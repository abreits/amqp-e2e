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

export interface KeyReceiverDefinition {
    key: string; // filename of the receiver rsa public key pem file
    startDate?: string | number; // UTC date-time, if not defined always start
    endDate?: string | number; // UTC date-time, if not defined never end
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

    static create(config: KeyReceiverDefinition, receiverDir: string) {
        const receiver = new KeyReceiver();
        try {
            receiver.receiverKey = new RsaKey(fs.readFileSync(path.join(receiverDir, config.key), "utf8"));
        } catch (e) {
            console.log(e);
            console.log(path.join(receiverDir, config.key));
            throw new Error("Rsa Public Key not found");
        }
        if (config.startDate) {
            try {
                receiver.startDate = new Date(config.startDate);
            } catch {
                throw new Error("Unrecognisable startDate, use UTC");
            }
        } else {
            receiver.startDate = MIN_DATE;
        }
        if (config.endDate) {
            try {
                receiver.endDate = new Date(config.endDate);
            } catch {
                throw new Error("Unrecognisable endDate, use UTC");
            }
        } else {
            receiver.endDate = MAX_DATE;
        }
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
