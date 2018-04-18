/* amqp-connection.ts ** define an amqp queue or exchange connection
 * 2018-04-18 by Ab Reitsma
 */

import * as Amqp from "amqp-ts";

export interface QueueDefinition {
    queue: string;
    options?: Amqp.Queue.DeclarationOptions;
}

export interface ExchangeDefinition {
    exchange: string;
    exchangeType: string;
    options: Amqp.Exchange.DeclarationOptions;
}

export class AmqpConnection {
    readonly connection: Amqp.Connection;
    readonly binding: Amqp.Exchange | Amqp.Queue;

    constructor (connectionUrl: string, bindingDefinition: ExchangeDefinition | QueueDefinition) {
        this.connection = new Amqp.Connection(connectionUrl);
        if((<QueueDefinition>bindingDefinition).queue) {
            const def = bindingDefinition as QueueDefinition;
            this.binding = this.connection.declareQueue(def.queue, def.options);
        } else {
            const def = bindingDefinition as ExchangeDefinition;
            this.binding = this.connection.declareExchange(def.exchangeType, def.exchangeType ? def.exchangeType : "fanout", def.options);
        }
    }

    send(message: Amqp.Message, routingKey?: string) {
        message.sendTo(this.binding, routingKey);
    }

    onMessage(messageProcessor: (msg: Amqp.Message) => void) {
        this.binding.activateConsumer(messageProcessor);
    }

    close() {
        this.connection.close();
    }
}
