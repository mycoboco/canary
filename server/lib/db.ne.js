/*
 *  DB wrapper for NeDB
 */

const crypto = require('crypto')
const { inspect } = require('util')
const fs = require('fs')
const path = require('path')

const Datastore = require('nedb')
let db = {}
const async = require('async')
const mkdirp = require('mkdirp')
const { logger } = require('@hodgepodge-node/server')
const { safePipe } = require('@hodgepodge-node/util')


let log, conf


function init(_conf, cb) {
    conf = {
        db: {
            path: 'db'
        },
        debug: false,
        ..._conf
    }

    log = logger.create({
        prefix: 'db',
        level:  (conf.debug)? 'info': 'error'
    })

    db = {
        song: new Datastore({
            filename: path.join(conf.db.path, 'songs.db'),
            autoload: true
        }),
        info: new Datastore({
            filename: path.join(conf.db.path, 'info.db'),
            autoload: true
        })
    }
    db.info.ensureIndex({ fieldName: 'type' })
    db.song.ensureIndex({ fieldName: 'id' })
    db.song.ensureIndex({ fieldName: 'version' })

    mkdirp(conf.db.path, cb)
}


function close() {
    // nothing to do
}


function songCount(cb) {
    db.song.count({}, cb)
}


function songListIter(cb) {
    db.song.find({}, cb)
}


function songPath(id, cb) {
    db.song.find({ id: id }, { _id: 0, path: 1 }, cb)
}


function songGet(id, cb) {
    db.song.find({ id: id }, { _id: 0 }, cb)
}


function songAdd(song, cb) {
    if (typeof song.id !== 'number' || song.id !== song.id) {
        return cb(new Error(`invalid song id: ${inspect(song.id)}`))
    }
    if (typeof song.path !== 'string' || !song.path) {
        return cb(new Error(`invalid song path: ${inspect(song.path)}`))
    }

    db.song.update({ id: song.id }, song, { upsert: true }, cb)
}


function songTouch(id, version, cb) {
    db.song.update({ id: id }, {
        $set: { version: version }
    }, cb)
}


function songClear(version, cb) {
    db.song.remove({
        version: { $lt: version }
    }, cb)
}


function versionGet(cb) {
    db.info.find({ type: 'music' }, (err, versions) => {
        if (err) return cb(err)
        if (versions.length === 0) versions[0] = { version: 2 }    // #26

        cb(null, versions[0].version)
    })
}


function versionInc(cb) {
    db.info.update({ type: 'music' }, {
        $inc: { version: 1 }
    }, (err, nModified) => {
        if (err) return cb(err)

        if (!nModified) {
            db.info.update({ type: 'music' }, {
                $set: { version: 2 }
            }, { upsert: true }, cb)
            return
        }

        cb()
    })
}


function dbIdGet(cb) {
    db.info.find({ type: 'music' }, {
        dbId: 1,
        _id: 0
    }, (err, ids) => {
        if (err) return cb(err)

        cb(null, ids && ids[0] && ids[0].dbId)
    })
}


function dbIdSet(dbId, cb) {
    if (typeof dbId !== 'string' || !dbId) {
        return cb(new Error(`invalid db id: ${inspect(dbId)}`))
    }

    db.info.update({ type: 'music' }, {
        $set: { dbId: dbId }
    }, cb)
}


function cacheName(name, metas) {
    const md5sum = crypto.createHash('md5')

    metas.forEach(meta => md5sum.update(meta))
    return path.join(conf.db.path, `cache-${name}-${md5sum.digest('hex')}`)
}


function cacheRead(name, metas, to, cb) {
    name = cacheName(name, metas)
    const rs = fs.createReadStream(name)

    log.info(`reading cache for ${name}`)
    safePipe(rs, to, cb)
}


function cacheWrite(name, metas, buffer, cb) {
    name = cacheName(name, metas)
    const ws = fs.createWriteStream(name)

    log.info(`writing cache for ${name}`)
    ws.on('error', (err) => err && cb(err))
    ws.write(buffer)
    ws.end()
}


function cacheExist(name, metas, cb) {
    fs.stat(cacheName(name, metas), (err, stats) => {
        cb(err, !!stats)
    })
}


function cacheClear(cb) {
    fs.readdir(conf.db.path, (err, files) => {
        if (err) {
            log.warning(err)
            return cb()    // errors ignored
        }

        async.parallel(
            files
                .filter(f => /^cache-/.test(f))
                .map(f =>
                    callback => {
                        fs.unlink(path.join(conf.db.path, f), err => { err && log.warning(err) })
                        callback()    // errors ignored
                    }
                ),
            cb
        )
    })
}


module.exports = {
    init,
    close,
    song: {
        count:    songCount,
        listIter: songListIter,
        path:     songPath,
        get:      songGet,
        add:      songAdd,
        touch:    songTouch,
        clear:    songClear
    },
    version: {
        get: versionGet,
        inc: versionInc
    },
    dbId: {
        get: dbIdGet,
        set: dbIdSet
    },
    cache: {
        read:  cacheRead,
        write: cacheWrite,
        exist: cacheExist,
        clear: cacheClear
    }
}

// end of db.ne.js
