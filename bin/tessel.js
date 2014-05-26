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
    "   tessel push <filename> [options]\n" +
    "          see 'tessel push --help' for options list\n" +
    "   tessel run <filename> [args...]\n" +
    "          run a script temporarily without writing it to flash\n" +
    "          -s push the specified file only (rather than associated files and modules)\n" + 
    "   tessel repl\n" +
    "          interative JavaScript shell\n" +
    "   tessel wifi -n <ssid> -p <pass> -s <security (wep/wpa/wpa2, wpa2 by default)>\n"+
    "   tessel wifi -n <ssid>\n" +
    "          connects to a wifi network without a password\n" + 
    "   tessel wifi -l\n" +
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
    "   tessel update [--list] [-b build] [-u <url>]\n" +
    "          updates tessel to the newest released firmware. Optionally can list all builds. Can specify by build or url to download firmware from\n" +
    "   tessel debug [script]\n" +
    "          runs through debug script and uploads logs\n" +
    "   tessel update\n" +
    "          updates tessel firmware\n" +
    "   tessel version\n" +
    "          show version\n" +
    "   tessel version --board\n" +
    "          show version of the connected Tessel\n" +
    ""
    );
}


var builtinCommands = {
  'blink': 'blink', 'blinky': 'blink', 'blinkie': 'blink', 'blinkee': 'blink',
  'debug': 'debug',
  'check': 'check',
  'debug-stack': 'debug-stack',
  'erase': 'erase',
  'firmware': 'firmware',
  'update': 'update', 'dfu-restore': 'update',
  'list': 'list',
  'logs': 'logs', 'listen': 'logs',
  'node': 'node', 'run': 'node',
  'pack': 'pack',
  'push': 'push',
  'repl': 'repl',
  'stop': 'stop',
  'verbose': 'verbose',
  'version': 'version',
  'wifi': 'wifi',
  'install-drivers': 'install-drivers',
}

if (process.argv.length < 3 || !builtinCommands[process.argv[2]]) {
  usage();
  process.exit(1);
}

// Launch subprocess as though it were ourself
var subprocess = './tessel-' + builtinCommands[process.argv[2]] + '.js';
process.argv.splice(1, 2, subprocess)
require(subprocess);