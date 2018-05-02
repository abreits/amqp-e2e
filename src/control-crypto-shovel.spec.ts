/**
 * tests for simple-crypto-shovel.ts
 * Created 2018-04-18 by Ab Reitsma
 */

import * as Chai from "chai";
const expect = Chai.expect;
import * as path from "path";

import * as Amqp from "amqp-ts";
import { ControlCryptoShovel } from "./control-crypto-shovel";

// define test defaults
const ConnectionUrl = "amqp://open_amqp";
const UnitTestTimeout = 1500;
const LogLevel = process.env.AMQPTEST_LOGLEVEL || "critical";
const configFolder = path.join(__dirname, "../test-data/control-crypto-shovel/");
const rsaKeyFolder = path.join(__dirname, "../test-data/rsa-keys/");
const testMsg = "This message should get through, at least I very much hope it will!!!";
const testRoutingKey = "test.routing.key";

// set logging level
Amqp.log.transports.console.level = LogLevel;

describe("Test ControlCryptoShovel class", function () {
    let encryptionShovel: ControlCryptoShovel;
    let decryptionShovel: ControlCryptoShovel;
    let conn: Amqp.Connection;
    let send: Amqp.Exchange;
    let receive: Amqp.Exchange;

    this.timeout(UnitTestTimeout); // define default timeout

    after(function (done) {
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
        encryptionShovel = new ControlCryptoShovel(path.join(configFolder, "control-send-shovel-config.json"));
        decryptionShovel = new ControlCryptoShovel(path.join(configFolder, "control-receive1-shovel-config.json"));
        // this function should receive the decrypted messages only
        function receiver(msg: Amqp.Message) {
            expect(msg.getContent()).to.equal(testMsg);
            expect(msg.fields.routingKey).to.equal(testRoutingKey);
            done();
        }
        encryptionShovel.start(100);
        decryptionShovel.start();
        // wait for everything to initialize
        Promise.all([
            encryptionShovel.initialized,
            decryptionShovel.initialized
        ]).then(() => {
            // test if the shovel works
            conn = new Amqp.Connection(ConnectionUrl);
            send = conn.declareExchange("control-src-exchange", "fanout", { noCreate: true });
            receive = conn.declareExchange("control-dest-exchange", "fanout", { noCreate: true });
            receive.activateConsumer(receiver, { noAck: true });
            return conn.initialized;
        }).then(() => {
            setTimeout(() => {
                // expect the receiver shovel to have received a key
                expect(decryptionShovel.keys.keys.size).to.equal(1);
                // send a test message
                const msg = new Amqp.Message(testMsg);
                msg.sendTo(send, testRoutingKey);
                //done();
            }, 200);
        });
    });
});