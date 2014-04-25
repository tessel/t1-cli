#!/usr/bin/env node
var request = require('request'),
  prompt = require('prompt'),
  temp = require('temp'),
  fs = require('fs'),
  tessel_dfu = require('../dfu/tessel-dfu');
  ;

var common = require('../src/common')

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
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })
  .option('flash', {
    abbr: 'f',
    flag: true,
    help: 'Write program to flash'
  })

  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

// check the builds list
function checkBuildList (next){
  request.get(common.utils.buildsPath+'builds.json', function(err, data){
    if (err) next && next(null);
    try {
      var builds = JSON.parse(data.body);

      // find the latest
      builds.sort(function(a, b){
        var aBuildDate = a.url.match(/-firmware-(.*?).bin/);
        var bBuildDate = b.url.match(/-firmware-(.*?).bin/);

        if (!aBuildDate) return 1;
        if (!bBuildDate) return -1;

        if (aBuildDate[1] > bBuildDate[1]) return -1;
        if (aBuildDate[1] < bBuildDate[1]) return 1;

        return 0;
      });
      next && next(builds);
    } catch (e){
      next && next(null);
    }
  });
}

function getBuild(url, next) {
  var d = new Date().toISOString();
  // console.log("build path", common.utils.buildsPath+url);
  temp.open('firmware-'+d, function (err, info){
    var file = fs.createWriteStream(info.path);
    request.get(common.utils.buildsPath+url).pipe(file).on('close', function(){
      // console.log("fs", file);
      next && next(info.path);
    });
  });
}

common.controller(function (err, client) {
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

  client.once('script-start', function () {
    // Stop on Ctrl+C.
    process.on('SIGINT', function() {
      client.once('script-stop', function (code) {
        process.exit(code);
      });
      setTimeout(function () {
        // timeout :|
        process.exit(code);
      }, 5000);
      client.stop();
    });

    client.once('script-stop', function (code) {
      client.close();
      process.exit(code);
    });
  });

  // Forward path and code to tessel cli handling.
  checkBuildList(function (builds){
    if (!builds) pushCode();
    var firmwareDate = new Date(client.version.date+" "+client.version.time);
    var newFirmwareDate = new Date(builds[0].modified);
    // in case the builds.version has the full git commithash instead of the first 10 char
    if (newFirmwareDate.valueOf() > firmwareDate.valueOf() && builds[0].version.search(client.version.firmware_git) == -1){
      // update?
      prompt.start();
      prompt.get({message: 'There is a newer firmware version available for Tessel. Would you like to update? (y/n)'}, function (err, res){
        if (err) pushCode();

        if (['Y', 'YES'].indexOf(res.question.toUpperCase()) != -1) {
          console.log("Downloading new firmware...");
          getBuild(builds[0].url, function(newFirmware){
            console.log("Updating firmware... please wait. Tessel will reset itself after the update");
            client.close();
            setTimeout(function(){
              tessel_dfu.write(fs.readFileSync(newFirmware));
            }, 500);
          });

        } else {
          pushCode();
        }
      });
    } else {
      pushCode();
    }

  });

  function pushCode(){
    common.pushCode(client, pushpath, ['tessel', pushpath].concat(argv.arguments || []), {flash: argv.flash}, argv);
  }
});
