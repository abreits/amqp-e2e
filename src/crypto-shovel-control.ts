/* managed-crypto-shovel.ts ** extension of the simple-crypto-shovel that includes
 * can also send regularly update and send new AES keys to authenticated receivers
 * 2018-04-1 by Ab Reitsma
 */

import { AmqpConnection, ConnectionConfig } from "./amqp-connection";
import { Key } from "./key";
import { KeyManager } from "./key-manager";
import { KeyDistributor } from "./key-distributor";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
import { KeyReceiver } from "./key-receiver";
import { RsaKey } from "./rsa-key";
import { Log } from "./log";
import { ControlShovelConfig, getFile, ControlShovelDecryptConfig, ControlShovelEncryptConfig, getFileName, getDirName } from "./crypto-shovel";
addCryptoMessage();

export class ControlCryptoShovel {
    protected role: string; // type of shovel, "control-sender" or "control-receiver"

    protected myRsaKey: RsaKey;
    protected senderRsaKey: RsaKey; // only needed by receiver, contains public key of sender
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;
    readonly keys: KeyManager;
    protected receiver: KeyReceiver;

    protected distributor: KeyDistributor;

    protected started: boolean;
    protected distributorTimeout: any;

    constructor(config: ControlShovelConfig, localConfig?: string, remoteConfig?: string) {
        let publicPem, privatePem, encryptPublicPem;

        try {
            publicPem = getFile(config.localPublicRsaKeyFile, localConfig, ".pem", "public");
            privatePem = getFile(config.localPrivateRsaKeyFile, localConfig, ".pem", "private");
        } catch (e) {
            Log.error("Error reading ControlCryptoShovel rsa key file", e);
            throw new Error("Error reading ControlCryptoShovel rsa key file");
        }

        this.myRsaKey = new RsaKey(publicPem, privatePem);
        this.fromConfig = config.readFrom;
        this.toConfig = config.sendTo;
        this.role = config.shovelRole;

        switch (this.role) {
            case "control-startpoint":
                // prepare key-distributor
                const encryptConfig = config as ControlShovelEncryptConfig;
                this.distributor = new KeyDistributor({
                    rsaKey: this.myRsaKey,
                    remoteDir: getDirName(encryptConfig.remoteRsaKeyDir, encryptConfig.remoteConfigFile || remoteConfig),
                    remoteConfigFile: getFileName(encryptConfig.remoteConfigFile || remoteConfig),
                    keyRotationInterval: encryptConfig.keyRotationInterval,
                    startUpdateWindow: encryptConfig.startUpdateWindow,
                    endUpdateWindow: encryptConfig.endUpdateWindow
                });
                break;
            case "control-endpoint":
                // get the public key of the corresponding control-encrypt
                const decryptConfig = config as ControlShovelDecryptConfig;
                encryptPublicPem = getFile(decryptConfig.remotePublicRsaKeyFile, remoteConfig, ".pem", "public");
                // prepare key-receiver
                this.keys = new KeyManager(decryptConfig.persistFile);
                this.senderRsaKey = new RsaKey(encryptPublicPem);
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.role);
                throw new Error("Illegal control-crypto-shovel type");
        }
    }

    start(deferDistributor?: number) {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        switch (this.role) {
            case "control-startpoint":
                this.from.onMessage(this.encryptAndSend);
                if (deferDistributor) {
                    this.distributorTimeout = setTimeout(() => {
                        this.distributorTimeout = null;
                        this.distributor.start(this.to);
                    }, deferDistributor);
                }
                break;
            case "control-endpoint":
                // todo setup receiver (process both key and content messages)
                // todo initialize keymanager (and read persisted key file)
                this.from.onMessage(this.decryptAndSend);
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.role);
                throw new Error("Illegal control-crypto-shovel type");
        }
    }

    stop() {
        switch (this.role) {
            case "control-startpoint":
                if (this.distributorTimeout) {
                    clearTimeout(this.distributorTimeout);
                } else {
                    this.distributor.stop();
                }
                break;
            case "control-endpoint":
                break;
            default:
                Log.error("Illegal control-crypto-shovel type", this.role);
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
        Log.debug("Encrypting message", {message: message});
        message.encrypt(this.distributor.keys);
        this.to.send(message);
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        if (message.content[0] === 75) { // 'K'
            Log.info("Received message encryption key");
            // todo decrypt key and add to keymanager (and persist)
            const decryptedKey = Key.decrypt(message.content, this.myRsaKey, this.senderRsaKey);
            if (decryptedKey) {
                this.keys.cleanup();
                this.keys.add(decryptedKey);
                this.keys.persist();
            }
        } else {
            Log.debug("Decrypting message");
            const routingKey = message.decrypt(this.keys);
            this.to.send(message, routingKey);
        }
    }
}

export default ControlCryptoShovel;
