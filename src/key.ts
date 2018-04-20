/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";
import * as fs from "fs";

import { KEY_LENGTH } from "./crypto-message";

/**
 *  key class, defines a new key and initializes it with a random key and id
 */
export class Key {
    id: Buffer; // 8 byte buffer
    key: Buffer; // 32 byte buffer
    activateOn: Date; // DateTime when to activate this key as the active key for encryption
    activateOff: Date; //DateTime when to deactivate again
    created: Date;

    static create(key?: Buffer, id?: Buffer, created?: Date) {
        let newKey = new Key();
        newKey.key = key ? key : crypto.randomBytes(KEY_LENGTH);
        newKey.id = id;
        newKey.created = created ? created : new Date();
        return newKey;
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
}
