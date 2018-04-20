/* crypto-message.ts ** extend Amqp.Message class to support encryption
 * 2018-04-11 ** by Ab Reitsma
 */
import * as crypto from "crypto";
import * as Amqp from "amqp-ts";

import { Key } from "./key";
import { KeyManager } from "./key-manager";

/* encrypted message format with AES-256-GCM:
 * [8 bytes keyId (optional)][16 bytes initialisationVector][16 bytes tag][encryptedData]
 * - keyId: TODO: an id of the decryption key that must be used,
 * - initialisationVector: needed for the decryption of the encryptedData
 * - encryptedData: data to be decrypted
 */
// these consts are also defined in the key and key-manager class for the moment
const KEYID_LENGTH = 8;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 *  extend Amqp.Message class to support encryption
 *  workaround: unable to tell Typescript to extend existing Amqp.Message class here
 *              so using CryptoMessage interface and typecasting
 */
export class CryptoMessage extends Amqp.Message {
    encrypt = encrypt;
    decrypt = decrypt;
}

function decorateWithCrypto(target: any) {
    target.prototype.encrypt = encrypt;
    target.prototype.decrypt = decrypt;
}

// decorate Amqp.Message class with encryption functions (only once)
let added = false;
export function addCryptoMessage() {
    if (!added) {
        decorateWithCrypto(Amqp.Message);
        added = true;
    }
}

/**
 * Encrypt data with given key into an encryptedMessage
 * @param key string | Buffer encryption key
 * @param initialisationVector string, optional, when provided must be unique for each call to prevent same data creating same encrypted message
 * @returns cryptoMessage, a Buffer with the encrypted message content
 */
function encrypt(using: Key | KeyManager) {
    const key = (using instanceof Key) ? using : using.getEncryptionKey();
    const data = this.content;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key.key, iv);
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    const msgElements = (using instanceof Key) ? [iv, tag, encryptedData] : [key.id, iv, tag, encryptedData];
    const encryptedMessage = Buffer.concat(msgElements);
    this.content = encryptedMessage;
}

/**
 * Decrypt an encryptedMessage to data with given key
 * @param key string | Buffer encryption key
 * @returns data, a Buffer with the decrypted message content
 */
function decrypt(using: Key | KeyManager) {
    let offset = 0;
    let key: Key;
    const encryptedMessage = this.content;
    if (using instanceof KeyManager) {
        // expect keyid in encrypted message
        const keyId = encryptedMessage.slice(0, offset += KEYID_LENGTH);
        key = using.get(keyId);
        if (key === undefined) {
            throw new Error("Key id does not exist");
        }
    } else {
        key = using;
    }

    const iv = encryptedMessage.slice(offset, offset += IV_LENGTH);
    const tag = encryptedMessage.slice(offset, offset += TAG_LENGTH);
    const encryptedData = encryptedMessage.slice(offset);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key.key, iv);
    decipher.setAuthTag(tag);
    const data = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    this.content = data;
}

export default CryptoMessage;
