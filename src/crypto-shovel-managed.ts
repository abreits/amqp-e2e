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
    manager: ConnectionConfig;
    privateRsaKeyFile: string; // path to private cert file of this shovel/manager
    publicRsaKeyFile: string; // path to public cert file of this shovel/manager

    // properties below only needed for managed sender and receiver modules
    managerPublicRsaKeyFile?: string;
    persistFile?: string; // path to the file that contains persistance information

    // properties below only needed for the manager module
    connectionConfigDir?: string; // path to configuration folder containing sender-receiver configuration json files, default "/config/connections"
    connectionRsaKeyFolder?: string; // path to folder containing receivers RSA public keys, default "/config/rsakeys/"
    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, 0 is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes
}

export class ManagedCryptoShovel {
    protected type: string; // type of shovel, "managed-sender", "managed-receiver" or "manager"

    protected myRsaKey: RsaKey;
    protected managerRsaKey: RsaKey; // needed by sender and receiver, contains public key of sender
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected managerConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;
    protected manager: AmqpConnection;

    readonly keys: KeyManager;
    protected receiver: KeyReceiver;

    protected distributors: Map<string, KeyDistributor>;

    protected started: boolean;
    protected distributorTimeout: any;

    protected readConfigFile(configFileName) {
        let configString = fs.readFileSync(configFileName, "utf8");
        // replace $(configRoot} with workspace root dir
        const workspaceRoot = path.join(__dirname, "..").split("\\").join("/");
        configString = configString.split("$(configRoot}").join(workspaceRoot);
        return JSON.parse(configString) as ManagedShovelConfig;
    }

    constructor(configFileName: string) {
        // read file and parse json
        let config: ManagedShovelConfig;
        try {
            config = this.readConfigFile(configFileName) as ManagedShovelConfig;
        } catch (e) {
            Log.error("Error reading ManagedCryptoShovel config file", e);
            throw new Error("Error reading ManagedCryptoShovel config file");
        }
        let publicPem, privatePem, managerPublicPem;
        try {
            publicPem = fs.readFileSync(config.publicRsaKeyFile);
            privatePem = fs.readFileSync(config.privateRsaKeyFile);
            if (config.managerPublicRsaKeyFile) {
                managerPublicPem = fs.readFileSync(config.managerPublicRsaKeyFile);
            }
        } catch (e) {
            Log.error("Error reading ManagedCryptoShovel rsa key file", e);
            throw new Error("Error reading ManagedCryptoShovel rsa key file");
        }

        this.myRsaKey = new RsaKey(publicPem, privatePem);
        this.fromConfig = config.from;
        this.toConfig = config.to;
        this.managerConfig = config.manager;
        this.type = config.type;

        switch (this.type) {
            case "manager":
                // todo: for each managed shovel config in the folder do:
                //  - initialize
                //  - watch changes
                // prepare key-distributor
                // for all files in folder do:
                let connectionDir = config.connectionConfigDir;
                let connectionConfigFiles = fs.readdirSync(connectionDir);
                for (const configFile in connectionConfigFiles) {
                    try {
                        let connConfig = this.readConfigFile(configFile);
                        let distributor = new KeyDistributor({
                            rsaKey: this.myRsaKey,
                            remoteConfigFile: configFile,
                            remoteDir:
                                connConfig.connectionRsaKeyFolder ||
                                config.connectionRsaKeyFolder,
                            keyRotationInterval:
                                connConfig.keyRotationInterval ||
                                config.keyRotationInterval,
                            startUpdateWindow:
                                connConfig.startUpdateWindow ||
                                config.startUpdateWindow,
                            endUpdateWindow:
                                connConfig.endUpdateWindow ||
                                config.endUpdateWindow
                        });
                        this.distributors.set(configFile, distributor);
                    } catch (e) {
                        Log.error("Error processing key distributor config file", {
                            fileName: configFile,
                            error: e
                        });
                    }
                }

                // todo: watch for changes in folder
                // todo: add architecture for remote removing keys from key-manager
                break;
            case "managed-sender":
            case "managed-receiver":
                // prepare key-receiver
                this.keys = new KeyManager(config.persistFile);
                this.managerRsaKey = new RsaKey(managerPublicPem);
                break;
            default:
                Log.error("Illegal managed-crypto-shovel type", this.type);
                throw new Error("Illegal managed-crypto-shovel type");
        }
    }

    start(deferDistributor?: number) {

        this.manager = new AmqpConnection(this.managerConfig);
        switch (this.type) {
            case "manager":
                if (deferDistributor) {
                    this.distributorTimeout = setTimeout(() => {
                        this.distributorTimeout = null;
                        for (const [id, distributor] of this.distributors) {
                            distributor.start(this.manager);
                        }
                    }, deferDistributor);
                }
                break;
            case "managed-sender":
                this.from = new AmqpConnection(this.fromConfig);
                this.to = new AmqpConnection(this.toConfig);
                this.manager.onMessage(this.addKey);
                this.from.onMessage(this.encryptAndSend);
                break;
            case "managed-receiver":
                this.from = new AmqpConnection(this.fromConfig);
                this.to = new AmqpConnection(this.toConfig);
                this.manager.onMessage(this.addKey);
                this.from.onMessage(this.decryptAndSend);
                break;
            default:
                Log.error("Illegal managed-crypto-shovel type", this.type);
                throw new Error("Illegal managed-crypto-shovel type");
        }
    }

    stop() {
        switch (this.type) {
            case "manager":
                if (this.distributorTimeout) {
                    clearTimeout(this.distributorTimeout);
                } else {
                    for (const [id, distributor] of this.distributors) {
                        distributor.stop();
                    }
                }
                break;
            case "managed-sender":
            case "managed-receiver":
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

    protected addKey = (message: CryptoMessage) => {
        // decrypt key and add to keymanager (and persist)
        const decryptedKey = Key.decrypt(message.content, this.myRsaKey, this.managerRsaKey);
        if (decryptedKey) {
            this.keys.cleanup();
            this.keys.add(decryptedKey);
            this.keys.persist();
        }
    }

    protected encryptAndSend = (message: CryptoMessage) => {
        let key = this.keys.setEncryptionKey();
        if (key) {
            message.encrypt(key);
            this.to.send(message);
        }
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        const routingKey = message.decrypt(this.keys);
        this.to.send(message, routingKey);
    }
}

export default ManagedCryptoShovel;
