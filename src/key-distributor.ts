/* key-distributor.ts ** class to encrypt and sign keys with RSA for distribution
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
import { KeyReceiver, KeyReceiverDefinition } from "./key-receiver";


export interface KeyDistributorSettings {
    sendTo: AmqpConnection;
    key: RsaKey; // rsa ke of the sender
    receiverDefinitionFile: string; // path to the receiver definition json file, defaults to receivers.json

    keyRotationInterval?: number; //force new key to be used after .. ms, default every 24 hours, 0 is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms (default 1 hour)
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent  (default 55 minutes)
}

export class KeyDistributor {
    //semi constants
    protected keyRotationInterval; //force new key to be used after .. ms, default every 24 hours, 0 is never
    protected startUpdateWindow; // when, before new key activates, to start sending new keys to receivers in ms (default 1 hour)
    protected endUpdateWindow; // when, before new key activates, all new keys should be sent  (default 55 minutes)

    protected to: AmqpConnection;
    protected key: RsaKey;
    protected receiverDefinitionFile: string; // path to the receiver definition json file

    constructor(settings: KeyDistributorSettings) {
        this.to = settings.sendTo;
        this.key = settings.key;
        this.receiverDefinitionFile = settings.receiverDefinitionFile;
        this.keyRotationInterval = settings.keyRotationInterval ? settings.keyRotationInterval : 24 * 3600000;
        this.startUpdateWindow = settings.startUpdateWindow ? settings.startUpdateWindow : 3600000;
        this.endUpdateWindow = settings.endUpdateWindow ? settings.endUpdateWindow : 3300000;
    }

    start() {
        this.nextKey = null;
        this.nextKeySent = new Map();
        this.nextKeyNotSent = new Map();
        this.activeReceivers = new Map();
        this.processReceiverConfigFile();
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    protected receivers: Map<string, KeyReceiver> = new Map;
    protected activeReceivers: Map<string, KeyReceiver> = new Map;

    protected keys: KeyManager;
    protected activeKey: Key;
    protected activeKeyChangeTime: Date;

    protected nextKey: Key;
    protected nextKeySent: Map<string, KeyReceiver> = new Map;
    protected nextKeyNotSent: Map<string, KeyReceiver> = new Map;

    protected timer: any;

    getActiveReceiversFor(date: Date) {
        const activeReceivers = new Map();
        for (let [name, receiver] of this.receivers) {
            if (receiver.startDate <= date && receiver.endDate > date) {
                activeReceivers.set(name, receiver);
            }
        }
        return activeReceivers;
    }

    processReceiverConfigFile() {
        const newReceivers: Map<string, KeyReceiver> = new Map;
        try {
            const receiverDefinitionString = fs.readFileSync(this.receiverDefinitionFile, "utf8");
            const receiverDefinitions = JSON.parse(receiverDefinitionString) as KeyReceiverDefinition[];
            for (let i = 0; i < receiverDefinitions.length; i += 1) {
                const receiver = new KeyReceiver(receiverDefinitions[i]);
                newReceivers[receiver.name] = receiver;
            }
        } catch {
            //todo: log error parsing receiver config file
        }
        // save old status for comparison
        const oldActiveReceivers = this.activeReceivers;
        this.receivers = newReceivers;
        this.activeReceivers = this.getActiveReceiversFor(new Date());

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
        let waitPeriod;
        if (!this.nextKey) {
            // create new key to be the next key
            this.nextKey = Key.create();
            this.nextKey.startDate = this.activeKeyChangeTime;
            this.nextKey.endDate = this.nextActiveKeyChangetime;
            this.keys.cleanup();
            this.keys.add(this.nextKey);
            this.nextKeySent.clear();
            this.nextKeyNotSent = this.getActiveReceiversFor(this.activeKeyChangeTime);
        }
        // check how much time we have to distribute the keys
        let timeUntilNextKeyActive = this.activeKeyChangeTime.getTime() - Date.now();
        if (timeUntilNextKeyActive <= this.endUpdateWindow) {
            // at the end of the key send interval, send all remaining key updates to the receivers now!
            for (let [name, receiver] of this.nextKeyNotSent) {
                this.sendNextKey(receiver);
                this.nextKeySent.set(name, receiver);
            }
            this.nextKeyNotSent.clear();
            if (timeUntilNextKeyActive <= 0) {
                // activate new key
                this.keys.setEncryptionKey(this.nextKey);
                this.activeKey = this.nextKey;
                this.nextKey = null;
                waitPeriod = Date.now() - this.nextActiveKeyChangetime.getTime();
            }
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
                let updateRange = timeUntilNextKeyActive - this.endUpdateWindow;
                updateRange = updateRange < 0 ? 0 : updateRange;
                waitPeriod = updateRange / this.nextKeyNotSent.size;
            } else {
                // all keys sent, wait until next key active
                waitPeriod = timeUntilNextKeyActive;
            }
        }
        // set next timeout
        waitPeriod = waitPeriod < 0 ? 0 : waitPeriod;
        this.timer = setTimeout(this.onTimeout, waitPeriod);
    }

    sendNextKey(receiver) {
        const message = new Amqp.Message(this.nextKey.encrypt(receiver.key, this.key));
        this.to.send(message);
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
