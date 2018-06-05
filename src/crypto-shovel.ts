/* crypto-shovel.ts ** root type definitions for the crypto various shovel types
 * created by Ab Reitsma on 2018-06-05
 */

import { ConnectionConfig } from "./amqp-connection";

export enum ShovelType {
    simpleEncrypt = "simple-encrypt",
    simpleDecrypt = "simple-decrypt",
    controlEncrypt = "control-encrypt",
    controlDecrypt = "control-decrypt",
    managedEncrypt = "managed-encrypt",
    managedDecrypt = "managed-decrypt",
    managedAdmin = "managed-admin"
}

export interface ShovelConfig {
    shovelType: ShovelType;
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
    myPrivateRsaKeyFile: string; // path to PEM file with private cert file of this shovel
    myPublicRsaKeyFile: string; // path to PEM file with public cert file of this shovel
}

export interface ControlShovelEncryptConfig extends ControlShovelConfig {
    decryptConfigFile: string; // path to configuration file for the decrypt shovels, default "/config/receivers.json"
    decryptRsaKeyFolder: string; // path to folder containing decrypt shovel RSA public keys, default "/config/rsakeys/"   
}

export interface ControlShovelDecryptConfig extends ControlShovelConfig {
    encryptRsaKeyFile: string; // path to PEM file with public cert file of the encryption shovel
    persistFile?: string; // path to the file contains persistance information    
}

export interface ControlCryptoKeyReceivers {
    name?: string; // name of the encryption/decryption shovel combo (for admin purposes only)
    details?: string; // details of the encryption/decryption shovel combo (for admin purposes only)

    decrypt: CryptoKeyReceiver[];

    keyRotationInterval?: number; // force new key to be used after .. ms, default every 24 hours, default is never
    startUpdateWindow?: number; // when, before new key activates, to start sending new keys to receivers in ms, default 1 hour
    endUpdateWindow?: number; // when, before new key activates, all new keys should be sent, default 55 minutes     
}


/*
 * --------------------- MANAGED SHOVEL CONFIG -------------------
 */

export interface ManagedShovelCryptoConfig extends ControlShovelConfig {
    adminRsaKeyFile: string; // path to PEM file with public cert file of the admin shovel
    persistFile?: string; // path to the file contains persistance information    
}

export interface ManagedShovelAdminConfig extends ControlShovelConfig {
    cryptConfigFolder: string; // path to folder containing configuration files for crypt shovels, default "/config/crypto"
    decryptRsaKeyFolder: string; // path to folder containing decrypt shovel RSA public keys, default "/config/rsakeys/"
}

export interface ManagedCryptoKeyReceivers extends ControlCryptoKeyReceivers {
    encrypt: CryptoKeyReceiver;   
}
