canary: a music streaming server/client
=======================================

`canary` is a package of a music streaming server and its companion iOS client
that run upon
[DAAP](https://en.wikipedia.org/wiki/Digital_Audio_Access_Protocol). Employing
DAAP for streaming and
[mDNS](https://www.multicastdns.org)/[DNS-SD](https://www.dns-sd.org) for
service advertisement let `canary` work perfectly with
[iTunes](https://www.apple.com/itunes/).

![running canary and iTunes](https://code.woong.org/common/files/canary-run.png)

This document explains the server. See the files in the `client` directory for
the client.

The server supports, among other things:

- Apple Music/iTunes as a client,
- rescan of songs based on a schedule,
  - it cleverly does nothing unless files or directories change
- authorization via a password,
- delievery of mp3/ogg files if your client can play them and
- multiple paths to contain your songs

but does not support yet:

- adding or editing smart playlists and
- what I don't know yet but you do
  - please let me know about them!

The initial scan of songs is fairly fast thanks to high performance of the
[`music-metadata`](https://www.npmjs.com/package/music-metadata) module; about 7 mins
with 5,000+ songs on my [Gentoo](https://www.gentoo.org/) machine with
[Intel Atom D525](https://ark.intel.com/products/49490/Intel-Atom-Processor-D525-1M-Cache-1_80-GHz),
4GB RAM and a 5400-rpm HDD. Once the database has been built, rescanning is
even faster; about 1 min on the same condition. The server remembers the mtime,
modification time of files and reads only added or modified files.


#### Prerequisites

- Nothing; [MongoDB](https://www.mongodb.org/) is no longer necessary!

The only thing you need to run `canary` is a node.js environment. `canary`
started to support a stand-alone DB,
[NeDB](https://github.com/louischatriot/nedb) as well as MongoDB. You better
depend on MongoDB, however, if a huge number of songs need to be
served, because NeDB stores all its indexed data on memory.

`canary` can run with [`avahi`](https://www.avahi.org/) or
[`dns-sd`](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/dns-sd.1.html),
or launch its own instance of mDNS/DNS-SD service implemented in pure
JavaScript ([`node-mdns-js`](https://www.npmjs.com/package/mdns-js)) when you
have neither installed.

_Having more than one instance of mDNS/DNS-SD service on the same machine
confuses the service to prevent it from properly working._

The value for `mdns` in `server.conf` (see below) chooses a service for mDNS
publication.

- `avahi`: `avahi-publish-service` is probed to execute;
- `dns-sd`: `dns-sd` is probed to execute;
- `mdns-js`: `mdns-js` is launched without probing the two above;
- `auto`: `canary` tries to execute either of `avahi-publish-service` or
  `dns-sd`, and launches `mdns-js` on failure. This is the default behavior;
- `off`: no service advertisement activated.

If your system have `avahi` or `dns-sd`, please make sure that
`avahi-publish-service` or `dns-sd` is accessible without specifying a path from
the location `canary` runs.

Whenever `avahi` or `dns-sd` fails to start, `mdns-js` is selected as a
fallback.

If you are not able to get the service advertisement to work with any of these
options, please let me know to help you.


#### Configuration

Two configuration files need to be provided for the server, one for its
database and the other for the server itself.

The server configuration, `config/server.json` looks like:

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
    "debug": false
}
```

- the `name` of the server will be published and broadcast. If your client knows
  DNS-SD, it will appear on it;
- the server will run on `port`; it must be set to the default port 3689 for
  iTunes to find the server;
- `runAs`, if specified, makes the server drop privileges by changing its `uid`
  and `gid` to the given ones, which is useful when the server initially runs
  as `root`, for example, by an `init.d` script. If not specified, running the
  server as `root` will be warned;
- if `password` has a non-empty string, the server requires a client to send the
  password on every request. This, for example, forces iTunes ask a password on
  its initial connection to the server;
- `scan` specifies the schedule for rescanning files:
  - `path` is an array of directories of music files to serve;
  - `cycle` and `utc`: clear what these mean from their names but you can refer
    to [`ontime`](https://www.npmjs.com/package/ontime) for how to specify the
    rescanning schedule. `canary-server` accepts other options for `ontime`
    except `single` that is always set to _true_;
- `db` selects a DB to store metadata of scanned songs. `neDB` and `mongoDB`
  (case-insensitive) are supported;
- `mdns` selects a service for mDNS advertisement. Possible values are `auto`,
  `avahi`, `dns-sd`, `mdns-js` and `off`. See _Prerequisites_ section above;
- `debug` controls the server's log level. Setting this to _true_ makes the
  server verbose.

One of `config/db.ne.json` and `config/db.mongo.json` is used depending on the
setting of the `db` field above; both files must exist and be syntactically
correct.

`config/db.mongo.json` contains:

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

The options from `host` to `password` inclusive specify basic information for
DB connection. If no authentication is required, `user` and `password` can be
omitted.

`reconnectTime` specifies a time interval in _seconds_ for which the server
waits before trying to reconnect when disconnected from the DB.

`config/db.ne.json` looks like:

```
{
    "path": "db"
}
```

to specify a path into which persistent DB files go.


#### How to run

As other node.js programs, you can run `canary-server` with

    node server.js -c config/

where the `-c` option (or `--config`) specifies a configuration directory the
server will use.

Since version 0.2.2, `canary` extracts cover images from media files. If you
have database built by a previous version, the `--rebuild` option will help
cover images be prepared.


#### Clients tested

The following DAAP clients have been tested with `canary-server`. If your
favorite client is not on the list or does not work with the server, please
[open](https://github.com/mycoboco/canary/issues/new) a new issue to describe
the problem concisely.

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


#### Help needed

`canary-server` is implemented in a very short time. It already works well but
needs many improvements that include, but not limited to:

- testing for files with various and sometimes weird meta data; metadata of my
  files are normalized so not enough samples to push the server's metadata
  handling.


`INSTALL.md` explains how to build and install the library. For the copyright
issues, see the accompanying `LICENSE.md` file.

If you have a question or suggestion, do not hesitate to contact me via email
(woong.jun at gmail.com) or web (https://code.woong.org/).
