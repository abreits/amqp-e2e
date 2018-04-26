/* managed-crypto-shovel.ts ** extension of the simple-crypto-shovel that includes
 * can also send regularly update and send new AES keys to authenticated receivers
 * 2018-04-1 by Ab Reitsma
 */

import * as fs from "fs";
import * as Amqp from "amqp-ts";
import { AmqpConnection, ConnectionDefinition, ExchangeDefinition, QueueDefinition } from "./amqp-connection";
import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { KeyDistributor, KeyDistributorDefinition } from "./key-distributor";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
addCryptoMessage();


export interface ManagedShovelDefinition {
    encrypts: boolean;
    from: AmqpConnection;
    to: AmqpConnection;
    privateKeyFile: string; // path to private cert file of this shovel
    receiverConfigFolder?: string; // path to folder containing RSA public keys of receivers and receiver
    // config json files (RSA public key and config json have identical base filenames).
    startUpdateWindow?: number; // interval in ms to automatically update the AES key and send it to the active receivers
    endUpdateWindow?: number; // margin in ms between sending and using a new key
}

export class ManagedCryptoShovel {
    currentKey: Key;

    protected started: boolean;
    protected encrypts; // whether it is an encryption or a decryption shovel
    protected fromConfig: ConnectionDefinition;
    protected toConfig: ConnectionDefinition;
    protected from: AmqpConnection;
    protected to: AmqpConnection;

    constructor(configFileName: string) {
        // read file and parse json
        // TODO: error handling
        const configString = fs.readFileSync(configFileName, "utf8");
        const config = JSON.parse(configString);

        this.fromConfig = config.from;
        this.toConfig = config.to;
        this.currentKey = Key.create (null, Buffer.from(config.key, "hex"));
        this.encrypts = config.encrypts;
    }

    start() {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        if (this.encrypts) {
            this.from.onMessage(this.encryptAndSend);
        } else {
            this.from.onMessage(this.decryptAndSend);
        }
        // TODO: start monitoring (process) for key and receiver changes
    }

    stop() {
        return Promise.all([
            this.from.close(),
            this.to.close()
         ]);

    }

    get initialized(): Promise<any> {
        return Promise.all([
            this.from.connection.initialized,
            this.to.connection.initialized
         ]);
    }

    protected encryptAndSend = (message: CryptoMessage) => {
        message.encrypt(this.currentKey);
        this.to.send(message);
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        // TODO: check message type, if new key, add to keymanager
        message.decrypt(this.currentKey);
        this.to.send(message);
    }
}

export default ManagedCryptoShovel;