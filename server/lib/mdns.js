/*
 *  service advertisement via mDNS
 */

const { execFile } = require('child_process')

const which = require('which')
const mdns = require('mdns-js')
let service


let id = 'beddab1edeadbea7'


function init(db, cb) {
    db.dbId.get((err, dbId) => {
        if (!err && dbId) {
            id = dbId
            return cb(null, id)
        }

        dbId = (new Date()).valueOf().toString(16) + Math.floor(Math.random()*16).toString(16)
        id = id.substring(0, id.length-dbId.length) + dbId
        db.dbId.set(id, err => cb(err, id))
    })
}


function escape(s) {
    return s.replace(/-/g, '\\-')
}


function getTxt() {
    return `"txtvers=1" "Database ID=${id}"`
}


function avahi(name, port, cb) {
    return execFile(
        which.sync('avahi-publish-service', { nothrow: true }) || 'avahi-publish-service',
        [
            escape(name),
            '_daap._tcp',
            port,
            getTxt()
        ],
        cb
    )
}


function dnssd(name, port, cb) {
    return execFile(
        which.sync('dns-sd', { nothrow: true }) || 'dns-sd',
        [
            '-R',
            escape(name),
            '_daap._tcp',
            'local',
            port,
            getTxt()
        ],
        cb
    )
}


function mdnsjs(name, port, cb) {
    service = mdns.createAdvertisement('_daap._tcp', port, {
        name: name,
        txt: {
            txtvers:       '1',
            'Database ID': id,
        }
    })
    service.start()
    cb(null)
    return service
}


module.exports = {
    init,
    avahi,
    'dns-sd':  dnssd,
    'mdns-js': mdnsjs
}

// end of mdns.js
