/**
 * Tests for crypto-message
 * Created by Ab on 2018-04-16.
 */
import * as Chai from "chai";
var expect = Chai.expect;

import * as Amqp from "amqp-ts";
import {CryptoMessage, addCryptoMessage} from "./crypto-message";
addCryptoMessage();
import {Key} from "./key";
import {KeyManager} from "./key-manager";

const testData = Buffer.from("This is a small line of text to test encryption and decryption");
const testKey = Key.create();
const testKeyManager = new KeyManager();
const testKey1ActivateOn = Key.create();
const testKey2ActivateOn = Key.create();
testKeyManager.add(testKey1ActivateOn);
testKeyManager.add(testKey2ActivateOn);
testKeyManager.setEncryptionKey(testKey1ActivateOn);

/* istanbul ignore next */
describe("Test crypto-message module", () => {
    it("should 'encrypt' and 'decrypt' a message with a random iv and simple key", () => {
        const cryptoMsg = new Amqp.Message(testData) as CryptoMessage;
        cryptoMsg.encrypt(testKey);
        cryptoMsg.decrypt(testKey);
        expect(cryptoMsg.content).to.deep.equal(testData);
    });
    it("Tampered messages should throw an error", () => {
        const cryptoMsg = new Amqp.Message(testData) as CryptoMessage;
        cryptoMsg.encrypt(testKey);
        // change value at location 45
        let oldValue = cryptoMsg.content[45];
        let newValue = oldValue;
        while (newValue === oldValue) {
            newValue = Math.floor(Math.random()*255);
            cryptoMsg.content.writeUInt8(newValue, 45);
        }
        try {
            cryptoMsg.decrypt(testKey);
        } catch (e) {
            expect(e.message).to.equal("Unsupported state or unable to authenticate data");
            return;
        }
        throw new Error("No error thrown");
    });
    it("should 'encrypt' and 'decrypt' a message with a random iv and key manager", () => {
        const cryptoMsg = new Amqp.Message(testData) as CryptoMessage;
        cryptoMsg.encrypt(testKeyManager);
        cryptoMsg.decrypt(testKeyManager);
        expect(cryptoMsg.content).to.deep.equal(testData);
    });
});
