/**
 * Tests for key class
 * Created by Ab on 2018-04-16.
 */
import * as fs from "fs";
import * as path from "path";
import * as Chai from "chai";
var expect = Chai.expect;

import { RsaKey } from "./rsa-key";
import { Key } from "./key";
import { KEY_LENGTH } from "./crypto-message";

// date computation constants for tests
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const today = new Date().getDate();

// read rsa keys for tests
const rsaPath = path.join(__dirname, "../test-data/rsa-keys");
const senderPrivateKey = fs.readFileSync(path.join(rsaPath, "sender.private"), "utf8");
const senderPublicKey = fs.readFileSync(path.join(rsaPath, "sender.public"), "utf8");
const senderKey = new RsaKey(senderPublicKey, senderPrivateKey);
const receiverPrivateKey = fs.readFileSync(path.join(rsaPath, "receiver1.private"), "utf8");
const receiverPublicKey = fs.readFileSync(path.join(rsaPath, "receiver1.public"), "utf8");
const receiverKey = new RsaKey(receiverPublicKey, receiverPrivateKey);

/* istanbul ignore next */
describe("Test the Key class", () => {
    it("should create a simple key", () => {
        const key = Key.create();

        expect(key.key.length).to.equal(KEY_LENGTH);
        expect(key.id).to.not.exist;
        expect(key.created).to.be.a.instanceof(Date);
    });
    it("should export a simple key", () => {
        const key = Key.create(
            Buffer.from("a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=", "base64"),
            null,
            new Date(1523697157207)
        );

        expect(key.export()).to.equal("{\"k\":\"a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=\",\"c\":1523697157207}");
    });
    it("should export a complete key", () => {
        const key = new Key();

        // make a constant key for testing purposes
        key.id = Buffer.from("bUcmwfgbWhE=", "base64");
        key.key = Buffer.from("a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=", "base64");
        key.activateOn = new Date(1523956965337);
        key.activateOff = new Date(1524043365337);
        key.created = new Date(1523697157207);

        expect(key.export()).to.equal("{\"i\":\"bUcmwfgbWhE=\"," +
            "\"k\":\"a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=\"," +
            "\"a\":1523956965337," +
            "\"d\":1524043365337," +
            "\"c\":1523697157207}");
    });
    it("should import an exported key", () => {
        const key = new Key();

        // make a constant key for testing purposes
        key.id = Buffer.from("bUcmwfgbWhE=", "base64");
        key.key = Buffer.from("a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=", "base64");
        key.activateOn = new Date(1523956965337);
        key.activateOff = new Date(1524043365337);
        key.created = new Date(1523697157207);

        const keyExport = key.export();
        const importedKey = Key.import(keyExport);

        expect(importedKey).to.deep.equal(key);
    });
    it("should not encrypt a key missing key and id", () => {
        const key = new Key();

        try {
            key.encrypt(receiverKey, senderKey);
        } catch (e) {
            expect(e.message).to.equal("Trying to encrypt incomplete Key");
            return;
        }
        throw new Error("key.encrypt(...) should throw an error");
    });
    it("should not encrypt a key missing key", () => {
        const key = new Key();
        key.id = Buffer.from("bUcmwfgbWhE=", "base64");

        try {
            key.encrypt(receiverKey, senderKey);
        } catch (e) {
            expect(e.message).to.equal("Trying to encrypt incomplete Key");
            return;
        }
        throw new Error("key.encrypt(...) should throw an error");
    });
    it("should not encrypt a key missing id", () => {
        const key = Key.create();

        try {
            key.encrypt(receiverKey, senderKey);
        } catch (e) {
            expect(e.message).to.equal("Trying to encrypt incomplete Key");
            return;
        }
        throw new Error("key.encrypt(...) should throw an error");
    });
    it("should encrypt a key and decrypt a key", () => {
        const key = Key.create();
        key.id = Buffer.from("bUcmwfgbWhE=", "base64");
        key.activateOff = new Date(1524043365337);

        const encryptedKey = key.encrypt(receiverKey, senderKey);
        const decryptedKey = Key.decrypt(encryptedKey, receiverKey, senderKey);

        expect(decryptedKey.activateOff).to.deep.equal(key.activateOff);
        expect(decryptedKey.key).to.deep.equal(key.key);
        expect(decryptedKey.id).to.deep.equal(key.id);
    });
});
