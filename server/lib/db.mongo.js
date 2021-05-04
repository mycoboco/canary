/*
 *  DB wrapper for MongoDB
 */

const crypto = require('crypto')
const { insepct } = require('util')

const async = require('async')
const _mongoose = require('mongoose'),
      Schema = _mongoose.Schema
const grid = require('gridfs-stream')
const { logger } = require('@hodgepodge-node/server')
const mongoose = require('@hodgepodge-node/db/mongoose')(_mongoose)
const { safePipe } = require('@hodgepodge-node/util')

const infoSchema = new Schema({
        type: {
            index: true,
            type:  String
        },
        version: Number,
        dbId:    String
    })
let Info

const songSchema = new Schema({
        id: {
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
    })
let Song


let log, db, gfs, conf


function init(_conf, cb) {
    conf = {
        db: {
            host:          'localhost',
            port:          27017,
            db:            'canary',
            // user:          'user',
            // password:      'password',
            reconnectTime: 10
        },
        debug: false,
        ..._conf
    }

    log = logger.create({
        prefix: 'db',
        level:  (conf.debug)? 'info': 'error'
    })

    mongoose.init(log)
    mongoose.connect(conf.db, (err, _db) => {
        if (err) return cb(err)

        db = _db
        Info = db.model('Info', infoSchema)
        Song = db.model('Song', songSchema)
        grid.mongo = _mongoose.mongo
        gfs = grid(db.db)

        cb()
    })
}


function close() {
    mongoose.close()
}


function songCount(cb) {
    Song.count(cb)
}


function songListIter(cb) {
    const songs = []
    const cursor = Song.find().cursor()
    function next() {
        cursor.next((err, song) => {
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
        return cb(new Error(`invalid song id: ${inspect(song.id)}`))
    }
    if (typeof song.path !== 'string' || !song.path) {
        return cb(new Error(`invalid song path: ${inspect(song.path)}`))
    }

    Song.update({ id: song.id }, song, { upsert: true }, cb)
}


function songTouch(id, version, cb) {
    Song.update({ id: id }, {
        $set: { version: version }
    }, cb)
}


function songClear(version, cb) {
    Song.remove({
        version: { $lt: version }
    }, cb)
}


function versionGet(cb) {
    Info.find({ type: 'music' }, (err, versions) => {
        if (err) return cb(err)
        if (versions.length === 0) versions[0] = { version: 2 }    // #26

        cb(null, versions[0].version)
    })
}


function versionInc(cb) {
    Info.update({ type: 'music' }, {
        $inc: { version: 1 }
    }, (err, result) => {
        if (err) return cb(err)

        if (!result.nModified) {
            return Info.update({ type: 'music' }, {
                $set: { version: 2 }
            }, { upsert: true }, cb)
        }

        cb()
    })
}


function dbIdGet(cb) {
    Info.find({ type: 'music' })
        .select('dbId -_id')
        .exec((err, ids) => {
            if (err) return cb(err)

            cb(null, ids && ids[0] && ids[0].dbId)
        })
}


function dbIdSet(dbId, cb) {
    if (typeof dbId !== 'string' || !dbId) {
        return cb(new Error(`invalid db id: ${inspect(dbId)}`))
    }

    Info.update({ type: 'music' }, {
        $set: { dbId: dbId }
    }, cb)
}


function hashQuery(metas) {
    const md5sum = crypto.createHash('md5')

    metas.forEach(meta => md5sum.update(meta))
    return md5sum.digest('hex')
}


function cacheRead(name, metas, to, cb) {
    name = `${name}-${hashQuery(metas)}`
    const rs = gfs.createReadStream({ filename: name })

    log.info(`reading cache for ${name}`)
    safePipe(rs, to, cb)
}


function cacheWrite(name, metas, buffer, cb) {
    name = `${name}-${hashQuery(metas)}`
    const ws = gfs.createWriteStream({ filename: name })

    log.info(`writing cache for ${name}`)
    ws.on('error', (err) => err && cb(err))
    ws.write(buffer)
    ws.end()
}


function cacheExist(name, metas, cb) {
    gfs.exist({ filename: `${name}-${hashQuery(metas)}` }, cb)
}


function cacheClear(cb) {
    async.parallel(
        [ 'fs.files', 'fs.chunks' ].map(name =>
            (callback) => {
                db.db.collection(name).drop(err => {    // uses underlying driver
                    err && log.warning(err)
                    callback()    // errors ignored
                })
            }
        ),
        cb
    )
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

// end of db.mongo.js
