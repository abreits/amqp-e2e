/* shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality adding end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as Amqp from "amqp-ts";
import * as events from "events";
import CryptoMessage from "./crypto-message";

interface ShovelConnection {
    connectionUrl: string; //amqp connection url
    queue?: string; // name of the queue used in this connection, if undefined expects an exchange
    exchange?: string;
    exchangeType?: string; // defaults to 'fanout'
    options: Amqp.Exchange.DeclarationOptions | Amqp.Queue.DeclarationOptions;
    connection: Amqp.Connection;
    binding: Amqp.Queue | Amqp.Exchange;
}

class Shovel extends events.EventEmitter {
    currentKey: string;

    //todo: for multiple decryption keys, provide a structure or function to get key based on an id (key id provided in encrypted message)

    protected started: boolean;
    protected encrypts; // whether it is an encryption or a decryption shovel
    protected from: ShovelConnection;
    protected to: ShovelConnection;

    constructor (from: ShovelConnection, to: ShovelConnection, encrypts = true) {
        super();
        this.from = from;
        this.to = to;
        this.encrypts = encrypts;

        // create shovel
        Shovel.createConnection(from);
        Shovel.createConnection(to);
        if (this.encrypts) {
            // receive raw, send encrypted
            this.from.binding.activateConsumer(this.encryptAndSend);
        } else {
            // recieve encrypted, send decrypted
            this.from.binding.activateConsumer(this.decryptAndSend);
        }
    }

    protected static createConnection(conn: ShovelConnection) {
        conn.connection = new Amqp.Connection(conn.connectionUrl);
        if(conn.queue !== undefined) {
            conn.binding = conn.connection.declareQueue(conn.queue, conn.options);
        } else {
            conn.binding = conn.connection.declareExchange(conn.queue, conn.exchangeType ? conn.exchangeType : "fanout", conn.options);
        }
    }

    protected encryptAndSend = (message: CryptoMessage) => {
        message.encrypt(this.currentKey);
        message.sendTo(this.to.binding);
    }

    protected decryptAndSend = (message: CryptoMessage) => {
        message.decrypt(this.currentKey);
        message.sendTo(this.to.binding);
    }
}

export {Shovel, ShovelConnection};