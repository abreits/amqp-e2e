/**
 * Tests for rsa key class
 * Created by Ab on 2018-04-16.
 */
import * as fs from "fs";
import * as path from "path";
import * as Chai from "chai";
var expect = Chai.expect;

import { RsaKey } from "./rsa-key";

// read rsa keys for tests
const rsaPath = path.join(__dirname, "../test-data/rsa-keys");
const senderPrivateKey = fs.readFileSync(path.join(rsaPath, "sender.private"), "utf8");
const senderPublicKey = fs.readFileSync(path.join(rsaPath, "sender.public"), "utf8");
const receiverPrivateKey = fs.readFileSync(path.join(rsaPath, "receiver1.private"), "utf8");
const receiverPublicKey = fs.readFileSync(path.join(rsaPath, "receiver1.public"), "utf8");

/* istanbul ignore next */
describe("Test the RsaKey class", () => {
    it("should create a public md5 hash", () => {
        const rsaKey = new RsaKey(receiverPublicKey);
        const md5 = rsaKey.hash;
        expect(md5.toString("hex")).to.equal("d041aa961d8bd99ace4bf09a6b50a3a7");
    });
});
