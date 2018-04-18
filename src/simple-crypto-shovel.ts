/* crypto-shovel.ts ** copies the RabbitMQ 'shovel' plugin functionality and adds end to end encryption
 * 2018-04-12 by Ab Reitsma
 */

import * as fs from "fs";
import * as Amqp from "amqp-ts";
import {AmqpConnection, ExchangeDefinition, QueueDefinition} from "./amqp-connection";
import {Key} from "./key-manager";
import {CryptoMessage, addCryptoMessage} from "./crypto-message";
addCryptoMessage();


export interface SimpleShovelDefinition {
    encrypts: boolean;
    from: AmqpConnection;
    to: AmqpConnection;
}

export class SimpleCryptoShovel {
    currentKey: Key;

    //todo: for multiple decryption keys, provide a structure or function to get key based on an id (key id provided in encrypted message)

    protected started: boolean;
    protected encrypts; // whether it is an encryption or a decryption shovel
    protected from: AmqpConnection;
    protected to: AmqpConnection;

    constructor (definitionFileName: string) {
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