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
import { KeyReceiver } from "./key-receiver";
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
    protected started: boolean;
    protected encrypts: boolean; // whether it is an encryption or a decryption shovel
    protected fromConfig: ConnectionDefinition;
    protected toConfig: ConnectionDefinition;
    protected from: AmqpConnection;
    protected to: AmqpConnection;
    protected keys: KeyManager;
    protected receiver: KeyReceiver;
    protected distributor: KeyDistributor;

    constructor(configFileName: string) {
        // read file and parse json
        // TODO: error handling
        const configString = fs.readFileSync(configFileName, "utf8");
        const config = JSON.parse(configString);

        this.fromConfig = config.from;
        this.toConfig = config.to;
        this.encrypts = config.encrypts;

        if (this.encrypts) {
            // prepare key-distributor
            this.distributor = new KeyDistributor({
                key: config.rsaKey,
                receiverPath: config.distributorPath,
                receiverFile: config.distributorFile,
                keyRotationInterval: config.keyrotationInterval,
                startUpdateWindow: config.startUpdateWindow,
                endUpdateWindow: config.endUpdateWindow
            });
        } else {
            // prepare key-receiver
        }
    }

    start() {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        if (this.encrypts) {
            this.distributor.connection = this.to;
            this.from.onMessage(this.encryptAndSend);
            this.distributor.start();
        } else {
            // todo setup receiver (process both key and content messages)
            // todo initialize keymanager (and read persisted key file)
            this.from.onMessage(this.decryptAndSend);
        }
    }

    stop() {
        this.distributor.stop();
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
        message.encrypt(this.keys.getEncryptionKey());
        this.to.send(message);
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        // TODO: check message type, if new key, add to keymanager
        if (message.content[0] === 75) { // 'K'
            // todo decrypt key and add to keymanager (and persist)
        } else {
            message.decrypt(this.keys);
            this.to.send(message);
        }
    }
}

export default ManagedCryptoShovel;