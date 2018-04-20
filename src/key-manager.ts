/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";
import * as fs from "fs";

import { Key } from "./key";

export const KEYID_LENGTH = 8;

type PersistFormat = {
    l: string[],
    e?: string
};
/**
 *  KeyManager class, with persistance to file
 */
export class KeyManager {
    protected keys: { [lookup: string]: Key } = {};
    protected encryptionKey: Key;
    protected persistFile: string;

    /**
     *
     * @param persistFile file location to get/store json persistent version of the keymanager contents
     */
    constructor(persistFile?: string) {
        if (persistFile) {
            this.persistFile = persistFile;
            if (fs.existsSync(this.persistFile)) {
                try {
                    let persistText = fs.readFileSync(this.persistFile, { encoding: "utf8" });
                    let parsed: PersistFormat = JSON.parse(persistText);
                    if (parsed && parsed.l) {
                        for (let i = 0; i < parsed.l.length; i += 1) {
                            this.add(Key.import(parsed.l[i]));
                        }
                    }
                    if (parsed && parsed.e) {
                        this.setEncryptionKey(this.get(new Buffer(parsed.e, "base64")));
                    }
                } catch (e) {
                    throw new Error("Error importing KeyManager persistFile");
                }
            }
        }
    }

    persist() {
        let keyList: string[] = [];
        for (let lookup in this.keys) {
            keyList.push(this.keys[lookup].export());
        }
        let exportStruct: PersistFormat = { l: keyList };
        if (this.encryptionKey) {
            exportStruct.e = this.encryptionKey.id.toString("base64");
        }
        fs.writeFileSync(this.persistFile, JSON.stringify(exportStruct), { encoding: "utf8" });
    }

    add(key: Key) {
        if (!key.id) { // generate a key id if it iodes not exist
            do {
                key.id = crypto.randomBytes(KEYID_LENGTH);
            } while (this.get(key.id));
        }
        let lookup = key.id.toString("base64");
        this.keys[lookup] = key;
    }

    delete(key: Key) {
        let lookup = key.id.toString("base64");
        delete this.keys[lookup];
    }

    get(id: Buffer) {
        if (id) {
            let lookup = id.toString("base64");
            return this.keys[lookup];
        } else {
            throw new Error("Empty KeyManager id");
        }
    }

    getEncryptionKey() {
        return this.encryptionKey;
    }

    /**
     * If no key is supplied, sets the most recently added active key
     * (when current DateTime between activeteOn and activatOff) as active
     * @param key the Key to set as active
     */
    setEncryptionKey(key?: Key) {
        if (key) {
            if (this.get(key.id) === key) { // make sure the key exists inside the key manager
                this.encryptionKey = key;
            } else {
                throw new Error("key not in KeyManager");
            }
        } else {
            let created;
            this.encryptionKey = undefined;
            for (let lookup in this.keys) {
                const now = new Date();
                const key = this.keys[lookup];
                if ((!key.activateOn || key.activateOn) < now && (!key.activateOff || key.activateOff > now)) {
                    if (!created || created < key.created) {
                        created = key.created;
                        this.encryptionKey = key;
                    }
                }
            }
        }
        return this.encryptionKey;
    }

    /**
     * remove deactivated keys
     */
    cleanupKeys() {
        const now = new Date();

        for (let lookup in this.keys) {
            let key = this.keys[lookup];
            if (key.activateOff && key.activateOff >= now) {
                delete this.keys[lookup];
            }
        }
    }
}

