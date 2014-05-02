#!/usr/bin/env node

var fork = require('child_process').fork

var optimist = require('optimist')

var argv = optimist
  .boolean('version')
  .boolean('v')
  .boolean('no-retry')
  .boolean('verbose')
  .boolean('quiet')
  .alias('exclude', 'x')
  .alias('include', 'i')
  .argv;

// tessel --version
if (argv.version) {
  console.log(require('../package.json').version.replace(/^v?/, 'v'));
  return;
}

function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "   tessel <filename>\n" +
    "   tessel list\n" +
    "   tessel logs\n" +
    "   tessel push <filename> [-r <ip[:port>]] [-b <file>] [-c] [-a [options]]\n" +
    // "          -r wireless pushing of code (inactive at the moment)\n" + 
    "          -b pushes a binary\n" + 
    "          -c compresses and pushes a dump dir\n" + 
    "          -a passes arguments to tessel scripts\n" + 
    "          -f writes the script to flash so it is run automatically on boot\n" + 
    // "       tessel pushall <filename>\n"+
    "   tessel wifi <ssid> <pass> <security (wep/wpa/wpa2, wpa2 by default)>\n"+
    "   tessel wifi <ssid>\n" +
    "          connects to a wifi network without a password\n" + 
    "   tessel wifi\n" +
    "          see current wifi status\n" + 
    "   tessel stop\n" +
    "   tessel check <file>\n" + 
    "          dumps the tessel binary code\n" + 
    "   tessel dfu-restore [tag]\n" +
    "          uploads new firmware when in DFU mode\n" +
    "          no arguments: list available tags\n" +
    "          relative or absolute path: pushe a local binary to tessel\n" +
    "   tessel blink\n" +
    "          uploads test blinky script\n" +
    "   tessel update [-u <url>]\n" +
    "          updates tessel to the newest released firmware. Optionally can specify any url to download firmware from\n" +
    "   tessel debug [script]\n" +
    "          runs through debug script and uploads logs\n" +
    ""
    );
}


var builtinCommands = {
  'blink': 'blink', 'blinky': 'blink', 'blinkie': 'blink', 'blinkee': 'blink',
  'debug': 'debug',
  'check': 'check',
  'debug-stack': 'debug-stack',
  'erase': 'erase',
  'firmware': 'firmware', 'dfu-restore': 'firmware',
  'list': 'list',
  'logs': 'logs', 'listen': 'logs',
  'node': 'node',
  'push': 'push',
  'repl': 'repl',
  'stop': 'stop',
  'update': 'update',
  'verbose': 'verbose',
  'version': 'version',
  'wifi': 'wifi',
}

if (process.argv.length < 3 || !builtinCommands[process.argv[2]]) {
  usage();
  process.exit(1);
}

// Launch subprocess as though it were ourself
var subprocess = './tessel-' + builtinCommands[process.argv[2]] + '.js';
process.argv.splice(1, 2, subprocess)
require(subprocess);