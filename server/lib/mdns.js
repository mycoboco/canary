/*
 *  service advertisement via mDNS
 */

import {execFile} from 'node:child_process';

import which from 'which';
import mdns from 'mdns-js';

import db from './db.js';

let id = 'beddab1edeadbea7';

export async function init() {
  let dbId = await db.dbId.get();
  if (dbId) return id = dbId;

  dbId = `${
    new Date()
      .valueOf()
      .toString(16)
  }${Math.floor(Math.random() * 16).toString(16)}`;
  id = `${id.substring(0, id.length - dbId.length)}${dbId}`;
  db.dbId.set(id); // no await intentionally
  return id;
}

function escape(s) {
  return s.replace(/-/g, '\\-');
}

function getTxts() {
  return ['txtvers=1', `Database ID=${id}`];
}

export function avahi(name, port, handler) {
  const service = execFile(
    which.sync('avahi-publish-service', {nothrow: true}) || 'avahi-publish-service',
    [
      escape(name),
      '_daap._tcp',
      port,
      ...getTxts(),
    ],
    handler,
  );

  return {stop: async () => service.kill()};
}

export function dnssd(name, port, handler) {
  const service = execFile(
    which.sync('dns-sd', {nothrow: true}) || 'dns-sd',
    [
      '-R',
      escape(name),
      '_daap._tcp',
      'local',
      port,
      ...getTxts(),
    ],
    handler,
  );

  return {stop: async () => service.kill()};
}

export function mdnsjs(name, port, handler) {
  const service = mdns.createAdvertisement(
    '_daap._tcp',
    port,
    {
      name,
      txt: getTxts()
        .map((t) => t.split('='))
        .reduce((acc, [k, v]) => {
          acc[k] = v;
          return acc;
        }, {}),
    },
  );
  service.start();
  handler();

  return {
    stop: () => new Promise((resolve) => {
      service.stop(resolve);
    }),
  };
}

export default {
  init,
  avahi,
  'dns-sd': dnssd,
  'mdns-js': mdnsjs,
};

// end of mdns.js
