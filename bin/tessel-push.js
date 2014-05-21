#!/usr/bin/env node
var request = require('request'),
  prompt = require('prompt'),
  fs = require('fs'),
  colors = require('colors'),
  builds = require('../src/builds')
  ;

var common = require('../src/cli');

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-push')
  .option('script', {
    position: 0,
    // required: true,
    full: 'script.js',
    help: 'Run this script on Tessel.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('quiet', {
    abbr: 'q',
    flag: true,
    help: '[Tessel] Hide tessel deployment messages.'
  })
  .option('messages', {
    abbr: 'm',
    flag: true,
    help: '[Tessel] Forward stdin as child process messages.'
  })
  .option('logs', {
    abbr: 'l',
    flag: true,
    help: '[Tessel] Stay connected and print logs.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })
  .option('help', {
    abbr: 'h',
    flag: true,
    help: 'Show usage for tessel push'
  })
  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

common.controller(true, function (err, client) {
  client.listen(true, [10, 11, 12, 13, 20, 21, 22])
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

  // Forward stdin as messages with "-m" option
  if (argv.messages) {
    process.stdin.resume();
    require('readline').createInterface(process.stdin, {}, null).on('line', function (std) {
      client.send(JSON.stringify(std));
    })
  }

  // Check pushing path.
  if (!argv.script) {
    usage();
  } else {
    var pushpath = argv.script;
  }

  // Command command.
  var updating = false;
  client.on('command', function (command, data) {
    if (command == 'u') {
      verbose && console.error(data.grey)
    } else if (command == 'U') {
      if (updating) {
        // Interrupted by other deploy
        process.exit(0);
      }
      updating = true;
    }
  });

  // Forward path and code to tessel cli handling.
  builds.checkBuildList(client.version, function (allBuilds, needUpdate){
    if (!allBuilds) return pushCode();

    if (needUpdate){
      // show warning
      console.log(colors.red("NOTE: There is a newer version of firmware available. Use \"tessel update\" to update to the newest version"));
    }
    
    pushCode();
  });

  function pushCode(){
    client.run(pushpath, ['tessel', pushpath].concat(argv.arguments || []), {
      flash: true,
    }, function (err) {

      console.log(colors.green("Finished deployment"));

      function exit(code) {
        console.log(colors.green("Run"), colors.red("tessel listen"), colors.green("or"), colors.red("tessel push <script.js> -l"), colors.green("to see logged output"));
        client.close(function () {
          process.exit(code || 0);
        });
      }

      if (argv.logs) {
        process.on('SIGINT', exit);
        client.once('script-stop', exit);
      } else {
        exit();
      }

    });
  }
});