# Control start point and endpoint configuration

The control start point and endpoint configuration defines the source and destination AMQP connections the same as the [simple](simple.md) configuration does.
It does not define an AES encrytion key, but instead uses RSA keys to securely transmit the AES key
to be used from the start point to the specified endpoints

## Start point config file and default directory structure

### Directory structure
```
[control config root folder]
 |
 +-- local             # home directory of all configuration options for this start point
 |    |
 |    +-- config.json  # default json config file for this start point
 |    |                # see below for config options
 |    +-- private.pem  # default RSA private key for this start point (pem format)
 |    |
 |    +-- public.pem   # default RSA public key for this start point (pem format)
 |
 +-- remote            # home directory of all configuration options for the start/end point
      |
      +-- config.json  # default json config file for the remote end points
      |                # see below for config options
      +-- <endpoint1-name>.pem   # default RSA public key for an endpoint specified in the remote config.json
```

You can specify the configuration file name path by specifying it in the `LOCAL_CONFIG` environment variable.
The variable can start with `${configRoot}` to specify the configuration root volume.
If `LOCAL_CONFIG` is undefined or empty it defaults to `${configRoot}/local/config.json`.

### Creating RSA key .pem files

Look [here](../rsa-keys.md) to generate your own private.pem and public.pem files.

### The `local/config.json` structure
```javascript
{
    "shovelRole": "control-startpoint",
    "readFrom": {                      // definition of the source AMQP connection, see AMQP connection definition section for details
        // AMQP connection example
        "connectionUrl": "amqp://example_amqp",
        "binding": {
            "exchange": "simple-encrypted-exchange",
            "exchangeType": "fanout",
            "options": {
                "autoDelete": true
            }
        }
    },
    "sendTo": {                        // definition of the destination AMQP connection, see AMQP connection definition section for details
        // AMQP connection example
        "connectionUrl": "amqp://example_amqp",
        "binding": {
            "exchange": "simple-dest-exchange",
            "exchangeType": "fanout",
            "options": {
                "autoDelete": true
            }
        }
    },
    // The properties below are optional and default to the values as defined here
    "localPrivateRsaKeyFile": "${configRoot}/local/private.pem", // path to PEM file with private RSA key of this shovel
    "localPublicRsaKeyFile": "${configRoot}/local/public.pem",   // path to PEM file with public RSA key of this shovel
    "remoteConfigFile": "${configRoot}/remote/config.json",      // path to configuration file for the endpoints
    "remoteRsaKeyDir": "${configRoot}/remote/",                  // path to directory containing the endpoint RSA public keys
    "keyRotationInterval": 86400000,                             // force new key to be used after .. ms, default every 24 hours, 0 is never
    "startUpdateWindow": 3600000,                                // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    "endUpdateWindow": 3300000                                   // when, before new key activates, all new keys should be sent, default 55 minutes

}
```
[AMQP connection definition](connection.md)

### The `remote/config.json` structure
```javascript
{
    "endpoint": [
        {
            "key": "receiver1.public.pem" // filename of the RSA public key of the receiver
            // The properties below are optional
            "startDate": string | number; // UTC date-time, if not defined always start
            "endDate": string | number;   // UTC date-time, if not defined never end
            "resend": boolean; // if true, resend key to this receiver after updating config file
        }
        //... multiple endpoints definitions possible
    ],
    // The properties below are optional and override same properties in local/config.json if defined
    "keyRotationInterval": 86400000, // force new key to be used after .. ms, default every 24 hours, 0 is never
    "startUpdateWindow": 3600000,    // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    "endUpdateWindow": 3300000       // when, before new key activates, all new keys should be sent, default 55 minutes
}
```

## Endpoint config file and default directory structure

### Directory structure
```
[control config root folder]
 |
 +-- local             # home directory of all configuration options for this endpoint
 |    |
 |    +-- config.json  # default json config file for this endpoint
 |    |                # see below for config options
 |    +-- private.pem  # default RSA private key for this endpoint (pem format)
 |    |
 |    +-- public.pem   # default RSA public key for this endpoint (pem format)
 |
 +-- remote            # home directory of all configuration options for the endpoint
      |
      +-- public.pem   # default RSA public key for the startpoint
```

You can specify the configuration file name path by specifying it in the `LOCAL_CONFIG` environment variable.
The variable can start with `${configRoot}` to specify the configuration root volume.
If `LOCAL_CONFIG` is undefined or empty it defaults to `${configRoot}/local/config.json`.

### The `local/config.json` structure
```javascript
{
    "shovelRole": "control-endpoint",
    "readFrom": {                      // definition of the source AMQP connection, see AMQP connection definition section for details
        "connectionUrl": "amqp://example_amqp",
        "binding": {
            "exchange": "simple-encrypted-exchange",
            "exchangeType": "fanout",
            "options": {
                "autoDelete": true
            }
        }
    },
    "sendTo": {                        // definition of the destination AMQP connection, see AMQP connection definition section for details
        "connectionUrl": "amqp://example_amqp",
        "binding": {
            "exchange": "simple-dest-exchange",
            "exchangeType": "fanout",
            "options": {
                "autoDelete": true
            }
        }
    },
    // The properties below are optional and default to the values as defined here
    "localPrivateRsaKeyFile": "${configRoot}/local/private.pem", // path to PEM file with private RSA key of this endpoint
    "localPublicRsaKeyFile": "${configRoot}/local/public.pem",  // path to PEM file with public RSA key of this endpoint
    "remotePublicRsaKeyFile": "${configRoot}/remote/public.json" // path to PEM file with public RSA key of the startpoint
}
```
[AMQP connection definition](connection.md)
