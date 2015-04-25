How to build and install canary
===============================

This package does not provide an automated way to build or install the server
except using [`npm`](http://npmjs.org/package/ontime.js) because
`canary-server` is intended to runs on top of [`node.js`](http://nodejs.org).
If you have `node.js` in your system,

    npm install canary

brings the latest version of `canary-server` and installs it with its all
depending packages.

To build a native module for [DNS-SD](http://www.dns-sd.org/), an
[Avahi](http://www.avahi.org/)-compatible library is required; see `README.md`
for details.
