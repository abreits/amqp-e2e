/* index.js ** starting point for the docker image
 * 2018-04-11 by Ab Reitsma
 *
 * starts different functionality for this image, based on environment variable settings
 * currently supported settings:
 * START: 'encrypt', 'decrypt' or 'dev'
 *  - encrypt: starts an encryption shovel
 *  - decrypt: starts a decryption shovel
 *  - dev: starts a docker development and test environment for the application
 */

let start = process.env.START;
if (start) {
    start = start.toLowerCase();
}

switch (start) {
    case "encrypt":
        console.log("ERROR: 'encrypt' start not implemented yet.");
        console.log("Exiting!");
        break;
    case "decrypt":
        console.log("ERROR: 'decrypt' start not implemented yet.");
        console.log("Exiting!");
        break;
    case "dev":
        console.log("Starting development environment.");
        require("./tools/alive");
        break;
    default:
        console.log("ERROR: expected a START environment variable with value of 'encrypt', 'decrypt' or 'dev'.");
        console.log("Exiting!");
}


