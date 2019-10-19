/*
 *  server APIs
 */

const fs = require('fs')

const mime = require('mime')
const hodgepodge = {
    logger,
    range
} = require('@hodgepodge-node/server')
const { safePipe } = require('@hodgepodge-node/util')

const mp3 = require('./mp3')


let log, db, daap, conf
let cache = true


function init(_db, _daap, _conf) {
    conf = {
        server: {
            name: 'canary',
            scan: {
                path: [ '/path/to/mp3/files' ]
            }
        },
        debug: false,
        ..._conf
    }

    log = logger.create({
        prefix: 'api',
        level:  (conf.debug)? 'info': 'error'
    })

    db = _db
    daap = _daap
}


const nextSession = (() => {
    let session = 1

    return () => {
        if (session > Math.pow(2, 31)-1) session = 1
        return session++
    }
})()


function auth(req, res, next) {
    if (!conf.server.password) return next()

    if (!req.headers.authorization) {
        log.warning('password required')
        return res.send(401)
    }

    let p = req.headers.authorization.substring(5)    // 'Basic ...'
    p = new Buffer(p, 'base64')
        .toString()
        .substring(p.indexOf(':'))                    // iTunes_12.1:password
    if (p !== `:${conf.server.password}`) {
        log.warning('authorization failed')
        return res.send(401)
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
    function run() {
        db.version.get((err, version) => {
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
    const auth = (conf.server.password)? 2: 0;    // 2: password only

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
    db.version.get((err, version) => {
        const update = (err || +req.query.delta !== version)
        const mlcl = (!update)? []: {
            mlit: [
                { miid: 1 },
                { mper: 1 },
                { minm: conf.server.name },
                { mimc: 1 },    // updated later
                { mctc: 1 }
            ]
        }

        db.song.count((err, number) => {
            if (err) return res.err(err)

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
    const d = {
        container: 'dmap.itemid,dmap.itemname,dmap.persistentid,dmap.parentcontainerid,'+
                   'com.apple.itunes.smart-playlist',
        song:      'dmap.itemkind,dmap.itemid,daap.songalbum,daap.songartist,daap.songgenre,'+
                   'daap.songtime,daap.songtracknumber,daap.songformat'
    }

    return (meta || d[name]).split(',')
}


function sendList(name, metas, res) {
    if (cache) {
        db.cache.exist(name, metas, (err, exist) => {
            if (!err && exist) db.cache.read(name, metas, res, cacheDisable)
            else cacheUpdate(name, metas, res)
        })
    } else {
        cacheUpdate(name, metas, res)
    }
}


function databaseItem(req, res) {
    const metas = defaultMetas('song', req.query.meta)

    db.version.get((err, version) => {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            return daap.song.item([], metas, obj => daap.build(obj, res.ok.bind(res)))
        }

        sendList('song', metas, res)
    })
}


// TODO: support smart playlists
function containerInfo(req, res) {
    db.version.get((err, version) => {
        const update = (err || +req.query.delta !== version)
        const mlcl = (!update)? []: {
            mlit: [
                { miid: 1 },
                { mper: 1 },
                { minm: conf.server.name },
                { mimc: 1 }
            ]
        }

        db.song.count((err, number) => {
            if (err) return res.err(err)

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
    const metas = defaultMetas('container', req.query.meta)

    db.version.get((err, version) => {
        if (!err && +req.query.delta === version) {
            log.info('sending empty list because nothing updated')
            return daap.container.item([], metas, obj => daap.build(obj, res.ok.bind(res)))
        }

        sendList('container', metas, res)
    })
}


function song(req, res) {
    const id = /([0-9]+)\.(mp3|ogg)/i.exec(req.params.file)
    if (!isFinite(+id[1])) return res.err(400)

    db.song.path(+id[1], (err, songs) => {
        if (err) return res.err(err)
        if (songs.length === 0) return res.err(404)

        if (!conf.server.scan.path.some(p => songs[0].path.indexOf(p) === 0)) {
            log.error(new Error(`requested file(${songs[0].path}) has no valid path`))
            return res.err(404)
        }

        fs.stat(songs[0].path, (err, stats) => {
            if (err) return res.err(404)

            const r = range.parse(req.headers.range, stats)
            if (r instanceof Error) return res.err(416, r)

            let rs
            if (r) {
                res.writeHead(206, {
                    'Content-Length': r.e-r.s+1,
                    'Content-Type':   mime.lookup(req.params.file),
                    'Content-Range':  range.header(r, stats)
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
            safePipe(rs, res, err => log.error(err))
        })
    })
}


function cacheUpdate(name, metas = defaultMetas(name), res) {
    db.song.listIter((err, songs) => {
        if (err) return res.err(err)

        daap[name].item(songs, metas, obj => {
            daap.build(obj, buf => {
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
    init,
    auth,
    login,
    update,
    logout,
    serverInfo,
    database: {
        info: databaseInfo,
        item: databaseItem
    },
    container: {
        info: containerInfo,
        item: containerItem
    },
    song,
    cache: {
        disable: cacheDisable,
        update:  cacheUpdate
    }
}

// end of api.js
