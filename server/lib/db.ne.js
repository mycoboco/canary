/*
 *  DB wrapper for NeDB
 */

import * as crypto from 'node:crypto';
import {inspect} from 'node:util';
import * as fs from 'node:fs/promises';
import {createReadStream, createWriteStream} from 'node:fs';
import * as path from 'node:path';

import Datastore from '@seald-io/nedb';
let db = {};
import {mkdirp} from 'mkdirp';
import {logger} from '@hodgepodge-node/server';
import {safePipe} from '@hodgepodge-node/util';

import config from '../config.js';

let log;

export async function init() {
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

export function close() {
  // nothing to do
}

export async function songCount() {
  return db.song.countAsync({});
}

export async function songList() {
  return db.song.findAsync({});
}

export async function songPath(id) {
  return db.song.findOneAsync({id}, {_id: 0, path: 1});
}

export async function songGet(id) {
  return db.song.findOneAsync({id}, {_id: 0});
}

export async function songAdd(song) {
  if (typeof song.id !== 'number' || isNaN(song.id)) {
    throw new Error(`invalid song id: ${inspect(song.id)}`);
  }
  if (typeof song.path !== 'string' || !song.path) {
    throw new Error(`invalid song path: ${inspect(song.path)}`);
  }

  delete song.cover;

  return db.song.updateAsync({id: song.id}, song, {upsert: true});
}

export async function songTouch(id, version) {
  return db.song.updateAsync(
    {id},
    {
      $set: {version},
    },
  );
}

export async function songClear(version) {
  return db.song.removeAsync({
    version: {$lt: version},
  });
}

export async function versionGet() {
  const versions = await db.info.findAsync({type: 'music'});
  return versions[0]?.version ?? 2; // #26
}

export async function versionInc() {
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

export async function dbIdGet() {
  const ids = await db.info.findAsync(
    {type: 'music'},
    {
      dbId: 1,
      _id: 0,
    },
  );
  return ids[0]?.dbId;
}

export async function dbIdSet(dbId) {
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

export function cacheRead(name, metas, to, handler) {
  name = cacheName(name, metas);
  const rs = createReadStream(name);

  log.info(`reading cache for ${name}`);
  safePipe(rs, to, handler);
}

export function cacheWrite(name, metas, buffer, handler) {
  name = cacheName(name, metas);
  const ws = createWriteStream(name);

  log.info(`writing cache for ${name}`);
  ws.on('error', (err) => handler(err));
  ws.write(buffer);
  ws.end();
}

export async function cacheExist(name, metas) {
  return fs.stat(cacheName(name, metas));
}

export async function cacheClear() {
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

export default {
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
