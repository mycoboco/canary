/*
 *  DB wrapper for MongoDB
 */

const crypto = require('crypto');
const {inspect} = require('util');

const _mongoose = require('mongoose');
const {Schema} = _mongoose;
const {createBucket} = require('mongoose-gridfs');
const {logger} = require('@hodgepodge-node/server');
const mongoose = require('@hodgepodge-node/db/mongoose')(_mongoose);
const {safePipe} = require('@hodgepodge-node/util');

const config = require('../config');

const infoSchema = new Schema({
  type: {
    index: true,
    type: String,
  },
  version: Number,
  dbId: String,
});
let Info;

const songSchema = new Schema({
  id: {
    index: true,
    type: Number,
  },
  kind: Number,
  title: String,
  artist: String,
  album: String,
  time: Number,
  year: Number,
  track: Number,
  genre: String,
  format: String,
  version: {
    index: true,
    type: Number,
  },
  path: String,
  mtime: Date,
});
let Song;
let Bucket;

let log;
let db;

async function init() {
  log = logger.create({
    prefix: 'db',
    level: config.debug ? 'info' : 'error',
  });

  mongoose.init(log);
  db = await mongoose.connect(config.db);

  Info = db.model('Info', infoSchema);
  Song = db.model('Song', songSchema);
  Bucket = createBucket({connection: db});
}

function close() {
  mongoose.close();
}

async function songCount() {
  return Song.count();
}

async function songList() {
  return Song.find();
}

async function songPath(id) {
  return Song.find({id}).select('-_id path');
}

async function songGet(id) {
  return Song.find({id}).select('-_id');
}

async function songAdd(song) {
  if (typeof song.id !== 'number' || song.id !== song.id) {
    throw new Error(`invalid song id: ${inspect(song.id)}`);
  }
  if (typeof song.path !== 'string' || !song.path) {
    throw new Error(`invalid song path: ${inspect(song.path)}`);
  }

  await Song.updateOne({id: song.id}, song, {upsert: true});
}

async function songTouch(id, version) {
  return Song.updateOne(
    {id},
    {
      $set: {version},
    },
  );
}

async function songClear(version) {
  return Song.deleteMany({
    version: {$lt: version},
  });
}

async function versionGet() {
  const versions = await Info.find({type: 'music'});
  if (versions.length === 0) versions[0] = {version: 2}; // #26
  return versions[0].version;
}

async function versionInc() {
  const result = await Info.updateOne(
    {type: 'music'},
    {
      $inc: {version: 1},
    },
  );

  if (!result.nModified) {
    return Info.updateOne(
      {type: 'music'},
      {
        $set: {version: 2},
      },
      {upsert: true},
    );
  }
}

async function dbIdGet() {
  const ids = await Info
    .find({type: 'music'})
    .select('dbId -_id');
  return ids && ids[0] && ids[0].dbId;
}

async function dbIdSet(dbId) {
  if (typeof dbId !== 'string' || !dbId) {
    throw new Error(`invalid db id: ${inspect(dbId)}`);
  }

  return Info.updateOne(
    {type: 'music'},
    {
      $set: {dbId},
    },
  );
}

function hashQuery(metas) {
  const md5sum = crypto.createHash('md5');

  metas.forEach((meta) => md5sum.update(meta));
  return md5sum.digest('hex');
}

function cacheRead(name, metas, to, handler) {
  name = `${name}-${hashQuery(metas)}`;
  const rs = Bucket.createReadStream({filename: name});

  log.info(`reading cache for ${name}`);
  safePipe(rs, to, handler);
}

function cacheWrite(name, metas, buffer, handler) {
  name = `${name}-${hashQuery(metas)}`;
  const ws = Bucket.createWriteStream({filename: name});

  log.info(`writing cache for ${name}`);
  ws.on('error', (err) => handler(err));
  ws.write(buffer);
  ws.end();
}

async function cacheExist(name, metas) {
  return new Promise((resolve, reject) => {
    Bucket.findOne({filename: `${name}-${hashQuery(metas)}`}, (err, file) => {
      if (err) return reject(err);
      resolve(!!file);
    });
  });
}

async function cacheClear() {
  return Promise.all(
    // uses underlying driver
    ['fs.files', 'fs.chunks'].map((name) => db.db.collection(name).drop()),
  )
    .catch((err) => log.warning(err)); // errors igrnored
}

module.exports = {
  init,
  close,
  song: {
    count: songCount,
    list: songList,
    path: songPath,
    get: songGet,
    add: songAdd,
    touch: songTouch,
    clear: songClear,
  },
  version: {
    get: versionGet,
    inc: versionInc,
  },
  dbId: {
    get: dbIdGet,
    set: dbIdSet,
  },
  cache: {
    read: cacheRead,
    write: cacheWrite,
    exist: cacheExist,
    clear: cacheClear,
  },
};

// end of db.mongo.js
