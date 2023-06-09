/*
 *  configuration
 */

const path = require('path');

const {argv} = require('yargs')
  .version(false)
  .help(false)
  .options({
    'config': {alias: 'c'},
    'rescan': {
      type: 'boolean',
      default: true,
    },
    'rebuild': {
      type: 'boolean',
      default: false,
    },
  });

if (argv.rebuild) argv.rescan = true;

if (argv.c) {
  const config = require('konphyg')(
    path.isAbsolute(argv.config) ? argv.c : path.join(__dirname, argv.c),
  );

  const server = config('server');
  server.useMongo = /mongo/i.test(server.db);

  module.exports = {
    server,
    db: server.useMongo ? config('db.mongo') : config('db.ne'),
    debug: server.debug,
  };
}

module.exports = {
  ...module.exports,
  argv,
};

// end of config.js
