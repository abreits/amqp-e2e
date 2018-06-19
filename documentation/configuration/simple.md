# Simple start point and endpoint configuration

The simple start point and endpoint configuration define only the source and destination AMQP connections and the encryption key used.

## Directory structure
```
[control config root folder]
 |
 +-- local             # home directory of all configuration options for this start/end point
 |    |
 |    +-- config.json  # default json config file for this start/end point
 ```

You can specify the configuration file name path by specifying it in the `LOCAL_CONFIG` environment variable. 
The variable can start with `${configRoot}` to specify the configuration root volume.
If `LOCAL_CONFIG` is undefined or empty it defaults to `${configRoot}/local/config.json`.

## The `config.json` file structure
```javascript
{
    "shovelRole": "simple-endpoint",   // "simple-startpoint" or "simple-endpoint", defines whether it encrypts or decrypts the source AMQP connection
    "messageKey": "5d999...8afa74",    // hex representation of the 32 byte AES encryption key
    "readFrom": {                      // definition of the source AMQP connection, see AMQP definition section for details
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
    "sendTo": {                        // definition of the destination AMQP connection, see AMQP definition section for details
        // AMQP connection example
        "connectionUrl": "amqp://example_amqp",
        "binding": {
            "exchange": "simple-dest-exchange",
            "exchangeType": "fanout",
            "options": {
                "autoDelete": true
            }
        }
    }
}
```
[AMQP connection definition](connection.md)
