# Create AES keys for amqp-e2e

Random 32-byte AES keys can be created with node, for example inside a shell spawned on the nodejs docker image (abreits/dev_amqp_e2e)

In the following example generates random 32-byte hex AES key for use in the simple configuration of amqp-e2e

```
$ echo "console.log(require('crypto').randomBytes(32).toString('hex'))" | node
```