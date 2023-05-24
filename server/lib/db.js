/*
 *  DB selector
 */

const config = require('../config');

module.exports = /mongo/i.test(config.server.db) ? require('./db.mongo') : require('./db.ne');

// end of db.js
