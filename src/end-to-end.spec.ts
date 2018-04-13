/**
 * Tests for amqp-ts
 * Created by Ab on 2015-09-16.
 */
import * as Chai from "chai";
var expect = Chai.expect;

import EndToEnd from "./end-to-end";

const testData = Buffer.from("This is a small line of text to test encryption and decryption");
const testIv = "1";
const testPassword = "This is a very secret password:)"; // password must be 32 bytes
const testEncrypted = Buffer.from("31202020202020202020202020202020f463457733af22dbc1846fc6952129ba21e4a137977886e0cae3f26a7a10b2842b238c32f5be856a1ae567321c5e49412fb558bf2c5fb04cc87498a45411d3ae96a3a413324a9e900e4acffd5355", "hex");

/* istanbul ignore next */
describe("Test end-to-end module", () => {
    it("'encrypt' should encrypt a standard message", () => {
        let encryptedResult = EndToEnd.encrypt(testData, testPassword, testIv);
        expect(encryptedResult).to.deep.equal(testEncrypted);
    });
    it("'decrypt' should decrypt a standard message", () => {
        let decryptedResult = EndToEnd.decrypt(testEncrypted, testPassword);
        expect(decryptedResult).to.deep.equal(testData);
    });
    it("should 'encrypt' and 'decrypt' a message with a random iv", () => {
        let encryptedResult = EndToEnd.encrypt(testData, testPassword);
        let decryptedResult = EndToEnd.decrypt(encryptedResult, testPassword);
        expect(decryptedResult).to.deep.equal(testData);
    });

});
