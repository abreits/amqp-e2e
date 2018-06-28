# Create RSA keys for amqp-e2e

RSA key pairs can be created with openssl, for example inside a shell spawned on the nodejs docker image (abreits/dev_amqp_e2e)

The rsa keys are created without password

In the following example a private and public key `pem` are created for the sender.
Replace `sender.private` and `sender.public` with the key name of your choise.

```
$ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out sender.private
$ openssl rsa -pubout -in sender.private -out sender.public
```