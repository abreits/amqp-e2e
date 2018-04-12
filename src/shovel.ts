/* shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality adding end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as Amqp from "amqp-ts";
import * as events from "events";
import EndToEnd from "./end-to-end";

interface ShovelConnection {
    connectionUrl: string; //amqp connection url
    bindTo: string; // name of the exchange or queue to bind to
    exchangeType: string;
    isQueue?: boolean; // expect to bind to an exchange by default
    options: Amqp.Exchange.DeclarationOptions | Amqp.Queue.DeclarationOptions;
    connection: Amqp.Connection;
    binding: Amqp.Queue | Amqp.Exchange;
    // exchange: Amqp.Exchange;
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
        if(conn.isQueue) {
            conn.binding = conn.connection.declareQueue(conn.bindTo, conn.options);
        } else {
            conn.binding = conn.connection.declareExchange(conn.bindTo, conn.exchangeType ? conn.exchangeType : "fanout", conn.options);
        }
    }

    protected encryptAndSend = (message: Amqp.Message) => {
        message.content = EndToEnd.encrypt(message.content, this.currentKey);
        message.sendTo(this.to.binding);
    }

    protected decryptAndSend = (message: Amqp.Message) => {
        message.content = EndToEnd.decrypt(message.content, this.currentKey);
        message.sendTo(this.to.binding);
    }
}

export {Shovel, ShovelConnection};