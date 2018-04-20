/**
 * Tests for ket-manager
 * Created by Ab on 2018-04-16.
 */
import * as fs from "fs";
import * as Chai from "chai";
var expect = Chai.expect;

import { Key } from "./key";
import { KeyManager } from "./key-manager";

// dat computation constants for tests
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const today = new Date().getDate();

/* istanbul ignore next */

describe("Test the KeyManager class", () => {
    it("should add multiple keys to a KeyManager", () => {
        let km = new KeyManager();
        let key1 = Key.create();
        let key2 = Key.create();
        km.add(key1);
        km.add(key2);
        expect(km.get(key1.id)).to.equal(key1);
        expect(km.get(key2.id)).to.equal(key2);
    });
    it("should add multiple keys to a KeyManager", () => {
        let km = new KeyManager();
        let key1 = Key.create();
        let key2 = Key.create();
        km.add(key1);
        km.add(key2);
        expect(km.get(key1.id)).to.equal(key1);
        expect(km.get(key2.id)).to.equal(key2);
    });
    it("should set an encryptionkey", () => {
        let km = new KeyManager();
        let key1 = Key.create();
        let key2 = Key.create();
        km.add(key1);
        km.add(key2);
        km.setEncryptionKey(key1);
        expect(km.getEncryptionKey()).to.equal(key1);
    });
    it("should not allow to set an external encryptionkey", () => {
        let km = new KeyManager();
        let key1 = Key.create();
        let key2 = Key.create();
        km.add(key2);
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
        let key1 = Key.create();
        let key2 = Key.create();
        km1.add(key1);
        km2.add(key2);
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
        let key1 = Key.create();
        let key2 = Key.create();
        km1.add(key1);
        km2.add(key2);
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
        let key1 = Key.create();
        let key2 = Key.create();
        let key3 = Key.create();
        km.add(key1);
        km.add(key2);
        km.add(key3);
        //adjust creation Date
        key1.created.setDate(today - 5);
        key2.created.setDate(today - 2);
        key3.created.setDate(today - 3);

        const key = km.setEncryptionKey();

        expect(key).to.equal(key2);
    });
    it("should return undefined when no candidates are active", () => {
        let km = new KeyManager();
        let key1 = Key.create();
        let key2 = Key.create();
        let key3 = Key.create();
        km.add(key1);
        km.add(key2);
        km.add(key3);
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
        let key1 = Key.create();
        let key2 = Key.create();
        let key3 = Key.create();
        km.add(key1);
        km.add(key2);
        km.add(key3);

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
        let key1 = Key.create();
        let key2 = Key.create();
        let key3 = Key.create();
        km.add(key1);
        km.add(key2);
        km.add(key3);

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
