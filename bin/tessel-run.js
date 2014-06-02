#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var path = require('path')

var common = require('../src/cli')
  , tessel = require('../')
  , keypress = require('keypress')
  , read = require('read')
  , colors = require('colors')
  , builds = require('../src/builds')
  , util = require('util')
  , humanize = require('humanize')
  , temp = require('temp')
  , path = require('path')
  ;

var colonyCompiler = require('colony-compiler')
var fs = require('fs')

temp.track();

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel run')
  .option('script', {
    position: 0,
    // required: true,
    full: 'script.js',
    help: 'Run this script on Tessel.',
  })
  .option('arguments', {
    position: 1,
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('version', {
    abbr: 'v',
    flag: true,
    help: 'Print tessel-node\'s version.',
    callback: function() {
      return require('./package.json').version.replace(/^v?/, 'v');
    }
  })
  .option('interactive', {
    abbr: 'i',
    flag: true,
    help: 'Enter the REPL.'
  })
  .option('upload-dir', {
    abbr: 'u',
    flag: false,
    help: 'Directory where uploads from process.sendfile should be saved to'
  })
  .option('evaluate', {
    abbr: 'e',
    help: 'Evaluate a string of code.'
  })
  .option('quiet', {
    abbr: 'q',
    flag: true,
    help: 'Hide tessel deployment messages from the PC.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: 'Push a single script file to Tessel.'
  })
  .option('help', {
    abbr: 'h',
    flag: true,
    help: 'Show usage for tessel node'
  })
  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function repl (client)
{
  // make `process.stdin` begin emitting "keypress" events
  keypress(process.stdin);
  // listen for the ctrl+c event, which seems not to be caught in read loop
  process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
      process.exit(0);
    }
  });

  client.on('message', prompt);

  // Ripped from the archives of joyent/node,
  // This code enables var and local functions to work in a repl.
  function convertToContext (cmd) {
    var self = this, matches,
        scopeVar = /^\s*var\s*([_\w\$]+)(.*)$/m,
        scopeFunc = /^\s*function\s*([_\w\$]+)/;

    // Replaces: var foo = "bar";  with: self.context.foo = bar;
    matches = scopeVar.exec(cmd);
    if (matches && matches.length === 3) {
      return matches[1] + matches[2];
    }

    // Replaces: function foo() {};  with: foo = function foo() {};
    matches = scopeFunc.exec(self.bufferedCommand);
    if (matches && matches.length === 2) {
      return matches[1] + ' = ' + self.bufferedCommand;
    }

    return cmd;
  };

  // Prompt for code in a repl, and loop.
  function prompt() {
    read({prompt: '>>'}, function (err, data) {
      try {
        if (err) {
          throw err;
        }
        data = String(data);

        data = convertToContext(data);
        var script
          = 'local function _run ()\n' + colonyCompiler.colonize(data, {returnLastStatement: true, wrap: false}) + '\nend\nsetfenv(_run, colony.global);\nreturn _run()';
        client.command('M', new Buffer(JSON.stringify(script)));
      } catch (e) {
        console.error(e.stack);
        setImmediate(prompt);
      }
    });
  }
}

common.controller(true, function (err, client) {
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

  // Check pushing path.
  if (argv.interactive) {
    var pushpath = path.resolve(__dirname, '../scripts/repl');
  } else if ('evaluate' in argv) {
    argv.arguments && argv.arguments.shift(argv.script);
  } else if (!argv.script) {
    usage();
  } else {
    var pushpath = argv.script;
  }

  // Read tessel messages, output information.
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

  builds.checkBuildList(client.version, function (allBuilds, needUpdate){
    if (allBuilds && needUpdate){
      // show warning
      console.log(colors.red("NOTE"), "Your Tessel firmware is outdated. Update by running \"tessel update\".");
    }

    if ('evaluate' in argv) {
      // Compile and evaluate a line of code.
      temp.mkdir('colony-evaluate', function (err, dirpath) {
        fs.writeFileSync(path.resolve(dirpath, 'index.js'), argv.evaluate);
        fs.writeFileSync(path.resolve(dirpath, 'package.json'), '{}');
        pushpath = path.resolve(dirpath, 'index.js');
        pushCode();
      });
    } else {
      pushCode();
    }
  });

  function pushCode () {
    // Bundle code based on file path.
    tessel.bundleScript(pushpath, ['tessel', pushpath].concat(argv.arguments || []), {}, function (err, tarbundle) {
      console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
      deploy(tarbundle);
    });
  }

  function deploy (tarbundle) {
    client.deployBundle(tarbundle, {}, function () {
      // Launch
      console.error(colors.grey('Running script...'));

      // Open the pipe floodgates.
      client.stdout.pipe(process.stdout);
      client.stderr.pipe(process.stderr);
      // Forward stdin by line.
      process.stdin.pipe(client.stdin);

      // Stop on Ctrl+C.
      process.on('SIGINT', function() {
        setTimeout(function () {
          // timeout :|
          console.error(colors.grey('Script aborted'));
          process.exit(131);
        }, 200);
        client.stop();
      });

      client.once('script-stop', function (code) {
        client.close(function () {
          process.exit(code);
        });
      });

      client.on('rawMessage', function (tag, data) {
        if (tag == 0x4113) {
          if (!argv['upload-dir']) {
            console.error(colors.red('ERR:'), colors.grey('ignoring uploaded file. call tessel with --upload-dir to save files from a running script.'));
            return;
          }

          try {
            var packet = require('structured-clone').deserialize(data);
            fs.writeFileSync(path.resolve(argv['upload-dir'], path.basename(packet.filename)), packet.buffer);
            console.error(colors.grey(util.format(packet.filename, 'saved to', argv['upload-dir'])));
          } catch (e) {
            console.error(colors.red('ERR:'), colors.grey('invalid sendfile packet received.'));
          }
        }
      });
      
      // repl is implemented in repl/index.js. Uploaded to tessel, it sends a
      // message telling host it's ready, then receives stdin via
      // process.on('message')
      if (argv.interactive) {
        repl(client);
      }
    });
  }
  
})
