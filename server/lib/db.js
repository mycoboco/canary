/*
 *  DB wrapper for MongoDB
 */

'use strict'

var util = require('util')

var _ = require('underscore')
var async = require('async')
var mongoose = require('mongoose'),
    Schema = mongoose.Schema
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
        version: Number
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


var log, conf


function init(_conf) {
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

    hodgepodge.mongoose = hodgepodge.mongoose(log)
    hodgepodge.mongoose.connect(conf.db)
}


function close() {
    hodgepodge.mongoose.close && hodgepodge.mongoose.close()
}


function songCount(cb) {
    Song.count(cb)
}


function songList(cb) {
    Song.find(cb)
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
    Info.update({
        type: 'music'
    }, {
        $inc: { version: 1 }
    }, {
        upsert: true
    }, cb)
}


module.exports = {
    init:  init,
    close: close,
    song: {
        count: songCount,
        list:  songList,
        path:  songPath,
        get:   songGet,
        add:   songAdd,
        touch: songTouch,
        clear: songClear
    },
    version: {
        get: versionGet,
        inc: versionInc
    }
}

// end of db.js
