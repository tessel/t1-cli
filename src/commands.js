// Add command helpers to client.
var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var stream = require('stream');
var clone = require('structured-clone');

var tessel = require('./');
var prototype = tessel.Tessel.prototype;

prototype.initCommands = function () {
  var self = this;

  this.stdout = new stream.Readable();
  this.stdout._read = function () {
  };

  this.stderr = new stream.Readable();
  this.stderr._read = function () {
  };

  this.stdin = new stream.Writable();
  this.stdin._write = function (chunk, encoding, callback) {
    self.command('n', Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, encoding), callback);
  };

  // Interpret old-form commands, emit as events.
  this.on('command', function (command, data) {
    // Script status.
    if (command == 'S') {
      var code = parseInt(data);
      if (code > 0) {
        this.emit('script-start');
      } else {
        this.emit('script-stop', -code);
      }
    }

    // Wifi.
    if (command == 'W') {
      var packet = JSON.parse(data);
      this.emit('wifi-' + packet.event, packet);
      // console.log(packet);
    }

    // Ping / pong.
    if (command == 'G') {
      var packet = JSON.parse(data);
      this.emit('pong', packet);
    }
  });

  this.on('rawMessage', function (command, data) {
    if (String.fromCharCode(command&0xff) == 'M') {
      this.emit('message', clone.deserialize(data));
    }
  })
}

prototype.ping = function (next) {
  this.once('pong', next);
  this.command('G', new Buffer('ping'));
}


prototype.wifiStatus = function (next) {
  this.command('V', new Buffer([0xde, 0xad, 0xbe, 0xef]), function () {
    console.error('Requesting wifi status...'.grey);
  });

  this.on('command', function oncommand (command, data) {
    if (command == 'V') {
      this.removeListener('command', oncommand);
      next(null, JSON.parse(data));
    }
  });
}

prototype.configureWifi = function (ssid, pass, security, opts, next) {
  var self = this;

  typeof opts == 'function' && (next = opts);
  next == null && (opts = {});
  var timeout = opts.timeout || 20;

  var switching = false;
  self.once('wifi-status', function (data) {
    if (data.connected) {
      console.log('Disconnecting from current network...');
      self.once('wifi-disconnect', start);
      self.command('Y', new Buffer(4));
    } else {
      start();
    }
  });
  self.checkWifi(true);

  function start () {
    console.error('Connecting to "%s" with %s security...', ssid, security);
    (function timeoutloop () {
      var checkInterval = null;
      var acquiring = false;

      function onAcquire (packet) {
        // Polling animation
        acquiring = true;
        process.stderr.write('Acquiring IP address. ')
        var count = 0;
        var maxCount = timeout;

        checkInterval = setInterval(function(){
          count++;
          if (count >= maxCount){
            process.stderr.write(' timeout.\n');
            console.error('Retrying...');

            cleanup();
            setTimeout(timeoutloop, 1000);
          } else {
            process.stderr.write('.');
          }
        }, 1000);
      }

      function onConnect (packet) {
        if (acquiring) {
          process.stderr.write('\n');
        }
        cleanup();

        self.once('wifi-status', function (packet) {
          next(packet);
        })
      }

      function onError (packet) {
        cleanup();

        next(packet);
      }

      function cleanup () {
        if (checkInterval != null) {
          clearInterval(checkInterval);
        }
        self.removeListener('wifi-acquire', onAcquire);
        self.removeListener('wifi-connect', onConnect);
        self.removeListener('wifi-disconnect', onConnect);
        self.removeListener('wifi-error', onError);
      }

      self.once('wifi-acquire', onAcquire);
      self.once('wifi-connect', onConnect);
      self.once('wifi-disconnect', onConnect);
      self.once('wifi-error', onError);

      // Package Wifi arguments
      var outbuf = new Buffer(128);
      outbuf.fill(0);
      new Buffer(String(ssid)).copy(outbuf, 0, 0, ssid.length);
      new Buffer(String(pass)).copy(outbuf, 32, 0, pass.length);
      new Buffer(String(security)).copy(outbuf, 96, 0, security.length);
      self.command('W', outbuf);
    })();
  }
}

prototype.checkWifi = function(lastCheck){
  var outbuf = new Buffer([lastCheck ? 0x1 : 0x0]);
  this.command('C', outbuf);
}

// prototype.deploy = function (file, args, next) {
//   tessel.detectDirectory(file, function (err, dirpath, relpath) {
//     tessel.bundleCode(dirpath, relpath, args, function (err, tarstream) {
//       this.deployBundle(tarstream, {}, next);
//     });
//   });
// }

prototype.deployBundle = function (bundle, options, next) {
  this.stop(function () {
    next && this.once('script-start', next);
    this.command(options.flash?'P':'U', bundle);
  }.bind(this));
}

prototype.erase = function (next) {
  this.stop(function () {
    this.command('P', new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  }.bind(this));
}

prototype.deployBinary = function (file, next) {
  // open up the file
  var buffer = fs.readFileSync(file);
  next && this.once('script-start', next);
  this.command('U', buffer);
}

prototype.send = function (data) {
  this.command('M', clone.serialize(data));
};
