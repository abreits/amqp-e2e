/**
 * tests for simple-crypto-shovel.ts
 * Created 2018-04-18 by Ab Reitsma
 */

import * as fs from "fs";
import * as path from "path";
import * as Chai from "chai";
const expect = Chai.expect;

import { KeyDistributor, KeyDistributorConfig } from "./key-distributor";
import { KeyReceiver, KeyReceiverDefinition, KeyReceiverDefinitions } from "./key-receiver";
import { RsaKey } from "./rsa-key";

// define test defaults
const UnitTestTimeout = 1500;
const tu = 20; // minimal time unit in ms to successfully test on with timeout tests
let keyRotationInterval = tu * 8;
let startUpdateWindow = tu * 6;
let endUpdateWindow = tu * 2;

// global tests settings
const distributorTestFolder = path.join(__dirname, "../test-data/key-distributor");
const rsaKeyFolder = path.join(__dirname, "../test-data/rsa-keys");
const senderPrivateKey = fs.readFileSync(path.join(rsaKeyFolder, "sender.private"), "utf8");
const senderPublicKey = fs.readFileSync(path.join(rsaKeyFolder, "sender.public"), "utf8");
const senderKey = new RsaKey(senderPublicKey, senderPrivateKey);
const receiver1Key = new RsaKey(fs.readFileSync(path.join(rsaKeyFolder, "receiver1.public"), "utf8"));
const receiver2Key = new RsaKey(fs.readFileSync(path.join(rsaKeyFolder, "receiver2.public"), "utf8"));
const receiver3Key = new RsaKey(fs.readFileSync(path.join(rsaKeyFolder, "receiver3.public"), "utf8"));
const receiver4Key = new RsaKey(fs.readFileSync(path.join(rsaKeyFolder, "receiver4.public"), "utf8"));

// test wrapper for the KeyDistributor class
// expose a few internals for tsting and add test setup and cleanup tools
class KeyDistributorTest extends KeyDistributor {
    // to inspect internal state of the class
    get test() {
        return {
            receivers: this.decryptReceivers,
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
    static create(config: string | { [id: string]: any }, deleteFile = true) {
        let distributor: KeyDistributorTest;
        let keyReceiverConfigFile: string;
        if (typeof config === "string") {
            keyReceiverConfigFile = config;
            distributor = new KeyDistributorTest({
                connection: null,
                rsaKey: senderKey,
                keyReceiverRsaKeyFolder: rsaKeyFolder,
                keyReceiverConfigFile: path.join(distributorTestFolder, keyReceiverConfigFile)
            });
        } else {
            keyReceiverConfigFile = config.keyReceiverConfigFile;
            distributor = new KeyDistributorTest({
                connection: null,
                rsaKey: senderKey,
                keyReceiverRsaKeyFolder: rsaKeyFolder,
                keyReceiverConfigFile: path.join(distributorTestFolder, keyReceiverConfigFile),
                keyRotationInterval: config.keyRotationInterval,
                startUpdateWindow: config.startUpdateWindow,
                endUpdateWindow: config.endUpdateWindow
            });
        }
        KeyDistributorTest.configDistributors.push(distributor);
        if (deleteFile) {
            KeyDistributorTest.configFiles.add(path.join(distributorTestFolder, keyReceiverConfigFile));
        }

        return distributor;
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
    timeoutHandler: (waitPeriod: number) => (() => void) | number;
    setTimeout(waitPeriod: number) {
        let done = this.timeoutHandler(waitPeriod);
        if (typeof done === "number") {
            super.setTimeout(done);
        } else if (done) {
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


function createReceiversFile(receiverFile: string, testConfig: KeyReceiverDefinitions) {
    let configString = JSON.stringify(testConfig, null, 4);
    fs.writeFileSync(path.join(distributorTestFolder, receiverFile), configString, { encoding: "utf8" });
}

function deleteReceiversFile(receiverFile: string) {
    fs.unlinkSync(path.join(distributorTestFolder, receiverFile));
}


describe("Test KeyDistributor class", function () {
    this.timeout(UnitTestTimeout); // define default timeout

    after(function () {
        KeyDistributorTest.cleanupTests();
    });

    it("should create a receiver list from a file", () => {
        let keyDistributor = KeyDistributorTest.create("receivers.json", false);
        keyDistributor.processkeyReceiverConfigFile();
        expect(keyDistributor.test.receivers.size).to.equal(4);
    });

    it("should get the active receivers on a specified Date", () => {
        let keyDistributor = KeyDistributorTest.create("receivers.json", false);
        keyDistributor.processkeyReceiverConfigFile();
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-06-01T00:00:00.000Z")).size).to.equal(4);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-02-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-10-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2002-06-01T00:00:00.000Z")).size).to.equal(2);
        expect(keyDistributor.getActiveReceiversOn(new Date("2012-01-01T00:00:00.000Z")).size).to.equal(2);
    });

    it("should get the active receivers on a specified Date", () => {
        let keyDistributor = new KeyDistributorTest({
            connection: null,
            rsaKey: senderKey,
            keyReceiverConfigFile: path.join(distributorTestFolder, "receivers.json"),
            keyReceiverRsaKeyFolder: rsaKeyFolder
        });
        keyDistributor.processkeyReceiverConfigFile();
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-06-01T00:00:00.000Z")).size).to.equal(4);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-02-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2010-10-01T00:00:00.000Z")).size).to.equal(3);
        expect(keyDistributor.getActiveReceiversOn(new Date("2002-06-01T00:00:00.000Z")).size).to.equal(2);
        expect(keyDistributor.getActiveReceiversOn(new Date("2012-01-01T00:00:00.000Z")).size).to.equal(2);
    });

    it("should immediately send new keys after start", (done) => {
        const filename = "test1.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            // expect the key to be sent to receiver1
            expect(receiver.id).to.equal(receiver1Key.hash.toString("hex"));
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return;
                case 2:
                    // expect the key to be updated after a 'nextkeychange interval'
                    expect(waitPeriod).to.be.greaterThan(0);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should immediately send multiple new keys after start", (done) => {
        const filename = "test2.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    // expect a key to be sent to both receivers
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should immediately send both encrypt and decrypt keys", (done) => {
        const filename = "test2.json";
        createReceiversFile(filename, {
            encrypt: {
                key: "receiver1.public"
            },
            decrypt: [
                {
                    key: "receiver2.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    // expect a key to be sent to both receivers
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should immediately restart key rotation interval after key rotation interval change", (done) => {
        const filename = "test3.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    // add key to config
                    createReceiversFile(filename, {
                        keyRotationInterval: 10000,
                        decrypt: [
                            {
                                key: "receiver1.public"
                            },
                            {
                                key: "receiver2.public"
                            }
                        ]
                    });
                    keyCount = 0;
                    return;
                case 3:
                    // expect immediate update
                    expect(waitPeriod).to.equal(0);
                    return;
                case 4:
                    // expect both receivers to receive a key update
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should immediately add extra keys after updating file with extra key", (done) => {
        const filename = "test3.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    // add key to config
                    createReceiversFile(filename, {
                        decrypt: [
                            {
                                key: "receiver1.public"
                            },
                            {
                                key: "receiver2.public"
                            },
                            {
                                key: "receiver3.public"
                            }
                        ]
                    });
                    keyCount = 0;
                    return;
                case 3:
                    // expect immediate update
                    expect(waitPeriod).to.equal(0);
                    return;
                case 4:
                    expect(waitPeriod).to.be.greaterThan(0);
                    // expect only the new receiver to receive a key update
                    expect(keyCount).to.equal(1);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should immediately resend new keys after removing key from file", (done) => {
        const filename = "test4.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                },
                {
                    key: "receiver3.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create(filename);
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    // remove active key from config
                    createReceiversFile(filename, {
                        decrypt: [
                            {
                                key: "receiver2.public"
                            },
                            {
                                key: "receiver3.public"
                            }
                        ]
                    });
                    keyCount = 0;
                    return null;
                case 3:
                    // should immediately react to deleted active receiver
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 4:
                    // remaining active receivers should have received a new key
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(2);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should space out resend new keys after key rotation interval", (done) => {
        const filename = "test5.json";
        createReceiversFile(filename,
            {
                decrypt: [
                    {
                        key: "receiver1.public"
                    },
                    {
                        key: "receiver2.public"
                    },
                    {
                        key: "receiver3.public"
                    }
                ]
            });
        let keyDistributor = KeyDistributorTest.create({
            keyReceiverConfigFile: filename,
            keyRotationInterval: keyRotationInterval,
            startUpdateWindow: startUpdateWindow,
            endUpdateWindow: endUpdateWindow
        });
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
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    keyCount = 0;
                    return;
                case 3:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(waitPeriod).to.be.lessThan(keyRotationInterval - startUpdateWindow + 2);
                    expect(keyCount).to.equal(1);
                    return null;
                case 4:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(waitPeriod).to.be.lessThan((startUpdateWindow - endUpdateWindow) / 2 + 2);
                    expect(keyCount).to.equal(2);
                    return null;
                case 5:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(waitPeriod).to.be.lessThan(endUpdateWindow + 2);
                    expect(keyCount).to.equal(3);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should space out resend new keys after key rotation interval", (done) => {
        const filename = "test5.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                },
                {
                    key: "receiver3.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create({
            keyReceiverConfigFile: filename,
            keyRotationInterval: keyRotationInterval,
            startUpdateWindow: startUpdateWindow,
            endUpdateWindow: endUpdateWindow
        });
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
                    return;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    keyCount = 0;
                    return;
                case 3:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(waitPeriod).to.be.lessThan(keyRotationInterval - startUpdateWindow + 2);
                    expect(keyCount).to.equal(1);
                    // make interval to exceed endUpdateInterval
                    return startUpdateWindow - endUpdateWindow + 1;
                case 4:
                    // expect all remaining keys to be sent at once
                    expect(waitPeriod).to.be.lessThan(endUpdateWindow + 2);
                    expect(keyCount).to.equal(3);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should resend a key to a receiver when resend is set to true", (done) => {
        const filename = "test6.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public"
                },
                {
                    key: "receiver2.public"
                },
                {
                    key: "receiver3.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create({
            keyReceiverConfigFile: filename,
            keyRotationInterval: keyRotationInterval,
            startUpdateWindow: startUpdateWindow,
            endUpdateWindow: endUpdateWindow
        });
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    createReceiversFile(filename, {
                        decrypt: [
                            {
                                key: "receiver1.public",
                                resend: true
                            },
                            {
                                key: "receiver2.public"
                            },
                            {
                                key: "receiver3.public"
                            }
                        ]
                    });
                    return null;
                case 3:
                    expect(waitPeriod).to.equal(0);
                    return null;
                case 4:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(4);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });

    it("should not reprocess unchanged file save within 100 ms", (done) => {
        const filename = "test7.json";
        createReceiversFile(filename, {
            decrypt: [
                {
                    key: "receiver1.public",
                    resend: true
                },
                {
                    key: "receiver2.public"
                },
                {
                    key: "receiver3.public"
                }
            ]
        });
        let keyDistributor = KeyDistributorTest.create({
            keyReceiverConfigFile: filename,
            keyRotationInterval: keyRotationInterval,
            startUpdateWindow: startUpdateWindow,
            endUpdateWindow: endUpdateWindow
        });
        let keyCount = 0;
        keyDistributor.sendKeyHandler = (receiver: KeyReceiver) => {
            keyCount += 1;
        };
        let timeoutCount = 0;
        keyDistributor.timeoutHandler = (waitPeriod: number) => {
            timeoutCount += 1;
            switch (timeoutCount) {
                case 1:
                    // initialize
                    expect(waitPeriod).to.equal(0);
                    createReceiversFile(filename, {
                        decrypt: [
                            {
                                key: "receiver1.public",
                                resend: true
                            },
                            {
                                key: "receiver2.public"
                            },
                            {
                                key: "receiver3.public"
                            }
                        ]
                    });
                    return null;
                case 2:
                    expect(waitPeriod).to.be.greaterThan(0);
                    expect(keyCount).to.equal(3);
                    return done;
            }
            throw new Error("Should not pass here");
        };
        keyDistributor.start();
    });
});
