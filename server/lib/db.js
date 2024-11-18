/*
 *  DB selector
 */

import config from '../config.js';
import mongo from './db.mongo.js';
import ne from './db.ne.js';

export default /mongo/i.test(config.server.db) ? mongo : ne;

// end of db.js
