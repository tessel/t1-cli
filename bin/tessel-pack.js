#!/usr/bin/env node

var common = require('../src/cli')
  , colors = require('colors')
  , tessel = require('../')
  , path = require('path')
  , fs = require('fs')
  , util = require('util')
  , humanize = require('humanize')
  ;

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-push')
  .option('script', {
    position: 0,
    // required: true,
    full: 'script.js',
    help: 'Pack this script as an archive.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('dry', {
    abbr: 'd',
    flag: true,
    help: 'Do not output a tar bundle.'
  })
  .option('help', {
    abbr: 'h',
    flag: true,
    help: 'Show usage for tessel pack'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

tessel.bundleScript(argv.script, argv.args, {
  quiet: true
}, function (err, tarbundle) {
  console.error('wrote %s bytes', humanize.filesize(tarbundle.length))
  if (!argv.dry) {
    var file = 'tessel-' + path.basename(process.cwd()) + '.tar';
    console.log(file)
    fs.writeFileSync(file, tarbundle);
  }
})
