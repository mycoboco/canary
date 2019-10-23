How to build and install canary
===============================

This package does not provide an automated way to build or install the server
except using [`npm`](http://npmjs.org/package/ontime.js) because
`canary-server` is intended to runs on top of [`node.js`](http://nodejs.org).
If you have `node.js` in your system,

    npm install canary

brings the latest version of `canary-server` and installs it with its all
depending packages.

The executable `canary` is placed into `node_modules/.bin`. You can run it with

    npx canary -c config

if you have 5.2.0 or a later version of `npm` installed, or

    $(npm bin)/canary -c config

otherwise. The `config` directory refers to the sample configuration directory
`node_modules/canary/config` and you should edit files there before running the
server.
