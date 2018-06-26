/**
 * speed-test, testing speed of various encryption methods
 * Created 2018-04-18 by Ab Reitsma
 */


// import * as Promise from "bluebird";
import * as Amqp from "amqp-ts";
import { Key } from "./key";
import { RsaKey } from "./rsa-key";
import { CryptoMessage } from "./crypto-message";

// define test defaults
const testMsg = "This message should get through, at least I very much hope it will!!!";

const testAesKeyBuffer = Buffer.from("5d999a80f53e7957aef724d7881776ad969467c8c9574dd15c01e4bcca8afa74", "hex");
const testPublicKeyPem = "-----BEGIN PUBLIC KEY-----\n" +
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8fLqIFZCN1mpoGUXcpgE\n" +
    "IVoHdPp2CQmLT9TKx/cUks7fIkHJstuo8/+fskU9MWtWH57J0eC9FHxKxBJ8AtsQ\n" +
    "nCyLk/QeqmgwXUBo8SQO1Ic69wTrYDHydvrPa4GUDB4ZbAylntvMNcOelknm1X4Q\n" +
    "9wT2FMm4+MTi5ViFIgx8IXugq6iEbaD7iAYFGx2WNKqJ61+C0t1rI+VWJL8fzuho\n" +
    "85OZfXoeHixnP01i3wBQu6Mt+MVk9mWxjFJsJdjXiOQ1foF5+FzcdSdOVIgbQB0W\n" +
    "+BvbyDlao0Bg00xPSLoWLkpaXAwDNoAqmU7GfyydgchCfTZ1kxVycxT83Ro+ssHF\n" +
    "BQIDAQAB\n" +
    "-----END PUBLIC KEY-----\n";
const connectionUrl = "amqp://open_amqp";
const testCountMax = 100000;
const rsaCount = 5;

// just time the difference in creating the message,
// everything else should take the same amount of time

// initialize amqp test connection
const testConnection = new Amqp.Connection(connectionUrl);
const testExchange = testConnection.declareExchange("speed-test");

// initialize encryption aids
let testAesKey = Key.create(testAesKeyBuffer);
let testRsaKey = new RsaKey(testPublicKeyPem);

// reference run, send messages without encryption
function timePlain() {
    return new Promise<void>(function (resolve, reject) {
        let testCount = 0;
        const startTime = Date.now();
        console.log("starting plain message test");
        function loop() {
            testCount += 1;
            if (testCount < testCountMax) {
                let dummyMsg = new Amqp.Message(testMsg);
                dummyMsg.sendTo(testExchange);
                setImmediate(loop);
            } else {
                const ms = Date.now() - startTime;
                const msgPerSec = Math.round(testCountMax / (ms / 1000));
                console.log("plain messages: " + ms + " ms, " + msgPerSec + " msg/sec");
                resolve();
            }
        }
        setImmediate(loop);
    });
}

function timeAES() {
    return new Promise<void>(function (resolve, reject) {
        let testCount = 0;

        const startTime = Date.now();
        console.log("starting AES message encryption test");
        function loop() {
            testCount += 1;
            if (testCount < testCountMax) {
                let dummyMsg = new CryptoMessage(testMsg);
                dummyMsg.encrypt(testAesKey);
                dummyMsg.sendTo(testExchange);
                setImmediate(loop);
            } else {
                const ms = Date.now() - startTime;
                const msgPerSec = Math.round(testCountMax / (ms / 1000));
                console.log("AES encrypted messages: " + ms + " ms, " + msgPerSec + " msg/sec");
                resolve();
            }
        }
        setImmediate(loop);
    });
}

function timeRSA(endpoints) {
    return new Promise<void>(function (resolve, reject) {
        let testCount = 0;

        const startTime = Date.now();
        console.log("starting RSA message encryption test");
        function loop() {
            testCount += 1;
            if (testCount < testCountMax) {
                let dummyMsg = new CryptoMessage(testMsg);
                dummyMsg.encrypt(testAesKey);
                for (let i = 0; i < endpoints; i += 1) {
                    testRsaKey.publicEncrypt(testAesKeyBuffer);
                }
                dummyMsg.sendTo(testExchange);
                setImmediate(loop);
            } else {
                const ms = Date.now() - startTime;
                const msgPerSec = Math.round(testCountMax / (ms / 1000));
                console.log("RSA encrypted messages, " + endpoints + " endpoints: " + ms + " ms, " + msgPerSec + " msg/sec");
                resolve();
            }
        }
        setImmediate(loop);
    });
}

// console.log("start");
// new Promise((resolve, reject) => {
//     setTimeout(() => resolve(1), 5000);
// })
//     .then((result) => {
//         console.log("result is: " + result);
//     });

// start the tests
testConnection.completeConfiguration()
    .then(timePlain)
    .then(timeAES)
    .then(() => { return timeRSA(1); })
    .then(() => { return timeRSA(2); })
    .then(() => { return timeRSA(3); })
    .then(() => { return timeRSA(4); })
    .then(() => { return timeRSA(5); })
    .then(() => { process.exit(0); })
    .catch((err) => {
        console.log("An errot occurred: " + err);
    });
