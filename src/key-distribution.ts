/* key-distribution.ts ** class to encrypt and sign keys with RSA for distribution
 * 2018-04-20 by Ab Reitsma
 * */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as Amqp from "amqp-ts";

const MAX_DATE = new Date(8640000000000000);
const MIN_DATE = new Date(-8640000000000000);

import { KEY_LENGTH } from "./crypto-message";
import { Key } from "./key";
import { KeyManager, KEYID_LENGTH } from "./key-manager";
import { AmqpConnection, ConnectionDefinition } from "./amqp-connection";
import { RsaKey } from "./rsa-key";

/*
 * Only once:
 * Passwordless RSA private and public key generated on sender
 * Passwordless RSA private and public key generated on each receiver
 *
 * Public key sender distributed safely to each receiver
 * Public keys of all receivers added to receiver configuration file (json)
 */

/* process for receiver:
 *  message receive loop:
 *      - if message contains encryption key for me
 *          - decrypt key with my private key and add it to the key manager
 *      - else
 *          - decrypt message and forward to destination
 */

/* process for sender:
 *  - startup initialization:
 *      - parse <receiver configuration file>
 *      - if active receivers available
 *          - create new <inactive encryption key>
 *          - create <receiver list> of active receivers to notify
 *          - send new <inactive encryption key> to remaining receivers on the list
 *          - activate new inactive encryption key
 *      - compute time for first <key change publication>
 *          ((de)activation of receiver or keychange time) - key notify period
 *      - compute timeout for first <key change publication>
 *      - start timeout
 *      - start file system watcher for <receiver configuration file> (json)
 *      - start forwarding encrypted messages with active key
 *
 *  - on timeout:
 *      - if no <inactive encryption key> exists
 *          - create new <inactive encryption key>
 *          - create <receiver list> of active receivers to notify
 *      - if <key change> time now or already passed:
 *          - send new <inactive encryption key> to all receivers on the <receiver list>
 *          - activate new <inactive encryption> key
 *          - compute time for next <key change>
 *          - compute time for next <key change publication>
 *          - compute timeout for next <key change publication>
 *      - else if list is not empty:
 *          - send key to first receiver on the <receiver list>
 *          - remove first receiver from the <receiver list>
 *          - compute timeout for next receiver key send
 *      - else:
 *          - compute timeout for <key change> time
 *       - start timeout
 *
 *  - on file change:
 *      - parse <receiver configuration file> and compare with current state
 *      - if <inactive encryption key> exists // busy updating
 *          - if active receiver(s) deactivated:
 *              - clear <inactive encryption key>
 *          - else if new active receiver(s) added:
 *              - add new active receivers to <receiver list>
 *          - set <key change> to now
 *          - disable current timeout
 *          - set timeout to 0
 *      - else
 *          - compute time for next <key change publication>
 *          - compute timeout for next <key change publication>
 *      - start timeout
 *
 */

interface StartpointDefinition {
    connection: ConnectionDefinition;
    publicKeyFile: string; // filename of the file containing the public key in PEM format
    privateKeyFile: string; // filename of the file containing the private key in PEM format
}

class Startpoint {
    connection: AmqpConnection;
    key: RsaKey; // filename of the file containing the public key in PEM format
}


interface EndpointDefinition {
    publicKeyFile: string; // filename of the file containing the public key in PEM format
    privateKeyFile?: string; // filename of the file containing the private key in PEM format
    startDate?: string | number; // UTC date-time, if not defined always start
    endDate?: string | number; // UTC date-time, if not defined never end
}

class Endpoint {
    static keyDirectory = "";

    key: RsaKey; // contains the public key in PEM format
    startDate: Date; // if not defined always start
    endDate: Date; // if not defined keeps running

    get name(): string {
        return this.key.hash.toString("hex");
    }

    constructor(definition: EndpointDefinition) {
        try {
            this.key = new RsaKey(fs.readFileSync(definition.publicKeyFile, "utf8"));
        } catch {
            throw new Error("Error reading public key file");
        }
        if (definition.startDate) {
            try {
                this.startDate = new Date(definition.startDate);
            } catch {
                throw new Error("Illegal startDate defined");
            }
        } else {
            this.startDate = MIN_DATE;
        }
        if (definition.endDate) {
            try {
                this.endDate = new Date(definition.endDate);
            } catch {
                throw new Error("Illegal endDate defined");
            }
        } else {
            this.startDate = MAX_DATE;
        }
    }
}

export class KeyDistributor {
    //semi constants
    protected sender: Startpoint;
    protected startNewKeySendRange = 3600000; // start sending new keys to the receivers in ms (default 1 hour)
    protected endNewKeySendRange = 1800000; // all new keys should be sent when this interval starts (default 1/2 hour)
    // protected newKeyNotifyRepetitons = 1; // future update?
    protected keyRotationInterval = 24 * 3600000; //force new key to be used after .. ms, default every 24 hours, 0 is never
    protected receiverDefinitionFile: string; // path to the receiver definition json file

    protected receivers: Map<string, Endpoint> = new Map;
    protected activeReceivers: Map<string, Endpoint> = new Map;

    protected keys: KeyManager;
    protected activeKey: Key;
    protected activeKeyChangeTime: Date;

    protected nextKey: Key;
    protected nextKeySent: Map<string, Endpoint> = new Map;
    protected nextKeyNotSent: Map<string, Endpoint> = new Map;

    protected timer: any;

    getActiveReceiversOn(date: Date) {
        const activeReceivers = new Map();
        for (let [name, receiver] of this.receivers) {
            if (receiver.startDate <= date && receiver.endDate > date) {
                activeReceivers.set(name, receiver);
            }
        }
        return activeReceivers;
    }

    processReceiverConfigFile() {
        const newReceivers: Map<string, Endpoint> = new Map;
        try {
            const receiverDefinitionString = fs.readFileSync(this.receiverDefinitionFile, "utf8");
            const receiverDefinitions = JSON.parse(receiverDefinitionString) as EndpointDefinition[];
            for (let i = 0; i < receiverDefinitions.length; i += 1) {
                const receiver = new Endpoint(receiverDefinitions[i]);
                newReceivers[receiver.name] = receiver;
            }
        } catch {
            //todo: log error parsing receiver config file
        }
        // save old status for comparison
        const oldReceivers = this.receivers;
        const oldActiveReceivers = this.activeReceivers;
        this.receivers = newReceivers;
        this.activeReceivers = this.getActiveReceiversOn(new Date());

        // check if we are updating keys at the moment
        if (this.nextKey) {
            // check if we have already updated receivers that are no longer defined or active
            for (let [name, receiver] of this.nextKeySent) {
                if (!this.activeReceivers.get(name)) {
                    // found a receiver that no longer is active: force distribution of new keys
                    this.nextKey = null; // create new key!
                    return this.updateNow();
                }
            }
            // recompute nextKeyNotReceived
            this.nextKeyNotSent.clear();
            for (let [name, receiver] of this.activeReceivers) {
                if (!this.nextKeySent.get(name)) {
                    this.nextKeyNotSent[name] = receiver;
                }
            }
            if (this.nextKeyNotSent.size > 0) {
                // new receiver now active, use same key and force rest to be done now
                return this.updateNow();
            }
        } else {
            // check if there are receivers that are no longer active
            for (let [name, receiver] of oldActiveReceivers) {
                if (!this.activeReceivers.get(name)) {
                    return this.updateNow();
                }
            }
            // check if there are new receivers active
            for (let [name, receiver] of this.activeReceivers) {
                if (!oldActiveReceivers.get(name)) {
                    this.nextKeyNotSent[name] = receiver;
                }
            }
            if (this.nextKeyNotSent.size > 0) {
                // update new receivers with current keys
                this.nextKey = this.activeKey;
                return this.updateNow();
            }
        }
    }

    protected updateNow() {
        this.activeKeyChangeTime = new Date();
        clearTimeout(this.timer);
        this.timer = setImmediate(this.onTimeout);
        return;
    }

    onTimeout = () => {
        if (!this.nextKey) {
            // create new key to be the next key
            this.nextKey = Key.create();
            this.nextKey.startDate = this.activeKeyChangeTime;
            this.nextKey.endDate = this.nextActiveKeyChangetime;
            this.keys.add(this.nextKey);
            this.nextKeySent.clear();
            this.nextKeyNotSent = this.getActiveReceiversOn(this.activeKeyChangeTime);
        }
        // check how much time we have to distribute the keys
        let timeUntilNextKeyActive = this.activeKeyChangeTime.getTime() - Date.now();
        if (timeUntilNextKeyActive <= this.endNewKeySendRange) {
            // at the ned of the key send interval, send all remaining key updates to the receivers now!
            for (let [name, receiver] of this.nextKeyNotSent) {
                this.sendNextKey(receiver);
                this.nextKeySent.set(name, receiver);
            }
            this.nextKeyNotSent.clear();
        } else {
            // spread out key distribution to receivers in the remaining period
            if (this.nextKeyNotSent.size > 0) {
                // send to first receiver in the map
                let [name, receiver] = this.nextKeyNotSent.entries().next().value;
                this.sendNextKey(receiver);
                this.nextKeySent.set(name, receiver);
                this.nextKeySent.delete(name);
            }
            timeUntilNextKeyActive = this.activeKeyChangeTime.getTime() - Date.now();
            if (this.nextKeyNotSent.size > 0) {
                // still keys to send, wait until we can send next key
                let updateRange = timeUntilNextKeyActive - this.endNewKeySendRange;
                updateRange = updateRange < 0 ? 0 : updateRange;
                this.timer = setTimeout(this.onTimeout, updateRange / this.nextKeyNotSent.size);
            } else {
                // all keys sent, wait until next key active
                this.timer = setTimeout(timeUntilNextKeyActive);
            }

        }

    }

    sendNextKey(receiver) {
        const message = new Amqp.Message(this.nextKey.encrypt(receiver.key, this.sender.key));
        this.sender.connection.send(message);
    }

    get nextActiveKeyChangetime(): Date {
        let nextTime = new Date(MAX_DATE);
        if (this.keyRotationInterval) {
            nextTime.setTime(this.activeKeyChangeTime.getTime() + this.keyRotationInterval);
        }
        for (let [name, receiver] of this.receivers) {
            if (receiver.startDate > this.activeKeyChangeTime && receiver.startDate < nextTime) {
                nextTime = receiver.startDate;
            }
            if (receiver.endDate > this.activeKeyChangeTime && receiver.endDate < nextTime) {
                nextTime = receiver.endDate;
            }
        }

        return nextTime;
    }
}
