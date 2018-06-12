/* index.ts ** startpoint of the application, starts the shovel defined in /config/config.json
 * Created 2018-06-11 by Ab Reitsma
 */

import { Log } from "./log";
import { ShovelConfig, SimpleShovelConfig, ControlShovelConfig, getFile } from "./crypto-shovel";
import { SimpleCryptoShovel } from "./crypto-shovel-simple";
import { ControlCryptoShovel } from "./crypto-shovel-control";
import { ManagedCryptoShovel } from "./crypto-shovel-managed";

// read the configuration file
try {
    console.log("starting");
    const localConfig = process.env.LOCAL_CONFIG || "${configRoot}/local/config.json";
    const remoteConfig = process.env.REMOTE_CONFIG || "${configRoot}/remote/config.json";
    const configString = getFile(localConfig);
    const config = JSON.parse(configString) as ShovelConfig;
    console.log("read config:", config);
    let shovel: SimpleCryptoShovel | ControlCryptoShovel | ManagedCryptoShovel;
    switch (config.shovelRole) {
        case "simple-startpoint":
        case "simple-endpoint":
            shovel = new SimpleCryptoShovel(config as SimpleShovelConfig);
            break;
        case "control-startpoint":
        case "control-endpoint":
            shovel = new ControlCryptoShovel(config as ControlShovelConfig, localConfig, remoteConfig);
            break;
        case "managed-startpoint":
        case "managed-startpoint":
        case "managed-admin":
            // todo: implement!
            //shovel = new ManagedCryptoShovel(config as ManagedShovelConfig);
            throw new Error("Shovel role not implemented yet: " + config.shovelRole);
        default:
            throw new Error("Shovel role undefined: " + config.shovelRole);
    }
    shovel.start();
} catch (e) {
    Log.error("Error reading configuration", e);
    process.exit(1);
}
