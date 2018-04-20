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
 * [[key][key_id][activeUntil] encrypted with public key of receiver][Signed Hash of [key][key_id]]
 */

/*
 * proposed process:
 *  - startup initialization:
 *      - get all receivers
 *      - get active receivers
 *      - create encryption key and set it to the active key
 *      - send key to active receivers
 *      - start timeout until first key change: (de)activation of receiver or keychange interval
 *      - start file system watcher for receiver configuration folder
 *      - send incoming message with active key
 *  - on file change:
 *      - if active receiver(s) deactivated:
 *          - create new encryption key and set it to the active key
 *          - send new active key to active receivers
 *      - else if new active receiver(s) added:
 *          - send active key to new receiver(s)
 *      - get new timeout until first key change: (de)activation of receiver or keychange interval
 *      - if new timeout is before original timeout
 *          - disable original timeout
 *          - start new timeout
 *  - on timeout:
 *          - get active receivers
 *          - create new encryption key and set it to the active key
 *          - send new active key to active receivers
 *
 * complicating factor: need to observe keyNotifyPeriod and keyNotifications
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
    keyChangeInterval: number; // in ms interval to change encryption key
    keyNotifyPeriod: number; // in ms, period in which to send new key to all recepients it activates
    keyNotifications: number; // number of times the key must be sent to a recepient before it activates

}
