/*
 *  canary server
 */

'use strict'

var VERSION = require('./VERSION')

var path = require('path')
var util = require('util')
var zlib = require('zlib')

var argv = require('optimist')
           .string('c')
           .alias('c', 'config')
           .default('rescan', true)
           .argv

// checks for program arguments must be done before konphyg
!function () {
    if (argv.version) version()
    if (!argv.c || argv.help) usage()
}()

var _ = require('underscore')
var restify = require('restify'),
    server
var defaults = require('defaults')
var config = require('konphyg')(path.join(__dirname, argv.c)),
    conf = {
        server: config('server'),
        db:     config('db')
    }

var db = require('./lib/db')
var daap = require('./lib/daap')
var api = require('./lib/api')
var mp3 = require('./lib/mp3')
var avahi = require('./lib/avahi_pub')
var logger = require('./lib/logger'),
    log


function exit() {
    if (db) db.close()
    process.exit(0)
}


var installRoute = function () {
    var route

    route = [
        '1.0.0',
        {
            'get': [
                {
                    path: '/server-info',
                    func: api.serverInfo
                },
                {
                    path: '/login',
                    func: [ api.auth, api.login ]
                },
                {
                    path: '/update',
                    func: [ api.auth, api.update ]
                },
                {
                    path: '/logout',
                    func: api.logout
                },
                {
                    path: '/databases',
                    func: [ api.auth, api.database.info ]
                },
                {
                    path: '/databases/1/items',
                    func: [ api.auth, api.database.item ]
                },
                {
                    path: '/databases/1/containers',
                    func: [ api.auth, api.container.info ]
                },
                {
                    path: '/databases/1/containers/:pl/items',
                    func: [ api.auth, api.container.item ]
                },
                {
                    path: '/databases/:num/items/:file',
                    func: api.song    // iTunes sends no password
                }
            ],
        },
    ]

    for (var i = 0; i < route.length; i += 2) {
        var version = route[i]
        var methods = route[i+1]

        Object.keys(methods).forEach(function (method) {
            var sets = methods[method]
            for (var i = 0; i < sets.length; i++) {
                server[method].apply(server, [{
                    path:    sets[i].path,
                    version: version
                }].concat(sets[i].func))
            }
        })
    }
}


function version() {
    //   12345678911234567892123456789312345678941234567895123456789612345678971234567898
    console.log(
        'canary server '+VERSION+'\n' +
        'This is free software; see the LICENSE file for more information. There is NO\n' +
        'warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.\n\n' +
        'Written by Jun Woong.')
    exit();
}


function usage() {
    //           12345678911234567892123456789312345678941234567895123456789612345678971234567898
    console.log('Usage: node server <OPTION>...\n\n' +
                'Mandatory arguments to long options are mandatory for short options too.\n' +
                '  -c, --config DIR      directory for configurations [required]\n' +
                '      --no-rescan       do not scan songs immediately after server starts\n' +
                '      --help            display this help and exit\n' +
                '      --version         display version information and exit\n')
    console.log('For bug reporting instructions, please see: <http://code.woong.org/>.');
    exit();
}


// starts here
!function () {
    conf.server = defaults(conf.server, {
        name:     'canary',
        host:     'localhost',
        port:     3689,
        password: 'password',
        timeout:  1800,
        scan: {
            path:  [ '/path/to/mp3/files' ],
            cycle: [ '19:00:00' ],
            utc:   false
        },
        debug:   false
    })
    if (!_.isArray(conf.server.scan.path)) conf.server.scan.path = [ conf.server.scan.path ]

    process.on('SIGINT', exit)
           .on('SIGTERM', exit)
    process.on('SIGUSR2', mp3.scan.bind(mp3, true))

    log = logger.create({
        prefix: 'server',
        level:  (conf.server.debug)? 'info': 'error'
    })

    server = restify.createServer()

    server.use(restify.acceptParser(server.acceptable))
    server.use(restify.queryParser())
    server.use(restify.bodyParser())
    server.use(function (req, res, next) {
        log.info('<< '+req.method+' '+req.url+' >>')

        res.ok = function (body) {
            if (!body) {
                res.send(500)
                return
            }
            log.info('sending response to '+req.method+' '+req.url)

            zlib.gzip(body, function (err, buffer) {
                var header = {
                    'DAAP-Server':     'canary/'+VERSION,
                    'Content-Type':    'application/x-dmap-tagged',
                    'Accept-Ranges':   'bytes',
                }

                if (err) {
                    log.error(err)
                    log.warning('uncompressed response sent instead')
                } else {
                    header['Content-Encoding'] = 'gzip'
                    body = buffer
                }
                header['Content-Length'] = body.length
                res.writeHead(200, header)
                res.write(body)
                res.end()
            })
        }

        res.err = function (code, err) {
            if (typeof code !== 'number' && !err) {
                err = code
                code = 500
            }
            log.warning('error occurred while handling '+req.method+' '+req.url)
            if (err) log.error(err)
            res.send(code)
        }

        next()
    })
    installRoute()

    daap.init({
        debug: conf.server.debug
    })
    db.init({
        db:     conf.db,
        debug:  conf.server.debug
    })
    api.init(db, daap, {
        server: conf.server,
        debug:  conf.server.debug
    })
    mp3.init(db, {
        mp3:   conf.server.scan,
        debug: conf.server.debug
    })

    if (argv.rescan) mp3.scan(true)

    server.listen(conf.server.port, function () {
        log.info('%s listening on port %s', server.name, conf.server.port)
    })

    avahi.publish({
        name: conf.server.name,
        type: '_daap._tcp',
        port: conf.server.port,
        // data: ''
    })
}()

// end of server.js
