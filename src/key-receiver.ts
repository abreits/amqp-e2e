/* key-receiver.ts ** class to receive and decrypt the keys sent with key-distributor
 * 2018-04-25 by Ab Reitsma
 * */

import * as fs from "fs";
import * as path from "path";

const MAX_DATE = new Date(8640000000000000);
const MIN_DATE = new Date(-8640000000000000);

import { AmqpConnection } from "./amqp-connection";
import { RsaKey } from "./rsa-key";
import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { Log } from "./log";

export interface KeyReceiverDefinition {
    key: string; // filename of the receiver rsa public key pem file
    startDate?: string | number; // UTC date-time, if not defined always start
    endDate?: string | number; // UTC date-time, if not defined never end
    resend?: boolean; // for key-distributor, if true, resend key to this receiver
}

export interface KeyReceiverDefinitions {
    startpoint?: KeyReceiverDefinition;
    endpoint: KeyReceiverDefinition[];  
    
    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, default is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes
}

export interface FullKeyReceiverDefinition {
    connection: AmqpConnection; // receive key udates from
    senderKey: RsaKey; // rsa public key of the sender
    receiverKey: RsaKey; // rsa public and private keys of the receiver
    keyManager: KeyManager; // keep track of the keys
}

export class KeyReceiver {
    senderKey: RsaKey; // rsa public key of the sender
    receiverKey: RsaKey; // rsa public and private keys of the receiver
    keyManager?: KeyManager;
    startDate?: Date; // if not defined always start
    endDate?: Date; // if not defined keeps running
    resend?: boolean; // for key-distributor, if true, resend key to this receiver
    encrypt?: boolean; // for key-distributor, if true, for encrypt, if not for decrypt (default)

    static create(config: KeyReceiverDefinition, receiverDir: string) {
        Log.debug("Creating KeyReceiver", {config: config});
        const receiver = new KeyReceiver();
        try {
            receiver.receiverKey = new RsaKey(fs.readFileSync(path.join(receiverDir, config.key), "utf8"));
        } catch (e) {
            console.log(e);
            console.log(path.join(receiverDir, config.key));
            Log.error("Rsa Public Key not found");
            throw new Error("Rsa Public Key not found");
        }
        if (config.startDate) {
            try {
                receiver.startDate = new Date(config.startDate);
            } catch {
                Log.error("Unrecognisable startDate, use UTC", config.startDate);
                throw new Error("Unrecognisable startDate, use UTC");
            }
        } else {
            receiver.startDate = MIN_DATE;
        }
        if (config.endDate) {
            try {
                receiver.endDate = new Date(config.endDate);
            } catch {
                Log.error("Unrecognisable endDate, use UTC", config.endDate);
                throw new Error("Unrecognisable endDate, use UTC");
            }
        } else {
            receiver.endDate = MAX_DATE;
        }
        receiver.resend = config.resend;
        return receiver;
    }

    static createFull(def: FullKeyReceiverDefinition) {
        const receiver = new KeyReceiver();
        receiver.receiverKey = def.receiverKey;
        receiver.senderKey = def.senderKey;
        receiver.keyManager = def.keyManager;

        return receiver;
    }

    get id(): string {
        return this.receiverKey.hash.toString("hex");
    }

    addKey(buf: Buffer) {
        this.keyManager.add(Key.decrypt(buf, this.receiverKey, this.senderKey));
    }
}
