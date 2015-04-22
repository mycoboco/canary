/*
 *  port of avahi_pub.coffee
 */

var os = require('os')

var bindings = require('bindings')('avahi_pub.node')


module.exports = {
    publish: function (opts) {
        service = bindings.publish(opts)
        bindings.poll()
        return service
    },
    isSupported: function () {
        return os.platform() == 'linux'
    },
    kill: function () {
        clearInterval(interval)
    }
}


!function () {
    bindings.init()
    if (module.exports.isSupported()) interval = setInterval(bindings.poll, 1000)
}()

// end of avahi_pub.js
