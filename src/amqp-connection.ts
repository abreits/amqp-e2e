/* amqp-connection.ts ** define an amqp queue or exchange connection
 * 2018-04-18 by Ab Reitsma
 */

import * as Amqp from "amqp-ts";

export interface ExchangeDefinition {
    exchange: string;
    exchangeType: string;
    options: Amqp.Exchange.DeclarationOptions;
}

export interface QueueDefinition {
    queue: string;
    options?: Amqp.Queue.DeclarationOptions;
}

export interface ConnectionConfig {
    connectionUrl: string;
    binding: ExchangeDefinition | QueueDefinition;
}

export class AmqpConnection {
    readonly connection: Amqp.Connection;
    readonly binding: Amqp.Exchange | Amqp.Queue;

    constructor(definition: ConnectionConfig) {
        this.connection = new Amqp.Connection(definition.connectionUrl);
        if ((<QueueDefinition>definition.binding).queue) {
            const def = definition.binding as QueueDefinition;
            this.binding = this.connection.declareQueue(def.queue, def.options);
        } else {
            const def = definition.binding as ExchangeDefinition;
            this.binding = this.connection.declareExchange(def.exchange, def.exchangeType ? def.exchangeType : "fanout", def.options);
        }
    }

    send(message: Amqp.Message, routingKey?: string) {
        message.sendTo(this.binding, routingKey);
    }

    onMessage(messageProcessor: (msg: Amqp.Message) => void) {
        this.binding.activateConsumer(messageProcessor, {noAck: true});
    }

    close() {
        this.connection.deleteConfiguration().then(() => {
            return this.connection.close();
        });
    }
}
