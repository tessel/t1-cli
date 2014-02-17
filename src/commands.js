// Add command helpers to client.
var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var stream = require('stream');

var tessel = require('./');

exports.apply = function (client) {

  client.stdout = new stream.Duplex();
  client.stdout._read = function () {
  };
  client.stdout._write = function (data, encoding, next) {
    this.push(data);
    this.push('\n');
    next(null);
  };

  client.on('command', function (command, data) {
    // console.log('command', command, data);
    if (command == 'S') {
      var code = parseInt(data);
      if (code > 0) {
        client.emit('script-start');
      } else {
        client.emit('script-stop', -code);
      }
    } else if (command == 's') {
      client.stdout.write(data);
    } else if (command == 'M') {
      client.emit('message', data);
    }
  })

  client.wifiStatus = function (next) {
    client.command('V', new Buffer([0xde, 0xad, 0xbe, 0xef]), function () {
      console.error('Requesting wifi status...'.grey);
    });

    client.on('command', function oncommand (command, data) {
      if (command == 'V') {
        client.removeListener('command', oncommand);
        next(null, data);
      }
    });
  }

  client.configureWifi = function (ssid, pass, security, opts, next) {
    typeof opts == 'function' && (next = opts);
    next == null && (opts = {});

    client.on('command', function oncommand (command, data) {
      if (command == 'W' && 'ip' in data) {
        client.removeListener('command', oncommand);
        next(!data.connected, data);
      }
    });

    // Package Wifi arguments
    var outbuf = new Buffer(129);
    outbuf.fill(0);
    new Buffer(String(ssid)).copy(outbuf, 0, 0, ssid.length);
    new Buffer(String(pass)).copy(outbuf, 32, 0, pass.length);
    new Buffer(String(security)).copy(outbuf, 96, 0, security.length);
    new Buffer([opts.timeout || 8]).copy(outbuf, 128, 0, 1);

    client.command('W', outbuf);
  }

  client.deploy = function (file, args, next) {
    tessel.detectDirectory(file, function (err, dirpath, relpath) {
      tessel.bundleCode(dirpath, relpath, args, function (err, tarstream) {
        client.deployBundle(tarstream, {}, next);
      });
    });
  }

  client.deployBundle = function (bundle, options, next) {
    if (options.save){
      fs.writeFileSync("builtin.tar", bundle);
      console.log("wrote builtin.tar");
    }
    
    next && client.once('script-start', next);
    client.command(options.flash?'P':'U', bundle);
  }

  client.erase = function (next) {
    this.command('P', new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  }

  client.stop = function (next) {
    this.command('X', new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  }

  client.deployBinary = function (file, next) {
    // open up the file
    var buffer = fs.readFileSync(file);
    next && client.once('script-start', next);
    this.command('U', buffer);
  }

  client.send = function (data) {
    this.command('M', new Buffer(JSON.stringify(data)));
  };
}