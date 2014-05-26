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

  this.on('command', function (command, data) {
    if (command == 'S') {
      var code = parseInt(data);
      if (code > 0) {
        this.emit('script-start');
      } else {
        this.emit('script-stop', -code);
      }
    }
  });
  this.on('rawMessage', function (command, data) {
    if (String.fromCharCode(command&0xff) == 'M') {
      this.emit('message', clone.deserialize(data));
    }
  })
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
  typeof opts == 'function' && (next = opts);
  next == null && (opts = {});
  var checkInterval;
  this.on('command', function oncommand (command, data) {
    data = JSON.parse(data)
    if (command == 'W' && data.hasOwnProperty('ip')) {
      this.removeListener('command', oncommand);
      clearInterval(checkInterval);
      next(data);
    } else if (command == 'W' && data.hasOwnProperty('acquiring')){
      // now do some periodic checks
      var count = 0;
      var maxCount = 8;
      var self = this;
      checkInterval = setInterval(function(){
        console.log("...");
        count++;
        if (count >= maxCount){
          self.checkWifi(true);
          clearInterval(checkInterval);
        } else {
          self.checkWifi(false);
        }
      }, opts.timeout/8 * 1000);
    }
  });

  // Package Wifi arguments
  var outbuf = new Buffer(128);
  outbuf.fill(0);
  new Buffer(String(ssid)).copy(outbuf, 0, 0, ssid.length);
  new Buffer(String(pass)).copy(outbuf, 32, 0, pass.length);
  new Buffer(String(security)).copy(outbuf, 96, 0, security.length);
  this.command('W', outbuf);
  
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
