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

// define test defaults
const UnitTestTimeout = 1500;

// global tests settings
const receiverPath = path.join(__dirname, "../test-data/key-distributor");
const senderPrivateKey = fs.readFileSync(path.join(receiverPath, "sender.private"), "utf8");
const senderPublicKey = fs.readFileSync(path.join(receiverPath, "sender.public"), "utf8");
const senderKey = new RsaKey(senderPublicKey, senderPrivateKey);
const receiver1Key = new RsaKey(fs.readFileSync(path.join(receiverPath, "receiver1.public"), "utf8"));
const receiver2Key = new RsaKey(fs.readFileSync(path.join(receiverPath, "receiver2.public"), "utf8"));
const receiver3Key = new RsaKey(fs.readFileSync(path.join(receiverPath, "receiver3.public"), "utf8"));
const receiver4Key = new RsaKey(fs.readFileSync(path.join(receiverPath, "receiver4.public"), "utf8"));

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

    static configDistributors: KeyDistributor[] = [];
    static configFiles: Set<string> = new Set();
    static fromConfigFile(receiverFile: string, deleteFile = true) {
        let kd = new KeyDistributorTest({
            connection: null,
            key: senderKey,
            receiverPath: receiverPath,
            receiverFile: receiverFile
        });
        KeyDistributorTest.configDistributors.push(kd);
        if (deleteFile) {
            KeyDistributorTest.configFiles.add(path.join(receiverPath, receiverFile));
        }

        return kd;
    }
    static cleanupTests() {
        for (let i = 0; i < KeyDistributorTest.configDistributors.length; i += 1) {
            KeyDistributorTest.configDistributors[i].stop();
        }
        for (let filename of KeyDistributorTest.configFiles) {
            fs.unlinkSync(filename);
        }
    }

    // catch setTimeout calls
    timeoutHandler: (waitPeriod: number) => () => void;
    setTimeout(waitPeriod: number) {
        let done = this.timeoutHandler(waitPeriod);
        if (done) {
            this.stop();
            done();
        } else {
            super.setTimeout(waitPeriod);
        }
    }

    // catch next keys sent
    sendKeyHandler: (receiver: KeyReceiver) => void;
    sendNextKey(receiver: KeyReceiver) {
        this.sendKeyHandler(receiver);
    }
}


function createReceiversFile(receiverFile: string, testConfig: KeyReceiverDefinition[]) {
    let configString = JSON.stringify(testConfig, null, 4);
    fs.writeFileSync(path.join(receiverPath, receiverFile), configString, { encoding: "utf8" });
}

function deleteReceiversFile(receiverFile: string) {
    fs.unlinkSync(path.join(receiverPath, receiverFile));
}

// define timing test constants
const tu = 10; // minimal time unit in ms to successfully test on with timeout tests

describe("Test KeyDistributor class", function () {
    this.timeout(UnitTestTimeout); // define default timeout

    after(function () {
        KeyDistributorTest.cleanupTests();
    });

    it("should create a receiver list from a file", () => {
        let keyDistributor = KeyDistributorTest.fromConfigFile("receivers.json", false);
        keyDistributor.processReceiverConfigFile();
        expect(keyDistributor.test.receivers.size).to.equal(4);
    });
    it("should get the active receivers on a specified Date", () => {
        let keyDistributor = KeyDistributorTest.fromConfigFile("receivers.json", false);
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
    it("should immediately send new keys after start", (done) => {
        const filename = "test1.json";
        createReceiversFile(filename, [
            {
                key: "receiver1.public"
            }
        ]);
        let keyDistributor = KeyDistributorTest.fromConfigFile(filename);
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            expect(receiver.id).to.equal(receiver1Key.hash.toString("hex"));
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });
    it("should immediately send multiple new keys after start", (done) => {
        const filename = "test2.json";
        createReceiversFile(filename, [
            {
                key: "receiver1.public"
            },
            {
                key: "receiver2.public"
            }
        ]);
        let keyDistributor = KeyDistributorTest.fromConfigFile(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });
    it("should immediately add extra keys after updating file with extra key", (done) => {
        const filename = "test3.json";
        createReceiversFile(filename, [
            {
                key: "receiver1.public"
            },
            {
                key: "receiver2.public"
            }
        ]);
        let keyDistributor = KeyDistributorTest.fromConfigFile(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    createReceiversFile(filename, [
                        {
                            key: "receiver1.public"
                        },
                        {
                            key: "receiver2.public"
                        },
                        {
                            key: "receiver3.public"
                        }
                    ]);
                    keyCount = 0;
                    return null;
                case 3:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 4:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(1);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });
    it("should immediately resend new keys after removing key from file", (done) => {
        const filename = "test3.json";
        createReceiversFile(filename, [
            {
                key: "receiver1.public"
            },
            {
                key: "receiver2.public"
            },
            {
                key: "receiver3.public"
            }
        ]);
        let keyDistributor = KeyDistributorTest.fromConfigFile(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    createReceiversFile(filename, [
                        {
                            key: "receiver2.public"
                        },
                        {
                            key: "receiver3.public"
                        }
                    ]);
                    keyCount = 0;
                    return null;
                case 3:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 4:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    //todo: define as much edge cases as we can
});
