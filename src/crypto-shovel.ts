/* crypto-shovel.ts ** root type definitions for the crypto various shovel types
 * created by Ab Reitsma on 2018-06-05
 */

import * as path from "path";
import * as fs from "fs";
import { ConnectionConfig } from "./amqp-connection";
import { Log } from "./log";

export enum Role {
    simpleStartpoint = "simple-startpoint",
    simpleEndpoint = "simple-endpoint",
    controlStartpoint = "control-startpoint",
    controlEndpoint = "control-endpoint",
    managedStartpoint = "managed-startpoint",
    managedEndpoint = "managed-endpoint",
    managedAdmin = "managed-admin"
}

export interface ShovelConfig {
    shovelRole: Role;
    readFrom: ConnectionConfig;
    sendTo: ConnectionConfig;
}

export interface CryptoKeyReceiver {
    key: string; // filename of the receiver rsa public key pem file
    startDate?: string | number; // UTC date-time, if not defined always start
    endDate?: string | number; // UTC date-time, if not defined never end
    resend?: boolean; // if true, resend key to this receiver    
}

/*
 * --------------------- SIMPLE SHOVEL CONFIG -------------------
 */

export interface SimpleShovelConfig extends ShovelConfig {
    messageKey: string;
}

/*
 * --------------------- CONTROL SHOVEL CONFIG -------------------
 */

export interface ControlShovelConfig extends ShovelConfig {
    localPrivateRsaKeyFile?: string; // path to PEM file with private RSA key of this shovel
    localPublicRsaKeyFile?: string; // path to PEM file with public RSA key of this shovel
}

export interface ControlShovelEncryptConfig extends ControlShovelConfig {
    remoteConfigFile: string; // path to configuration file for the endpoints, default "${configRoot}/remote/config.json"
    remoteRsaKeyDir: string; // path to directory containing the endpoint RSA public keys, default "${configRoot}/remote/"   

    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, default is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes  
}

export interface ControlShovelDecryptConfig extends ControlShovelConfig {
    remotePublicRsaKeyFile?: string; // path to PEM file with public RSA key of the encryption shovel
    persistFile?: string; // path to the file contains persistance information    
}

export interface ControlCryptoKeyReceivers {
    name?: string; // name of the encryption/decryption shovel combo (for admin purposes only)
    details?: string; // details of the encryption/decryption shovel combo (for admin purposes only)

    endpoint: CryptoKeyReceiver[];

    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, default is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes     
}


/*
 * --------------------- MANAGED SHOVEL CONFIG -------------------
 */

export type ManagedShovelConfig = ControlShovelConfig;

export interface ManagedShovelCryptoConfig extends ManagedShovelConfig {
    adminRsaKeyFile: string; // path to PEM file with public cert file of the admin shovel
    persistFile?: string; // path to the file contains persistance information    
}

export interface ManagedShovelAdminConfig extends ManagedShovelConfig {
    cryptConfigFolder: string; // path to folder containing configuration files for crypt shovels, default "/config/crypto"
    decryptRsaKeyFolder: string; // path to folder containing decrypt shovel RSA public keys, default "/config/rsakeys/"
}

export interface ManagedCryptoKeyReceivers extends ControlCryptoKeyReceivers {
    startpoint: CryptoKeyReceiver;
}

export function getDirName(dirname: string, masterFilename?: string) {
    const configRoot = path.join(__dirname, "..", "config").split("\\").join("/");
    const workspaceRoot = path.join(__dirname, "..").split("\\").join("/");
    if (!dirname) {
        dirname = path.dirname(masterFilename);
    }

    // replace ${configRoot} with workspace root dir
    dirname = dirname.split("${configRoot}").join(configRoot);
    dirname = dirname.split("${workspaceRoot}").join(workspaceRoot);

    return dirname;
}

export function getFileName(filename: string, masterFilename?: string, defaultExtension?: string, defaultBasename?: string) {
    const configRoot = path.join(__dirname, "..", "config").split("\\").join("/");
    const workspaceRoot = path.join(__dirname, "..").split("\\").join("/");
    if (!filename) {
        const dirname = path.dirname(masterFilename);
        const basename = defaultBasename ? defaultBasename : path.basename(masterFilename);
        filename = path.join(dirname, basename + defaultExtension);
    }

    // replace ${configRoot} with workspace root dir
    filename = filename.replace("${configRoot}", configRoot);
    filename = filename.replace("${workspaceRoot}", workspaceRoot);
    return filename;
}

export function getFile(filename: string, masterFilename?: string, defaultExtension?: string, defaultBasename?: string) {
    filename = getFileName(filename, masterFilename, defaultExtension, defaultBasename);
    Log.debug("Get file: " + filename);
    return fs.readFileSync(filename, "utf8");
}
