# secure-receive

This folder contains the docker application that sits between the unsecure AMQP brokers and the receiver application.

It is a transparent module that receives encrypted messages from a specified exchange, decrypts these messages and exposes them on a local AMQP exchange.
