/* log.ts ** winston logging framework initialization and configuration
 * 2018-05-07 by Ab Reitsma
 */

import * as winston from "winston";
import * as path from "path";

const root = path.join(__dirname, "..");
const errorLogFile = path.join(root, "logs", "error.log");
const infoLogfile = path.join(root, "logs", "info.log");

// default transports
const consoleTransport = new winston.transports.Console({
    format: winston.format.printf(info => {
        return `${info.timestamp.split(".")[0].replace("T", " ")} ${info.level}: ${info.message} ${JSON.stringify(info.metadata, null, 4)}`;
    })
});
const errorFileTransport = new winston.transports.File({ filename: errorLogFile, level: "error" });
const infoFileTransport = new winston.transports.File({ filename: infoLogfile, level: "info", maxsize: 1024 * 1024, maxFiles: 10 });

// wrapper for the logger
export class Log {
    // create a default logger
    protected static logger;

    static start(level = "info") {
        Log.logger = winston.createLogger({
            level: level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                consoleTransport,
                errorFileTransport,
                infoFileTransport
            ]
        });
    }

    static debug(message: string, details?: any) {
        if (Log.logger) {
            Log.logger.debug(message, {
                metadata: details
            });
        }
    }

    static verbose(message: string, details?: any) {
        if (Log.logger) {
            Log.logger.verbose(message, {
                metadata: details
            });
        }
    }

    static info(message: string, details?: any) {
        if (Log.logger) {
            Log.logger.info(message, {
                metadata: details
            });
        }
    }

    static warn(message: string, details?: any) {
        if (Log.logger) {
            Log.logger.warn(message, details);
        }
    }

    static error(message: string, details?: any) {
        if (Log.logger) {
            Log.logger.error(message, details);
        }
    }
}