# AMQP-E2E documentation

This document describes two things: 
- the [Docker](https://www.docker.com/) production environment 
- the [Docker](https://www.docker.com/) development environment used to build the amqp-e2e application


## AMQP-E2E production application

The `docker-production` directory contains the `Dockerfile` to build a production version of amqp-e2e from the `abreits/amqp-e2e` github repository. It exposes a `/amqp-e2e/config` for the configuration and a `/amqp-e2e-log` volume for the log files.

The subdirectories `control-example` and `simple-example` contain a `docker-compose.yml` example file that deploys a working start and endpoint on the same AMQP hub (not very useful, but works as an example).

For configuration documentation see:
- [control start point and endpoint configuration](configuration/control.md) 
- [simple start point and endpoint configuration](configuration/control.md) 

### Future developments

Currently logging logs only to file, the [winston logging system](https://github.com/winstonjs/winston) used supports multiple log formats and delivery modes, however currently the system must be rebuilt to support that.

Also loglevels are hardcoded for the moment, this must be configurable in the future.

## AMQP-E2E development environment

To start developing:
- Clone the `abreits/amqp-e2e` project
- Open the project in [Visual Studio Code](https://code.visualstudio.com/).
- Open a terminal.
- Start the Docker development container with `docker-compose up -d`
- Build and tests with `CTRL-SHIFT-B`.

_todo: describe project directory structure in detail_

