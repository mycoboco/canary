/*
 *  mp3 scanner
 */

import * as fs from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import * as path from 'node:path';
import {inspect} from 'node:util';

import {parseFile} from 'music-metadata';
import {FNV} from 'fnv';
import ontime from 'ontime';
import {logger} from '@hodgepodge-node/server';
import {recursiveWatch as rwatch} from '@hodgepodge-node/util';

import config from '../config.js';
import db from './db.js';
import api from './api.js';

let log;

let qd = [];
let qf = [];

let watch;
let needRescan;
let inProgress;
let version;

export function init() {
  log = logger.create({
    prefix: 'mp3',
    level: config.debug ? 'info' : 'error',
  });

  const {scan: scanConfig} = config.server;
  try {
    scanConfig.path = scanConfig.path.map((p) => realpathSync(p));
  } catch (e) {
    log.error(e);
  }
  watch = rwatch(scanConfig.path, {ignoreHiddenDirs: true});
  watch
    .on('change', () => {
      log.info('change detected; rescan scheduled');
      needRescan = true;
    })
    .on('error', (err) => log.error(err));

  log.info(`rescan scheduled with ${inspect(scanConfig)}`);
  ontime({
    ...scanConfig,
    single: true,
  }, async (ot) => {
    await scan();
    ot.done();
  });
}

function id(s) {
  let fnv = new FNV();
  fnv.update(Buffer.from(s));
  fnv = fnv.value();
  if (fnv < 0) fnv = Math.pow(2, 32) - fnv;
  return (fnv >> 31) ^ (fnv & 0x7fffffff);
}

async function meta(song) {
  const chkmeta = (meta) => {
    if (!isFinite(+meta.year)) {
      meta.year = /^\s*([0-9]{2,4})/.exec(meta.year);
      if (meta.year) [, meta.year] = meta.year;
    }
    meta.year = Math.max(0, +meta.year);

    if (!isFinite(+meta.track) || +meta.track < 0) meta.track = 0;
    else meta.track = +meta.track;

    if (!isFinite(+meta.time) || +meta.time < 0) meta.time = 0;
    else meta.time = +meta.time;

    // handles "Ballad/Ballad"
    if (meta.genre.indexOf('/') !== -1) {
      const genre = /^([^/]+)\/([^/]+)$/.exec(meta.genre);
      if (genre && genre[1] === genre[2]) [, meta.genre] = genre;
    }

    return meta;
  };

  const setMeta = (song, data) => {
    const {
      common,
      format,
    } = data;
    const {
      title,
      artist,
      artists,
      albumartist,
      album,
      year,
      track,
      genre,
      picture,
    } = common;

    const meta = {
      id: id(song),
      kind: 2,
      title: title || path.basename(song),
      artist: albumartist || artist || artists?.filter((a) => a).join(', ') || '(Unknown Artist)',
      album: album || '(Unknown Album)',
      time: Math.floor(format?.duration * 1000 ?? 0),
      year: year ?? 0,
      track: (track?.no) ?? 0,
      genre: genre?.filter((g) => g).join(', ') || '(Unknown Genre)',
      format: path.extname(song).substring(1, song.length - 1),
      path: song,
      cover: picture && {
        format: picture[0].format,
        image: picture[0].data,
      },
    };

    return chkmeta(meta);
  };

  try {
    const metadata = await parseFile(song, {
      duration: true,
      skipCovers: !config.server.useMongo, // cover only supported with MongoDB
    });
    return setMeta(song, metadata);
  } catch (err) {
    log.error(`failed to retrieve meta data from ${song}`, err);
    return setMeta(song, {common: {}});
  }
}

function isSong(f) {
  const ext = path.extname(f).toLowerCase();
  return ext === '.mp3' || ext === '.ogg';
}

async function done() {
  const meta = { // from iTunes 12.5.5.5
    container: 'dmap.itemid,dmap.containeritemid',
    song: 'dmap.itemid,dmap.itemname,dmap.itemkind,dmap.persistentid,daap.songalbum,' +
      'daap.songgrouping,daap.songartist,daap.songalbumartist,daap.songbitrate,' +
      'daap.songbeatsperminute,daap.songcomment,daap.songcodectype,' +
      'daap.songcodecsubtype,daap.songcompilation,daap.songcomposer,' +
      'daap.songdateadded,daap.songdatemodified,daap.songdisccount,' +
      'daap.songdiscnumber,daap.songdisabled,daap.songeqpreset,daap.songformat,' +
      'daap.songgenre,daap.songdescription,daap.songrelativevolume,' +
      'daap.songsamplerate,daap.songsize,daap.songstarttime,daap.songstoptime,' +
      'daap.songtime,daap.songtrackcount,daap.songtracknumber,daap.songuserrating,' +
      'daap.songyear,daap.songdatakind,daap.songdataurl,daap.songcontentrating,' +
      'com.apple.itunes.norm-volume,com.apple.itunes.itms-songid,' +
      'com.apple.itunes.itms-artistid,com.apple.itunes.itms-playlistid,' +
      'com.apple.itunes.itms-composerid,com.apple.itunes.itms-genreid,' +
      'com.apple.itunes.itms-storefrontid,' +
      'com.apple.itunes.has-videodaap.songcategory,daap.songextradata,' +
      'daap.songcontentdescription,daap.songlongcontentdescription,' +
      'com.apple.itunes.is-podcast,com.apple.itunes.mediakind,' +
      'com.apple.itunes.extended-media-kind,com.apple.itunes.series-name,' +
      'com.apple.itunes.episode-num-str,com.apple.itunes.episode-sort,' +
      'com.apple.itunes.season-num,daap.songgapless,' +
      'com.apple.itunes.gapless-enc-del,com.apple.itunes.gapless-heur,' +
      'com.apple.itunes.gapless-enc-dr,com.apple.itunes.gapless-dur,' +
      'com.apple.itunes.gapless-resy,com.apple.itunes.content-rating',
  };

  log.info('scanning songs finished');
  try {
    await db.song.clear(++version);
  } catch (err) {
    log.error(err);
  }
  inProgress = false;
  try {
    await db.version.inc();
    const count = await db.song.count();
    log.info(`${count} song(s) in database`);
  } catch (err) {
    log.error(err);
  }

  log.info('invalidating cache');
  await db.cache.clear();
  log.info('preparing cache for iTunes');
  Object.entries(meta).forEach(([k, v]) => api.cache.update(k, v.split(',')));
}

async function next(update) {
  const addSong = async (file, stats) => {
    let changed;

    try {
      const song = await db.song.get(id(file));
      changed = update || song?.mtime.valueOf() !== stats.mtime.valueOf();
    } catch (err) {
      log.error(err);
      changed = true;
    }
    qf.push({
      path: file,
      mtime: stats.mtime,
      changed,
    });
  };

  if (qd.length === 0 && qf.length === 0) {
    qd = [], qf = [];
    return done();
  }

  await Promise.all([
    new Promise((resolve) => {
      const p = qd.pop();
      if (!p) return resolve();

      fs.readdir(p)
        .then((files) => Promise.all(
          files
            .map((f) => path.join(p, f))
            .map((f) => (async (f) => {
              const stats = await fs.stat(f);
              if (stats.isDirectory()) return qd.push(f);
              if (isSong(f)) return addSong(f, stats);
            })(f)),
        ))
        .then(resolve);
    }),
    new Promise((resolve) => {
      const p = qf.pop();
      if (!p) return resolve();

      if (p.changed) {
        meta(p.path)
          .then((song) => {
            song.version = version + 1;
            song.mtime = p.mtime;
            return song;
          })
          .then(db.song.add)
          .then(resolve);
      } else {
        db.song.touch(id(p.path), version + 1)
          .then(resolve);
      }
    }),
  ])
    .catch((err) => log.error(err));
  await next(update);
}

export async function scan(force, update) {
  if (!force && !needRescan) {
    log.info('rescan is not necessary');
    return;
  }
  if (inProgress) {
    log.warning('scanning is already in progress');
    return;
  }
  needRescan = false;
  inProgress = true;

  log.info('starting to scan songs');
  watch.sync();
  try {
    version = await db.version.get();
  } catch (err) {
    log.error(err);
    version = 2; // #26
  }

  qd.push(...config.server.scan.path);
  await next(update);
}

export function close() {
  // nothing to do
}

export default {
  init,
  scan,
  close,
};

// end of mp3.js
