/**
 * tests for simple-crypto-shovel.ts
 * Created 2018-04-18 by Ab Reitsma
 */

import * as Chai from "chai";
const expect = Chai.expect;
import * as path from "path";

import * as Amqp from "amqp-ts";
import { SimpleCryptoShovel } from "./crypto-shovel-simple";
import { getFile } from "./crypto-shovel";

// define test defaults
const ConnectionUrl = "amqp://open_amqp";
const UnitTestTimeout = 1500;
const LogLevel = process.env.AMQPTEST_LOGLEVEL || "critical";
const configFolder = path.join(__dirname, "../test-data/simple-crypto-shovel/");
const testMsg = "This message should get through, at least I very much hope it will!!!";
const testRoutingKey = "test.routing.key";

// set logging level
Amqp.log.transports.console.level = LogLevel;

describe("Test SimpleCryptoShovel class", function () {
    let encryptionShovel: SimpleCryptoShovel;
    let decryptionShovel: SimpleCryptoShovel;
    let conn: Amqp.Connection;
    let send: Amqp.Exchange;
    let receive: Amqp.Exchange;

    this.timeout(UnitTestTimeout); // define default timeout

    after(function(done) {
        Promise.all([
            encryptionShovel.stop(),
            decryptionShovel.stop(),
            conn.deleteConfiguration().then(() => { return conn.close(); })
        ]).then(() => {
            done();
        });
    });

    it("should create an encryption and decryption shovel and send data through it", (done) => {
        // create the sending and receiving shovel
        let encryptFile = getFile(path.join(configFolder, "simple-encrypt-shovel-config.json"));
        let decryptFile = getFile(path.join(configFolder, "simple-decrypt-shovel-config.json"));        
        encryptionShovel = new SimpleCryptoShovel(JSON.parse(encryptFile));
        decryptionShovel = new SimpleCryptoShovel(JSON.parse(decryptFile));
        encryptionShovel.start();
        decryptionShovel.start();

        // this function should receive the decrypted message
        function receiver(msg: Amqp.Message) {
            expect(msg.getContent()).to.equal(testMsg);
            expect(msg.fields.routingKey).to.equal(testRoutingKey);
            done();
        }

        // wait for everything to initialize
        Promise.all([
            encryptionShovel.initialized,
            decryptionShovel.initialized
        ]).then(() => {
            // test if the shovel works
            conn = new Amqp.Connection(ConnectionUrl);
            send = conn.declareExchange("simple-src-exchange", "fanout", { noCreate: true });
            receive = conn.declareExchange("simple-dest-exchange", "fanout", { noCreate: true });
            receive.activateConsumer(receiver, {noAck: true});
            return conn.initialized;
        }).then(() => {
            // workaround: receive.activateConsumer appears to need some extra time to set up?
            setTimeout(() => {
                const msg = new Amqp.Message(testMsg);
                msg.sendTo(send, testRoutingKey);
            }, 50);
        });
    });
});