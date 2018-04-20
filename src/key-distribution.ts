/* key-distribution.ts ** class to encrypt and sign keys with RSA for distribution
 * 2018-04-20 by Ab Reitsma
 * */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { KEY_LENGTH } from "./crypto-message";
import { Key } from "./key";
import { KeyManager, KEYID_LENGTH } from "./key-manager";

/*
 * key message format:
 * [[key][key_id] encrypted with public key of receiver][Signed Hash of [key][key_id]]
 */


export class KeyReceiver {
    privateKey: string; // for receiver to decrypt sent keys
    publicKey: string; // for sender to encrypt ket and key-id
    publicKeySender: string; // for receiver to authenticate sender
}

export class KeySender {
    keyManager: KeyManager;
    privateKey: string; // to sign
    keyReceivers: KeyReceiver[];
}