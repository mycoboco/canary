/*
 *  mp3 scanner
 */

const fs = require('fs')
const path = require('path')
const { inspect } = require('util')

const async = require('async')
const mm = require('music-metadata')
const { FNV } = require('fnv')
const ontime = require('ontime')
const { logger } = require('@hodgepodge-node/server')
const { recursiveWatch: rwatch } = require('@hodgepodge-node/util')


let log, db, api, conf
let qd = [], qf = []
let watch, needRescan, inProgress, version


function init(_db, _api, _conf) {
    conf = {
        mp3: {
            path:  [ '/path/to/mp3/files' ],
            cycle: [ '19:00:00' ],
            utc:   false
        },
        debug: false,
        ..._conf
    }

    log = logger.create({
        prefix: 'mp3',
        level:  (conf.debug)? 'info': 'error'
    })

    db = _db
    api = _api

    try {
        conf.mp3.path = conf.mp3.path.map(p => fs.realpathSync(p))
    } catch(e) {
        log.error(e)
    }
    watch = rwatch(conf.mp3.path, { ignoreHiddenDirs: true })
    watch
        .on('change', () => {
            log.info('change detected; rescan scheduled')
            needRescan = true
        })
        .on('error', err => log.error(err))

    log.info(`rescan scheduled with ${inspect(conf.mp3)}`)
    conf.mp3.single = true
    ontime(conf.mp3, ot => scan(ot.done.bind(ot)))
}


function id(s) {
    let fnv = new FNV()
    fnv.update(Buffer(s))
    fnv = fnv.value()
    if (fnv < 0) fnv = Math.pow(2, 32) - fnv
    return (fnv >> 31) ^ (fnv & 0x7fffffff)
}


function meta(song, cb) {
    function chkmeta(meta) {
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
            const genre = /^([^\/]+)\/([^\/]+)$/.exec(meta.genre)
            if (genre && genre[1] === genre[2]) meta.genre = genre[1]
        }

        return meta
    }

    function setMeta(song, data) {
        const meta = {
            id:     id(song),
            kind:   2,
            title:  data.common.title || song,
            artist: data.common.albumartist || data.common.artist ||
                    (data.common.artists &&
                     data.common.artists.filter(a => a).join(', ')) ||
                    '(Unknown Artist)',
            album:  data.common.album || '(Unknown Album)',
            time:   Math.floor((data.format && data.format.duration*1000) || 0),
            year:   data.common.year || 0,
            track:  (data.common.track && data.common.track.no) || 0,
            genre:  (data.common.genre &&
                     data.common.genre.filter(g => g).join(', ')) ||
                    '(Unknown Genre)',
            format: path.extname(song).substring(1, song.length-1),
            path:   song
        }

        cb(null, chkmeta(meta))
    }

    return mm.parseFile(song, {
        duration:   true,
        skipCovers: true
    })
    .then(metadata => setMeta(song, metadata))
    .catch(err => {
        log.error('failed to retrieve meta data from %s', song, err)
        setMeta(song, { common: {} })
    })
}


function isSong(f) {
    const ext = path.extname(f).toLowerCase()
    return (ext === '.mp3' || ext === '.ogg')
}


function done(cb) {
    const meta = {    // from iTunes 12.5.5.5
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
    db.song.clear(++version, err => {
        err && log.error(err)
        inProgress = false
        db.version.inc(err => {
            err && log.error(err)
            db.song.count((err, count) => !err && log.info(`${count} song(s) in database`))
            ;(typeof cb === 'function') && cb()
        })
    })

    log.info('invalidating cache')
    db.cache.clear(() => {
        log.info('preparing cache for iTunes')
        Object.keys(meta).forEach(name => api.cache.update(name, meta[name].split(',')))
    })
}


function next(cb) {
    function addSong(file, stats, cb) {
        db.song.get(id(file), (err, songs) => {
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
        return done(cb)
    }

    async.parallel([
        callback => {
            const p = qd.pop()
            if (!p) return callback(null)

            fs.readdir(p, (err, files) => {
                if (err) return callback(err)

                async.parallel(
                    files
                        .map(f => path.join(p, f))
                        .map(f =>
                            callback => {
                                fs.stat(f, (err, stats) => {
                                    if (err) return callback(err)

                                    if (stats.isDirectory()) {
                                        qd.push(f)
                                        callback(null)
                                    } else if (isSong(f)) {
                                        addSong(f, stats, callback)
                                    } else {
                                        callback(null)
                                    }
                                })
                            }
                        ),
                    err => callback(err)
                )
            })
        },
        callback => {
            const p = qf.pop()
            if (!p) return callback(null)

            if (p.changed) {
                meta(p.path, (err, song) => {
                    if (err) return callback(err)

                    song.version = version+1
                    song.mtime = p.mtime
                    db.song.add(song, err => callback(err))
                })
            } else {
                db.song.touch(id(p.path), version+1, err => callback(err))
            }
        }
    ], err => {
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
    watch.sync()
    db.version.get((err, _version) => {
        if (err) {
            log.error(err)
            _version = 2    // #26
        }
        version = _version

        Array.prototype.push.apply(qd, conf.mp3.path)
        next(cb)
    })
}


function close() {
    // nothing to do
}


module.exports = {
    init,
    scan,
    close
}

// end of mp3.js
