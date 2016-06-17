/*
 *  server APIs
 */

'use strict'

var fs = require('fs')

var defaults = require('defaults')
var mime = require('mime')
var hodgepodge = {
    logger: require('hodgepodge-node/logger'),
    range:  require('hodgepodge-node/range')
}

var mp3 = require('./mp3')


var log, db, daap, conf
var cache = {}


function init(_db, _daap, _conf) {
    conf = defaults(_conf, {
        server: {
            name: 'canary',
            scan: {
                path: [ '/path/to/mp3/files' ]
            }
        },
        debug: false
    })

    log = hodgepodge.logger.create({
        prefix: 'api',
        level:  (conf.debug)? 'info': 'error'
    })

    db = _db
    daap = _daap
}


var nextSession = function () {
    var session = 1

    return function () {
        if (session > Math.pow(2, 31)-1) session = 1
        return session++
    }
}()


function auth(req, res, next) {
    var p

    if (!conf.server.password) {
        next()
        return
    }

    if (!req.headers.authorization) {
        log.warning('password required')
        res.send(401)
        return
    }

    p = req.headers.authorization.substring(5)    // 'Basic ...'
    p = new Buffer(p, 'base64').toString()
    p = p.substring(p.indexOf(':'))               // iTunes_12.1:password
    if (p !== ':'+conf.server.password) {
        log.warning('authorization failed')
        res.send(401)
        return
    }

    next()
}


function login(req, res) {
    res.ok(daap.build({
        mlog: [
            { mstt: 200 },
            { mlid: nextSession() }
        ]
    }))
}


function update(req, res) {
    var run = function () {
        db.version.get(function (err, version) {
            if (err) {
                log.error(err)
                version = 1
            }
            res.ok(daap.build({
                mupd: [
                    { mstt: 200 },
                    { musr: version }
                ]
            }))
        })
    }

    if (+req.query.delta > 0) setTimeout(run, 30*1000)
    else run()
}


function logout(req, res) {
    res.ok(new Buffer(0))
}


function serverInfo(req, res) {
    var auth = (conf.server.password)? 2: 0;    // 2: password only

    res.ok(daap.build({
        msrv: [
            { mstt: 200 },
            { mpro: '2.0.0' },
            { apro: '3.0.0' },
            { minm: conf.server.name },
            { mslr: !!auth },
            { msau: auth },
            { mstm: 1800 },
            { msex: false },
            { msix: false },
            { msbr: false },
            { msqy: false },
            { msup: false },
            { msrs: false },
            { msdc: 1 },
            { msal: false },
            { mspi: true },
            { ated: 0 },
        ]
    }))
}


function databaseInfo(req, res) {
    db.version.get(function (err, version) {
        var update = (!err && +req.query.delta === version)
        var mlcl = (update)? []: {
            mlit: [
                { miid: 1 },
                { mper: 1 },
                { minm: conf.server.name },
                { mimc: 1 },    // updated later
                { mctc: 1 }
            ]
        }

        db.song.count(function (err, number) {
            if (err) {
                res.err(err)
                return
            }

            if (mlcl.mlit) mlcl.mlit.mimc = number
            res.ok(daap.build({
                avdb: [
                    { mstt: 200 },
                    { muty: update },
                    { mtco: (update)? 0: 1 },
                    { mrco: (update)? 0: 1 },
                    { mlcl: mlcl }
                ]
            }))
        })
    })
}


function databaseItem(req, res) {
    var query

    query = req.query.meta || 'dmap.itemkind,dmap.itemid,daap.songalbum,daap.songartist,'+
                              'daap.songgenre,daap.songtime,daap.songtracknumber,daap.songformat'
    query = query.split(',')

    db.version.get(function (err, version) {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            res.ok(daap.build(daap.song.item([], query, true)))
            return
        }

        if (cache && cache.databaseItem && !err && cache.databaseItem.version === version) {
            log.info('sending response from cache')
            res.ok(cache.databaseItem.buffer)
            return
        }

        db.song.list(function (err, songs) {
            if (err) {
                res.err(err)
                return
            }

            cache.databaseItem = {
                buffer:  daap.build(daap.song.item(songs, query)),
                version: version
            }
            res.ok(cache.databaseItem.buffer)
        })
    })
}


// TODO: support smart playlists
function containerInfo(req, res) {
    db.version.get(function (err, version) {
        var update = (!err && +req.query.delta === version)
        var mlcl = (update)? []: {
            mlit: [
                { miid: 1 },
                { mper: 1 },
                { minm: conf.server.name },
                { mimc: 1 }
            ]
        }

        db.song.count(function (err, number) {
            if (err) {
                res.err(err)
                return
            }

            res.ok(daap.build({
                aply: [
                    { mstt: 200 },
                    { muty: update },
                    { mtco: (update)? 0: 1 },
                    { mrco: (update)? 0: 1 },
                    { mlcl: mlcl }
                ]
            }))
        })
    })
}


function containerItem(req, res) {
    var query

    query = req.query.meta || 'dmap.itemid,dmap.itemname,dmap.persistentid,'+
                              'dmap.parentcontainerid,com.apple.itunes.smart-playlist'

    query = query.split(',')

    db.version.get(function (err, version) {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            res.ok(daap.build(daap.container.item([], query, true)))
            return
        }

        if (cache && cache.containerItem && !err && cache.containerItem.version === version) {
            log.info('sending response from cache')
            res.ok(cache.containerItem.buffer)
            return
        }

        db.song.list(function (err, songs) {
            if (err) {
                res.err(err)
                return
            }

            cache.containerItem = {
                buffer:  daap.build(daap.container.item(songs, query)),
                version: version
            }
            res.ok(cache.containerItem.buffer)
        })
    })
}


function song(req, res) {
    var id, rs

    id = /([0-9]+)\.(mp3|ogg)/i.exec(req.params.file)
    if (!isFinite(+id[1])) {
        res.err(400)
        return
    }

    db.song.path(+id[1], function (err, songs) {
        var i

        if (err) {
            res.err(err)
            return
        }
        if (songs.length === 0) {
            res.err(404)
            return
        }

        for (i = 0; i < conf.server.scan.path.length; i++) {
            if (songs[0].path.indexOf(conf.server.scan.path[0]) === 0) break
        }
        if (i === conf.server.scan.path.length) {
            log.error(new Error('requested file('+songs[0].path+') has no valid path'))
            res.err(404)
            return
        }

        fs.stat(songs[0].path, function (err, stats) {
            var r

            if (err) {
                res.err(404)
                return
            }

            r = hodgepodge.range.parse(req.headers.range, stats)
            if (r instanceof Error) {
                res.err(416, r)
                return
            }

            if (r) {
                res.writeHead(206, {
                    'Content-Length': r.e-r.s+1,
                    'Content-Type':   mime.lookup(req.params.file),
                    'Content-Range':  hodgepodge.range.header(r, stats)
                })
                rs = fs.createReadStream(songs[0].path, {
                    start: r.s,
                    end:   r.e
                })
            } else {
                res.writeHead(200, {
                    'Content-Length': stats.size,
                    'Content-Type':   mime.lookup(req.params.file)
                })
                rs = fs.createReadStream(songs[0].path)
            }
            rs.pipe(res)
        })
    })
}


module.exports = {
    init:       init,
    auth:       auth,
    login:      login,
    update:     update,
    logout:     logout,
    serverInfo: serverInfo,
    database: {
        info: databaseInfo,
        item: databaseItem
    },
    container: {
        info: containerInfo,
        item: containerItem
    },
    song: song
}

// end of api.js
