/*
 *  server APIs
 */

import * as fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';

import mime from 'mime';
import {
  logger,
  range,
  ServerError,
} from '@hodgepodge-node/server';
import {safePipe} from '@hodgepodge-node/util';

import config from '../config.js';
import db from './db.js';
import daap from './daap.js';

const log = logger.create({
  prefix: 'api',
  level: config.debug ? 'info' : 'error',
});
let cache = true;

const nextSession = (() => {
  let session = 1;

  return () => {
    if (session > Math.pow(2, 31) - 1) session = 1;
    return session++;
  };
})();

export function auth(req, res, next) {
  if (!config.server.password) return next();

  if (!req.headers.authorization) {
    log.warning('password required');
    return res.sendStatus(401);
  }

  let p = req.headers.authorization.substring(5); // 'Basic ...'
  p = Buffer.from(p, 'base64').toString();
  // iTunes_Music/1.2.5 (Macintosh; OS X 12.6) AppleWebKit/613.3.9.1.16 build/7 (dt:1):password
  p = p.substring(p.lastIndexOf(':'));
  if (p !== `:${config.server.password}`) {
    log.warning('authorization failed');
    return res.sendStatus(401);
  }

  next();
}

export async function login(_req, res) {
  res.ok(await daap.build({
    mlog: [
      {mstt: 200},
      {mlid: nextSession()},
    ],
  }));
}

export async function update(req, res) {
  const run = async () => {
    let version;

    try {
      version = await db.version.get();
    } catch (err) {
      log.error(err);
      version = 2; // #26
    }

    res.ok(await daap.build({
      mupd: [
        {mstt: 200},
        {musr: version},
      ],
    }));
  };

  if (+req.query.delta > 0) setTimeout(run, 30 * 1000);
  else run();
}

export function logout(_req, res) {
  res.ok(Buffer.alloc(0));
}

export async function serverInfo(_req, res) {
  const auth = config.server.password ? 2 : 0; // 2: password only

  res.ok(await daap.build({
    msrv: [
      {mstt: 200},
      {mpro: '2.0.0'},
      {apro: '3.0.0'},
      {minm: config.server.name},
      {mslr: !!auth},
      {msau: auth},
      {mstm: 1800},
      {msex: false},
      {msix: false},
      {msbr: false},
      {msqy: false},
      {msup: false},
      {msrs: false},
      {msdc: 1},
      {msal: false},
      {mspi: true},
      {ated: 0},
    ],
  }));
}

export async function databaseInfo(req, res, next) {
  let update;
  try {
    const version = await db.version.get();
    update = +req.query.delta !== version;
  } catch (err) {
    update = true;
  }
  const mlcl = !update ? [] : {
    mlit: [
      {miid: 1},
      {mper: 1},
      {minm: config.server.name},
      {mimc: 1}, // updated later
      {mctc: 1},
    ],
  };

  try {
    const number = await db.song.count();
    if (mlcl.mlit) mlcl.mlit.mimc = number;
    res.ok(await daap.build({
      avdb: [
        {mstt: 200},
        {muty: 0},
        {mtco: update ? 1 : 0},
        {mrco: update ? 1 : 0},
        {mlcl},
      ],
    }));
  } catch (err) {
    next(err);
  }
}

function defaultMetas(name, meta) {
  const d = {
    container: 'dmap.itemid,dmap.itemname,dmap.persistentid,dmap.parentcontainerid,' +
      'com.apple.itunes.smart-playlist',
    song: 'dmap.itemkind,dmap.itemid,daap.songalbum,daap.songartist,daap.songgenre,daap.songtime,' +
      'daap.songtracknumber,daap.songformat',
  };

  return (meta || d[name]).split(',');
}

async function sendList(name, metas, res, next) {
  if (cache) {
    try {
      const exist = await db.cache.exist(name, metas);
      if (exist) return db.cache.read(name, metas, res, cacheDisable);
    } catch (err) {
      // fall through
    }
  }
  cacheUpdate(name, metas, res, next);
}

export async function databaseItem(req, res, next) {
  const metas = defaultMetas('song', req.query.meta);

  try {
    const version = await db.version.get();
    if (+req.query.delta === version) {
      log.info('sending empty list because nothing updated');
      return res.ok(
        await daap.build(
          await daap.song.item([], metas),
        ),
      );
    }
  } catch (err) {
    // fall through
  }
  await sendList('song', metas, res, next);
}

// TODO: support smart playlists
export async function containerInfo(req, res) {
  let update;
  try {
    const version = await db.version.get();
    update = +req.query.delta !== version;
  } catch (err) {
    update = true;
  }

  const mlcl = !update ? [] : {
    mlit: [
      {miid: 1},
      {mper: 1},
      {minm: config.server.name},
      {mimc: 1},
    ],
  };

  res.ok(await daap.build({
    aply: [
      {mstt: 200},
      {muty: 0},
      {mtco: update ? 1 : 0},
      {mrco: update ? 1 : 0},
      {mlcl},
    ],
  }));
}

export async function containerItem(req, res, next) {
  const metas = defaultMetas('container', req.query.meta);

  try {
    const version = await db.version.get();
    if (+req.query.delta === version) {
      log.info('sending empty list because nothing updated');
      return res.ok(
        await daap.build(
          await daap.container.item([], metas),
        ),
      );
    }
  } catch (err) {
    // fall through
  }
  await sendList('container', metas, res, next);
}

export async function song(req, res, next) {
  try {
    const id = /([0-9]+)\.(mp3|ogg)/i.exec(req.params.file);
    if (!isFinite(+id[1])) throw new ServerError(400, `invaild song id: ${id[1]}`);

    const song = await db.song.path(+id[1]);
    if (!song) throw new Error('no songs found');

    if (!config.server.scan.path.some((p) => song.path.indexOf(p) === 0)) {
      throw new Error(`requested file(${song.path}) has no valid path`);
    }
    const stats = await fs.stat(song.path);
    const r = range.parse(req.headers.range, stats);
    if (r instanceof Error) throw new ServerError(416, r);

    let rs;
    if (r) {
      res.writeHead(206, {
        'Content-Length': r.e - r.s + 1,
        'Content-Type': mime.getType(req.params.file),
        'Content-Range': range.header(r, stats),
      });
      rs = createReadStream(song.path, {
        start: r.s,
        end: r.e,
      });
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': mime.getType(req.params.file),
      });
      rs = createReadStream(song.path);
    }
    safePipe(rs, res, (err) => log.error(err));
  } catch (err) {
    if (!err.statusCode) err.statusCode = 404;
    next(err);
  }
}

export async function cacheUpdate(name, metas = defaultMetas(name), res, next) {
  try {
    const songs = await db.song.list();
    const buf = await daap.build(
      await daap[name].item(songs, metas),
    );
    if (res) res.ok(buf);
    if (cache) db.cache.write(name, metas, buf, cacheDisable);
  } catch (err) {
    if (next) next(err);
  }
}

export function cacheDisable(err) {
  cache = false;
  log.error(err);
  log.warning('cache disabled');
}

export async function cover(req, res, next) {
  try {
    const {id} = req.params;
    const cover = await db.cover.get(+id);
    if (!cover) return res.sendStatus(404); // ignored
    res.writeHead(200, {'Content-Type': cover.format});
    res.end(Buffer.from(cover.image));
  } catch (err) {
    next(err);
  }
}

export default {
  auth,
  login,
  update,
  logout,
  serverInfo,
  database: {
    info: databaseInfo,
    item: databaseItem,
  },
  container: {
    info: containerInfo,
    item: containerItem,
  },
  song,
  cache: {
    disable: cacheDisable,
    update: cacheUpdate,
  },
  cover,
};

// end of api.js
