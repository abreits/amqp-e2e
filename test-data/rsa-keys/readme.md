# Test ssh keys

Test RSA key pairs created with openssl inside a shell spawned on the nodejs docker image (abreits/dev_amqp_e2e)

The rsa keys have been created without password

The following command lines are used for creating a key pair for the sender:

```
$ openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out sender.private
$ openssl rsa -pubout -in sender.private -out sender.public
```