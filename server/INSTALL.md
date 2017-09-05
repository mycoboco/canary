How to build and install canary
===============================

This package does not provide an automated way to build or install the server
except using [`npm`](http://npmjs.org/package/ontime.js) because
`canary-server` is intended to runs on top of [`node.js`](http://nodejs.org).
If you have `node.js` in your system,

    npm install --legacy-bundling canary

brings the latest version of `canary-server` and installs it with its all
depending packages.

The `--legacy-bundling` option is necessary when using `npm3` because, without
it, dependent modules are installed at the same nesting level as `canary` into
`node_modules`.
