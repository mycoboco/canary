canary: a music streaming server/client
=======================================

`canary` is a package consisting of a music streaming server and its companion
iOS/web clients, built on
[DAAP](https://en.wikipedia.org/wiki/Digital_Audio_Access_Protocol). By using
DAAP for streaming and
[mDNS](https://www.multicastdns.org)/[DNS-SD](https://www.dns-sd.org) for
service discovery, `canary` works seamlessly with
[Apple Music](https://www.apple.com/itunes/).

![running canary with Apple Music](https://code.woong.org/common/files/canary-run.png)

This document describes the server component. For the clients, refer to the
files in the `client` directory.

#### Features

The server supports:

- Compatibility with Apple Music or iTunes as a client
- Scheduled rescanning of music files
  - Efficient change detection (only rescans modified or newly added files)
- Password-based authentication
- Streaming of MP3 and OGG files (if supported by the client)
- Multiple directories for storing music

Currently, the server does __not__ support:

- Creating or editing smart playlists
- Other features you may discover - please report them!

#### Performance

The initial scan is relatively fast thanks to the high performance of the
[`music-metadata`](https://www.npmjs.com/package/music-metadata) module. For
example,

- ~7 minutes for 5,000+ songs on a [Gentoo](https://www.gentoo.org/) system
([Intel Atom D525](https://ark.intel.com/products/49490/Intel-Atom-Processor-D525-1M-Cache-1_80-GHz),
4GB RAM and a 5400-rpm HDD)
- ~1 minutes for subsequent rescans under the same conditions

The server tracks file modification times (mtime) and only processes files that
have been added or changed.

--------------------------------------------------------------------------------

#### Prerequisites

No external database is strictly required.

`canary` supports both:

- A standalone database ([NeDB](https://github.com/louischatriot/nedb))
- [MongoDB](https://www.mongodb.org) (recommended for large music libraries,
  because NeDB keeps indexed data in memory)

For service discovery, `canary` can use:

- [`avahi`](https://www.avahi.org/)
- [`dns-sd`](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/dns-sd.1.html)
- A built-in JavaScript implementation
  ([`mdns-js`](https://www.npmjs.com/package/mdns-js))

⚠️  Running multiple mDNS/DNS-SD services on the same machine may cause
conflicts.

#### mDNS configuration options

The `mdns` setting in `server.conf` determines how service advertisement works:

- `avahi`: uses `avahi-publish-service`
- `dns-sd`: uses `dns-sd`
- `mdns-js`: uses the built-in implementation
- `auto` (default): tries `avahi` or `dns-sd`, falls back to `mdns-js`
- `off`: disables service advertisement

Ensure `avahi-publish-service` or `dns-sd` is accessible in your system `PATH`
if installed.

--------------------------------------------------------------------------------

#### Configuration

Two configuration files are required:

1. Server configuration (`config/server.json`)
2. Database configuration (`config/db.ne.json` or `config/db.mongo.json`)

##### Example: `config/server.json`

```
{
    "name":     "canary music",
    "port":     3689,
    "runAs": {
        "uid": "userid",
        "gid": "groupid"
    },
    "password": "password",
    "scan": {
        "path":  [ "/path/to/mp3/files" ],
        "cycle": [ "17:00:00" ],
        "utc":   false
    },
    "db":    "neDB",
    "mdns":  "auto",
    "web":   true,
    "debug": false
}
```

Notes:

- `name`: Advertised server name (visible to DNS-SD clients)
- `port`: Must be `3689` for Apple Music compatibility
- `runAs`: Drops privileges to specified user(`uid`)/group(`gid`) (recommended
  when starting as root)
- `password`: Enables authentication if non-empty
  - `path`: directories containing music
  - `cycle`: rescan schedule
  - `utc`: whether to use UTC time
- `scan`: controls file rescanning behavior
  - `path`: directories containing music
  - `cycle` and `utc`: define the rescan schedule. The format follows the
    [`ontime`](https://www.npmjs.com/package/ontime) scheduling syntax. `canary`
    supports most `ontime` options, except `single`, which is always treated as
    `true`.
- `db`: `neDB` or `mongoDB`
- `mdns`: service discovery method
- `web`: whether to serve the built web client from `server/web/`. Set to
  `false` to disable web UI serving entirely. If the directory does not exist,
  the server logs a warning and skips serving (DAAP and `/api` endpoints remain
  unaffected).
- `debug`: enables verbose logging

--------------------------------------------------------------------------------

##### Example: `config/db.mongo.json`

```
{
    "host":          "localhost",
    "port":          27017,
    "db":            "canary",
    "user":          "user",
    "password":      "password",
    "reconnectTime": 2
}
```

- Authentication fields are optional
- `reconnectTime`: retry interval (_seconds_) after disconnection

--------------------------------------------------------------------------------

##### Example: `config/db.ne.json`

```
{
    "path": "db"
}
```

Specifies where NeDB stores its persistent files.

--------------------------------------------------------------------------------

#### Running the server

Run the server like any Node.js application:

    node server.js -c config/

- `-c` or `--config`: specifies the configuration directory

Since version 0.2.2, `canary` can extract cover images. If upgrading from an
older version, rebuild the database:

    node server.js -c config/ --rebuild

To serve the web client from the same port, build it first:

    cd ../client/web
    npm install
    npm run build

The server then serves the built artifacts at `/` (configurable via the `web`
field in `server.json`). Without a build, the web UI is silently disabled while
DAAP and `/api` endpoints continue to work.

--------------------------------------------------------------------------------

#### Tested clients

- [iTunes](https://www.apple.com/itunes/) (Windows)
- [Apple Music](https://music.apple.com/) (Mac)
- [Simple DAAP Client](https://itunes.apple.com/app/simple-daap-client/id369605270)
  (iOS)
- [DAAP Media Player](https://play.google.com/store/apps/details?id=org.mult.daap)
  (Android)
- [Music Pump DAAP Player Demo](https://play.google.com/store/apps/details?id=ch.berard.musicpumpdemo)
  (Android)
- [SharePlay](https://play.google.com/store/apps/details?id=com.afqa123.shareplay)
  (Android)
- [Diapente Music Stream Player](https://play.google.com/store/apps/details?id=net.cequals.daaper)
  (Android)

If your client is not listed or does not work, please report the issue.

--------------------------------------------------------------------------------

`INSTALL.md` explains how to build and install the library. For the copyright
issues, see the accompanying `LICENSE.md` file.

If you have a question or suggestion, do not hesitate to contact me via email
(woong.jun at gmail.com) or web (https://code.woong.org/).
