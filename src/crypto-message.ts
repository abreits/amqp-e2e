/* crypto-message.ts ** extend Amqp.Message class to support encryption
 * 2018-04-11 ** by Ab Reitsma
 */

import * as crypto from "crypto";
import * as Amqp from "amqp-ts";

/* TODO: execute process
 *  1. read message from src exchange/queue
 *  2. encrypt/decrypt message
 *  3. send result to dest exchange/queue
 */

/* encrypted message format with AES-256-GCM:
 * [8 bytes keyId][16 bytes initialisationVector][16 bytes tag][encryptedData]
 * - keyId: TODO: an id of the decryption key that must be used,
 * - initialisationVector: needed for the decryption of the encryptedData
 * - encryptedData: data to be decrypted
 */
const IV_LENGTH = 16;

/**
 *  extend Amqp.Message class to support encryption
 */
export class CryptoMessage extends Amqp.Message {

    //static key: KeyManager;
    /**
     * Encrypt data with given key into an encryptedMessage
     * @param key string | Buffer encryption key
     * @param initialisationVector string, optional, when provided must be unique for each call to prevent same data creating same encrypted message
     * @returns cryptoMessage, a Buffer with the encrypted message content
     */
    encrypt (key: string | Buffer, initialisationVector?: string) {
        const data = this.content;
        let iv: Buffer;
        if (initialisationVector) {
            iv = Buffer.from(initialisationVector + "               ").slice(0, 16);
        } else {
            iv = crypto.randomBytes(16);
        }
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
        const encryptedMessage = Buffer.concat([iv, tag, encryptedData]);
        this.content = encryptedMessage;
    }

    /**
     * Decrypt an encryptedMessage to data with given key
     * @param key string | Buffer encryption key
     * @returns data, a Buffer with the decrypted message content
     */
    decrypt (key: string | Buffer) {
        const encryptedMessage = this.content;
        const iv = encryptedMessage.slice(0, 16);
        const tag = encryptedMessage.slice(16, 32);
        const encryptedData = encryptedMessage.slice(32);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const data = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        this.content = data;
    }
}

export default CryptoMessage;
