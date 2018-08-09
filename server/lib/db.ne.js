/*
 *  DB wrapper for NeDB
 */

'use strict'

var crypto = require('crypto')
var util = require('util')
var fs = require('fs')
var path = require('path')

var Datastore = require('nedb'),
    db = {}
var async = require('async')
var mkdirp = require('mkdirp')
var logger = require('hodgepodge-node/logger')


var log, conf


function init(_conf, cb) {
    conf = Object.assign({
        db: {
            path: 'db'
        },
        debug: false
    }, _conf)

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
        cb(new Error('invalid song id: '+util.inspect(song.id)))
        return
    }
    if (typeof song.path !== 'string' || !song.path) {
        cb(new Error('invalid song path: '+util.inspect(song.path)))
        return
    }

    db.song.update({
        id: song.id
    }, song, { upsert: true }, cb)
}


function songTouch(id, version, cb) {
    db.song.update({ id: id }, {
        $set: { version: version }
    }, cb)
}


function songClear(version, cb) {
    db.song.remove({
        version: {
            $lt: version
        }
    }, cb)
}


function versionGet(cb) {
    db.info.find({
        type: 'music'
    }, function (err, versions) {
        if (err) {
            cb(err)
            return
        }
        if (versions.length === 0) versions[0] = { version: 2 }    // #26

        cb(null, versions[0].version)
    })
}


function versionInc(cb) {
    db.info.update({ type: 'music' }, {
        $inc: { version: 1 }
    }, function (err, nModified) {
        if (err) {
            cb(err)
            return
        }

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
    db.info.find({
        type: 'music'
    }, {
        dbId: 1,
        _id: 0
    }, function (err, ids) {
        if (err) {
            cb(err)
            return
        }

        cb(null, ids && ids[0] && ids[0].dbId)
    })
}


function dbIdSet(dbId, cb) {
    if (typeof dbId !== 'string' || !dbId) {
        cb(new Error('invalid db id: '+util.inspect(dbId)))
        return
    }

    db.info.update({
        type: 'music'
    }, {
        $set: { dbId: dbId }
    }, cb)
}


function cacheName(name, metas) {
    var md5sum = crypto.createHash('md5')

    metas.forEach(function (meta) { md5sum.update(meta) })
    return path.join(conf.db.path, 'cache-'+name+'-'+md5sum.digest('hex'))
}


function cacheRead(name, metas, to, cb) {
    var rs

    name = cacheName(name, metas)
    rs = fs.createReadStream(name)

    log.info('reading cache for '+name)
    rs.on('error', cb)
    rs.pipe(to)
}


function cacheWrite(name, metas, buffer, cb) {
    var ws

    name = cacheName(name, metas)
    ws = fs.createWriteStream(name)

    log.info('writing cache for '+name)
    ws.on('error', cb)
    ws.write(buffer)
    ws.end()
}


function cacheExist(name, metas, cb) {
    fs.stat(cacheName(name, metas), function (err, stats) {
        cb(err, !!stats)
    })
}


function cacheClear(cb) {
    var funcs

    fs.readdir(conf.db.path, function (err, files) {
        if (err) {
            log.warning(err)
            cb()    // errors ignored
            return
        }

        funcs = files.filter(function (f) { return /^cache-/.test(f) })
                     .map(function (f) {
            return function (callback) {
                fs.unlink(path.join(conf.db.path, f), function (err) { err && log.warning(err) })
                callback()    // errors ignored
            }
        })

        async.parallel(funcs, cb)
    })
}


module.exports = {
    init:  init,
    close: close,
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
