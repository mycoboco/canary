/*
 *  web JSON API handlers
 */

import * as fs from 'node:fs/promises';
import {createReadStream, readFileSync} from 'node:fs';

import mime from 'mime';
import {
  logger,
  range,
  ServerError,
} from '@hodgepodge-node/server';
import {safePipe} from '@hodgepodge-node/util';

const {version: VERSION} = JSON.parse(readFileSync('./package.json'));

import config from '../config.js';
import db from './db.js';
import playlist from './playlist.js';

const log = logger.create({
  prefix: 'api.web',
  level: config.debug ? 'info' : 'error',
});

function sanitizeSong(song) {
  const {
    id,
    title,
    artist,
    album,
    genre,
    year,
    track,
    time,
    format,
  } = song;

  return {
    id,
    title,
    artist,
    album,
    genre,
    year,
    track,
    time,
    format,
  };
}

// GET /api/server
export async function serverInfo(_req, res) {
  const songCount = await db.song.count();
  res.json({
    name: config.server.name,
    version: VERSION,
    songCount,
  });
}

// GET /api/songs
export async function songs(_req, res, next) {
  try {
    const list = await db.song.list();
    res.json(list.map(sanitizeSong));
  } catch (err) {
    next(err);
  }
}

// GET /api/songs/:id/stream
export async function songStream(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) throw new ServerError(400, `invalid song id: ${req.params.id}`);

    const song = await db.song.path(id);
    if (!song) throw new ServerError(404, 'song not found');

    if (!config.server.scan.path.some((p) => song.path.indexOf(p) === 0)) {
      throw new ServerError(403, `invalid path`);
    }
    const stats = await fs.stat(song.path);
    const ext = song.path.split('.').pop();
    const r = range.parse(req.headers.range, stats);
    if (r instanceof Error) throw new ServerError(416, r);

    let rs;
    if (r) {
      res.writeHead(206, {
        'Content-Length': r.e - r.s + 1,
        'Content-Type': mime.getType(ext),
        'Content-Range': range.header(r, stats),
        'Accept-Ranges': 'bytes',
      });
      rs = createReadStream(song.path, {start: r.s, end: r.e});
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': mime.getType(ext),
        'Accept-Ranges': 'bytes',
      });
      rs = createReadStream(song.path);
    }
    safePipe(rs, res, (err) => log.error(err));
  } catch (err) {
    next(err);
  }
}

// GET /api/songs/:id/cover
export async function songCover(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) throw new ServerError(400, `invalid song id: ${req.params.id}`);

    const cover = await db.cover.get(id);
    if (!cover) return res.sendStatus(404);
    res.writeHead(200, {'Content-Type': cover.format});
    res.end(Buffer.from(cover.image));
  } catch (err) {
    next(err);
  }
}

function sanitizePlaylist(pls) {
  const {
    id, name, type,
  } = pls;
  if (type === 'manual') {
    return {
      id,
      name,
      type,
      songIds:
      pls.songIds ?? [],
    };
  }
  return {
    id,
    name,
    type,
    match: pls.match,
    rules: pls.rules,
  };
}

function buildPlaylistDoc({
  name, type, match, rules, songIds,
}) {
  const base = {name: name.trim(), type};
  if (type === 'manual') return {...base, songIds: [...new Set(songIds)]};
  return {
    ...base,
    match,
    rules,
  };
}

// GET /api/playlists
export async function playlistList(_req, res, next) {
  try {
    const result = [];
    const songCount = await db.song.count();
    if (songCount > 0) {
      result.push({
        id: 1,
        name: 'Recently Added',
        type: 'builtin',
      });
    }
    const list = await db.playlist.list();
    result.push(...list.map(sanitizePlaylist));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/playlists
export async function playlistCreate(req, res, next) {
  try {
    const error = playlist.validate(req.body);
    if (error) return res.status(400).json({error});

    const id = await db.playlist.nextId();
    await db.playlist.incId();

    const pls = {id, ...buildPlaylistDoc(req.body)};
    await db.playlist.add(pls);
    res.status(201).json(sanitizePlaylist(pls));
  } catch (err) {
    next(err);
  }
}

// PUT /api/playlists/:id
export async function playlistUpdate(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) return res.status(400).json({error: 'invalid playlist id'});

    const error = playlist.validate(req.body);
    if (error) return res.status(400).json({error});
    if (id === 1) return res.status(400).json({error: 'cannot modify built-in playlist'});

    const existing = await db.playlist.get(id);
    if (!existing) return res.status(404).json({error: 'playlist not found'});
    if (existing.type !== req.body.type) {
      return res.status(400).json({error: 'cannot change playlist type'});
    }

    const updated = await db.playlist.update(id, buildPlaylistDoc(req.body));
    res.json(sanitizePlaylist(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/playlists/:id
export async function playlistDelete(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) return res.status(400).json({error: 'invalid playlist id'});
    if (id === 1) return res.status(400).json({error: 'cannot delete built-in playlist'});

    const existing = await db.playlist.get(id);
    if (!existing) return res.status(404).json({error: 'playlist not found'});

    await db.playlist.remove(id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
}

// GET /api/playlists/:id/songs
export async function playlistSongs(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) return res.status(400).json({error: 'invalid playlist id'});

    if (id === 1) {
      const songs = await db.song.recent(50);
      return res.json(songs.map(sanitizeSong));
    }

    const pls = await db.playlist.get(id);
    if (!pls) return res.status(404).json({error: 'playlist not found'});

    const songs = await playlist.evaluate(pls);
    res.json(songs.map(sanitizeSong));
  } catch (err) {
    next(err);
  }
}

// POST /api/playlists/:id/songs
export async function playlistAddSong(req, res, next) {
  try {
    const id = +req.params.id;
    if (!isFinite(id)) return res.status(400).json({error: 'invalid playlist id'});
    const songId = +req.body?.songId;
    if (!Number.isInteger(songId)) return res.status(400).json({error: 'invalid songId'});

    const song = await db.song.get(songId);
    if (!song) return res.status(404).json({error: 'song not found'});

    const updated = await db.playlist.addSong(id, songId);
    if (!updated) return res.status(404).json({error: 'manual playlist not found'});
    res.json(sanitizePlaylist(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/playlists/:id/songs/:songId
export async function playlistRemoveSong(req, res, next) {
  try {
    const id = +req.params.id;
    const songId = +req.params.songId;
    if (!isFinite(id)) return res.status(400).json({error: 'invalid playlist id'});
    if (!Number.isInteger(songId)) return res.status(400).json({error: 'invalid songId'});

    const updated = await db.playlist.removeSong(id, songId);
    if (!updated) return res.status(404).json({error: 'manual playlist not found'});
    res.json(sanitizePlaylist(updated));
  } catch (err) {
    next(err);
  }
}

export default {
  serverInfo,
  songs,
  songStream,
  songCover,
  playlistList,
  playlistCreate,
  playlistUpdate,
  playlistDelete,
  playlistSongs,
  playlistAddSong,
  playlistRemoveSong,
};
