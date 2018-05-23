/* crypto-shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality and adds end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as fs from "fs";
import * as Amqp from "amqp-ts";
import { AmqpConnection, ConnectionConfig, ExchangeDefinition, QueueDefinition } from "./amqp-connection";
import { Key } from "./key";
import { Log } from "./log";
import { CryptoMessage, addCryptoMessage } from "./crypto-message";
addCryptoMessage();


export interface SimpleShovelConfig {
    type: string;
    key: string;
    from: ConnectionConfig;
    to: ConnectionConfig;
}

export class SimpleCryptoShovel {
    currentKey: Key;

    protected started: boolean;
    protected type; // whether it is an encryption or a decryption shovel
    protected fromConfig: ConnectionConfig;
    protected toConfig: ConnectionConfig;
    protected from: AmqpConnection;
    protected to: AmqpConnection;

    constructor(configFileName: string) {
        // read file and parse json
        // TODO: error handling
        const configString = fs.readFileSync(configFileName, "utf8");
        const config = JSON.parse(configString) as SimpleShovelConfig;

        this.fromConfig = config.from;
        this.toConfig = config.to;
        this.currentKey = Key.create(Buffer.from(config.key, "hex"));
        this.type = config.type;
    }

    start() {
        this.from = new AmqpConnection(this.fromConfig);
        this.to = new AmqpConnection(this.toConfig);
        if (this.type === "simple-sender") {
            this.from.onMessage(this.encryptAndSend);
        } else if (this.type === "simple-receiver") {
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