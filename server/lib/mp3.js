/*
 *  mp3 scanner
 */

'use strict'

var fs = require('fs')
var path = require('path')
var util = require('util')

var async = require('async')
var mm = require('music-metadata')
var mp3len = require('mp3-duration')
var FNV = require('fnv').FNV
var defaults = require('defaults')
var watch = require('watch')
var ontime = require('ontime')
var logger = require('hodgepodge-node/logger')


var log, db, api, conf
var qd = [], qf = []
var needRescan, inProgress, version


function init(_db, _api, _conf) {
    conf = defaults(_conf, {
        mp3: {
            path:  [ '/path/to/mp3/files' ],
            cycle: [ '19:00:00' ],
            utc:   false
        },
        debug: false
    })

    log = logger.create({
        prefix: 'mp3',
        level:  (conf.debug)? 'info': 'error'
    })

    db = _db
    api = _api

    for (var i = 0; i < conf.mp3.path.length; i++) {
        try {
            conf.mp3.path[i] = fs.realpathSync(conf.mp3.path[i])
            log.info('monitoring changes on '+conf.mp3.path[i])
            watch.createMonitor(conf.mp3.path[i], {
                ignoreDotFiles:      true,
                ignoreUnreadableDir: true,
                ignoreNotPermitted:  true
            }, function (monitor) {
                var setUpdate = function (f) {
                    log.info('change detected on '+f+'; rescan scheduled')
                    needRescan = true
                }

                monitor.on('created', setUpdate.bind(null))
                       .on('changed', setUpdate.bind(null))
                       .on('removed', setUpdate.bind(null))
            })
        } catch(e) {
            log.error(e)
        }
    }

    log.info('rescan scheduled with '+util.inspect(conf.mp3))
    conf.mp3.single = true
    ontime(conf.mp3, function (ot) {
        scan(ot.done.bind(ot))
    })
}


function id(s) {
    var fnv = new FNV()
    fnv.update(Buffer(s))
    fnv = fnv.value()
    if (fnv < 0) fnv = Math.pow(2, 32) - fnv
    return (fnv >> 31) ^ (fnv & 0x7fffffff)
}


function meta(song, cb) {
    var chkmeta = function (meta) {
        var genre

        if (!isFinite(+meta.year)) {
            meta.year = /^\s*([0-9]{2,4})/.exec(meta.year)
            if (meta.year) meta.year = meta.year[1]
        }
        meta.year = Math.max(0, +meta.year)

        if (!isFinite(+meta.track) || +meta.track < 0) meta.track = 0
        else meta.track = +meta.track

        if (!isFinite(+meta.time) || +meta.time < 0) meta.time = 0
        else meta.time = +meta.time

        // handles "Ballad/Ballad"
        if (meta.genre.indexOf('/') !== -1) {
            genre = /^([^\/]+)\/([^\/]+)$/.exec(meta.genre)
            if (genre && genre[1] === genre[2]) meta.genre = genre[1]
        }

        return meta
    }

    var setMeta = function (song, data) {
        var meta = {
            id:     id(song),
            kind:   2,
            title:  data.common.title || song,
            artist: data.common.albumartist || data.common.artist[0] || '(Unknown Artist)',
            album:  data.common.album || '(Unknown Album)',
            time:   +data.format.duration*1000,
            year:   data.common.year || 0,
            track:  data.common.track.no || 0,
            genre:  data.common.genre[0] || '(Unknown Genre)',
            format: path.extname(song).substring(1, song.length-1),
            path:   song
        }

        if (!data.duration) {
            mp3len(song, true, function (err, len) {
                err && log.error(err)
                meta.time = len*1000 || 0
                cb(null, chkmeta(meta))
            })
        } else {
            cb(null, chkmeta(meta))
        }
    }

    return mm.parseFile(song, {
        duration:   true,
        skipCovers: true
    }).then(function (metadata) {
        setMeta(song, metadata)
    }).catch(function (err) {
        log.error('music-metadata: failed to retrieve meta data from %s: %s', song, err.message)
        mp3len(song, true, function (err, len) {
            if (err) {
                log.error('mp3len: failed to retrieve meta data from: %s', song)
                cb(err)
                return
            }

            setMeta(song, {
                format: {duration: len}
            })
        })
    })
}


function isSong(f) {
    var ext = path.extname(f).toLowerCase()
    return (ext === '.mp3' || ext === '.ogg')
}


function done(cb) {
    var meta = {    // from iTunes 12.5.5.5
        container: 'dmap.itemid,dmap.containeritemid',
        song:      'dmap.itemid,dmap.itemname,dmap.itemkind,dmap.persistentid,daap.songalbum,'+
                   'daap.songgrouping,daap.songartist,daap.songalbumartist,daap.songbitrate,'+
                   'daap.songbeatsperminute,daap.songcomment,daap.songcodectype,'+
                   'daap.songcodecsubtype,daap.songcompilation,daap.songcomposer,'+
                   'daap.songdateadded,daap.songdatemodified,daap.songdisccount,'+
                   'daap.songdiscnumber,daap.songdisabled,daap.songeqpreset,daap.songformat,'+
                   'daap.songgenre,daap.songdescription,daap.songrelativevolume,'+
                   'daap.songsamplerate,daap.songsize,daap.songstarttime,daap.songstoptime,'+
                   'daap.songtime,daap.songtrackcount,daap.songtracknumber,daap.songuserrating,'+
                   'daap.songyear,daap.songdatakind,daap.songdataurl,daap.songcontentrating,'+
                   'com.apple.itunes.norm-volume,com.apple.itunes.itms-songid,'+
                   'com.apple.itunes.itms-artistid,com.apple.itunes.itms-playlistid,'+
                   'com.apple.itunes.itms-composerid,com.apple.itunes.itms-genreid,'+
                   'com.apple.itunes.itms-storefrontid,'+
                   'com.apple.itunes.has-videodaap.songcategory,daap.songextradata,'+
                   'daap.songcontentdescription,daap.songlongcontentdescription,'+
                   'com.apple.itunes.is-podcast,com.apple.itunes.mediakind,'+
                   'com.apple.itunes.extended-media-kind,com.apple.itunes.series-name,'+
                   'com.apple.itunes.episode-num-str,com.apple.itunes.episode-sort,'+
                   'com.apple.itunes.season-num,daap.songgapless,'+
                   'com.apple.itunes.gapless-enc-del,com.apple.itunes.gapless-heur,'+
                   'com.apple.itunes.gapless-enc-dr,com.apple.itunes.gapless-dur,'+
                   'com.apple.itunes.gapless-resy,com.apple.itunes.content-rating'
    }

    log.info('scanning songs finished')
    db.song.clear(++version, function (err) {
        err && log.error(err)
        inProgress = false
        db.version.inc(function (err) {
            err && log.error(err)
            db.song.count(function (err, count) {
                !err && log.info(count+' song(s) in database')
            })
            ;(typeof cb === 'function') && cb()
        })
    })

    log.info('invalidating cache')
    db.cache.clear(function () {
        log.info('preparing cache for iTunes')
        Object.keys(meta).forEach(function (name) {
            api.cache.update(name, meta[name].split(','))
        })
    })
}


function next(cb) {
    var addSong = function (file, stats, cb) {
        db.song.get(id(file), function (err, songs) {
            err && log.error(err)
            qf.push({
                path:    file,
                mtime:   stats.mtime,
                changed: !!(err || !songs[0] || songs[0].mtime.valueOf() !== stats.mtime.valueOf())
            })
            cb(null)    // error ignored
        })
    }

    if (qd.length === 0 && qf.length === 0) {
        qd = [], qf = []
        done(cb)
        return
    }

    async.parallel([
        function (callback) {
            var p = qd.pop()
            if (!p) {
                callback(null)
                return
            }

            fs.readdir(p, function (err, files) {
                var funcs = []

                if (err) {
                    callback(err)
                    return
                }

                for (var i = 0; i < files.length; i++) {
                    files[i] = path.join(p, files[i])
                    !function (file) {
                        funcs.push(function (callback) {
                            fs.stat(file, function (err, stats) {
                                if (err) {
                                    callback(err)
                                    return
                                }
                                if (stats.isDirectory()) {
                                    qd.push(file)
                                    callback(null)
                                } else if (isSong(file)) {
                                    addSong(file, stats, callback)
                                } else {
                                    callback(null)
                                }
                            })
                        })
                    }(files[i])
                }
                async.parallel(funcs, function (err) {
                    callback(err)
                })
            })
        },
        function (callback) {
            var p = qf.pop()
            if (!p) {
                callback(null)
                return
            }

            if (p.changed) {
                meta(p.path, function (err, song) {
                    if (err) {
                        callback(err)
                        return
                    }
                    song.version = version+1
                    song.mtime = p.mtime
                    db.song.add(song, function (err) {
                        callback(err)
                    })
                })
            } else {
                db.song.touch(id(p.path), version+1, function (err) {
                    callback(err)
                })
            }
        }
    ], function (err) {
        err && log.error(err)
        next(cb)
    })
}


function scan(force, cb) {
    if (typeof force === 'function') {
        cb = force
        force = false
    }
    if (!force && !needRescan) {
        log.info('rescan is not necessary')
        ;(typeof cb === 'function') && cb()
        return
    }
    if (inProgress) {
        log.warning('scanning is already in progress')
        ;(typeof cb === 'function') && cb()
        return
    }
    needRescan = false
    inProgress = true

    log.info('starting to scan songs')
    db.version.get(function (err, _version) {
        if (err) {
            log.error(err)
            _version = 1
        }
        version = _version

        for (var i = 0; i < conf.mp3.path.length; i++) qd.push(conf.mp3.path[i])
        next(cb)
    })
}


module.exports = {
    init: init,
    scan: scan
}

// end of mp3.js
