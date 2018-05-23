/* crypto-shovel-managed.ts ** extension of the crypto-shovel-control that includes
 * a seperate managemant module that can control multiple sender-receiver shovel combo's
 * 2018-05-14 by Ab Reitsma
 */

import * as fs from "fs";
import * as path from "path";
import * as Amqp from "amqp-ts";
import { AmqpConnection, ConnectionConfig, ExchangeDefinition, QueueDefinition } from "./amqp-connection";
import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { KeyDistributor, KeyDistributorConfig } from "./key-distributor";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
import { KeyReceiver } from "./key-receiver";
import { RsaKey } from "./rsa-key";
import { Log } from "./log";
addCryptoMessage();


export interface ManagedShovelConfig {
    type: string;
    from: ConnectionConfig;
    to: ConnectionConfig;
    manage: ConnectionConfig;
    privateRsaKeyFile: string; // path to private cert file of this shovel/manager
    publicRsaKeyFile: string; // path to public cert file of this shovel/manager

    // properties below only needed for managed sender and receiver modules
    managerPublicRsaKeyFile: string;
    persistFile?: string; // path to the file that contains persistance information

    // properties below only needed for the manager module
    receiverConfigFile?: string; // path to configuration file for the receivers, default "/config/receivers.json"
    receiverRsaKeyFolder?: string; // path to folder containing receivers RSA public keys, default "/config/rsakeys/"
    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, 0 is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes
}

export class ManagedCryptoShovel {
    protected type: string; // type of shovel, "control-sender" or "control-receiver"

    protected myRsaKey: RsaKey;
    protected senderRsaKey: RsaKey; // only needed by receiver, contains public key of sender
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected manageConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;
    protected manage: AmqpConnection;

    readonly keys: KeyManager;
    protected receiver: KeyReceiver;

    protected distributor: KeyDistributor;

    protected started: boolean;
    protected distributorTimeout: any;

    constructor(configFileName: string) {
        // read file and parse json
        let config;
        try {
            let configString = fs.readFileSync(configFileName, "utf8");
            // replace ${workspaceRoot} with workspace root dir
            const workspaceRoot = path.join(__dirname, "..").split("\\").join("/");
            configString = configString.split("${workspaceRoot}").join(workspaceRoot);
            config = JSON.parse(configString) as ManagedShovelConfig;
        } catch (e) {
            Log.error("Error reading ControlCryptoShovel config file", e);
            throw new Error("Error reading ControlCryptoShovel config file");
        }
        let publicPem, privatePem, senderPublicPem;
        try {
            publicPem = fs.readFileSync(config.publicRsaKeyFile);
            privatePem = fs.readFileSync(config.privateRsaKeyFile);
            if (config.senderPublicRsaKeyFile) {
                senderPublicPem = fs.readFileSync(config.senderPublicRsaKeyFile);
            }
        } catch (e) {
            Log.error("Error reading ControlCryptoShovel rsa key file", e);
            throw new Error("Error reading ControlCryptoShovel rsa key file");
        }

        this.myRsaKey = new RsaKey(publicPem, privatePem);
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
                this.senderRsaKey = new RsaKey(senderPublicPem);
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.type);
                throw new Error("Illegal control-crypto-shovel type");
        }
    }

    start(deferDistributor?: number) {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        switch (this.type) {
            case "control-sender":
                this.from.onMessage(this.encryptAndSend);
                if (deferDistributor) {
                    this.distributorTimeout = setTimeout(() => {
                        this.distributorTimeout = null;
                        this.distributor.start(this.to);
                    }, deferDistributor);
                }
                break;
            case "control-receiver":
                // todo setup receiver (process both key and content messages)
                // todo initialize keymanager (and read persisted key file)
                this.from.onMessage(this.decryptAndSend);
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.type);
                throw new Error("Illegal control-crypto-shovel type");
        }
    }

    stop() {
        switch (this.type) {
            case "control-sender":
                if (this.distributorTimeout) {
                    clearTimeout(this.distributorTimeout);
                } else {
                    this.distributor.stop();
                }
                break;
            case "control-receiver":
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.type);
                throw new Error("Illegal control-crypto-shovel type");
        }
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
        message.encrypt(this.distributor.keys);
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
            const routingKey = message.decrypt(this.keys);
            this.to.send(message, routingKey);
        }
    }
}

export default ManagedCryptoShovel;