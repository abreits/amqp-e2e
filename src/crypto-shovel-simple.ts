/* crypto-shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality and adds end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import { AmqpConnection, ConnectionConfig } from "./amqp-connection";
import { Key } from "./key";
import { Log } from "./log";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
import { SimpleShovelConfig } from "./crypto-shovel";
addCryptoMessage();


export class SimpleCryptoShovel {
    currentKey: Key;

    protected started: boolean;
    protected role; // whether it is an encryption or a decryption shovel
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;

    constructor(config: SimpleShovelConfig) {
        this.fromConfig = config.readFrom;
        this.toConfig = config.sendTo;
        this.currentKey = Key.create(Buffer.from(config.messageKey, "hex"));
        this.role = config.shovelRole;
    }

    start() {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        if (this.role === "simple-encrypt") {
            this.from.onMessage(this.encryptAndSend);
        } else if (this.role === "simple-decrypt") {
            this.from.onMessage(this.decryptAndSend);
        } else {
            Log.error("Illegal simple-crypto-shovel type");
            throw new Error("Illegal simple-crypto-shovel type");
        }
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
        const routingKey = message.decrypt(this.currentKey);
        this.to.send(message, routingKey);
    }
}

export default SimpleCryptoShovel;
