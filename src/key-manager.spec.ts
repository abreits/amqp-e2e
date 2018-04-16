/**
 * Tests for ket-manager
 * Created by Ab on 2018-04-16.
 */
import * as Chai from "chai";
var expect = Chai.expect;

import { Key, KeyManager } from "./key-manager";

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
            expect(km.get(key.id)).to.equal(key);
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
            throw new Error ("Error expected");
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
            throw new Error ("Error expected");
        });
        // todo: more complex setEncryptionkey() actions
        // situations:
        //  - one candidate
        //  - multiple candidates, choose most recently added
        //  - no candidate

    });
});
