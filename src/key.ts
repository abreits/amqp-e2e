/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";
import * as fs from "fs";

import { RsaKey } from "./rsa-key";
import { KEY_LENGTH } from "./crypto-message";

const MAX_DATE = new Date(8640000000000000);
const MIN_DATE = new Date(-8640000000000000);
/**
 *  key class, defines a new key and initializes it with a random key and id
 */
export class Key {
    id: Buffer; // 8 byte buffer
    key: Buffer; // 32 byte buffer
    startDate: Date; // DateTime when to activate this key as the active key for encryption
    endDate: Date; //DateTime when to deactivate again
    created: Date;

    private toEncrypt: Buffer;
    private sign: Buffer;

    static create(key?: Buffer, id?: Buffer, created?: Date) {
        let newKey = new Key();
        newKey.key = key ? key : crypto.randomBytes(KEY_LENGTH);
        newKey.id = id;
        newKey.created = created ? created : new Date();
        return newKey;
    }

    static import(exportString) {
        let parsed = JSON.parse(exportString);
        let key = new Key();
        if (parsed.i) {
            key.id = new Buffer(parsed.i, "base64");
        }
        key.key = new Buffer(parsed.k, "base64");
        if (parsed.s) {
            key.startDate = new Date(parsed.s);
        }
        if (parsed.e) {
            key.endDate = new Date(parsed.e);
        }
        key.created = new Date(parsed.c);

        return key;
    }

    export() {
        let s = "{";
        s += this.id ? "\"i\":\"" + this.id.toString("base64") + "\"," : "";
        s += "\"k\":\"" + this.key.toString("base64") + "\",";
        s += this.startDate ? "\"s\":" + this.startDate.getTime() + "," : "";
        s += this.endDate ? "\"e\":" + this.endDate.getTime() + "," : "";
        s += "\"c\":" + this.created.getTime() + "}";

        return s;
    }

    encrypt(encryptKey: RsaKey, signKey: RsaKey) {
        // only collect the content to encrypt once for all receivers
        if (!this.toEncrypt) {
            // should have a key and an id
            if (!this.id || !this.key) {
                throw new Error("Trying to encrypt incomplete Key");
            }
            const activateOff = Buffer.allocUnsafe(8);
            activateOff.writeDoubleLE((this.endDate ? this.endDate : MAX_DATE).getTime(), 0);
            this.toEncrypt = Buffer.concat([activateOff, this.key, this.id]);
        }
        // only compute the sign for the content to encrypt once for all receivers
        if (!this.sign) {
            this.sign = signKey.sign(this.toEncrypt);
        }
        const encrypted = encryptKey.publicEncrypt(this.toEncrypt);
        const encryptedSize = Buffer.allocUnsafe(2);
        encryptedSize.writeUInt16LE(encrypted.length, 0);
        const msgType = Buffer.from("K", "utf8");
        const receiver = encryptKey.hash;
        return (Buffer.concat([msgType, receiver, encryptedSize, encrypted, this.sign]));
    }

    /**
     * to clean encrypt cache
     */
    flushEncrypt() {
        this.toEncrypt = null;
        this.sign = null;
    }

    static decrypt(encrypted: Buffer, decryptKey: RsaKey, verifyKey: RsaKey) {
        const msgType = encrypted.toString("utf8", 0, 1);
        if (msgType !== "K") {
            throw new Error("Not a key");
        }
        const receiver = encrypted.slice(1, 17);
        if (receiver.compare(decryptKey.hash) !== 0) {
            // log key not intended for this receiver
            return null;
        }
        const encryptedSize = encrypted.readUInt16LE(17);
        const decrypted = decryptKey.privateDecrypt(encrypted.slice(19, encryptedSize + 19));
        if(verifyKey.verify(decrypted, encrypted.slice(encryptedSize + 19))) {
            const key = new Key();
            key.endDate = new Date(decrypted.readDoubleLE(0));
            key.key = decrypted.slice(8, 40);
            key.id = decrypted.slice(40);
            return key;
        } else {
            throw new Error("Key signature failed!");
        }
    }
}
