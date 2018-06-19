# amqp-e2e
Secure end to end message transfer over AMQP demonstrator

This project contains the code developed for my research project.

It will contain 3 main elements:
* a secure send module (implemented)
* a secure receive module (implemented)
* an administration module (future development)

See the [documentation](documentation/readme.md) for more details.

## Tools used

- docker
- RabbitMQ
- Node.js
- typescript

## Summary

In stage 1 of this research project I will create a pair of external applications that act
as AMQP shovels. For an explanation of what a shovel does, see https://www.rabbitmq.com/shovel.html

### Start point shovel

The first one is the start point 'shovel', this application reads unencrypted messages from a
private 'source' AMQP server, encrypts these messages and sends the encrypted messages to a
public 'transfer' AMQP server.

### Endpoint shovel

The endpoint 'shovel' is the opposite of the 'sender shovel', it reads encrypted messages
from a public 'transfer' AMQP server, decrypts the messages and sends the result to a
private 'destination' amqp server.

## Prerequisites for the develop environment

The following needs to be installed to build and run this demonstrator:

- docker, https://www.docker.com

The following should be installed for an optimal development experience:

- Visual Studio Code, https://code.visualstudio.com
- Node.js, https://nodejs.org

### 2018-06-19 V1.0.0
latest release

### 2018-02-09 V0.0.1
initial project start
