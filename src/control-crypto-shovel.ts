/* managed-crypto-shovel.ts ** extension of the simple-crypto-shovel that includes
 * can also send regularly update and send new AES keys to authenticated receivers
 * 2018-04-1 by Ab Reitsma
 */

import * as fs from "fs";
import * as Amqp from "amqp-ts";
import { AmqpConnection, ConnectionConfig, ExchangeDefinition, QueueDefinition } from "./amqp-connection";
import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { KeyDistributor, KeyDistributorConfig } from "./key-distributor";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
import { KeyReceiver } from "./key-receiver";
import { RsaKey } from "./rsa-key";
addCryptoMessage();


export interface ControlShovelConfig {
    type: string;
    from: ConnectionConfig;
    to: ConnectionConfig;
    privateRsaKeyFile: string; // path to private cert file of this shovel
    publicRsaKeyFile: string; // path to public cert file of this shovel

    // properties below only needed for control-receiver
    senderPublicRsaKeyFile: string;
    persistFile?: string; // path to the file contains persistance information

    // properties below only needed for the control-sender
    receiverConfigFile?: string; // path to configuration file for the receivers, default "/config/receivers.json"
    receiverRsaKeyFolder?: string; // path to folder containing receivers RSA public keys, default "/config/rsakeys/"
    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, 0 is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes
}

export class ControlCryptoShovel {
    protected type: string; // type of shovel, "control-sender" or "control-receiver"

    protected myRsaKey: RsaKey;
    protected senderRsaKey: RsaKey; // only needed by receiver, contains public key of sender
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;
    protected keys: KeyManager;
    protected receiver: KeyReceiver;

    protected distributor: KeyDistributor;

    protected started: boolean;

    constructor(configFileName: string) {
        // read file and parse json
        // TODO: error handling
        const configString = fs.readFileSync(configFileName, "utf8");
        const config = JSON.parse(configString) as ControlShovelConfig;

        this.myRsaKey = new RsaKey(config.publicRsaKeyFile, config.privateRsaKeyFile);
        this.fromConfig = config.from;
        this.toConfig = config.to;
        this.type = config.type;

        switch (this.type) {
            case "control-sender":
                // prepare key-distributor
                this.distributor = new KeyDistributor({
                    rsaKey: this.myRsaKey,
                    receiverRsaKeyFolder: config.receiverRsaKeyFolder,
                    receiverConfigFile: config.receiverConfigFile,
                    keyRotationInterval: config.keyRotationInterval,
                    startUpdateWindow: config.startUpdateWindow,
                    endUpdateWindow: config.endUpdateWindow
                });
                break;
            case "control-receiver":
                // prepare key-receiver
                this.keys = new KeyManager(config.persistFile);
                this.senderRsaKey = new RsaKey(config.senderPublicRsaKeyFile);
                break;
            default:
                throw new Error("Illegal control-crypto-shovel type");
        }

    }

    start() {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        switch (this.type) {
            case "control-sender":
                this.from.onMessage(this.encryptAndSend);
                this.distributor.start(this.to);
                break;
            case "control-receiver":
                // todo setup receiver (process both key and content messages)
                // todo initialize keymanager (and read persisted key file)
                this.from.onMessage(this.decryptAndSend);
                break;
            default:
                throw new Error("Illegal control-crypto-shovel type");
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
            const decryptedKey = Key.decrypt(message.content, this.myRsaKey, this.senderRsaKey);
            if (decryptedKey) {
                this.keys.cleanup();
                this.keys.add(decryptedKey);
                this.keys.persist();
            }
        } else {
            message.decrypt(this.keys);
            this.to.send(message);
        }
    }
}

export default ControlCryptoShovel;
