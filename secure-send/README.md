# secure-receive

This folder contains the docker application that sits between the message sending application and the unsecure AMQP brokers.

It is a transparent module that exposes a local AMQP exchange, encrypts messages from that exchange and sends them on to an unsecure AMQP broker.
