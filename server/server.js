#!/usr/bin/env node

/*
 *  canary server
 */

import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const {version: VERSION} = JSON.parse(readFileSync('./package.json'));

import config from './config.js';
const {argv} = config;
(function() {
  if (argv.version) version();
  if (!argv.c || argv.help) usage();
})();

import * as zlib from 'node:zlib';

import express from 'express';
const app = express();
import {
  logger,
  dropPrivilege,
} from '@hodgepodge-node/server';

import db from './lib/db.js';
import api from './lib/api.js';
import mp3 from './lib/mp3.js';
import mdns from './lib/mdns.js';
let service;

let log;

async function exit() {
  mp3?.close();
  if (service) {
    log.info('stopping service advertisement');
    const _service = service;
    service = null;
    await _service.stop();
  }
  db?.close();
  process.exit(0);
}

function installRoute() {
  const route = {
    'get': {
      '/server-info': [api.serverInfo],
      '/login': [api.auth, api.login],
      '/update': [api.auth, api.update],
      '/logout': [api.logout],
      '/databases': [api.auth, api.database.info],
      '/databases/1/items': [api.auth, api.database.item],
      '/databases/1/containers': [api.auth, api.container.info],
      '/databases/1/containers/:pl/items': [api.auth, api.container.item],
      '/databases/1/items/:file': [api.song], // iTunes sends no password
      '/databases/1/items/:id/extra_data/artwork': [api.cover],
    },
  };

  Object.entries(route).forEach(([method, set]) => {
    Object.entries(set).forEach(([path, handlers]) => {
      app[method](path, ...handlers);
    });
  });
}

function publishService(services, i = 0) {
  const s = services[i];
  log.info(`running ${s}`);
  service = mdns[s](config.server.name, config.server.port, (err) => {
    if (i < services?.length - 1) { // something went wrong
      service = null;
      if (!err?.signal) {
        log.warning(`seems not to have '${s}'`);
        if (i + 1 === services.length - 1) log.warning(`fall back to '${services[i + 1]}'`);
        publishService(services, i + 1);
      } else { // probably killed for a reason
        log.error(`'${s}' has suddenly stopped`);
      }
    }
  });
}

function version() {
  // 12345678911234567892123456789312345678941234567895123456789612345678971234567898
  console.log(
    `canary server ${VERSION}\n` +
    'This is free software; see the LICENSE file for more information. There is NO\n' +
    'warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.\n\n' +
    'Written by Woong Jun.',
  );
  process.exit(); // cannot use exit()
}

function usage() {
  // 12345678911234567892123456789312345678941234567895123456789612345678971234567898
  console.log(
    'Usage: node server <OPTION>...\n\n' +
    'Mandatory arguments to long options are mandatory for short options too.\n' +
    '  -c, --config DIR      directory for configurations [required]\n' +
    '      --no-rescan       do not scan songs immediately after server starts\n' +
    '      --rebuild         rebuild database; overrides --no-rescan\n' +
    '      --help            display this help and exit\n' +
    '      --version         display version information and exit\n',
  );
  console.log('For bug reporting instructions, please see: <http://code.woong.org/>.');
  process.exit(); // cannot use exit()
}

// starts here
(async function() {
  log = logger.create({
    prefix: 'server',
    level: config.debug ? 'info' : 'error',
  });

  if (!Array.isArray(config.server.scan.path)) {
    config.server.scan.path = [config.server.scan.path];
  }

  process
    .on('SIGINT', exit)
    .on('SIGTERM', exit)
    .on('uncaughtException', (err) => {
      log.error(err);
      exit();
    });
  process.on('SIGUSR2', () => mp3.scan(true));

  dropPrivilege(config.server.runAs, log, exit);

  app.use((req, res, next) => {
    log.info(`<< ${req.method} ${req.url} >>`);

    res.ok = (body) => {
      const send = (err, buffer) => {
        const header = {
          'DAAP-Server': `canary/${VERSION}`,
          'Content-Type': 'application/x-dmap-tagged',
          'Accept-Ranges': 'bytes',
        };

        if (err) {
          log.error(err);
          log.warning('uncompressed response sent instead');
        } else if (buffer) {
          header['Content-Encoding'] = 'gzip';
          body = buffer;
        }
        header['Content-Length'] = body.length;
        res.writeHead(200, header);
        res.write(body);
        res.end();
      };

      if (!body) return res.sendStatus(500);

      log.info(`sending response to ${req.method} ${req.url}`);
      if (/\bgzip\b/.test(req.headers['accept-encoding'])) {
        zlib.gzip(body, send);
      } else {
        send();
      }
    };

    next();
  });
  installRoute();
  // handles errors
  app.use((err, req, res) => {
    log.warning(`error occurred while handling ${req.method} ${req.url}`);
    log.error(err);
    res
      .status(isFinite(err.statusCode) ? err.statusCode : 500)
      .send(err.message);
  });

  try {
    await db.init();
    const id = await mdns.init();
    log.info(`database id to advertise is ${id}`);

    const {mdns: mdnsConfig} = config.server;
    if (mdnsConfig === 'auto') {
      log.info('detecting tools for service advertisement');
      publishService(['avahi', 'dns-sd', 'mdns-js']);
    } else if (mdnsConfig !== 'off') {
      if (typeof mdns[mdnsConfig] === 'function') {
        publishService([mdnsConfig, 'mdns-js']);
      } else {
        log.error(`'${mdnsConfig}' not supported for service advertisement`);
        log.warning('trying to auto-detect');
        publishService(['avahi', 'dns-sd', 'mdns-js']);
      }
    }

    mp3.init();
    if (argv.rescan) mp3.scan(true, argv.rebuild);

    const server = createServer({requireHostHeader: false}, app);
    server.listen(config.server.port, () => {
      log.info(`listening on port ${config.server.port}`);
    });
  } catch (err) {
    log.warning(err);
  }
})();

// end of server.js
