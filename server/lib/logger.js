/*
 *  logger wrapper for winston
 */

// cannot 'use strict' due to arguments.callee

var defaults = require('defaults')
var winston = require('winston')
var colors = require('colors')


// extends Object to trace call stacks
Object.defineProperty(global, '__stack', {
    get: function() {
        var orig = Error.prepareStackTrace
        var err = new Error

        Error.prepareStackTrace = function(_, stack) {
            return stack
        }
        Error.captureStackTrace(err, arguments.callee)
        var stack = err.stack
        Error.prepareStackTrace = orig

        return stack
    }
})


// extends Object to get line number
Object.defineProperty(global, '__line', {
    get: function() {
        return __stack[2].getLineNumber()
    }
})


// extends Object to get function name
Object.defineProperty(global, '__function', {
    get: function() {
        return __stack[2].getFunctionName()
    }
})


// ?conf = {
//     prefix: 'prefix',
//     level:  'info' || 'warning' || 'error' || 'off',
//     stack:  true || false
// }
function create(conf) {
    var info, warning, error

    var locus = function (s) {
        // assumes Console used for output
        return (conf.level !== 'off' && process.stdout.isTTY)? s.cyan: s
    }

    conf = defaults(conf, {
        prefix: undefined,
        level:  'info',
        stack:  true
    })

    var logger = new winston.Logger({
        levels: {
            error:   0,
            warning: 1,
            info:    2
        },
        colors: {
            error:   'red',
            warning: 'yellow',
            info:    'green'
        },
        transports: (conf.level !== 'off')? [
            new winston.transports.Console({
                timestamp: true,
                label:     conf.prefix,
                level:     conf.level,
                colorize:  process.stdout.isTTY
            })
        ]: []
    })

    info = logger.info
    warning = logger.warning
    error = logger.error

    logger.info = function (err) {
        var args = Array.prototype.slice.call(arguments)

        err = err.message || err
        args.push(locus(((__function)? __function+'': '(anonymous)')+':'+__line))
        info.apply(logger, args)
    }

    logger.warning = function (err) {
        var args = Array.prototype.slice.call(arguments)

        err = err.message || err
        args.push(locus(((__function)? __function+'': '(anonymous)')+':'+__line))
        warning.apply(logger, args)
    }

    logger.error = function (err) {
        var args, stack

        if (!err) return

        if (conf.stack) stack = err.stack
        err = err.message || err
        err += ((stack)? '\n'+stack: '')
        args = Array.prototype.slice.call(arguments)

        args.push(locus(((__function)? __function+'': '(anonymous)')+':'+__line))
        error.apply(logger, args)
    }

    return logger
}


module.exports = {
    create: create
}

// end of logger.js
