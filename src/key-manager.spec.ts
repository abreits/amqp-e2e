/**
 * Tests for ket-manager
 * Created by Ab on 2018-04-16.
 */
import * as fs from "fs";
import * as Chai from "chai";
var expect = Chai.expect;

import { Key, KeyManager } from "./key-manager";

// dat computation constants for tests
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const today = new Date().getDate();

/* istanbul ignore next */
describe("Test crypto-message module", () => {
    describe("Test the Key class", () => {
        it("should create a simple key", () => {
            const key = new Key();

            expect(key.key.length).to.equal(32);
            expect(key.id).to.not.exist;
            expect(key.created).to.be.a.instanceof(Date);
        });
        it("should create a key for a keyManager", () => {
            const km = new KeyManager();
            const key = new Key(km);

            expect(key.key.length).to.equal(32);
            expect(key.id.length).to.equal(8);
            expect(key.created).to.be.a.instanceof(Date);
            // expect the key to be added to the keymanager
            // console.log("");
            // console.log(key.key.toString("hex"));
            expect(km.get(key.id)).to.equal(key);
        });
        it("should export a simple key", () => {
            const key = new Key();
            // make a constant key for testing purposes
            key.key = Buffer.from("a9ITQAFpNi+wJqrw4n7SznGJ3rtACO1GoX8iYUHke+8=", "base64");
            key.created = new Date(1523697157207);

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


    });
    describe("Test the KeyManager class", () => {
        it("should add multiple keys to a KeyManager", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            expect(km.get(key1.id)).to.equal(key1);
            expect(km.get(key2.id)).to.equal(key2);
        });
        it("should add multiple keys to a KeyManager", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            expect(km.get(key1.id)).to.equal(key1);
            expect(km.get(key2.id)).to.equal(key2);
        });
        it("should set an encryptionkey", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            km.setEncryptionKey(key1);
            expect(km.getEncryptionKey()).to.equal(key1);
        });
        it("should not allow to set an external encryptionkey", () => {
            let km = new KeyManager();
            let key1 = new Key();
            let key2 = new Key(km);
            try {
                km.setEncryptionKey(key1);
            } catch (e) {
                expect(e.message).to.equal("Empty KeyManager id");
                return;
            }
            throw new Error("Error expected");
        });
        it("should not allow to set an encryptionkey from another KeyManager", () => {
            let km1 = new KeyManager();
            let km2 = new KeyManager();
            let key1 = new Key(km1);
            let key2 = new Key(km2);
            try {
                km1.setEncryptionKey(key2);
            } catch (e) {
                expect(e.message).to.equal("key not in KeyManager");
                return;
            }
            throw new Error("Error expected");
        });
        it("should not allow to set an encryptionkey from another KeyManager even if it has the same id", () => {
            let km1 = new KeyManager();
            let km2 = new KeyManager();
            let key1 = new Key(km1);
            let key2 = new Key(km2);
            // make id same
            key2.id = key1.id;
            try {
                km1.setEncryptionKey(key2);
            } catch (e) {
                expect(e.message).to.equal("key not in KeyManager");
                return;
            }
            throw new Error("Error expected");
        });
        it("should set the active key to the most recently created when more candidates are active", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            let key3 = new Key(km);
            //adjust creation Date
            key1.created.setDate(today - 5);
            key2.created.setDate(today - 2);
            key3.created.setDate(today - 3);

            const key = km.setEncryptionKey();

            expect(key).to.equal(key2);
        });
        it("should return undefined when no candidates are active", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            let key3 = new Key(km);
            //adjust creation Date

            key1.created.setDate(today - 5);
            key1.activateOn = new Date(now - 5 * day);
            key1.activateOff = new Date(now - 5 * day);
            key2.created.setDate(today - 2);
            key2.activateOn = new Date(now - 2 * day);
            key2.activateOff = new Date(now - 1 * day);
            key3.created.setDate(today - 3);
            key3.activateOn = new Date(now - 3 * day);
            key3.activateOff = new Date(now - 2 * day);

            const key = km.setEncryptionKey();

            expect(key).to.equal(undefined);
        });
        it("should return the candidate that is active", () => {
            let km = new KeyManager();
            let key1 = new Key(km);
            let key2 = new Key(km);
            let key3 = new Key(km);

            key1.created.setDate(today - 5);
            key1.activateOn = new Date(now - 5 * day);
            key1.activateOff = new Date(now + 5 * day);
            key2.created.setDate(today - 2);
            key2.activateOn = new Date(now - 2 * day);
            key2.activateOff = new Date(now - 1 * day);
            key3.created.setDate(today - 3);
            key3.activateOn = new Date(now - 3 * day);
            key3.activateOff = new Date(now - 2 * day);

            const key = km.setEncryptionKey();

            expect(key).to.equal(key1);
        });
        it("should persist to a file", () => {
            let persistFile = "testKeyManager.json";
            if (fs.existsSync(persistFile)) {
                fs.unlinkSync(persistFile);
            }

            let km = new KeyManager(persistFile);
            let key1 = new Key(km);
            let key2 = new Key(km);
            let key3 = new Key(km);

            key1.created.setDate(today - 5);
            key1.activateOn = new Date(now - 5 * day);
            key1.activateOff = new Date(now + 5 * day);
            key2.created.setDate(today - 2);
            key2.activateOn = new Date(now - 2 * day);
            key2.activateOff = new Date(now - 1 * day);
            key3.created.setDate(today - 3);
            key3.activateOn = new Date(now - 3 * day);
            key3.activateOff = new Date(now - 2 * day);
            km.setEncryptionKey();

            km.persist();
            let km2 = new KeyManager(persistFile);
            fs.unlinkSync(persistFile);

            expect(km2).to.deep.equal(km);
        });
    });
});
