/* log.ts ** winston logging framework initialization and configuration
 * 2018-05-07 by Ab Reitsma
 *
 * default logs only to file. change here if you want to change the logging (see winston docs)
 */

import * as winston from "winston";
import * as path from "path";

const root = path.join(__dirname, "..");
// const debugLogfile = path.join(root, "logs", "debug.json");
const errorLogFile = path.join(root, "logs", "error.json");
const infoLogfile = path.join(root, "logs", "info.json");

// default transports
const consoleTransport = new winston.transports.Console({
    format: winston.format.printf(info => {
        return `${info.timestamp.split(".")[0].replace("T", " ")} ${info.level}: ${info.message} ${JSON.stringify(info.metadata, null, 4)}`;
    })
});
// const debugFileTransport = new winston.transports.File({ filename: debugLogfile, level: "debug", maxsize: 1024 * 1024, maxFiles: 10 });
const errorFileTransport = new winston.transports.File({ filename: errorLogFile, level: "error" });
const infoFileTransport = new winston.transports.File({ filename: infoLogfile, level: "info", maxsize: 1024 * 1024, maxFiles: 10 });

// wrapper for the logger
export class Log {
    // create a default logger
    protected static logger;

    static start(level = "debug") {
        Log.logger = winston.createLogger({
            level: level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                consoleTransport,
                // debugFileTransport,
                errorFileTransport,
                infoFileTransport
            ]
        });
    }

    static send(level: string, message: string, details?: any) {
        if (Log.logger) {
            try {
                Log.logger.log(level, message, { metadata: details });
            } catch {
                Log.logger.log(level, message, details);
            }
        }
    }

    static debug(message: string, details?: any) {
        Log.send("debug", message, details);
    }

    static verbose(message: string, details?: any) {
        Log.send("verbose", message, details);
    }

    static info(message: string, details?: any) {
        Log.send("info", message, details);
    }

    static warn(message: string, details?: any) {
        Log.send("warn", message, details);
    }

    static error(message: string, details?: any) {
        Log.send("error", message, details);
    }
}