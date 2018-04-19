# Test ssh keys

Test RSA key pairs created with ssh-keygen inside a shell spawned on the nodejs docker image (abreits/dev_amqp_e2e)

The rsa keys have been created without password

The following command line is used for creating a key pair:

```
$ ssh-keygen -t rsa -b 2048 -v
```