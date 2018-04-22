/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";
import * as fs from "fs";

import { KEY_LENGTH } from "./crypto-message";

const MAX_DATE = new Date(738905609893065); //  2^47 (because we translate it to a six byte int)
const MIN_DATE = new Date(-738905609893065);
/**
 *  key class, defines a new key and initializes it with a random key and id
 */
export class Key {
    id: Buffer; // 8 byte buffer
    key: Buffer; // 32 byte buffer
    activateOn: Date; // DateTime when to activate this key as the active key for encryption
    activateOff: Date; //DateTime when to deactivate again
    created: Date;

    private toEncrypt: Buffer;
    private signed: Buffer;

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
        if (parsed.a) {
            key.activateOn = new Date(parsed.a);
        }
        if (parsed.d) {
            key.activateOff = new Date(parsed.d);
        }
        key.created = new Date(parsed.c);

        return key;
    }

    export() {
        let s = "{";
        s += this.id ? "\"i\":\"" + this.id.toString("base64") + "\"," : "";
        s += "\"k\":\"" + this.key.toString("base64") + "\",";
        s += this.activateOn ? "\"a\":" + this.activateOn.getTime() + "," : "";
        s += this.activateOff ? "\"d\":" + this.activateOff.getTime() + "," : "";
        s += "\"c\":" + this.created.getTime() + "}";

        return s;
    }

    encrypt(publicKey: string, privateKey: string) {
        if (!this.toEncrypt) {
            // should have a key and an id
            if (!this.id || !this.key) {
                throw new Error("Trying to encrypt incomplete Key");
            }
            const activateOff = Buffer.allocUnsafe(6);
            activateOff.writeIntLE((this.activateOff ? this.activateOff : MAX_DATE).getTime(), 0, 6);
            this.toEncrypt = Buffer.concat([activateOff, this.key, this.id]);
        }
        if (!this.signed) {
            const sign = crypto.createSign("SHA1");
            sign.update(this.toEncrypt);
            this.signed = sign.sign(privateKey);
        }
        // encrypted size is 256 bytes
        const encrypted = crypto.publicEncrypt(publicKey, this.toEncrypt);
        return (Buffer.concat([encrypted, this.signed]));
    }

    /**
     * to clean encrypt cache
     */
    flushEncrypt() {
        this.toEncrypt = null;
        this.signed = null;
    }

    static decrypt(encrypted: Buffer, privateKey: string, publicKey: string) {
        const decrypted = crypto.privateDecrypt(privateKey, encrypted.slice(0, 256));
        const verify = crypto.createVerify("SHA1");
        verify.update(decrypted);
        if(verify.verify(publicKey, encrypted.slice(256))) {
            const key = new Key();
            key.activateOff = new Date(decrypted.readIntLE(0,6));
            key.key = decrypted.slice(6, 38);
            key.id = decrypted.slice(38);
            return key;
        } else {
            throw new Error("Key signature failed!");
        }
    }
}
