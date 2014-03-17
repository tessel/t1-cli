#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , repl = require('repl')
  , colony = require('colony')
  , net = require('net')
  , spawn = require('child_process').spawn
  , exec = require('child_process').exec
  , zlib = require('zlib');

var choices = require('choices')
  , colors = require('colors')
  , async = require('async')
  , optimist = require('optimist')
  , dgram = require('dgram')
  , temp = require('temp')
  , read = require('read')
  , keypress = require('keypress')
  , request = require('request')
  , humanize = require('humanize');

var tesselClient = require('../');
var repository = require('../src/repository');

// Prevent color output to TTY.
require('colorsafeconsole')(console);

// Automatically track and cleanup files at exit
temp.track();

var argv = optimist
  .boolean('v')
  .boolean('no-retry')
  .boolean('verbose')
  .alias('exclude', 'x')
  .alias('include', 'i')
  .argv;

// process.on('uncaughtException', function (err) {
//   console.error(err.stack);
// })

function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "   tessel <filename>\n" +
    "   tessel list\n" +
    "   tessel logs\n" +
    "   tessel push <filename> [-r <ip[:port>]] [-s] [-b <file>] [-c] [-a [options]]\n" +
    "          -r wireless pushing of code (inactive at the moment)\n" + 
    "          -s saves the file that is getting passed to Tessel as builtin.tar.gz\n" + 
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
    ""
    );
}

function repeatstr (str, n) {
  return Array(n + 1).join(str);
}

var header = {
  init: function () {
    header._msg('TESSEL? '.grey);
  },
  _unwrite: function (n) {
    process.stderr.write(repeatstr('\b', n));
    header.len = 0;
  },
  _msg: function (str) {
    header._unwrite(header.len || 0);
    header.len = str.stripColors.length;
    process.stderr.write(str);
  },
  nofound: function () {
    header._msg('TESSEL? No Tessel found, waiting...'.grey);
  },
  connecting: function (serialNumber) {
    header._msg('TESSEL? Connecting to '.grey + serialNumber.grey + '...');
  },
  connected: function (serialNumber) {
    header._msg('TESSEL!'.bold.cyan + ' Connected to '.cyan + ("" + serialNumber).green + '.          \n'.cyan);
  }
}

function zipCode (dir, client) {
  tesselClient.tarCode(dir, dir, function (err, pushdir, tarstream){
    // deploy that bundle
    console.error(('Deploying...').grey);
    client.deployBundle(tarstream, {});
  });
}

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
    if (!pushdir) {
      if (fs.lstatSync(arg).isDirectory()) {
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
  setTimeout(function () {
    var ret = bundle(file);
    if (ret.warning) {
      console.error(('WARN').yellow, ret.warning.grey);
    }
    console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);

    tesselClient.bundleFiles(ret.relpath, args, ret.files, function (err, tarbundle) {
      console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
      client.deployBundle(tarbundle, options);
    })
  }, 100);
  // tesselClient.detectDirectory(file, function (err, pushdir, relpath) {
  //   if (err) {
  //     setTimeout(function () {
  //       console.error('ERR'.red, err.message);
  //       process.exit(1);
  //     }, 10)
  //     return;
  //   }

  //   setTimeout(function () {
  //     console.error(('Bundling directory ' + pushdir).grey);
  //   }, 100);
  //   tesselClient.bundleCode(pushdir, relpath, args, function (err, tarstream) {
  //     console.error(('Deploying...').grey);

  //     client.deployBundle(tarstream, options.save);
  //   });
  // });
}

function pushTar (file, client, options) {
  console.error(('Deploying tar ' + file).grey);
  var tarbuff = fs.readFileSync(file);
  client.deployBundle(tarbuff, {});
}

function pushBinary (file, client) {
  console.error(('Deploying binary ' + file).grey);
  client.deployBinary(file);
}

function dumpBinary(file){

  var gzBuff = fs.readFileSync(file);
  var newGzipBuff = new Buffer(gzBuff.length - 4);
  gzBuff.copy(newGzipBuff, 0, 4, gzBuff.length);

  zlib.inflate(newGzipBuff, function(err, inflated) {
    console.log("dumping binary");

    if (!err) {
      // untar it
      fs.mkdir('dump', function(error) {
        if (!err) {
          fs.writeFileSync("dump/"+file+"-tarred", inflated);
          exec("tar xvf "+file+"-tarred", {
            cwd: process.cwd()+"/dump"
          }, function (err, stdout, stderr){
            if (err) {
              console.log("error couldn't untar", file, stderr);
            } else {
              console.log("dumped ", file);
            }
            // remove tarball
            fs.unlinkSync("dump/"+file+"-tarred");
            process.exit(1);
          });
        } else {
          console.log("can't make dump dir", error);
        }
      });
    } else {
      console.error("can't inflate", file, err);
    }
  });
}

if (process.argv.length < 3) {
  usage();
  process.exit(1);
}

if (argv.v || process.argv[2] == 'version') {
  exec("more VERSION", {
    cwd: __dirname,
  }, function (err, stdout, stderr){
    if (err) {
      console.log(require('../package.json').version.replace(/^v?/, 'v'))
    } else {
      console.log(stdout);
    }
  });
} else if (process.argv[2] == 'dfu-restore') {
  function isLocalPath (str) {
    return str.match(/^[\.\/\\]/);
  }

  if (process.argv.length == 3) {
    // Display list of tools.
    repository.getToolsListing(function (err, entries) {
      function currentize (key, i) {
        var date = key.match(/\d{4}-\d{2}-\d{2}/) || 'current   '.yellow;
        // return i == 0 ? (key + '  (current)').yellow : key;
        return date // + ('\t\t' + key + '').grey
      }

      console.log('Available firmware tags:')
      var tags = entries.filter(function (file) {
        return file.key.match(/^firmware\/./) && file.key.match(/\.bin$/);
      }).sort(function (a, b) {
        if (a.key < b.key) return 1;
        if (a.key > b.key) return -1;
        return 0;
      }).map(function (file, i) {
        return '  o '.blue + currentize(file.key.replace(/^firmware\//, ''), i);
      });
      if (tags.length > 10) {
        tags = tags.slice(0, 10);
        tags.push('  ...');
      }
      console.log(tags.join('\n'));
    })
  } else if (isLocalPath(process.argv[3])) {
    // Try local file.
    console.error('Deploying local file', process.argv[3], 'to Tessel.');
    dfuRestoreFunc(fs.readFileSync(process.argv[3]));
  } else {
    // Download tagged version.
    var tag = process.argv[3];
    if (tag == '--latest') {
      tag = 'current';
    }
    var url = repository.firmwareURL(tag);

    process.stdout.write(String('Downloading ' + url));
    request(url, {
      headers: {
        'User-Agent': 'tessel',
        'Accept': 'application/octet-stream'
      },
      encoding: null,
      followRedirect: false
    }, function (err, res, body) {
      if (err || res.statusCode >= 400) {
        process.stderr.write(' failed!');
        console.error('Could not download file, aborting.')
        process.exit(10);
      }

      if (res.statusCode == 302) {
        request(res.headers.location, {
          headers: {
            'User-Agent': 'tessel',
            'Accept': 'application/octet-stream'
          },
          encoding: null,
          followRedirect: true
        }, function (err, res, body) {
          console.error(', done.');
          dfuRestoreFunc(body);
        });
      } else {
        console.error(', done.');
        dfuRestoreFunc(body);
      }
    });
  }

  function dfuRestoreFunc (body) {
    require('../dfu/tessel-dfu').write(body)
  }
} else if (process.argv[2] == 'list') {
  tesselClient.listDevices(function (err, devices) {
    devices.map(function (device) {
      console.log(device.serialNumber);
    });
  })
} else if (process.argv[2] == 'check') {
  dumpBinary(process.argv[3]);
} else {
  header.init();

  if (argv.r) {
    setImmediate(function () {
      console.log('listening...'.grey);
    })
    var args = argv.r.split(':');
    host = args[0];
    port = args[1] || 4444;
    onconnect('[' + host + ':' + port + ']', port, host);
  } else {
    tesselClient.findTessel(null, onconnect)
  }
}

function onconnect (err, client) {
  if (!client) {
    console.error('Error: Cannot connect to Tessel locally.', err);
    return;
  }

  header.connected(client.serialNumber);

  client.listen();
  client.receiveMessages();

  if (process.argv[2] == 'push' || process.argv[2] == 'repl' || process.argv[2].match(/^blinky?/)) {
    // Push new code to the device.
    if (process.argv[2] == 'push') {
      if (process.argv.length < 4) {
        usage();
        process.exit(1);
      } 

      var pushpath = process.argv[3];
    } else if (process.argv[2] == 'repl') {
      var pushpath = __dirname + '/../scripts/repl';
    } else if (process.argv[2].match(/^blinky?/)) {
      var pushpath = __dirname + '/../scripts/blink';
    }

    var args = [];
    var options = {
      save: false,
      binary: false,
      compress: false,
      tar: false,
      flash: false,
    };

    // for all the process args
    for (var i = 2; i<process.argv.length; i++){
      switch(process.argv[i])
      {
      case '-a' :
      case '--args':
        // TODO: only supports 1 argument right now
        args = process.argv.slice(i+1);
        break;
      case '-s' :
      case '--save':
        options.save = true;
        break;
      case '-b' :
      case '--binary':
        console.log("\nuploading binary", process.argv.slice(i+1));
        pushBinary(process.argv.slice(i+1)[0], client);
        options.binary = true;
        break;
      case '-c' :
      case '--compress':
        console.log("\ncompressing and uploading dir", process.argv.slice(i+1)[0]);
        zipCode(process.argv.slice(i+1)[0], client);
        options.compress = true;
        break;
      case '-t' :
      case '--tar':
        console.error(("\nuploading tarball", process.argv.slice(i+1)[0]).grey);
        options.tar = true;
        pushTar(process.argv.slice(i+1)[0], client, options);
        break;
      case '-f' :
      case '--flash':
        options.flash = true;
        break;
      default:
        break;
      }
    }

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
      // Pipe output to client
      while (null !== (chunk = client.stdout.read())) {
        // Flush
      }
      client.stdout.pipe(process.stdout);

      // Repl hack
      if (process.argv[2] == 'repl') {
        function cool () {
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
                = 'local function _run ()\n' + colony.colonize(data, { returnLastStatement: true, wrap: false }) + '\nend\nsetfenv(_run, colony.global);\nreturn _run()';
              client.command('M', new Buffer(JSON.stringify(script)));
              client.once('message', function (ret) {
                console.log(ret.ret);
                setImmediate(cool);
              })
            } catch (e) {
              console.error(e.stack);
              setImmediate(cool);
            }
          });
        }
        client.once('message', cool);
      }

      client.once('script-stop', function (code) {
        client.end();
        process.exit(code);
      });
    });

    if (!options.binary && !options.compress && !options.tar) {
      pushCode(pushpath, ['tessel', process.argv[3]].concat(args), client, options);
    }
    
  } else if (process.argv[2] == 'stop') {
    client.stop(function () {
      client.end();
    });

  } else if (process.argv[2] == 'erase') {
    client.erase(function () {
      // client.end();
    });

  } else if (process.argv[2] == 'debug-stack') {
    setTimeout(function () {
      console.log('Requesting stack trace from Tessel...'.grey);
    }, 10)
    client.command('K', new Buffer([0xff, 0xff, 0xff, 0xff]));
    client.on('command', function (kind, data) {
      if (kind == 'k') {
        data = String(data);
        var out = data.replace(/(---|###)\s*$/, '');
        if (out) {
          console.log(out);
        }
        if (data.match(/---\s*$/)) {
          console.error('Not running.');
          process.exit(1);
        } else if (data.match(/###\s*$/)) {
          process.exit(0);
        }
      }
    })

  } else if (process.argv[2] == 'wifi') {
    if (argv._.length == 1) {
      // just request status
      client.on('command', function (command, data) {
        if (command == 'v') { // verbose wifi logs
          console.log(data);
        }
      })
      client.wifiStatus(function (err, data) {
        Object.keys(data).map(function (key) {
          console.log(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
        })
        process.exit(0);
      })

    } else {
      // if (argv._.length < 3) {
      //   usage();
      //   process.exit(1);
      // }

      function retry () {
        var ssid = argv._[1];
        var pass = argv._[2] || "";
        var security = (argv._[3] || (pass ? 'wpa2' : 'unsecure')).toLowerCase();

        // Only defer to make print after thing.
        client.once('connect', function () {
          console.log(('Network ' + JSON.stringify(ssid) + 
            ' (pass ' + JSON.stringify(pass) + ') with ' + security + ' security'));
        });

        // This is just for fun logs
        client.on('command', function listener (command, data) {
          if (command == 'w') {
            console.log(data);
          }
          if (command == 'W' && 'connected' in data) {
            client.removeListener('command', listener);
          }
        });

        client.configureWifi(ssid, pass, security, {
          timeout: argv.timeout || 8
        }, function (err) {
          if (err && !argv['no-retry']) {
            console.error('Retrying...');
            setImmediate(retry);
          } else {
            process.exit(err ? 1 : 0);
          }
        });
      }

      retry();
    }

  } else if (process.argv[2] == 'logs' || process.argv[2] == 'listen') {
    client.on('command', function (command, data, debug) {
      if (debug) {
        console.log(command.grey, data);
      }
    });

  } else if (process.argv[2] == 'verbose') {
    client.on('command', function (command, data, debug) {
      console.log(debug ? command.grey : command.red, data);
    });

  } else {
    usage();
    process.exit(1);
  }
}

// } else if (process.argv[2] == 'pushall'){
//   // listen for all possible 
//   var client = dgram.createSocket('udp4');
//   var addresses = [];
//   client.bind(5454, function() {
//     client.addMembership('224.0.1.187'); // hard coded for now
//   });
  
//   console.log(('listening for tessel devices...').yellow);

//   client.on('listening', function () {
//       var address = s.address();
//   });
  
//   client.on('message', function (message, remote) {   
//     if (addresses.indexOf(remote.address) == -1) {
//       addresses.push(remote.address);
//       console.log("found ip: " + remote.address);
//     } 
//     // console.log('B: From: ' + remote.address + ':' + remote.port +' - ' + message);
//   });

//   // timeout of 2 seconds
//   setTimeout(function () {
//     client.close();
//     console.log('pushing code to the following: ', addresses);
//     // push to all gathered ips
//     addresses.forEach(function(address){
//       var tClient = net.connect(port, address);
//       // tClient.on('connect', function () {
//       //   header.connected(modem);
//       // });
//       pushCode(address, tClient);
//     });
    
//   }, 2000);

// } else if (process.argv[2] == 'firmware') {
//   if (process.argv.length < 4) {
//     usage();
//     process.exit(1);
//   }

//   upload('F', client, fs.readFileSync(process.argv[3]));

// TCP
// if (process.argv[2] == 'remotepush') {
//   if (process.argv.length < 6) {
//     usage();
//     process.exit(1);
//   }

//   var filename = process.argv[3];
//   var ip = process.argv[4];
//   var port = process.argv[5];

//   var net = require('net');
//   var fs = require('fs');

//   compile(filename, false, function (luacode) {
//     console.log('Writing', luacode.length, 'bytes by TCP...');
//     var client = net.connect(port, ip, function () {
//       console.log('connected');
//       var sizebuf = new Buffer(4);
//       sizebuf.writeInt32LE(luacode.length, 0);
//       client.write(Buffer.concat([sizebuf, luacode]), function () {
//         console.log('written');
//         // client.end();
//       });
//     });
//     client.on('end', function () {
//       console.log('disconnected');
//     });
//   });
// } else {
// }

// Interactive.
// handshake(modem, function (serial) {
//   if (process.argv[2] == '-i') {
//     console.log('[connected]'.grey);

//     repl.start({
//       prompt: "",
//       input: process.stdin,
//       output: process.stdout,
//       ignoreUndefined: true,
//       eval: function eval(cmd, context, filename, callback) {
//         cmd = cmd.replace(/^.|\n.$/g, '');
//         runeval(cmd, function () {
//           callback(null, undefined);
//         });
//       }
//     }).on('exit', function (code) {
//       process.exit(code);
//     })

//     // process.stdin.on('data', function (data) {

//     function runeval (data, next) {
//       fs.writeFileSync(path.join(__dirname, 'tmp', 'repl.js'), data);
//       compile(path.join(__dirname, 'tmp', 'repl.js'), true, function (luacode) {
//         if (luacode) {
//           upload(serial, luacode);
//           next();
//         } else {
//           process.stdout.write('> ');
//           next();
//         }
//       });
//     }

//     serial.once('data', function () {
//       console.log('global.board = require(\'tm\')');
//       runeval('global.board = require(\'tm\')', function () { });
//     })

//   } else {
//     compile(process.argv[2], false, function (luacode) {
//       upload(serial, luacode);
//     });
//   }
// });
