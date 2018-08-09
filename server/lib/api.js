/*
 *  server APIs
 */

'use strict'

var fs = require('fs')

var mime = require('mime')
var hodgepodge = {
    logger: require('hodgepodge-node/logger'),
    range:  require('hodgepodge-node/range')
}

var mp3 = require('./mp3')


var log, db, daap, conf
var cache = true


function init(_db, _daap, _conf) {
    conf = Object.assign({
        server: {
            name: 'canary',
            scan: {
                path: [ '/path/to/mp3/files' ]
            }
        },
        debug: false
    }, _conf)

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
    daap.build({
        mlog: [
            { mstt: 200 },
            { mlid: nextSession() }
        ]
    }, res.ok.bind(res))
}


function update(req, res) {
    var run = function () {
        db.version.get(function (err, version) {
            if (err) {
                log.error(err)
                version = 2    // #26
            }
            daap.build({
                mupd: [
                    { mstt: 200 },
                    { musr: version }
                ]
            }, res.ok.bind(res))
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

    daap.build({
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
    }, res.ok.bind(res))
}


function databaseInfo(req, res) {
    db.version.get(function (err, version) {
        var update = (err || +req.query.delta !== version)
        var mlcl = (!update)? []: {
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
            daap.build({
                avdb: [
                    { mstt: 200 },
                    { muty: 0 },
                    { mtco: (update)? 1: 0 },
                    { mrco: (update)? 1: 0 },
                    { mlcl: mlcl }
                ]
            }, res.ok.bind(res))
        })
    })
}


function defaultMetas(name, meta) {
    var d = {
        container: 'dmap.itemid,dmap.itemname,dmap.persistentid,dmap.parentcontainerid,'+
                   'com.apple.itunes.smart-playlist',
        song:      'dmap.itemkind,dmap.itemid,daap.songalbum,daap.songartist,daap.songgenre,'+
                   'daap.songtime,daap.songtracknumber,daap.songformat'
    }

    return (meta || d[name]).split(',')
}


function sendList(name, metas, res) {
    if (cache) {
        db.cache.exist(name, metas, function (err, exist) {
            if (!err && exist) db.cache.read(name, metas, res, cacheDisable)
            else cacheUpdate(name, metas, res)
        })
    } else {
        cacheUpdate(name, metas, res)
    }
}


function databaseItem(req, res) {
    var metas = defaultMetas('song', req.query.meta)

    db.version.get(function (err, version) {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            daap.song.item([], metas, function (obj) {
                daap.build(obj, res.ok.bind(res))
            })
            return
        }

        sendList('song', metas, res)
    })
}


// TODO: support smart playlists
function containerInfo(req, res) {
    db.version.get(function (err, version) {
        var update = (err || +req.query.delta !== version)
        var mlcl = (!update)? []: {
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

            daap.build({
                aply: [
                    { mstt: 200 },
                    { muty: 0 },
                    { mtco: (update)? 1: 0 },
                    { mrco: (update)? 1: 0 },
                    { mlcl: mlcl }
                ]
            }, res.ok.bind(res))
        })
    })
}


function containerItem(req, res) {
    var metas = defaultMetas('container', req.query.meta)

    db.version.get(function (err, version) {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            daap.container.item([], metas, function (obj) {
                daap.build(obj, res.ok.bind(res))
            })
            return
        }

        sendList('container', metas, res)
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
            res.on('error', function () { rs.close() })
            res.on('close', function () { rs.close() })
            rs.pipe(res)
        })
    })
}


function cacheUpdate(name, metas, res) {
    metas = metas || defaultMetas(name)

    db.song.listIter(function (err, songs) {
        if (err) {
            res.err(err)
            return
        }

        daap[name].item(songs, metas, function (obj) {
            daap.build(obj, function (buf) {
                res && res.ok(buf)
                if (cache) db.cache.write(name, metas, buf, cacheDisable)
            })
        })
    })
}


function cacheDisable(err) {
    cache = false
    log.error(err)
    log.warning('cache disabled')
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
    song: song,
    cache: {
        disable: cacheDisable,
        update:  cacheUpdate
    }
}

// end of api.js
