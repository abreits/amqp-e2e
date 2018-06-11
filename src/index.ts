/* index.ts ** startpoint of the application, starts the shovel defined in /config/config.json
 * Created 2018-06-11 by Ab Reitsma
 */

import { Log } from "./log";
import * as fs from "fs";
import * as path from "path";
import { ShovelConfig, SimpleShovelConfig, ControlShovelConfig, ManagedShovelConfig, getFile } from "./crypto-shovel";
import { SimpleCryptoShovel } from "./crypto-shovel-simple";
import { ControlCryptoShovel } from "./crypto-shovel-control";
import { ManagedCryptoShovel } from "./crypto-shovel-managed";

// replace ${configRoot} woth the config root folder (/config)
function fullPath(filePath) {
    // replace ${configRoot} with workspace root dir
    const configRoot = path.join(__dirname, "..", "config").split("\\").join("/");
    return filePath.split("${configRoot}").join(configRoot);
}

// read the configuration file
try {
    const localConfig = process.argv[0] || process.env.LOCAL_CONFIG || "${configRoot}/local/config.json";
    const remoteConfig = process.argv[0] || process.env.REMOTE_CONFIG || "${configRoot}/remote/config.json";
    const configString = getFile(localConfig);
    const config = JSON.parse(configString) as ShovelConfig;
    let shovel: SimpleCryptoShovel | ControlCryptoShovel | ManagedCryptoShovel;
    switch (config.shovelRole) {
        case "simple-encrypt":
        case "simple-decrypt":
            //shovel = new SimpleCryptoShovel(config as SimpleShovelConfig, localConfig, remoteConfig);
            break;
        case "control-encrypt":
        case "control-decrypt":
            shovel = new ControlCryptoShovel(config as ControlShovelConfig, localConfig, remoteConfig);
            break;
        case "managed-encrypt":
        case "managed-encrypt":
        case "managed-admin":
            // todo: implement!
            //shovel = new ManagedCryptoShovel(config as ManagedShovelConfig);
            throw new Error("Shovel role not implemented yet: " + config.shovelRole);
            break;
        default:
            throw new Error("Shovel role undefined: " + config.shovelRole);
    }
    shovel.start();
} catch (e) {
    Log.error("Error reading configuration", e);
    process.exit(1);
}
