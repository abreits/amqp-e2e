/* index.js ** starting point for the docker image
 * 2018-04-11 by Ab Reitsma
 *
 * starts different functionality for this image, based on environment variable settings
 * currently supported settings:
 * START: 'run' or 'dev'
 *  - run: starts a shovel (default)
 *  - dev: starts a docker development and test environment for the application
 */

let start = process.env.START;
if (start) {
    start = start.toLowerCase();
}

switch (start) {
    case "dev":
        console.log("Starting development environment.");
        require("./tools/alive");
        break;
    default:
        console.log("Starting amqp-e2e shovel.");
        require("run/index"); // only works in docker-production version
}


