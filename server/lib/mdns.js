/*
 *  service advertisement via mDNS
 */

const {execFile} = require('child_process');

const which = require('which');
const mdns = require('mdns-js');

const db = require('./db');

let id = 'beddab1edeadbea7';

async function init() {
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

function avahi(name, port, handler) {
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

function dnssd(name, port, handler) {
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

function mdnsjs(name, port, handler) {
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

module.exports = {
  init,
  avahi,
  'dns-sd': dnssd,
  'mdns-js': mdnsjs,
};

// end of mdns.js
