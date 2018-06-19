# AMQP Connection configuration

For each start point and endpoint a `readFrom` and a `sendTo` AMQP connection must be defined in the json configuration file.

In this document the AMQP connection section of the json configuration file is explained in detail.

## Connecting to an AMQP exchange

```javascript
    "readFrom": {
        "connectionUrl": "amqp://username:password@amqp_broker", // url that defines the connection to the AMQP broker
                        // where
                        //   amqp://            : defines the type of amqp connection: amqp:// or amqps://
                        //   username:password@ : optional username and password, defaults to guest:guest@
                        //   amqp_broker        : hostname of the AMQP broker to connect to
        "binding": {
            "exchange": "exchange-name", // name of the exchang to bind to
            // The properties below are optional and default to the values as defined here
            "exchangeType": "direct",    // one of 'direct', 'fanout', 'topic', or 'headers'
            "options": {
                "alternateExchange": string // an exchange to send messages to if this exchange can’t route them to any queues
                "arguments": {/*...*/} // additional arguments, usually broker specific
                "autoDelete": false,   // the exchange will be deleted when the number of bindings from it drops to zero
                "durable": true,       // the exchange will survive broker restart
                "internal": false,     // messages cannot be published directly to the exchange
                "noCreate": false      // if true, does not create an exchange or queue, expects it to already exist
            }
        }
    }
```

The for more details for the binding options see the amqplib [exchange](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertExchange) documentation.

## Connecting to an AMQP queue

```javascript
    "readFrom": {
        "connectionUrl": "amqp://username:password@amqp_broker", // url that defines the connection to the AMQP broker
                        // where
                        //   amqp://            : defines the type of amqp connection: amqp:// or amqps://
                        //   username:password@ : optional username and password, defaults to guest:guest@
                        //   amqp_broker        : hostname of the AMQP broker to connect to
        "binding": {
            "queue": "simple-encrypted-exchange",
            // The properties below are optional and default to the values as defined here
            "options": {
                "autoDelete": false,   // the queue will be deleted when the number of consumers drops to zero 
                "arguments": {/*...*/} // additional arguments, usually broker specific
                "deadLetterExchange": string // an exchange to which messages discarded from the queue will be resent
                "durable": true,       // the queue will survive broker restart
                "exclusive": false,    // scopes the queue to the connection
                "expires": number,     // the queue will be destroyed after n milliseconds of disuse
                "maxLength": number,   // maximum number of messages the queue will hold
                "maxPriority": number, // makes the queue a priority queue
                "messageTtl": number,  // expires messages arriving in the queue after n milliseconds
                "noCreate": false      // if true, does not create an exchange or queue, expects it to already exist
            }
        }
    }
```

The for more details for the binding options see the amqplib [queue](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue) documentation.
