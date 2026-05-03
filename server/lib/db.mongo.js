/*
 *  DB wrapper for MongoDB
 */

import * as crypto from 'node:crypto';
import {inspect} from 'node:util';

import _m, {Schema} from 'mongoose';
import {logger} from '@hodgepodge-node/server';
import {mongoose as _mongoose} from '@hodgepodge-node/db';
const mongoose = _mongoose(_m);
import {safePipe} from '@hodgepodge-node/util';

import config from '../config.js';

const infoSchema = new Schema({
  type: {
    index: true,
    type: String,
  },
  version: Number,
  dbId: String,
  nextId: Number,
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

const coverSchema = new Schema({
  id: {
    index: true,
    type: Number,
  },
  format: String,
  image: Buffer,
  version: {
    index: true,
    type: Number,
  },
});
let Cover;

const playlistSchema = new Schema({
  id: {
    index: true,
    type: Number,
  },
  name: String,
  match: String,
  rules: [{
    field: String,
    op: String,
    value: Schema.Types.Mixed,
  }],
});
let Playlist;

let bucket;

let log;
let db;

export async function init() {
  log = logger.create({
    prefix: 'db',
    level: config.debug ? 'info' : 'error',
  });

  mongoose.init(log);
  db = await mongoose.connect(config.db);

  Info = db.model('Info', infoSchema);
  Song = db.model('Song', songSchema);
  Cover = db.model('Cover', coverSchema);
  Playlist = db.model('Playlist', playlistSchema);
  bucket = new _m.mongo.GridFSBucket(db.db);
}

export function close() {
  mongoose.close();
}

export async function songCount() {
  return Song.countDocuments();
}

export async function songList() {
  return Song.find();
}

export async function songPath(id) {
  return Song.findOne({id}).select('-_id path');
}

export async function songGet(id) {
  return Song.findOne({id}).select('-_id');
}

export async function coverGet(id) {
  return Cover.findOne({id}).select('-_id');
}

export async function songAdd(song) {
  if (typeof song.id !== 'number' || isNaN(song.id)) {
    throw new Error(`invalid song id: ${inspect(song.id)}`);
  }
  if (typeof song.path !== 'string' || !song.path) {
    throw new Error(`invalid song path: ${inspect(song.path)}`);
  }

  const {cover} = song;
  delete song.cover;

  if (cover) {
    Cover.updateOne(
      {id: song.id},
      {
        id: song.id,
        ...cover,
        version: song.version,
      },
      {upsert: true},
    ).catch((err) => log.error(err));
  }
  return Song.updateOne({id: song.id}, song, {upsert: true});
}

export async function songTouch(id, version) {
  return Promise.all([
    Cover.updateOne(
      {id},
      {
        $set: {version},
      },
    ),
    Song.updateOne(
      {id},
      {
        $set: {version},
      },
    ),
  ]);
}

export async function songClear(version) {
  return Promise.allSettled([
    Cover.deleteMany({
      version: {$lt: version},
    }),
    Song.deleteMany({
      version: {$lt: version},
    }),
  ]);
}

export async function versionGet() {
  const versions = await Info.find({type: 'music'});
  return versions[0]?.version ?? 2; // #26
}

export async function versionInc() {
  const result = await Info.updateOne(
    {type: 'music'},
    {
      $inc: {version: 1},
    },
  );

  if (result.modifiedCount === 0) {
    return Info.updateOne(
      {type: 'music'},
      {
        $set: {version: 2},
      },
      {upsert: true},
    );
  }
}

export async function dbIdGet() {
  const ids = await Info
    .find({type: 'music'})
    .select('dbId -_id');
  return ids[0]?.dbId;
}

export async function dbIdSet(dbId) {
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

export async function playlistNextId() {
  const info = await Info.find({type: 'playlist'});
  return info[0]?.nextId ?? 10;
}

export async function playlistIncId() {
  const result = await Info.updateOne(
    {type: 'playlist'},
    {$inc: {nextId: 1}},
  );
  if (result.modifiedCount === 0) {
    return Info.create({type: 'playlist', nextId: 11});
  }
}

export async function playlistList() {
  return Playlist.find();
}

export async function playlistGet(id) {
  return Playlist.findOne({id});
}

export async function playlistAdd(playlist) {
  return Playlist.create(playlist);
}

export async function playlistUpdate(id, playlist) {
  return Playlist.findOneAndUpdate({id}, {$set: playlist}, {new: true});
}

export async function playlistRemove(id) {
  const result = await Playlist.deleteOne({id});
  return result.deletedCount;
}

export async function playlistQuery(query) {
  return Song.find(query);
}

export async function songRecent(limit) {
  return Song.find()
    .sort({mtime: -1})
    .limit(limit);
}

function hashQuery(metas) {
  const md5sum = crypto.createHash('md5');

  metas.forEach((meta) => md5sum.update(meta));
  return md5sum.digest('hex');
}

export function cacheRead(name, metas, to, handler) {
  name = `${name}-${hashQuery(metas)}`;
  const rs = bucket.openDownloadStreamByName(name);

  log.info(`reading cache for ${name}`);
  safePipe(rs, to, handler);
}

export function cacheWrite(name, metas, buffer, handler) {
  name = `${name}-${hashQuery(metas)}`;
  const ws = bucket.openUploadStream(name);

  log.info(`writing cache for ${name}`);
  ws.on('error', (err) => handler(err));
  ws.write(buffer);
  ws.end();
}

export async function cacheExist(name, metas) {
  // cannot use Bucket.findOne() because of no support for Promise
  // use underlying driver instead
  return db.db.collection('fs.files').findOne({filename: `${name}-${hashQuery(metas)}`});
}

export async function cacheClear() {
  return Promise.all(
    // uses underlying driver
    ['fs.files', 'fs.chunks'].map((name) => db.db.collection(name).drop()),
  )
    .catch((err) => log.warning(err)); // errors igrnored
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
    recent: songRecent,
  },
  cover: {
    get: coverGet,
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
  playlist: {
    list: playlistList,
    get: playlistGet,
    add: playlistAdd,
    update: playlistUpdate,
    remove: playlistRemove,
    nextId: playlistNextId,
    incId: playlistIncId,
    query: playlistQuery,
  },
};

// end of db.mongo.js
