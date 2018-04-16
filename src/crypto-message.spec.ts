/**
 * Tests for crypto-message
 * Created by Ab on 2018-04-16.
 */
import * as Chai from "chai";
var expect = Chai.expect;


import CryptoMessage from "./crypto-message";
import {Key, KeyManager} from "./key-manager";

const testData = Buffer.from("This is a small line of text to test encryption and decryption");
const testKey = new Key();
const testKeyManager = new KeyManager();
const testKey1ActivateOn = new Key(testKeyManager);
const testKey2ActivateOn = new Key(testKeyManager);
testKeyManager.setEncryptionKey(testKey1ActivateOn);

/* istanbul ignore next */
describe("Test crypto-message module", () => {
    it("should 'encrypt' and 'decrypt' a message with a random iv and simple key", () => {
        const cryptoMsg = new CryptoMessage(testData);
        cryptoMsg.encrypt(testKey);
        cryptoMsg.decrypt(testKey);
        expect(cryptoMsg.content).to.deep.equal(testData);
    });
    it("Tampered messages should throw an error", () => {
        const cryptoMsg = new CryptoMessage(testData);
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
        const cryptoMsg = new CryptoMessage(testData);
        cryptoMsg.encrypt(testKeyManager);
        cryptoMsg.decrypt(testKeyManager);
        expect(cryptoMsg.content).to.deep.equal(testData);
    });
});
