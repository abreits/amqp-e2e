/* crypto-shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality and adds end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as fs from "fs";
import * as Amqp from "amqp-ts";
import { AmqpConnection, ConnectionDefinition, ExchangeDefinition, QueueDefinition } from "./amqp-connection";
import { Key } from "./key";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
addCryptoMessage();


export interface SimpleShovelDefinition {
    encrypts: boolean;
    from: AmqpConnection;
    to: AmqpConnection;
}

export class SimpleCryptoShovel {
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
        this.currentKey = Key.create(Buffer.from(config.key, "hex"));
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
        message.decrypt(this.currentKey);
        this.to.send(message);
    }
}

export default SimpleCryptoShovel;