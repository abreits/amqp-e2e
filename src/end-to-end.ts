/* amqp-e2e.ts ** start the correct end to end encryption modules
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
 * [2 bytes keyId][16 bytes initialisationVector][encryptedData]
 * - keyId: an id of the decryption key that must be used,
 * - initialisationVector: needed for the decryption of the encryptedData
 * - encryptedData: data to be decrypted
 */
const IV_LENGTH = 16;

/**
 *  ent to end encryption/decryption support class
 */
class EndToEnd {
    /**
     * Encrypt data with given key into an encryptedMessage
     * @param data Buffer data to encrypt (binary)
     * @param key string | Buffer encryption key
     * @param initialisationVector string, optional, when provided must be unique for each call to prevent same data creating same encrypted message
     * @returns cryptoMessage, a Buffer with the encrypted message content
     */
    static encrypt(data: Buffer, key: string | Buffer, initialisationVector?: string) {
        let iv: Buffer;
        if (initialisationVector) {
            iv = Buffer.from(iv + "               ").slice(0, 16);
        } else {
            iv = crypto.randomBytes(16);
        }
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
        const encryptedMessage = Buffer.concat([iv, tag, encryptedData]);
        return encryptedMessage;
    }

    /**
     * Decrypt an encryptedMessage to data with given key
     * @param encryptedMessage Buffer encrypte message
     * @param key string | Buffer encryption key
     * @returns data, a Buffer with the decrypted message content
     */
    static decrypt(encryptedMessage: Buffer, key: string | Buffer) {
        const iv = encryptedMessage.slice(0, 16);
        const tag = encryptedMessage.slice(16, 32);
        const encryptedContent = encryptedMessage.slice(32);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const data = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
        return data;
    }
}

export default EndToEnd;
