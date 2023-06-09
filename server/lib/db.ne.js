/*
 *  DB wrapper for NeDB
 */

const crypto = require('crypto');
const {inspect} = require('util');
const fs = require('fs').promises;
const {createReadStream, createWriteStream} = require('fs');
const path = require('path');

const Datastore = require('@seald-io/nedb');
let db = {};
const {mkdirp} = require('mkdirp');
const {logger} = require('@hodgepodge-node/server');
const {safePipe} = require('@hodgepodge-node/util');

const config = require('../config');

let log;

async function init(_conf, cb) {
  log = logger.create({
    prefix: 'db',
    level: config.debug ? 'info' : 'error',
  });

  db = {
    song: new Datastore({
      filename: path.join(config.db.path, 'songs.db'),
      autoload: true,
    }),
    info: new Datastore({
      filename: path.join(config.db.path, 'info.db'),
      autoload: true,
    }),
  };
  db.info.ensureIndex({fieldName: 'type'});
  db.song.ensureIndex({fieldName: 'id'});
  db.song.ensureIndex({fieldName: 'version'});

  await mkdirp(config.db.path);
}

function close() {
  // nothing to do
}

async function songCount() {
  return db.song.countAsync({});
}

async function songList() {
  return db.song.findAsync({});
}

async function songPath(id) {
  return db.song.findOneAsync({id}, {_id: 0, path: 1});
}

async function songGet(id) {
  return db.song.findOneAsync({id}, {_id: 0});
}

async function songAdd(song) {
  if (typeof song.id !== 'number' || song.id !== song.id) {
    throw new Error(`invalid song id: ${inspect(song.id)}`);
  }
  if (typeof song.path !== 'string' || !song.path) {
    throw new Error(`invalid song path: ${inspect(song.path)}`);
  }

  delete song.cover;

  return db.song.updateAsync({id: song.id}, song, {upsert: true});
}

async function songTouch(id, version) {
  return db.song.updateAsync(
    {id},
    {
      $set: {version},
    },
  );
}

async function songClear(version) {
  return db.song.removeAsync({
    version: {$lt: version},
  });
}

async function versionGet() {
  const versions = await db.info.findAsync({type: 'music'});
  if (versions.length === 0) versions[0] = {version: 2}; // #26
  return versions[0].version;
}

async function versionInc(cb) {
  const result = await db.info.updateAsync(
    {type: 'music'},
    {
      $inc: {version: 1},
    },
  );
  if (result.numAffected === 0) {
    return db.info.updateAsync(
      {type: 'music'},
      {
        $set: {version: 2},
      },
      {upsert: true},
    );
  }
}

async function dbIdGet() {
  const ids = await db.info.findAsync(
    {type: 'music'},
    {
      dbId: 1,
      _id: 0,
    },
  );
  return ids && ids[0] && ids[0].dbId;
}

async function dbIdSet(dbId) {
  if (typeof dbId !== 'string' || !dbId) {
    throw new Error(`invalid db id: ${inspect(dbId)}`);
  }

  return db.info.updateAsync(
    {type: 'music'},
    {
      $set: {dbId},
    },
  );
}

function cacheName(name, metas) {
  const md5sum = crypto.createHash('md5');

  metas.forEach((meta) => md5sum.update(meta));
  return path.join(config.db.path, `cache-${name}-${md5sum.digest('hex')}`);
}

function cacheRead(name, metas, to, handler) {
  name = cacheName(name, metas);
  const rs = createReadStream(name);

  log.info(`reading cache for ${name}`);
  safePipe(rs, to, handler);
}

function cacheWrite(name, metas, buffer, handler) {
  name = cacheName(name, metas);
  const ws = createWriteStream(name);

  log.info(`writing cache for ${name}`);
  ws.on('error', (err) => handler(err));
  ws.write(buffer);
  ws.end();
}

async function cacheExist(name, metas) {
  return fs.stat(cacheName(name, metas));
}

async function cacheClear() {
  try {
    const files = await fs.readdir(config.db.path);
    return Promise.all(
      files
        .filter((f) => /^cache-/.test(f))
        .map((f) => fs.unlink(path.join(config.db.path, f))),
    )
      .catch((err) => log.warning(err)); // errors ignored
  } catch (err) {
    log.warning(err); // errors ignored
  }
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
  cover: {
    get: async () => null,
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

// end of db.ne.js
