var choices = require('choices');
var net = require('net');
var carrier = require('carrier');
var portscanner = require('portscanner')
var spawn = require('child_process').spawn;
var fs = require('fs');
var libserialport = require('libserialport')
var path = require('path')
  , temp = require('temp')
  , colony = require('colony')
  , async = require('async')
  , fstream = require('fstream')
  , tar = require('tar')
  , osenv = require('osenv');

(function () {
  // We want to force node-tar to not use extended headers.
  var fn = require('tar/lib/header').encode;
  require('tar/lib/header').encode = function (obj) {
    var ret = fn(obj);
    obj.needExtended = false
    return ret;
  }
})();

var wrench = require('./wrench');


/**
 * tesel module
 */


var tessel = exports;


tessel.descriptors = {
  TESSEL_VID: 0x1d50, TESSEL_PID: 0x6097,
  TESSEL_OLD_VID: 0x1fc9, TESSEL_OLD_PID: 0x2002,
  NXP_ROM_VID: 0x1fc9, NXP_ROM_PID: 0x000c
};


tessel.connect = function (port, host)
{
  var client = net.connect(port, host);

  // Parse messages, crudely.
  carrier.carry(client, function (data) {
    data = String(data);
    var type = 's';
    if (data.match(/^\#\&/)) {
      type = data.charAt(2);
      data = data.substr(3);
    }
    if (type == type.toUpperCase()) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new Error('Invalid command body from Tessel: ' + data);
      }
    }

    client.emit('command', type, data, type == type.toLowerCase());
  });

  client.command = function (type, buf, next) {
    var sizebuf = new Buffer(5);
    sizebuf.writeUInt8(type.charCodeAt(0), 0);
    sizebuf.writeInt32LE(buf.length, 1);
    this.write(Buffer.concat([sizebuf, buf]), function () {
      next && next();
    });
  };

  require('./commands').apply(client);
  
  return client;
}


tessel.connectServer = function (modem, next)
{
  portscanner.checkPortStatus(6540, 'localhost', function (err, status) {
    if (status != 'open') {
      var child = spawn(process.argv[0], [__dirname + '/server.js', modem], {
        stdio: [0, 1, 2, 'ipc'],
        // detached: true
      });
      child.on('error', function (err) {
        console.log(err);
        next(err);
      })
      child.on('message', function (m) {
        if (m.ready) {
          child.once('disconnect', function () {
            next(null, 6540);
          });
          child.disconnect()
        }
      });
    } else {
      next(null, 6540);
    }
  });
}


tessel.detectModems = function (next)
{
  libserialport.list(function (err, ports) {
    next(err, ports && ports.filter(function (port) {
      // Remove the following line once everyone has updated their firmware
      if (port.vendorId == tessel.descriptors.TESSEL_VID && port.productId == tessel.descriptors.TESSEL_PID) {
        return true;
      }
      if (port.vendorId == tessel.descriptors.NXP_ROM_VID && port.productId == tessel.descriptors.NXP_ROM_PID) {
        return true;
      }
    }).map(function (port) {
      return port.path;
    }));
  });
}


tessel.selectModem = function detectDevice (notfound, next)
{
  tessel.detectModems(function (err, modems) {
    if (modems.length == 0) {
      notfound();
      return setTimeout(detectDevice, 10, notfound, next);
    }

    if (modems.length > 1) {
      choices('Select a device: ', modems, function (i) {
        next(null, modems[i]);
      });
    } else {
      next(null, modems[0]);
    }
  });
}


tessel.acquire = function (modem, next)
{
  if (!next || !modem) {
    if (!next) {
      next = modem;
      modem = null;
    }

    tessel.selectModem(function () {
      // none found, wait
    }, onfound);
  } else {
    onfound(null, modem);
  }

  function onfound (err, modem) {
    tessel.connectServer(modem, function (err, port) {
      next(err, tessel.connect(port));
    });
  }
}


tessel.bundleFiles = function (startpath, args, files, next)
{
  temp.mkdir('colony', function (err, dirpath) {
    var mkdirp = require('mkdirp');
    Object.keys(files).forEach(function (filename) {
      mkdirp.sync(path.join(dirpath, 'app', path.dirname(filename)));
      fs.writeFileSync(path.join(dirpath, 'app', filename), fs.readFileSync(files[filename], 'binary'), 'binary');
    })

    var stub
      = 'process.env.DEPLOY_IP = ' + JSON.stringify(require('my-local-ip')()) + ';\n'
      + 'process.argv = ' + JSON.stringify(args) + ';\n'
      + 'process.send = function (a) { console.log("#&M" + JSON.stringify(a)); };\n'
      + 'require(' + JSON.stringify('./app/' + startpath) + ');';
    fs.writeFileSync(path.join(dirpath, '_start.js'), stub);

    var docompile = [];

    wrench.readdirRecursive(path.join(dirpath), function (err, curFiles) {
      // console.log(curFiles);
      if (!curFiles) {
        afterColonizing();
        return;
      }
      curFiles.forEach(function (f) {
        // console.log("current file", f);
        if (f.match(/\.js$/)) {
          try {
            var res = colony.colonize(fs.readFileSync(path.join(dirpath, f), 'utf-8'));
            fs.writeFileSync(path.join(dirpath, f), res);
            docompile.push([f, path.join(dirpath, f)]);
          } catch (e) {
            e.filename = f.substr(4);
            console.log('Syntax error in', f, ':\n', e);
            process.exit(1);
          }
        }
      })
    });

    var compileBytecode = true;

    function afterColonizing () {
      // compile with compile_lua
      async.each(docompile, function (f, next) {
        if (!compileBytecode) {
          next(null);
        } else {
          try {
            colony.toBytecode(fs.readFileSync(f[1], 'utf-8'), '/' + f[0].split(path.sep).join('/'), function (err, res) {
              !err && fs.writeFileSync(f[1], res);
              next(err);
            });
          } catch (e) {
            console.log('ERR'.red, 'Compilation process failed for the following file:');
            console.log('ERR'.red, ' ', f[0].replace(/^[^/]+/, '.'))
            console.log('ERR'.red, 'This is a compilation bug! Please file an issue at');
            console.log('ERR'.red, 'https://github.com/tessel/beta/issues with this text');
            console.log('ERR'.red, 'and a copy of the file that failed to compile.')
            process.exit(1);
          }
        }

      }, function (err) {
        tessel.tarCode(dirpath, '', next);
      });
    }
  });
};


// TODO should not be public,
// relied on by debug push code path
tessel.tarCode = function (dirpath, pushdir, next)
{
  var fstr = fstream.Reader({path: dirpath, type: "Directory"})
  fstr.basename = '';

  fstr.on('entry', function (e) {
    e.root = {path: e.path};
  })

  fstr.on('error', function (err) {
    console.error('Error bundling code archive: ' + err);
    process.exit(1);
  })

  var bufs = [];
  var p = tar.Pack();
  p._noProprietary = true;
  fstr.pipe(p).on('data', function (buf) {
    bufs.push(buf);
  }).on('end', function () {
    var bundle = Buffer.concat(bufs);

    var hasIndex = false;
    var p = tar.Parse().on('entry', function (a) {
      if (a.path == '_start.js') {
        hasIndex = true;
      }
    }).on('end', function () {
      if (!hasIndex) {
        console.error('ERR'.red, 'Command line generated bundle without an /_start.js file. Please report this error.');
        process.exit(1);
      }

      next(null, bundle);
    })
    p.write(bundle);
    p.end();
  }).on('error', function (err) {
    console.error('ERR'.red, 'Error in compressing code archive: ' + err);
    process.exit(1);
  });
}