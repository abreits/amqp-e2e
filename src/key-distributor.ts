/* key-distributor.ts ** class to encrypt and sign keys with RSA for distribution
 * 2018-04-20 by Ab Reitsma
 * */

import * as fs from "fs";
import * as Amqp from "amqp-ts";

const MAX_DATE = new Date(8640000000000000);
const MIN_DATE = new Date(-8640000000000000);

import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { AmqpConnection } from "./amqp-connection";
import { RsaKey } from "./rsa-key";
import { KeyReceiver, KeyReceiverDefinitions } from "./key-receiver";
import { Log } from "./log";
import { getFile } from "./crypto-shovel";

export interface KeyDistributorConfig {
    connection?: AmqpConnection; // send keys to
    rsaKey: RsaKey; // rsa key of the sender
    remoteDir?: string; // full path of the directory where all receivers public key files can be found
    remoteConfigFile?: string; // receivers definition json filename, defaults to receivers.json

    keyRotationInterval?: number; //force new key to be used after .. ms, default every 24 hours, 0 is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms (default 1 hour)
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent  (default 55 minutes)
}

export class KeyDistributor {
    protected started = false;
    protected filewatcher: fs.FSWatcher;
    protected lastFileChange: Date = MIN_DATE;
    //semi constants
    protected keyRotationInterval; // force new key to be used after .. ms, default every 24 hours, 0 is never
    protected startUpdateWindow; // when, before new key activates, to start sending new keys to receivers in ms (default 1 hour)
    protected endUpdateWindow; // when, before new key activates, all new keys should be sent  (default 55 minutes)

    protected connection: AmqpConnection;
    protected rsaKey: RsaKey;
    protected keyReceiverRsaKeyFolder: string; // folder where all receivers public keys files can be found, defaults to "/config/rsakeys/"
    protected keyReceiverConfigFile: string; // receivers definition json filename, defaults to "/config/receivers.json"

    constructor(config: KeyDistributorConfig) {
        this.connection = config.connection;
        this.rsaKey = config.rsaKey;
        this.keyReceiverRsaKeyFolder = config.remoteDir || "${configRoot}/remote";
        this.keyReceiverConfigFile = config.remoteConfigFile || "${configRoot}/remote/config.json";
        this.keyRotationInterval = config.keyRotationInterval ? config.keyRotationInterval : 24 * 3600000;
        this.startUpdateWindow = config.startUpdateWindow ? config.startUpdateWindow : 3600000;
        this.endUpdateWindow = config.endUpdateWindow ? config.endUpdateWindow : 3300000;
    }

    start(connection?: AmqpConnection) {
        Log.debug("Starting key distributor", { rsaKeyFolder: this.keyReceiverRsaKeyFolder, configFile: this.keyReceiverConfigFile });
        if (connection) {
            this.connection = connection;
        }
        this.nextKey = null;
        this.nextKeySent = new Map();
        this.nextKeyNotSent = new Map();
        this.activeReceivers = new Map();
        this.started = true;
        this.processkeyReceiverConfigFile();
        this.filewatcher = fs.watch(this.keyReceiverConfigFile, null, this.watchkeyReceiverConfigFile);
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.filewatcher) {
            this.filewatcher.close();
            this.filewatcher = null;
        }
        this.started = false;
    }

    protected lastReceivers: string;
    protected decryptReceivers: Map<string, KeyReceiver> = new Map;
    protected activeReceivers: Map<string, KeyReceiver> = new Map;

    readonly keys = new KeyManager();
    protected activeKey: Key;
    protected activeKeyChangeTime: Date;

    protected nextKey: Key;
    protected nextKeySent: Map<string, KeyReceiver> = new Map;
    protected nextKeyNotSent: Map<string, KeyReceiver> = new Map;

    protected timer: any;

    getActiveKey() {
        return this.keys.getEncryptionKey();
    }

    getActiveReceiversOn(date: Date) {
        const activeReceivers = new Map();
        for (let [name, receiver] of this.decryptReceivers) {
            if (receiver.startDate <= date && receiver.endDate > date) {
                activeReceivers.set(name, receiver);
            }
        }
        return activeReceivers;
    }

    watchkeyReceiverConfigFile = () => {
        // console.log("Config file changed: " + this.receiverFile);
        this.processkeyReceiverConfigFile();
    }

    processkeyReceiverConfigFile = () => {
        let newKeyRotationInterval;
        const newReceivers: Map<string, KeyReceiver> = new Map;
        try {
            //const configString = fs.readFileSync(this.keyReceiverConfigFile, "utf8");
            const configString = getFile(this.keyReceiverConfigFile);
            // check if config file really changed (some OSes call this multiple times for a single file change)
            if (((Date.now() - this.lastFileChange.getTime()) < 100) && configString === this.lastReceivers) {
                this.lastFileChange = new Date();
                return;
            } else {
                this.lastFileChange = new Date();
                this.lastReceivers = configString;
            }
            // console.log("Reading file ", fullFileName);
            const config = JSON.parse(configString) as KeyReceiverDefinitions;

            newKeyRotationInterval = config.keyRotationInterval;
            if (config.startUpdateWindow) {
                this.startUpdateWindow = config.startUpdateWindow;
            }
            if (config.endUpdateWindow) {
                this.endUpdateWindow = config.endUpdateWindow;
            }

            const encryptReceiver = config.startpoint;
            const decryptReceivers = config.endpoint;
            for (let i = 0; i < decryptReceivers.length; i += 1) {
                const receiver = KeyReceiver.create(decryptReceivers[i], this.keyReceiverRsaKeyFolder);
                newReceivers.set(receiver.id, receiver);
            }
            // add the encryption receiver, if it exists
            if (encryptReceiver) {
                const receiver = KeyReceiver.create(encryptReceiver, this.keyReceiverRsaKeyFolder);
                newReceivers.set(receiver.id, receiver);
            }
        } catch (e) {
            Log.error("Error reading file ", {errot: e, configFile: this.keyReceiverConfigFile, rsaKeyFilder: this.keyReceiverRsaKeyFolder});
        }

        // update key rotation interval?
        if (newKeyRotationInterval && newKeyRotationInterval !== this.keyRotationInterval) {
            this.keyRotationInterval = newKeyRotationInterval;
            // interval changed, start new interval (with new key)
            this.activeKeyChangeTime = new Date();
            return this.updateNow();
        }

        // save old status for comparison
        const oldActiveReceivers = this.activeReceivers;
        this.decryptReceivers = newReceivers;
        this.activeReceivers = this.getActiveReceiversOn(new Date());

        // if not started we are done
        if (!this.started) {
            return;
        }
        // check if we are updating keys at the moment
        if (this.nextKey) {
            // remove all receivers that must be resent from this.nextKeysent
            for (let [id, receiver] of this.decryptReceivers) {
                if (receiver.resend) {
                    this.nextKeySent.delete(id);
                }
            }
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
                    this.nextKeyNotSent.set(name, receiver);
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
            // check if there are new receivers active, or receivers that need their key resent
            for (let [name, receiver] of this.activeReceivers) {
                if (!oldActiveReceivers.get(name) || receiver.resend) {
                    this.nextKeyNotSent.set(name, receiver);
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
        this.setTimeout(0);
        return;
    }

    protected onTimeout = () => {
        this.timer = null;
        let waitPeriod;
        if (!this.nextKey) {
            // create new key to be the next key
            this.nextKey = Key.create();
            this.nextKey.startDate = this.activeKeyChangeTime;
            this.nextKey.endDate = this.nextActiveKeyChangetime;
            this.keys.cleanup();
            this.keys.add(this.nextKey);
            this.nextKeySent.clear();
            this.nextKeyNotSent = this.getActiveReceiversOn(this.activeKeyChangeTime);
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
                this.activeKeyChangeTime = this.nextActiveKeyChangetime;
                waitPeriod = this.activeKeyChangeTime.getTime() - Date.now() - this.startUpdateWindow;
            } else {
                // wait until next key active
                waitPeriod = timeUntilNextKeyActive;
            }
        } else {
            // spread out key distribution to receivers in the remaining period
            if (this.nextKeyNotSent.size > 0) {
                // send to first receiver in the map
                let [name, receiver] = this.nextKeyNotSent.entries().next().value;
                this.sendNextKey(receiver);
                this.nextKeySent.set(name, receiver);
                this.nextKeyNotSent.delete(name);
            }
            timeUntilNextKeyActive = this.activeKeyChangeTime.getTime() - Date.now();
            if (this.nextKeyNotSent.size > 0) {
                // still keys to send, wait until we can send next key
                let updateRange = timeUntilNextKeyActive - this.endUpdateWindow;
                updateRange = updateRange < 0 ? 0 : updateRange;
                waitPeriod = updateRange / this.nextKeyNotSent.size;
                // console.log("Keys not sent: " + this.nextKeyNotSent.size);
                // console.log("interval to send in: " + updateRange);
                // console.log("now waiting for: ", waitPeriod);
            } else {
                // all keys sent, wait until next key active
                waitPeriod = timeUntilNextKeyActive;
                // console.log("all keys sent, waiting for next key change: ", waitPeriod);
            }
        }
        // set next timeout
        // waitPeriod = waitPeriod < 0 ? 0 : waitPeriod;
        // this.timer = setTimeout(this.onTimeout, waitPeriod);
        this.setTimeout(waitPeriod);
    }

    protected setTimeout(waitPeriod: number) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        waitPeriod = waitPeriod < 0 ? 0 : waitPeriod;
        this.timer = setTimeout(this.onTimeout, waitPeriod);
    }

    protected sendNextKey(receiver: KeyReceiver) {
        const message = new Amqp.Message(this.nextKey.encrypt(receiver.receiverKey, this.rsaKey));
        if (this.connection) {
            Log.debug("Sending key to receiver", receiver);
            this.connection.send(message);
        } else {
            Log.warn("Unable to send message, no connection defined", this);
        }
    }

    get nextActiveKeyChangetime(): Date {
        let nextTime = new Date(MAX_DATE);
        if (this.keyRotationInterval) {
            nextTime.setTime(this.activeKeyChangeTime.getTime() + this.keyRotationInterval);
        }
        for (let [name, receiver] of this.decryptReceivers) {
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
