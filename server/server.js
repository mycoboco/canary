/*
 *  canary server
 */

const { version: VERSION } = require('./package.json')

const path = require('path')
const util = require('util')
const zlib = require('zlib')

const argv = require('optimist')
    .string('c')
    .alias('c', 'config')
    .default('rescan', true)
    .argv

// checks for program arguments must be done before konphyg
!function () {
    argv.version && version()
    ;(!argv.c || argv.help) && usage()
}()

const restify = require('restify')
let server

const {
    logger,
    dropPrivilege
} = require('@hodgepodge-node/server')
const config = require('konphyg')(path.join(__dirname, argv.c)),
      conf = {
          server: config('server'),
          db: {
              mongo: config('db.mongo'),
              ne:    config('db.ne')
          }
      }

let db = {
    mongo: require('./lib/db.mongo'),
    ne:    require('./lib/db.ne')
}
const daap = require('./lib/daap')
const api = require('./lib/api')
const mp3 = require('./lib/mp3')
const mdns = require('./lib/mdns')
let service


let log


function exit() {
    mp3 && mp3.close()
    if (service) {
        log.info('stopping service advertisement')
        const _service = service
        service = null
        if (typeof _service.kill === 'function') _service.kill()
        else if (typeof _service.stop === 'function') _service.stop()
    }
    db && typeof db.close === 'function' && db.close()
    setTimeout(() => process.exit(0), 1*1000)
}


function installRoute() {
    const route = [
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

    for (let i = 0; i < route.length; i += 2) {
        const version = route[i]
        const methods = route[i+1]

        Object.keys(methods).forEach(method => {
            methods[method].forEach(rule => {
                server[method].apply( server, [{
                    path: rule.path,
                    version
                }].concat(rule.func))
            })
        })
    }
}


function publishService(services, i = 0) {
    log.info(`running '${services[i]}'`)
    service = mdns[services[i]](conf.server.name, conf.server.port, err => {
        if (service && i < services.length-1) {    // something went wrong
            service = null
            if (!err || !err.signal) {
                log.warning(`seems not to have '${services[i]}'`)
                ;(i+1 === services.length-1) && log.warning(`fall back to '${services[i+1]}'`)
                publishService(services, i+1)
            } else {    // probably killed for a reason
                log.error(`'${services[i]}' has suddenly stopped`)
            }
        }
    })
}


function selectDb() {
    if (/mongo/i.test(conf.server.db)) {
        conf.db = conf.db.mongo
        db = db.mongo
    } else {
        conf.db = conf.db.ne
        db = db.ne
    }
}


function version() {
    //   12345678911234567892123456789312345678941234567895123456789612345678971234567898
    console.log(
        `canary server ${VERSION}\n` +
        'This is free software; see the LICENSE file for more information. There is NO\n' +
        'warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.\n\n' +
        'Written by Woong Jun.')
    process.exit()    // cannot use exit()
}


function usage() {
    //           12345678911234567892123456789312345678941234567895123456789612345678971234567898
    console.log('Usage: node server <OPTION>...\n\n' +
                'Mandatory arguments to long options are mandatory for short options too.\n' +
                '  -c, --config DIR      directory for configurations [required]\n' +
                '      --no-rescan       do not scan songs immediately after server starts\n' +
                '      --help            display this help and exit\n' +
                '      --version         display version information and exit\n')
    console.log('For bug reporting instructions, please see: <http://code.woong.org/>.')
    process.exit()    // cannot use exit()
}


// starts here
!function () {
    conf.server = {
        name: 'canary music',
        port: 3689,
        runAs: {
            uid: 'userid',
            gid: 'groupid'
        },
        // password: 'password',
        scan: {
            path:  [ '/path/to/mp3/files' ],
            cycle: [ '19:00:00' ],
            utc:   false
        },
        db:    'nedb',
        mdns:  'auto',
        debug: false,
        ...conf.server
    }
    if (!Array.isArray(conf.server.scan.path)) conf.server.scan.path = [ conf.server.scan.path ]

    log = logger.create({
        prefix: 'server',
        level:  (conf.server.debug)? 'info': 'error'
    })

    process
        .on('SIGINT', exit)
        .on('SIGTERM', exit)
        .on('uncaughtException', err => {
            log.error(err)
            exit()
        })
    process.on('SIGUSR2', mp3.scan.bind(mp3, true))

    dropPrivilege(conf.server.runAs, log, exit)

    server = restify.createServer({ name: conf.server.name })
    server.use(restify.acceptParser(server.acceptable))
    server.use(restify.queryParser())
    server.use(restify.bodyParser())
    server.use((req, res, next) => {
        log.info(`<< ${req.method} ${req.url} >>`)

        res.ok = body => {
            function send(err, buffer) {
                const header = {
                    'DAAP-Server':   `canary/${VERSION}`,
                    'Content-Type':  'application/x-dmap-tagged',
                    'Accept-Ranges': 'bytes',
                }

                if (err) {
                    log.error(err)
                    log.warning('uncompressed response sent instead')
                } else if (buffer) {
                    header['Content-Encoding'] = 'gzip'
                    body = buffer
                }
                header['Content-Length'] = body.length
                res.writeHead(200, header)
                res.write(body)
                res.end()
            }

            if (!body) return res.send(500)

            log.info(`sending response to ${req.method} ${req.url}`)
            if (/\bgzip\b/.test(req.headers['accept-encoding'])) {
                zlib.gzip(body, send)
            } else {
                send(null, null)
            }
        }

        res.err = (code, err) => {
            if (typeof code !== 'number') {
                err = code
                code = 500
            }
            log.warning(`error occurred while handling ${req.method} ${req.url}`)
            err && log.error(err)
            res.send(code)
        }

        next()
    })
    installRoute()

    daap.init({ debug: conf.server.debug })
    selectDb()
    db.init({
        db:    conf.db,
        debug: conf.server.debug
    }, err => {
        if (err) {
            log.error(err)
            exit()
        }

        mdns.init(db, (err, id) => {
            err && log.warning(err)
            log.info(`database id to advertise is ${id}`)

            if (conf.server.mdns === 'auto') {
                log.info('detecting tools for service advertisement')
                publishService([ 'avahi', 'dns-sd', 'mdns-js' ])
            } else if (conf.server.mdns !== 'off') {
                if (typeof mdns[conf.server.mdns] === 'function') {
                    publishService([ conf.server.mdns, 'mdns-js' ])
                } else {
                    log.error(`'${conf.server.mdns}' not supported for service advertisement`)
                    log.warning('trying to auto-detect')
                    publishService([ 'avahi', 'dns-sd', 'mdns-js' ])
                }
            }
        })

        api.init(db, daap, {
            server: conf.server,
            debug:  conf.server.debug
        })
        mp3.init(db, api, {
            mp3:   conf.server.scan,
            debug: conf.server.debug
        })

        argv.rescan && mp3.scan(true)

        server.listen(conf.server.port, '::', () => {
            log.info('%s listening on port %s', server.name, conf.server.port)
        })
    })
}()

// end of server.js
