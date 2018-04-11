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

class AesCrypt {
    getKey: (keyId: number) => Buffer;

    encrypt(keyId: number, data: Buffer, initialisationVector?: string) {
        const key = this.getKey(keyId);

        let iv;
        if (initialisationVector) {
            iv = Buffer.from((initialisationVector + "               ").slice(0,16));
        } else {
            iv = crypto.randomBytes(IV_LENGTH);
        }

        const cypher = crypto.createCipheriv("aes-256-gcm", key, iv);

        const encryptedData = 0; // TODO!


    }
}