/*
 *  wrapper for stream pipes to avoid broken pipe;
 *      to be replaced by @hodgepodge-node/util/safePipe()
 */


module.exports = function (rs, ws, _handler) {
    var handler = function (err) {
        rs.unpipe(ws)
        ws.end()
        _handler && _handler(err)
    }

    ws.on('unpipe', function () {
        rs.once('readable', function () { rs.destroy() })
    })
    ws.on('error', handler)
      .on('close', function () { rs.unpipe(ws) })
    rs.on('error', handler)
    rs.pipe(ws)
}

// end of safePipe.js
