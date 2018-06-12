# Dockerfile to build a production version of this solution in a docker container

FROM node:latest AS build
WORKDIR /src
RUN git clone https://github.com/abreits/amqp-e2e.git .
RUN npm install -g gulp && npm install && gulp build && rm build/*.spec.js build/*.map


FROM node:latest
# FROM mhart/alpine-node:8 #minimal footprint version
WORKDIR /amqp-e2e
COPY --from=build /src/build/*.js run/
COPY --from=build /src/package.json /src/index.js ./
RUN npm install --production
VOLUME [ "/amqp-e2e/config" ]
COPY --from=build /src/tools/alive.js tools/
CMD [ "node", "index"]
