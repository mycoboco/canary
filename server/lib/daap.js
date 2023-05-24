/* eslint-disable object-curly-newline */
/* eslint-disable no-multi-spaces */

/*
 *  DAAP response
 */

const {inspect} = require('util');

const {logger} = require('@hodgepodge-node/server');

const config = require('../config');

const tag2info = {
  miid: {desc: 'dmap.itemid',                          type: 5, field: 'id'},
  minm: {desc: 'dmap.itemname',                        type: 9, field: 'title'},
  mikd: {desc: 'dmap.itemkind',                        type: 1, field: 'kind'},
  mper: {desc: 'dmap.persistentid',                    type: 7, field: 'id'},
  mcon: {desc: 'dmap.container',                       type: 12},
  mcti: {desc: 'dmap.containeritemid',                 type: 5, field: 'id'},
  mpco: {desc: 'dmap.parentcontainerid',               type: 5},
  mstt: {desc: 'dmap.status',                          type: 5},
  msts: {desc: 'dmap.statusstring',                    type: 9},
  mimc: {desc: 'dmap.itemcount',                       type: 5},
  mctc: {desc: 'dmap.containercount',                  type: 5},
  mrco: {desc: 'dmap.returnedcount',                   type: 5},
  mtco: {desc: 'dmap.specifiedtotalcount',             type: 5},
  mlcl: {desc: 'dmap.listing',                         type: 12},
  mlit: {desc: 'dmap.listingitem',                     type: 12},
  mbcl: {desc: 'dmap.bag',                             type: 12},
  mdcl: {desc: 'dmap.dictionary',                      type: 12},
  msrv: {desc: 'dmap.serverinforesponse',              type: 12},
  msau: {desc: 'dmap.authenticationmethod',            type: 1},
  msas: {desc: 'dmap.authenticationschemes',           type: 5},
  mslr: {desc: 'dmap.loginrequired',                   type: 1},
  mpro: {desc: 'dmap.protocolversion',                 type: 11},
  msal: {desc: 'dmap.supportsautologout',              type: 1},
  msup: {desc: 'dmap.supportsupdate',                  type: 1},
  mspi: {desc: 'dmap.supportspersistentids',           type: 1},
  msex: {desc: 'dmap.supportsextensions',              type: 1},
  msbr: {desc: 'dmap.supportsbrowse',                  type: 1},
  msqy: {desc: 'dmap.supportsquery',                   type: 1},
  msix: {desc: 'dmap.supportsindex',                   type: 1},
  msrs: {desc: 'dmap.supportsresolve',                 type: 1},
  mstm: {desc: 'dmap.timeoutinterval',                 type: 5},
  msdc: {desc: 'dmap.databasescount',                  type: 5},
  mstc: {desc: 'dmap.utctime',                         type: 10},
  msto: {desc: 'dmap.utcoffset',                       type: 6},
  mlog: {desc: 'dmap.loginresponse',                   type: 12},
  mlid: {desc: 'dmap.sessionid',                       type: 5},
  mupd: {desc: 'dmap.updateresponse',                  type: 12},
  musr: {desc: 'dmap.serverrevision',                  type: 5},
  muty: {desc: 'dmap.updatetype',                      type: 1},
  mudl: {desc: 'dmap.deletedid',                       type: 12},
  mccr: {desc: 'dmap.contentcodesresponse',            type: 12},
  mcnm: {desc: 'dmap.contentcodesnumber',              type: 5},
  mcna: {desc: 'dmap.contentcodesname',                type: 9},
  mcty: {desc: 'dmap.contentcodestype',                type: 3},
  meds: {desc: 'dmap.editcommandssupported',           type: 5},
  ated: {desc: 'daap.supportsextradata',               type: 3},
  apro: {desc: 'daap.protocolversion',                 type: 11},
  avdb: {desc: 'daap.serverdatabases',                 type: 12},
  abro: {desc: 'daap.databasebrowse',                  type: 12},
  adbs: {desc: 'daap.databasesongs',                   type: 12},
  aply: {desc: 'daap.databaseplaylists',               type: 12},
  apso: {desc: 'daap.playlistsongs',                   type: 12},
  arsv: {desc: 'daap.resolve',                         type: 12},
  arif: {desc: 'daap.resolveinfo',                     type: 12},
  abal: {desc: 'daap.browsealbumlisting',              type: 12},
  abar: {desc: 'daap.browseartistlisting',             type: 12},
  abcp: {desc: 'daap.browsecomposerlisting',           type: 12},
  abgn: {desc: 'daap.browsegenrelisting',              type: 12},
  aePP: {desc: 'com.apple.itunes.is-podcast-playlist', type: 1},
  asal: {desc: 'daap.songalbum',                       type: 9, field: 'album'},
  asar: {desc: 'daap.songartist',                      type: 9, field: 'artist'},
  asbr: {desc: 'daap.songbitrate',                     type: 3},
  ascm: {desc: 'daap.songcomment',                     type: 9},
  asco: {desc: 'daap.songcompilation',                 type: 1},
  ascp: {desc: 'daap.songcomposer',                    type: 9},
  asda: {desc: 'daap.songdateadded',                   type: 10},
  asdm: {desc: 'daap.songdatemodified',                type: 10},
  asdc: {desc: 'daap.songdisccount',                   type: 3},
  asdn: {desc: 'daap.songdiscnumber',                  type: 3},
  aseq: {desc: 'daap.songeqpreset',                    type: 9},
  asgn: {desc: 'daap.songgenre',                       type: 9, field: 'genre'},
  asdt: {desc: 'daap.songdescription',                 type: 9},
  asrv: {desc: 'daap.songrelativevolume',              type: 2},
  assr: {desc: 'daap.songsamplerate',                  type: 5},
  assz: {desc: 'daap.songsize',                        type: 5},
  asst: {desc: 'daap.songstarttime',                   type: 5},
  assp: {desc: 'daap.songstoptime',                    type: 5},
  astm: {desc: 'daap.songtime',                        type: 5, field: 'time'},
  astc: {desc: 'daap.songtrackcount',                  type: 3},
  astn: {desc: 'daap.songtracknumber',                 type: 3, field: 'track'},
  asur: {desc: 'daap.songuserrating',                  type: 1},
  asyr: {desc: 'daap.songyear',                        type: 3, field: 'year'},
  asfm: {desc: 'daap.songformat',                      type: 9, field: 'format'},
  asdb: {desc: 'daap.songdisabled',                    type: 1},
  asdk: {desc: 'daap.songdatakind',                    type: 1},
  asul: {desc: 'daap.songdataurl',                     type: 9},
  asbt: {desc: 'daap.songbeatsperminute',              type: 3},
  abpl: {desc: 'daap.baseplaylist',                    type: 1},
  agrp: {desc: 'daap.songgrouping',                    type: 9},
  ascd: {desc: 'daap.songcodectype',                   type: 5},
  ascs: {desc: 'daap.songcodecsubtype',                type: 5},
  apsm: {desc: 'daap.playlistshufflemode',             type: 1},
  aprm: {desc: 'daap.playlistrepeatmode',              type: 1},
  asct: {desc: 'daap.songcategory',                    type: 9},
  ascn: {desc: 'daap.songcontentdescription',          type: 9},
  aslc: {desc: 'daap.songlongcontentdescription',      type: 9},
  asky: {desc: 'daap.songkeywords',                    type: 9},
  ascr: {desc: 'daap.songcontentrating',               type: 1},
  asgp: {desc: 'daap.songgapless',                     type: 1},
  asdr: {desc: 'daap.songdatereleased',                type: 10},
  asdp: {desc: 'daap.songdatepurchased',               type: 10},
  ashp: {desc: 'daap.songhasbeenplayed',               type: 1},
  assn: {desc: 'daap.sortname',                        type: 9},
  assa: {desc: 'daap.sortartist',                      type: 9},
  assl: {desc: 'daap.sortalbumartist',                 type: 9},
  assu: {desc: 'daap.sortalbum',                       type: 9},
  assc: {desc: 'daap.sortcomposer',                    type: 9},
  asss: {desc: 'daap.sortseriesname',                  type: 9},
  asbk: {desc: 'daap.bookmarkable',                    type: 1},
  asbo: {desc: 'daap.songbookmark',                    type: 5},
  aspu: {desc: 'daap.songpodcasturl',                  type: 9},
  asai: {desc: 'daap.songalbumid',                     type: 7},
  asls: {desc: 'daap.songlongsize',                    type: 7},
  asaa: {desc: 'daap.songalbumartist',                 type: 9},
  aeSP: {desc: 'com.apple.itunes.smart-playlist',      type: 1},
};
const desc2tag = {};
Object.keys(tag2info).forEach((key) => desc2tag[tag2info[key].desc] = key);

const max = {
  byte1: Math.pow(2, 8) - 1,
  byte2: Math.pow(2, 16) - 1,
  byte4: Math.pow(2, 32) - 1,
};
const verTmpl = /([0-9]+)\.([0-9]+)(?:\.([0-9]+))?/;
const log = logger.create({
  prefix: 'daap',
  level: config.debug ? 'info' : 'error',
});

function number2(n) {
  const buf = Buffer.alloc(2);
  n = Math.min(max.byte2, Math.max(0, n));
  buf.writeUInt16BE(n, 0);

  return buf;
}

function number4(n) {
  const buf = Buffer.alloc(4);
  n = Math.min(max.byte4, Math.max(0, n));
  buf.writeUInt32BE(n, 0);

  return buf;
}

function size(n) {
  return number4(n);
}

function number8(n) {
  const buf = Buffer.alloc(8);
  n = Math.min(max.byte4, Math.max(0, n));
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(n, 4);

  return buf;
}

function byte(n) {
  const buf = Buffer.alloc(1);
  n = +n;
  n = Math.min(max.byte1, Math.max(0, n));
  buf.writeUInt8(n, 0);

  return buf;
}

function date(d) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(d.valueOf() / 1000, 0);

  return buf;
}

function version(v) {
  const version = verTmpl.exec(v);
  const buf = Buffer.alloc(4);

  version[1] = Math.min(max.byte2, Math.max(0, +version[1]));
  version[2] = Math.min(max.byte1, Math.max(0, +version[2]));
  version[3] = Math.min(max.byte1, Math.max(0, +version[3]));

  buf.writeUInt16BE(version[1], 0);
  buf.writeUInt8(version[2], 2);
  buf.writeUInt8(+version[3] || 0, 3);

  return buf;
}

function chktype(key, val, type) {
  switch (type) {
    case 'byte':
      if (typeof val === 'number' || typeof val === 'boolean') return;
      break;
    case 'number':
    case 'string':
    case 'object':
      if (typeof val === type) return;
      break;
    case 'date':
      if (val instanceof Date) return;
      break;
    case 'version':
      if (typeof val === 'string' && verTmpl.test(val)) return;
      break;
    default:
      throw new Error(`val(${val}) has invalid type(${typeof val}) for ${key}; should be ${type}`);
  }
}

async function buffer(obj) {
  const [key] = Object.keys(obj);
  const buf = Buffer.from(key, 'utf-8');
  let val = obj[key];

  if (!tag2info[key]) throw new Error(`unknown key: ${key}`);

  switch (tag2info[key].type) {
    case 1: // char
      chktype(key, val, 'byte');
      return Buffer.concat([buf, size(1), byte(val)], buf.length + 4 + 1);
    case 3: // 2-byte integer
      chktype(key, val, 'number');
      return Buffer.concat([buf, size(2), number2(val)], buf.length + 4 + 2);
    case 5: // 4-byte integer
      chktype(key, val, 'number');
      return Buffer.concat([buf, size(4), number4(val)], buf.length + 4 + 4);
    case 7: // 8-byte integer
      chktype(key, val, 'number');
      return Buffer.concat([buf, size(8), number8(val)], buf.length + 4 + 8);
    case 9: // string
      chktype(key, val, 'string');
      val = Buffer.from(val, 'utf-8');
      return Buffer.concat([buf, size(val.length), val], buf.length + 4 + val.length);
    case 10: // date (4-byte integer with seconds since 1970)
      chktype(key, val, 'date');
      return Buffer.concat([buf, size(4), date(val)], buf.length + 4 + 4);
    case 11: // version (2-bytes major version, minor version, patch level)
      chktype(key, val, 'version');
      return Buffer.concat([buf, size(4), version(val)], buf.length + 4 + 4);
    case 12: // container
    {
      let top;
      chktype(key, val, 'object');
      if (!Array.isArray(val)) {
        top = [];
        Object.entries(val).forEach(([k, v]) => {
          const nested = {};
          nested[k] = v;
          top.push(nested);
        });
        val = top;
      }
      top = Buffer.alloc(0);
      for (const v of val) {
        const nested = await buffer(v);
        top = Buffer.concat([top, nested], top.length + nested.length);
      }
      return Buffer.concat([buf, size(top.length), top], buf.length + 4 + top.length);
    }
    default:
      throw new Error(`unknown type: ${tag2info[key].type}`);
  }
}

async function build(obj) {
  log.info(`building DAAP response from: ${inspect(obj)}`);

  try {
    return await buffer(obj);
  } catch (err) {
    log.error(err);
  }
}

async function item(container, songs, metas) {
  const obj = {};
  const top = container ? 'apso' : 'adbs';

  obj[top] = [
    {mstt: 200},
    {muty: 1},
    {mtco: songs.length},
    {mrco: songs.length},
  ];

  const mlcl = [];
  for (const song of songs) {
    await Promise.resolve();
    const mlit = {};
    metas.forEach((meta) => {
      const key = desc2tag[meta];
      if (tag2info[key] && tag2info[key].field) mlit[key] = song[tag2info[key].field];
    });
    mlcl.push({mlit});
  }
  obj[top].push({mlcl});
  return obj;
}

module.exports = {
  build,
  song: {
    item: item.bind(null, false),
  },
  container: {
    item: item.bind(null, true),
  },
};

// end of daap.js
