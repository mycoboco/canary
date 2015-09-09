/*
 *  service advertisement via mDNS
 */

var exec = require('child_process').exec
var mdns = require('mdns-js'),
    service


var txt = ' "txtvers=1" "Database ID=beddab1edeadbea7"'


function escape(s) {
    return s.replace(/-/g, '\\-')
            .replace(/\"/g, '\\"')
}

function avahi(name, port, cb) {
    return exec('avahi-publish-service "'+escape(name)+'" _daap._tcp '+port+txt, cb)
}

function dnssd(name, port, cb) {
    return exec('dns-sd -R "'+escape(name)+'" _daap._tcp local '+port+txt, cb)
}

function mdnsjs(name, port, cb) {
    service = mdns.createAdvertisement('_daap._tcp', port, {
        name: name,
        txt: {
            txtvers:       '1',
            'Database ID': 'beddab1edeadbea7',
        }
    })
    service.start()
    cb(null)
    return service
}


module.exports = {
    avahi:     avahi,
    'dns-sd':  dnssd,
    'mdns-js': mdnsjs
}

// end of mdns.js
