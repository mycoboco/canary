/*
 *  DB wrapper for MongoDB
 */

'use strict'

var crypto = require('crypto')
var util = require('util')

var async = require('async')
var mongoose = require('mongoose'),
    Schema = mongoose.Schema
var grid = require('gridfs-stream')
var hodgepodge = {
    logger:   require('hodgepodge-node/logger'),
    mongoose: require('hodgepodge-node/mongoose')(mongoose)
}

var safePipe = require('./safePipe')

var infoSchema = new Schema({
        type: {
            index: true,
            type:  String
        },
        version: Number,
        dbId:    String
    }),
    Info

var songSchema = new Schema({
        id:     {
            index: true,
            type:  Number
        },
        kind:    Number,
        title:   String,
        artist:  String,
        album:   String,
        time:    Number,
        year:    Number,
        track:   Number,
        genre:   String,
        format:  String,
        version: {
            index: true,
            type:  Number
        },
        path:  String,
        mtime: Date
    }),
    Song


var log, db, gfs, conf


function init(_conf, cb) {
    conf = Object.assign({
        db: {
            host:          'localhost',
            port:          27017,
            db:            'canary',
            // user:          'user',
            // password:      'password',
            reconnectTime: 10
        },
        debug: false
    }, _conf)

    log = hodgepodge.logger.create({
        prefix: 'db',
        level:  (conf.debug)? 'info': 'error'
    })

    hodgepodge.mongoose.init(log)
    hodgepodge.mongoose.connect(conf.db, function (err, _db) {
        if (err) return cb(err)

        db = _db
        Info = db.model('Info', infoSchema)
        Song = db.model('Song', songSchema)
        grid.mongo = mongoose.mongo
        gfs = grid(db.db)

        cb()
    })
}


function close() {
    hodgepodge.mongoose.close()
}


function songCount(cb) {
    Song.count(cb)
}


function songListIter(cb) {
    var songs = []
    var cursor = Song.find().cursor()
    var next = function () {
        cursor.next(function (err, song) {
            if (err) return cb(err)

            if (!song) return cb(null, songs)
            songs.push(song)
            setImmediate(next)
        })
    }

    next()
}


function songPath(id, cb) {
    Song.find({ id: id }).select('-_id path').exec(cb)
}


function songGet(id, cb) {
    Song.find({ id: id }).select('-_id').exec(cb)
}


function songAdd(song, cb) {
    if (typeof song.id !== 'number' || song.id !== song.id) {
        return cb(new Error('invalid song id: '+util.inspect(song.id)))
    }
    if (typeof song.path !== 'string' || !song.path) {
        return cb(new Error('invalid song path: '+util.inspect(song.path)))
    }

    Song.update({
        id: song.id
    }, song, { upsert: true }, cb)
}


function songTouch(id, version, cb) {
    Song.update({ id: id }, {
        $set: { version: version }
    }, cb)
}


function songClear(version, cb) {
    Song.remove({
        version: {
            $lt: version
        }
    }, cb)
}


function versionGet(cb) {
    Info.find({
        type: 'music'
    }, function (err, versions) {
        if (err) return cb(err)
        if (versions.length === 0) versions[0] = { version: 2 }    // #26

        cb(null, versions[0].version)
    })
}


function versionInc(cb) {
    Info.update({ type: 'music' }, {
        $inc: { version: 1 }
    }, function (err, result) {
        if (err) return cb(err)

        if (!result.nModified) {
            Info.update({ type: 'music' }, {
                $set: { version: 2 }
            }, { upsert: true }, cb)
            return
        }

        cb()
    })
}


function dbIdGet(cb) {
    Info.find({
        type: 'music'
    }).select('dbId -_id').exec(function (err, ids) {
        if (err) return cb(err)

        cb(null, ids && ids[0] && ids[0].dbId)
    })
}


function dbIdSet(dbId, cb) {
    if (typeof dbId !== 'string' || !dbId) {
        return cb(new Error('invalid db id: '+util.inspect(dbId)))
    }

    Info.update({
        type: 'music'
    }, {
        $set: { dbId: dbId }
    }, cb)
}


function hashQuery(metas) {
    var md5sum = crypto.createHash('md5')

    metas.forEach(function (meta) { md5sum.update(meta) })
    return md5sum.digest('hex')
}


function cacheRead(name, metas, to, cb) {
    var rs

    name = name+'-'+hashQuery(metas)
    rs = gfs.createReadStream({ filename: name })

    log.info('reading cache for '+name)
    safePipe(rs, to, cb)
}


function cacheWrite(name, metas, buffer, cb) {
    var ws

    name = name+'-'+hashQuery(metas)
    ws = gfs.createWriteStream({ filename: name })

    log.info('writing cache for '+name)
    ws.on('error', cb)
    ws.write(buffer)
    ws.end()
}


function cacheExist(name, metas, cb) {
    gfs.exist({ filename: name+'-'+hashQuery(metas) }, cb)
}


function cacheClear(cb) {
    var funcs = [ 'fs.files', 'fs.chunks' ].map(function (name) {
        return function (callback) {
            db.db.collection(name).drop(function (err) {    // uses underlying driver
                err && log.warning(err)
                callback()    // errors ignored
            })
        }
    })

    async.parallel(funcs, cb)
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

// end of db.mongo.js
