/*
 *  configuration
 */

import * as path from 'node:path';
import {fileURLToPath} from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {default as konphyg} from 'konphyg';

const argv = yargs(hideBin(process.argv))
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
  })
  .parse();
let ex = {argv};

if (argv.rebuild) argv.rescan = true;

if (argv.c) {
  const config = konphyg(
    path.isAbsolute(argv.config) ? argv.c : path.join(__dirname, argv.c),
  );

  const server = config('server');
  server.useMongo = /mongo/i.test(server.db);

  ex = {
    ...ex,
    server,
    db: server.useMongo ? config('db.mongo') : config('db.ne'),
    debug: server.debug,
  };
}

export default ex;

// end of config.js
