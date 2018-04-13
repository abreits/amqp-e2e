/* key-manager.ts ** a management class for cryptographic key management
 * 2018-04-13 by Ab Reitsma
 */
import * as crypto from "crypto";

export interface Key {
    id: Buffer;         // 8 byte buffer
    value: Buffer;      // 32 byte buffer
    ttl: number;        // time to live after activateUtc in seconds
    activateUtc: Date;  // startdate and time for using this key
}

// simple key-value implementation with persist to json file
export class KeyManager {
    private keyList: {[id: string]: Buffer};
    private currentKeyId: string;

    constructor () {
        // when to generate new keys, when to forget old keys
    }

    /**
     * adds key to dictionary, throws error if key already exists
     * @param key 32 byte Buffer
     * @param id 8 byte Buffer
     */
    addKey (key: Buffer, id: Buffer) {
        let lookup = id.toString("base64");
        if(!this.keyList[lookup]) {
            this.keyList[lookup] = key;
        } else {
            throw new Error("Key id already exists!");
        }
    }

    /**
     * replaces or adds key to dictionary
     * @param key 32 byte Buffer
     * @param id 8 byte Buffer
     */
    replaceKey (key: Buffer, id: Buffer) {
        let lookup = id.toString("base64");
        this.keyList[lookup] = key;
    }

    /**
     * removes key from dictionary
     * @param id 8 byte Buffer
     */
    removeKey (id: Buffer) {
        let lookup = id.toString("base64");
        delete this.keyList[lookup];
    }

    /**
     * sets the current (encryption) key to this id
     * @param id 8 byte buffer
     */
    setKey (id: Buffer) {
        let lookup = id.toString("base64");
        this.currentKeyId = lookup;
    }

    /**
     * gets the key with id
     * @param id 8 byte buffer
     */
    getKey (id: Buffer) {
        let lookup = id.toString("base64");
        return this.currentKeyId[lookup];
    }

    get key() {
        return this.keyList[this.currentKeyId];
    }
}