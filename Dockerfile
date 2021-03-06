# Dockerfile to build and test this library in a docker container with an external IDE
# (in this case visual studio code)
#
# execute the following commands to build this docker image:
#  $ docker build -t amqp-ts .
#
# to start the development process with docker
#  $ docker-compose up -d
#
# to build execute the following command:
#  $ docker exec dev-amqp-ts gulp
#
# to automatically build from within Visual Studio Code with CTRL-SHIFT-B
# create a tasks.json file in the .vscode folder with the following content:
# {
#     // See https://go.microsoft.com/fwlink/?LinkId=733558
#     // for the documentation about the tasks.json format
#     "version": "0.1.0",
#     "command": "docker",
#     "isShellCommand": true,
#     "args": ["exec", "dev-amqp-ts", "gulp"],
#     "showOutput": "always"
# }
#
# to debug (in this case the mocha tests) execute the following line and run the 'Attach' Visual Studio Code Debugger:
#  $ docker exec dev-amqp-ts node --debug-brk --nolazy /src/node_modules/mocha/bin/_mocha transpiled/amqp-ts.spec.js
# todo: create better integration
FROM node:latest

WORKDIR /src

# install global modules needed
RUN npm install -g gulp

# copy and install local development libraries
COPY package.json /src/
RUN npm install

# needed to keep the docker version of the libraries separate from the local version
VOLUME ["/src", "/src/node_modules"]
# default node debug port
EXPOSE 9229

# define the default settings (default settings are settings for dev)
ENV AMQP_SRC_CONNECTION_URL=amqp://rabbitmq
ENV START=dev

#initialize the docker development environment
#CMD ["npm", "run", "docker-develop"]
CMD ["node", "index"]