// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Add command helpers to client.
var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var stream = require('stream');
var clone = require('structured-clone')
  , logs = require('../src/logs')
  ;

var tessel = require('./');
var prototype = tessel.Tessel.prototype;

// Abstract raw command writing from JS API.
// Eventually this will correspond to the USB interface.
var commands = {
  disconnect: function (client, callback) {
    client.command('Y', new Buffer(4), callback);
  },
  connect: function (client, ssid, pass, security, callback) {
    // Package Wifi arguments
    var outbuf = new Buffer(128);
    outbuf.fill(0);
    new Buffer(String(ssid)).copy(outbuf, 0, 0, ssid.length);
    new Buffer(String(pass)).copy(outbuf, 32, 0, pass.length);
    new Buffer(String(security)).copy(outbuf, 96, 0, security.length);
    client.command('W', outbuf, callback);
  },
  writeStdin: function (client, buffer, callback) {
    client.command('n', buffer, callback);
  },
  ping: function (client, callback) {
    client.command('G', new Buffer('ping'), callback);
  },
  checkWifi: function (client, lastCheck, callback) {
    client.command('C', new Buffer([lastCheck ? 0x1 : 0x0]), callback);
  },
  uploadRam: function (client, bundle, callback) {
    client.command('U', bundle, callback);
  },
  uploadFlash: function (client, bundle, callback) {
    client.command('P', bundle, callback);
  },
  writeMessage: function (client, data, callback) {
    client.command('M', clone.serialize(data), callback);
  },
  requestWifiNetworksAndStatus: function (client, callback) {
    client.command('V', null, callback);
  },
  enterBootloader: function (client, callback) {
    client.command('B', null, callback);
  },
};

prototype.initCommands = function () {
  var self = this;

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
    }

    // Ping / pong.
    if (command == 'G') {
      var packet = JSON.parse(data);
      this.emit('pong', packet);
    }

    // Wifi list.
    if (command == 'V') {
      var packet = JSON.parse(data);
      this.emit('wifi-list', packet);
    }

    // process.send() message
    if (command == 'M') {
      this.emit('message', clone.deserialize(data));
    }

    // debug stack
    if (command == 'k') {
      this.emit('debug-stack', String(data));
    }
  });

  this.stdout = new stream.Readable();
  this.stdout._read = function () {
  };
  this.stdout.pause();

  this.stderr = new stream.Readable();
  this.stderr._read = function () {
  };
  this.stderr.pause();

  this.stdin = new stream.Writable();
  this.stdin._write = function (chunk, encoding, callback) {
    commands.writeStdin(self, Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, encoding), callback)
  };

  this.on('log', function (level, str) {
    if (level == 10 || level == 11 || level == 12) {
      self.stdout.push(str + '\n');
    }
    if (level == 13 || level == 22) {
      self.stderr.push(str + '\n');
    }
  });
}

prototype.enterBootloader = function (next) {
  this.command('B', next);
};

prototype.ping = function (opts, next) {
  if (typeof opts == 'function') {
    next = opts;
    opts = null;
  }
  opts = opts || {};
  opts.timeout = opts.timeout || 3000;

  var self = this;
  function ponghandler (data) {
    if (timeout) {
      clearTimeout(timeout);
      self.removeListener('pong', ponghandler);
      next(null, data);
    }
  }
  var timeout = setTimeout(function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      next(new Error('timeout occurred after ' + (opts.timeout / 1000) + ' seconds!'), null);
    }
  }, opts.timeout)
  self.once('pong', ponghandler);
  commands.ping(self);
}

prototype.wifiStatus = function (next) {
  commands.requestWifiNetworksAndStatus(this, function () {
    logs.info('Requesting wifi status...'.grey);
  });

  this.once('wifi-list', function (list) {
    next(null, list);
  });
}

prototype.wifiErase = function (next) {
  this.command('D', new Buffer('erase'), function(){
    console.error('Erasing saved wifi profiles'.grey);
  });

  this.on('command', function oncommand (command,data) {
    if (command == 'D'){
      this.removeListener('command', oncommand);
      if (Number(data) < 0) {
        next(data);
      } else {
        next(null);
      } 
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
      logs.info('Disconnecting from current network...');
      self.once('wifi-disconnect', start);
      commands.disconnect(self);
    } else {
      start();
    }
  });
  self.checkWifi(true);

  function start () {
    logs.info('Connecting to "%s" with %s security...', ssid, security);
    (function timeoutloop () {
      var checkInterval = null;
      var acquiring = false;

      function onAcquire (packet) {
        // Polling animation
        acquiring = true;
        logs.info('Acquiring IP address. ')
        var count = 0;
        var maxCount = timeout;

        checkInterval = setInterval(function(){
          count++;
          if (count >= maxCount){
            process.stderr.write(' timeout.\n');
            logs.info('Retrying...');

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

      commands.connect(self, ssid, pass, security);
    })();
  }
}

prototype.checkWifi = function(lastCheck){
  commands.checkWifi(this, lastCheck);
};

prototype.deployBundle = function (bundle, options, next) {
  var self = this;
  self.stop(function () {
    next && self.once('script-start', next);
    if (options.flash) {
      commands.uploadFlash(self, bundle);
    } else {
      commands.uploadRam(self, bundle);
    }
  });
};

prototype.erase = function (next) {
  var self = this;
  self.stop(function () {
    commands.uploadFlash(self, new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  });
}

prototype.send = function (data) {
  commands.writeMessage(this, data);
};
