/* rsa-key.ts ** wrapper for the rsa key functionality
 * 2018-04-23 by Ab Reitsma
 */

import * as crypto from "crypto";
import * as forge from "node-forge";

export class RsaKey {
    readonly publicPem: string;
    readonly privatePem: string;
    protected md5Hash: Buffer;

    constructor(publicPem: string, privatePem?: string) {
        this.publicPem = publicPem;
        this.privatePem = privatePem;
    }

    get hash(): Buffer {
        if (this.md5Hash) {
            return this.md5Hash;
        } else {
            const hasher = crypto.createHash("MD5");
            let publicKey = forge.pki.publicKeyFromPem(this.publicPem);
            let md5Hash = forge.ssh.getPublicKeyFingerprint(publicKey, {
                md: forge.md.md5.create(),
                encoding: 'hex'
            }) as string;
            this.md5Hash = Buffer.from(md5Hash, "hex");
            return this.md5Hash;
        }
    }
}