/* crypto-message.ts ** extend Amqp.Message class to support encryption
 * 2018-04-11 ** by Ab Reitsma
 */
import * as crypto from "crypto";
import * as Amqp from "amqp-ts";

import { Key } from "./key";
import { KeyManager, KEYID_LENGTH } from "./key-manager";
import { Log } from "./log";

/* encrypted message format with AES-256-GCM:
 * [8 bytes keyId (optional)][16 bytes initialisationVector][16 bytes tag][encryptedData]
 * - keyId: TODO: an id of the decryption key that must be used,
 * - initialisationVector: needed for the decryption of the encryptedData
 * - encryptedData: data to be decrypted
 */
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
export const KEY_LENGTH = 32;

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
 * @returns void (used as a CryptoMessage method)
 */
function encrypt(using: Key | KeyManager) {
    const key = (using instanceof Key) ? using : using.getEncryptionKey();

    // also encrypt message properties
    const metadata = Buffer.from(JSON.stringify({
        p: this.properties,
        r: this.fields ? this.fields.routingKey : undefined
    }), "utf8");

    const metadataSize = Buffer.allocUnsafe(2);
    if(metadata.length > 65535) {
        throw new Error("Metadata too large (>64K)");
    }
    metadataSize.writeUInt16LE(metadata.length, 0);
    const data = Buffer.concat([metadataSize, metadata, this.content]);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key.key, iv);
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    const msgType = Buffer.from("M", "utf8");
    const msgElements = (using instanceof Key) ?  [iv, tag, encryptedData] : [msgType, key.id, iv, tag, encryptedData];
    const encryptedMessage = Buffer.concat(msgElements);
    this.content = encryptedMessage;
    this.properties = {};
    this.fields = undefined;
}

/**
 * Decrypt an encryptedMessage to data with given key
 * @param key string | Buffer encryption key
 * @returns routingKey, if there is one
 */
function decrypt(using: Key | KeyManager) {
    let offset = 0;
    let key: Key;
    const encryptedMessage = this.content;
    if (using instanceof KeyManager) {
        // expect msgType to be message 'M'
        const msgType = encryptedMessage.toString("utf8", offset, offset += 1);
        if(msgType !== "M") {
            throw Error("Not an encrypted managed message");        }
        // expect keyid in encrypted message
        const keyId = encryptedMessage.slice(offset, offset += KEYID_LENGTH);
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
    const decryptedBuf = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    const metadataSize = decryptedBuf.readUInt16LE(0);
    const metadataString = decryptedBuf.toString("utf8", 2, metadataSize + 2);
    const metadata = JSON.parse(metadataString);
    this.properties = metadata.p;
    const data = decryptedBuf.slice(metadataSize + 2);
    this.content = data;

    return metadata.r;
}

export default CryptoMessage;
