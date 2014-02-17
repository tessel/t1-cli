#!/usr/bin/env node

// Slimmed down Tessel client that emulates Node.js

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net')
  , zlib = require('zlib');

var choices = require('choices')
  , colors = require('colors')
  , async = require('async')
  , nomnom = require('nomnom')
  , dgram = require('dgram')
  , humanize = require('humanize')
  , keypress = require('keypress')
  , read = require('read');

var tessel = require('tessel-client');

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-node')
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
  .option('remote', {
    abbr: 'r',
    flag: true,
    help: '[Tessel] Push code to a Tessel by IP address.'
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

  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

var verbose = !argv.quiet;


/**
 * Library functions
 */

// Push code to device.
function bundle (arg)
{
  var hardwareResolve = require('hardware-resolve');
  var effess = require('effess');

  function duparg (arr) {
    var obj = {};
    arr.forEach(function (arg) {
      obj[arg] = arg;
    })
    return obj;
  }

  var ret = {};

  hardwareResolve.root(arg, function (err, pushdir, relpath) {
    var files;
    if (argv.single || !pushdir) {
      if (!argv.single && fs.lstatSync(arg).isDirectory()) {
        ret.warning = String(err).replace(/\.( |$)/, ', pushing just this directory.');

        pushdir = fs.realpathSync(arg);
        relpath = fs.lstatSync(path.join(arg, 'index.js')) && 'index.js';
        files = duparg(effess.readdirRecursiveSync(arg, {
          inflateSymlinks: true,
          excludeHiddenUnix: true
        }))
      } else {
        ret.warning = String(err).replace(/\.( |$)/, ', pushing just this file.');

        pushdir = path.dirname(fs.realpathSync(arg));
        relpath = path.basename(arg);
        files = duparg([path.basename(arg)]);
      }
    } else {
      // Parse defaults from command line for inclusion or exclusion
      var defaults = {};
      if (typeof argv.x == 'string') {
        argv.x = [argv.x];
      }
      if (argv.x) {
        argv.x.forEach(function (arg) {
          defaults[arg] = false;
        })
      }
      if (typeof argv.i == 'string') {
        argv.i = [argv.i];
      }
      if (argv.i) {
        argv.i.forEach(function (arg) {
          defaults[arg] = true;
        })
      }

      // Get list of hardware files.
      files = hardwareResolve.list(pushdir, null, null, defaults);
      // Ensure the requested file from command line is included, even if blacklisted
      if (!(relpath in files)) {
        files[relpath] = relpath;
      }
    }

    ret.pushdir = pushdir;
    ret.relpath = relpath;
    ret.files = files;

    // Update files values to be full paths in pushFiles.
    Object.keys(ret.files).forEach(function (file) {
      ret.files[file] = fs.realpathSync(path.join(pushdir, ret.files[file]));
    })
  })

  // Dump stats for files and their sizes.
  var sizelookup = {};
  Object.keys(ret.files).forEach(function (file) {
    sizelookup[file] = fs.lstatSync(ret.files[file]).size;
    var dir = file;
    do {
      dir = path.dirname(dir);
      sizelookup[dir + '/'] = (sizelookup[dir + '/'] || 0) + sizelookup[file];
    } while (path.dirname(dir) != dir);
  });
  if (argv.verbose) {
    Object.keys(sizelookup).sort().forEach(function (file) {
      console.error('LOG'.cyan.blueBG, file.match(/\/$/) ? ' ' + file.underline : ' \u2192 ' + file, '(' + humanize.filesize(sizelookup[file]) + ')');
    });
    console.error('LOG'.cyan.blueBG, 'Total file size:', humanize.filesize(sizelookup['./'] || 0));
  }
  ret.size = sizelookup['./'] || 0;

  return ret;
}

function pushCode (file, args, client, options) {
  var ret = bundle(file);
  if (ret.warning) {
    console.error(('WARN').yellow, ret.warning.grey);
  }
  console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);

  tessel.bundleFiles(ret.relpath, args, ret.files, function (err, tarbundle) {
    console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
    client.deployBundle(tarbundle, options);
  })
}


/**
 * Program entry
 */

// Check flags.
if (!argv.interactive && !argv.script) {
  usage();
}

// Listen to remote or local device.
if (argv.remote) {
  // Use remote IP address.
  setImmediate(function () {
    console.log('Listening on remote port...'.grey);
  })
  var _ = argv.remote.split(':')
    , host = _[0]
    , port = _[1] || 4444;
  onconnect('[' + host + ':' + port + ']', port, host);
} else {
  // Poll for devices.
  var firstNoDevicesFound = false;
  tessel.selectModem(function notfound () {
    if (!verbose) {
      throw new Error('No Tessel device found.');
    }

    if (!firstNoDevicesFound) {
      firstNoDevicesFound = true;
      console.error('No tessel devices detected, waiting...'.grey);
    }
  }, function found (err, modem) {
    verbose && console.error(('Connecting to ' + modem).grey);
    tessel.connectServer(modem, function () {
      onconnect(modem, 6540, 'localhost');
    });
  });
}


// Once client is connected, run.
function onconnect (modem, port, host) {
  var client = tessel.connect(port, host);
  
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

  // Forward stdin as messages with "-m" option
  if (argv.m) {
    process.stdin.resume();
    require('readline').createInterface(process.stdin, {}, null).on('line', function (std) {
      client.send(JSON.stringify(std));
    })
  }

  // Check pushing path.
  if (argv.interactive) {
    var pushpath = __dirname + '/repl';
  } else if (!argv.script) {
    usage();
  } else {
    var pushpath = argv.script;
  }

  // Command command.
  var updating = false;
  client.on('command', function (command, data) {
    if (command == 'u') {
      console.error(data.grey)
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
      client.stop();
    });
    process.on('SIGTERM', function() {
    });

    // Flush existing output, then pipe output to client
    while (null !== (chunk = client.stdout.read())) {
      ;
    }
    client.stdout.pipe(process.stdout);

    client.once('script-stop', function (code) {
      client.end();
      process.exit(code);
    });

    // Hack to get repl working.
    if (argv.interactive) {
      function pollInteractive () {
        // make `process.stdin` begin emitting "keypress" events
        keypress(process.stdin);
        // listen for the ctrl+c event, which seems not to be caught in read loop
        process.stdin.on('keypress', function (ch, key) {
          if (key && key.ctrl && key.name == 'c') {
            process.exit(0);
          }
        });

        read({prompt: '>>'}, function (err, data) {
          try {
            if (err) {
              throw err;
            }
            var script
              // = 'function _locals()\nlocal variables = {}\nlocal idx = 1\nwhile true do\nlocal ln, lv = debug.getlocal(2, idx)\nif ln ~= nil then\n_G[ln] = lv\nelse\nbreak\nend\nidx = 1 + idx\nend\nreturn variables\nend\n'
              = 'local function _run ()\n' + colony.colonize(data, false) + '\nend\nsetfenv(_run, colony.global);\n_run()';
            client.command('M', new Buffer(JSON.stringify(script)));
            client.once('message', function (ret) {
              console.log(ret.ret);
              setImmediate(pollInteractive);
            })
          } catch (e) {
            console.error(e.stack);
            setImmediate(pollInteractive);
          }
        });
      }
      client.once('message', pollInteractive);
    }
  });

  pushCode(pushpath, ['tessel', pushpath].concat(argv.arguments || []), client, {});
}
