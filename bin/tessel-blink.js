#!/usr/bin/env node

// tessel blink
// Whoever blinks first loses.

var common = require('../src/common')

// Setup cli.
common.basic();

common.controller(function (err, client) {
  client.listen(true, [10, 11, 12, 13, 20, 21, 22])
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

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
  common.pushCode(client, __dirname + '/../scripts/blink', ['tessel', 'blink.js'], {}, {});
})
