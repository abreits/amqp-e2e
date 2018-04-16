/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";

const KEYID_LENGTH = 8;
const KEY_LENGTH = 32;

/**
 *  key class, defines a new key and initializes it with a random key and id
 */
export class Key {
    id: Buffer; // 8 byte buffer
    key: Buffer; // 32 byte buffer
    activateOn: Date; // DateTime when to activate this key as the active key for encryption
    activateOff: Date; //DateTime when to deactivate again
    created: Date;

    constructor(forKeyManager?: KeyManager) {
        this.key = crypto.randomBytes(KEY_LENGTH);
        this.created = new Date();
        if (forKeyManager) {
            do {
                this.id = crypto.randomBytes(KEYID_LENGTH);
            } while (forKeyManager.get(this.id));
            forKeyManager.add(this);
        }

    }
}

/**
 *  KeyManager class
 */
export class KeyManager {
    protected keys: { [lookup: string]: Key } = {};
    protected encryptionKey: Key;

    add(key: Key) {
        let lookup = key.id.toString("base64");
        if (!this.keys[lookup]) {
            this.keys[lookup] = key;
        } else {
            throw new Error("Key id already exists");
        }
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
            if (this.get(key.id)) {
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
                if (key.activateOn < now && !key.activateOff || key.activateOff > now) {
                    if (!created || created < key.created) {
                        created = created;
                        this.encryptionKey = key;
                    }
                }
            }
        }
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

