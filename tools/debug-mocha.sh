#!/bin/bash
node --inspect-brk=0.0.0.0:9229 --nolazy /src/node_modules/.bin/mocha --require source-map-support/register build/*.spec.js &
exit
