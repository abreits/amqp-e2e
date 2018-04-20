/**
 * Tests for ket-manager
 * Created by Ab on 2018-04-16.
 */
import * as fs from "fs";
import * as Chai from "chai";
var expect = Chai.expect;

import { Key } from "./key";

// dat computation constants for tests
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const today = new Date().getDate();

/* istanbul ignore next */
describe("Test the Key class", () => {
    it("should create a simple key", () => {
        const key = Key.create();

        expect(key.key.length).to.equal(32);
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
        const key = Key.create();

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
        const key = Key.create();

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
