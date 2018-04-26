/**
 * tests for simple-crypto-shovel.ts
 * Created 2018-04-18 by Ab Reitsma
 */

import * as fs from "fs";
import * as path from "path";
import * as Chai from "chai";
const expect = Chai.expect;

import { KeyDistributor, KeyDistributorDefinition } from "./key-distributor";
import { KeyReceiver, KeyReceiverDefinition } from "./key-receiver";
import { RsaKey } from "./rsa-key";

// test functionality added to the KeyDistributor class
class KeyDistributorTest extends KeyDistributor {
    // to inspect internal state of the class
    get test() {
        return {
            receivers: this.receivers,
            activeReceivers: this.activeReceivers,
            keys: this.keys,
            activeKeyChangeTime: this.activeKeyChangeTime,
            nextKey: this.nextKey,
            nextKeySent: this.nextKeySent,
            nextKeyNotSent: this.nextKeyNotSent,
            timer: this.timer
        };
    }

    static fromConfigFile(receiverFile: string) {
        return new KeyDistributorTest({
            connection: null,
            key: senderKey,
            receiverPath: receiverPath,
            receiverFile: receiverFile
        });
    }

    static startTest(testConfig: KeyReceiverDefinition[]) {
        let keyDistributor = new KeyDistributorTest({
            connection: null,
            key: senderKey,
            receiverPath: receiverPath
        });
    }

    // catch setTimeout calls
    timeoutHandler: (waitPeriod: number) => boolean;
    setTimeout(waitPeriod: number) {
        if(this.timeoutHandler(waitPeriod)) {
            super.setTimeout(waitPeriod);
        }
    }

    // catch next keys sent
    sendKeyHandler: (receiver: KeyReceiver) => void;
    sendNextKey(receiver: KeyReceiver) {
        this.sendKeyHandler(receiver);
    }
}

// read rsa keys for tests
const rsaPath = path.join(__dirname, "../test-data/rsa-keys");
const receiverPath = path.join(__dirname, "../test-data/key-distributor");
const senderPrivateKey = fs.readFileSync(path.join(rsaPath, "sender.private"), "utf8");
const senderPublicKey = fs.readFileSync(path.join(rsaPath, "sender.public"), "utf8");
const senderKey = new RsaKey(senderPublicKey, senderPrivateKey);

// define timing test constants
const tu = 10; // minimal time unit in ms to successfully test on with timeout tests

describe("Test KeyDistributor class", function() {
    it("should create a receiver list from a file", () => {
        let keyDistributor = KeyDistributorTest.fromConfigFile("receivers.json");
        keyDistributor.processReceiverConfigFile();
        expect(keyDistributor.test.receivers.size).to.equal(4);
    });
    it("should get the active receivers on a specified Date", () => {
        let keyDistributor = KeyDistributorTest.fromConfigFile("receivers.json");
        keyDistributor.processReceiverConfigFile();
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-06-01T00:00:00.000Z")).size).to.equal(4);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-02-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-10-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2002-06-01T00:00:00.000Z")).size).to.equal(2);
        expect(keyDistributor.getActiveReceiversOn(new Date("2012-01-01T00:00:00.000Z")).size).to.equal(2);
    });
    it("should get the active receivers on a specified Date", () => {
        let keyDistributor = new KeyDistributorTest({
            connection: null,
            key: senderKey,
            receiverPath: receiverPath
        });
        keyDistributor.processReceiverConfigFile();
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-06-01T00:00:00.000Z")).size).to.equal(4);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-02-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-10-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2002-06-01T00:00:00.000Z")).size).to.equal(2);
        expect(keyDistributor.getActiveReceiversOn(new Date("2012-01-01T00:00:00.000Z")).size).to.equal(2);
    });
    //todo: define as much edge cases as we can

});