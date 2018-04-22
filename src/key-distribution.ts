/* key-distribution.ts ** class to encrypt and sign keys with RSA for distribution
 * 2018-04-20 by Ab Reitsma
 * */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { KEY_LENGTH } from "./crypto-message";
import { Key } from "./key";
import { KeyManager, KEYID_LENGTH } from "./key-manager";
import { AmqpConnection } from "./amqp-connection";

/*
 * Only once:
 * Passwordless RSA private and public key generated on sender
 * Passwordless RSA private and public key generated on each receiver
 *
 * Public key sender distributed safely to each receiver
 * Public keys of all receivers added to receiver configuration file (json)
 */

/*
 * configuration file format
 *
 */
interface DefinedEndpoint {
    name: string; // name of the sender/receiver, should be unique
    connection: AmqpConnection;
    publicKeyFile: string; // filename of the file containing the public key in PEM format
    privateKeyFile: string; // filename of the file containing the private key in PEM format
}

interface ReferencedEndpoint {
    name: string; // name of the sender/receiver, should be unique
    publicKeyFile: string; // filename of the file containing the public key in PEM format
    startDate?: Date; // if not defined always start
    endDate?: Date; // if not defined keeps running
}

interface KeyDistributorConfiguration {
    sender: DefinedEndpoint;
    receivers: [ReferencedEndpoint];
}

interface KeyReceiverConfiguration {
    sender: ReferencedEndpoint;
    receiver: DefinedEndpoint;
}

/* process for receiver:
 *  message receive loop:
 *      - if message contains encryption key for me
 *          - decrypt key with my private key and add it to the key manager
 *      - else
 *          - decrypt message and forward to destination
 */

/* process for sender:
 *  - startup initialization:
 *      - parse <receiver configuration file>
 *      - if active receivers available
 *          - create new <inactive encryption key>
 *          - create <receiver list> of active receivers to notify
 *          - send new <inactive encryption key> to remaining receivers on the list
 *          - activate new inactive encryption key
 *      - compute time for first <key change publication>
 *          ((de)activation of receiver or keychange time) - key notify period
 *      - compute timeout for first <key change publication>
 *      - start timeout
 *      - start file system watcher for <receiver configuration file> (json)
 *      - start forwarding encrypted messages with active key
 *
 *  - on timeout:
 *      - if no <inactive encryption key> exists
 *          - create new <inactive encryption key>
 *          - create <receiver list> of active receivers to notify
 *      - if <key change> time now or already passed:
 *          - send new <inactive encryption key> to all receivers on the <receiver list>
 *          - activate new <inactive encryption> key
 *          - compute time for next <key change>
 *          - compute time for next <key change publication>
 *          - compute timeout for next <key change publication>
 *      - else if list is not empty:
 *          - send key to first receiver on the <receiver list>
 *          - remove first receiver from the <receiver list>
 *          - compute timeout for next receiver key send
 *      - else:
 *          - compute timeout for <key change> time
 *       - start timeout
 *
 *  - on file change:
 *      - parse <receiver configuration file> and compare with current state
 *      - if <inactive encryption key> exists // busy updating
 *          - if active receiver(s) deactivated:
 *              - clear <inactive encryption key>
 *          - else if new active receiver(s) added:
 *              - add new active receivers to <receiver list>
 *          - set <key change> to now
 *          - disable current timeout
 *          - set timeout to 0
 *      - else
 *          - compute time for next <key change publication>
 *          - compute timeout for next <key change publication>
 *      - start timeout
 *
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
