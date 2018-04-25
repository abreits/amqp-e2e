/* key-receiver.ts ** class to receive and decrypt the keys sent with key-distributor
 * 2018-04-25 by Ab Reitsma
 * */

import * as fs from "fs";

const MAX_DATE = new Date(8640000000000000);
const MIN_DATE = new Date(-8640000000000000);

import { RsaKey } from "./rsa-key";

export interface KeyReceiverDefinition {
    publicKeyFile: string; // filename of the file containing the public key in PEM format
    privateKeyFile?: string; // filename of the file containing the private key in PEM format
    startDate?: string | number; // UTC date-time, if not defined always start
    endDate?: string | number; // UTC date-time, if not defined never end
}

export class KeyReceiver {
    static keyDirectory = "";

    key: RsaKey; // contains the public key in PEM format
    startDate: Date; // if not defined always start
    endDate: Date; // if not defined keeps running

    get name(): string {
        return this.key.hash.toString("hex");
    }

    constructor(definition: KeyReceiverDefinition) {
        try {
            let publicKeyPem = fs.readFileSync(definition.publicKeyFile, "utf8");
            let privateKeyPem = null;
            if (definition.privateKeyFile) {
                privateKeyPem = fs.readFileSync(definition.privateKeyFile, "utf8");
            }
            this.key = new RsaKey(publicKeyPem, privateKeyPem);
        } catch {
            throw new Error("Error reading public or private key file");
        }
        if (definition.startDate) {
            try {
                this.startDate = new Date(definition.startDate);
            } catch {
                throw new Error("Unrecognisable startDate, use UTC");
            }
        } else {
            this.startDate = MIN_DATE;
        }
        if (definition.endDate) {
            try {
                this.endDate = new Date(definition.endDate);
            } catch {
                throw new Error("Unrecognisable endDate, use UTC");
            }
        } else {
            this.startDate = MAX_DATE;
        }
    }
}
