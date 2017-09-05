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
var defaults = require('defaults')
var hodgepodge = {
    logger:   require('hodgepodge-node/logger'),
    mongoose: require('hodgepodge-node/mongoose')
}

var infoSchema = new Schema({
        type: {
            index: true,
            type:  String
        },
        version: Number,
        dbId:    String
    }),
    Info = mongoose.model('Info', infoSchema)

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
    Song = mongoose.model('Song', songSchema)


var log, gfs, conf


function init(_conf, cb) {
    conf = defaults(_conf, {
        db: {
            host:          'localhost',
            port:          27017,
            db:            'canary',
            // user:          'user',
            // password:      'password',
            reconnectTime: 10
        },
        debug: false
    })

    log = hodgepodge.logger.create({
        prefix: 'db',
        level:  (conf.debug)? 'info': 'error'
    })

    hodgepodge.mongoose = hodgepodge.mongoose(mongoose, log)
    hodgepodge.mongoose.connect(conf.db)

    grid.mongo = mongoose.mongo
    mongoose.connection.once('open', function () {
        gfs = grid(mongoose.connection.db)
        cb()
    })
}


function close() {
    hodgepodge.mongoose.close && hodgepodge.mongoose.close()
}


function songCount(cb) {
    Song.count(cb)
}


function songListIter(cb) {
    var songs = []
    var cursor = Song.find().cursor()
    var next = function () {
        cursor.next(function (err, song) {
            if (err) {
                cb(err)
                return
            }

            if (!song) {
                cb(null, songs)
                return
            }
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
        cb(new Error('invalid song id: '+util.inspect(song.id)))
        return
    }
    if (typeof song.path !== 'string' || !song.path) {
        cb(new Error('invalid song path: '+util.inspect(song.path)))
        return
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
        if (err) {
            cb(err)
            return
        }
        if (versions.length === 0) versions[0] = { version: 0 }

        cb(null, versions[0].version)
    })
}


function versionInc(cb) {
    async.series([
        function (callback) {
            Info.update({
                type:    'music',
                version: { $exists: false }
            }, {
                $set: { version: 1 }
            }, {
                upsert: true
            }, callback)
        },
        function (callback) {
            Info.update({
                type: 'music',
                version: {
                    $exists: true,
                    $ne:     null
                }
            }, {
                $inc: { version: 1 }
            }, callback)
        }
    ], cb)
}


function dbIdGet(cb) {
    Info.find({
        type: 'music'
    }).select('dbId -_id').exec(function (err, ids) {
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
    rs.on('error', cb)
    rs.pipe(to)
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
    var db = mongoose.connection.db    // uses underlying driver

    var funcs = [ 'fs.files', 'fs.chucks' ].map(function (name) {
        return function (callback) {
            db.collection(name).drop(function (err) {
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

// end of db.js
