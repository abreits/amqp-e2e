/* crypto-shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality and adds end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as Amqp from "amqp-ts";
import * as events from "events";
import {Key} from "./key-manager";
import CryptoMessage from "./crypto-message";

export interface ShovelConnection {
    connectionUrl: string; //amqp connection url
    queue?: string;
    exchange?: string;
    exchangeType?: string; // defaults to 'fanout'
    options?: Amqp.Queue.DeclarationOptions;
}

export interface SimpleShovelDefinition {
    encrypts: boolean;
    from: ShovelConnection;
    to: ShovelConnection;
}

export class SimpleCryptoShovel extends events.EventEmitter {
    currentKey: Key;

    //todo: for multiple decryption keys, provide a structure or function to get key based on an id (key id provided in encrypted message)

    protected started: boolean;
    protected encrypts; // whether it is an encryption or a decryption shovel
    protected from: ShovelConnection;
    protected fromConnection: Amqp.Connection;
    protected fromBinding: Amqp.Queue | Amqp.Exchange;
    protected to: ShovelConnection;
    protected toConnection: Amqp.Connection;
    protected toBinding: Amqp.Queue | Amqp.Exchange;

    constructor (from: ShovelConnection, to: ShovelConnection, encrypts = true) {
        super();
        this.from = from;
        this.to = to;
        this.encrypts = encrypts;

        // create shovel
        [this.fromConnection, this.fromBinding] = SimpleCryptoShovel.createConnection(from);
        [this.toConnection, this.toBinding] = SimpleCryptoShovel.createConnection(to);
        if (this.encrypts) {
            // receive raw, send encrypted
            this.fromBinding.activateConsumer(this.encryptAndSend);
        } else {
            // receive encrypted, send decrypted
            this.toBinding.activateConsumer(this.decryptAndSend);
        }
    }

    protected static createConnection(conn: ShovelConnection) {
        let connection = new Amqp.Connection(conn.connectionUrl);
        let binding;
        if(conn.queue !== undefined) {
            binding = connection.declareQueue(conn.queue, conn.options);
        } else {
            binding = connection.declareExchange(conn.queue, conn.exchangeType ? conn.exchangeType : "fanout", conn.options);
        }
        return [connection, binding];
    }

    protected encryptAndSend = (message: CryptoMessage) => {
        message.encrypt(this.currentKey);
        message.sendTo(this.toBinding);
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        message.decrypt(this.currentKey);
        message.sendTo(this.toBinding);
    }
}

export default SimpleCryptoShovel;