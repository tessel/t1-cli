// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var usb = 'MOCK_USB' in process.env ? {} : require('usb');
var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var REQ_INFO = 0x00;
var REQ_KILL = 0x10;
var REQ_STACK_TRACE = 0x11;
var REQ_WIFI = 0x20;
var REQ_CC = 0x21;

var VENDOR_REQ_OUT = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_OUT;
var VENDOR_REQ_IN  = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_IN;


var usb_debug = parseInt(process.env.TESSEL_USB_DEBUG, 10);
if (usb_debug) {
  console.log("USB debug level", usb_debug);
  usb.setDebugLevel(usb_debug);
}


function Tessel(dev) {
  this.usb = dev;
  this.rx = true;
}

exports.Tessel = Tessel;

util.inherits(Tessel, EventEmitter);

Tessel.prototype.init = function init(next) {
  var self = this;
  try {
    this.usb.open();
  } catch (e) {
    if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
      console.error("Please run `sudo tessel install-drivers` to fix device permissions.\n(Error: could not open USB device.)")
    }
    return next(e)
  }
  this.initCommands();

  this.logColors = true;
  this.logLevels = [];

  this.usb.getStringDescriptor(this.usb.deviceDescriptor.iSerialNumber, function (error, data) {
    if (error) return next(error);
    self.serialNumber = data;
    self._info(function(err, info) {
      if (err) return next(error);
      self.version = info;
      next(null, self);
    })
  })
}

Tessel.prototype.claim = function claim(stop, next) {
  // Runs the claiming procedure exactly once, and calls next after it has completed
  if (this.claimed === 'claimed') {
    // Already claimed
    if (stop) {
      this.stop(next);
    } else {
      return setImmediate(next);
    }
  }

  this.once('claimed', next);

  if (!this.claimed) {
    this.claimed = 'claiming';
    var self = this;
    self.intf = self.usb.interface(0);

    try {
      self.intf.claim();
    } catch (e) {
      if (e.message === 'LIBUSB_ERROR_BUSY') {
        e = "Device is in use by another process";
      }
      return next(e);
    }

    if (stop) {
      this.stop(step);
    } else {
      step();
    }
    
    function step() {
      // We use an alternate setting so it is automatically released if the program is killed
      self.intf.setAltSetting(1, function(error) {
        if (error) return next(error);
        self.log_ep = self.intf.endpoints[0];
        self.msg_in_ep = self.intf.endpoints[1];
        self.msg_out_ep = self.intf.endpoints[2];
        self.claimed = 'claimed';

        self.usb.timeout = 10000;

        if (self.rx) {
          self._receiveLogs();
          self._receiveMessages();
        }

        self.emit('claimed');
      });
    }
  }
}

Tessel.prototype.close = function close (next) {
  if (this.closed) {
    return next && next();
  }
  this.closed = true;

  this.intf.release(true, function (err) {
    this.usb.close();
    this.emit('close');
    next && next();
  }.bind(this));
}

Tessel.prototype.listen = function listen(colors, levels) {
  this.logColors = colors;
  this.logLevels = levels;
}

Tessel.prototype._receiveLogs = function _receiveLogs() {
  var self = this;
  self.log_ep.startStream(4, 4096);
  self.log_ep.on('data', function(data) {
    var pos = 0;
    while (pos < data.length) {
      if (data[pos] !== 1) { throw new Error("Expected STX at"+ pos +' ' + data[pos]) }
      var level = data[pos+1];
      
      for (var next=pos+2; next<data.length; next++) {
        if (data[next] === 1) {
          break;
        }
      }

      var str = data.toString('utf8', pos+2, next);

      if ((!self.logLevels && typeof self.logLevels != 'array') || self.logLevels.indexOf(level) != -1) {
        process.stdout.write(str + "\n");
      }

      self.emit('log', level, str);
      pos = next;
    }
  });
  self.log_ep.on('error', function(e) {
    console.error("Error reading USB log endpoint:", e);
    process.exit(-5);
  });
}

Tessel.prototype.postMessage = function postMessage(tag, buf, cb) {
  if (usb_debug) {
    console.log("USB TX: ", buf.length, tag.toString(16), buf);
  }

  var header = new Buffer(8);
  buf = buf || new Buffer(0);
  header.writeUInt32LE(buf.length, 0);
  header.writeUInt32LE(tag, 4);
  var data = Buffer.concat([header, buf]);

  var self = this;
  self.msg_out_ep.transferWithZLP(data, function(error) {
    if (error) {
      console.error("Error writing USB message endpoint", error);
      self.emit('error', error);
    }
    cb && cb(error);
  });
}

Tessel.prototype._receiveMessages = function _receiveMessages() {
  var self = this;

  var transferSize = 4096;
  self.msg_in_ep.startStream(2, transferSize);

  var buffers = [];
  self.msg_in_ep.on('data', function(data) {
    buffers.push(data);
    if (data.length < transferSize) {
      var b = Buffer.concat(buffers);
      if (b.length > 0) {
        var len = b.readUInt32LE(0);
        var tag = b.readUInt32LE(4);
        b = b.slice(8);

        if (usb_debug) {
          console.log("USB RX: ", len, tag.toString(16), data);
        }

        // Emit messages.
        self.emit('rawMessage', tag, b);
        self.emit('rawMessage:' + ('0000' + tag.toString(16)).slice(-4), b);
      }

      buffers = [];
    } else if (buffers.length * transferSize > 32 * 1024 * 1024) {
      // The message wouldn't fit in Tessel's memory. It probably didn't mean to send this...
      throw new Error("Malformed message (oversize): " + buffers[0].toString('hex', 0, 8))
    }
  });

  self.msg_in_ep.on('error', function(e) {
    console.error("Error reading USB message endpoint:", e);
    process.exit(-5);
  });
};

Tessel.prototype._info = function info(next) {
  this.usb.controlTransfer(VENDOR_REQ_IN, REQ_INFO, 0, 0, 512, function(error, data) {
    if (error) return next(error);
    next(null, JSON.parse(data.toString()));
  });
}

Tessel.prototype.stop = function stop(next) {
  this.usb.controlTransfer(VENDOR_REQ_OUT, REQ_KILL, 0, 0, new Buffer(0), next);
}

Tessel.prototype.debugstack = function stop(next) {
  this.usb.controlTransfer(VENDOR_REQ_IN, REQ_STACK_TRACE, 0, 0, 16, function(err, buf) {
    if (err) return callNext(err);

    var r = buf.readInt8(0);
    if (r != 0) return callNext(null, false);
    // otherwise, wait for the message
  });

  this.once('debug-stack', function (stack) {
    next(null, stack)
  })
}

Tessel.prototype.wifiIP = function (next) {
  this.usb.controlTransfer(VENDOR_REQ_IN, REQ_WIFI, 0, 0, 4, function(error, data) {
    var ip = data[0]+"."+data[1]+"."+data[2]+"."+data[3];
    if (error) return next(error);
    next(null, ip);
  });
}

Tessel.prototype.wifiVer = function (next) {
  this.usb.controlTransfer(VENDOR_REQ_IN, REQ_CC, 0, 0, 2, function(error, data) {
    var version = data[0]+"."+data[1];
    if (error) return next(error);
    next(null, version);
  });
}

exports.findTessel = function findTessel(desiredSerial, stop, next) {
  if (typeof stop === 'function' && typeof next === 'undefined') {
    next = stop;
    stop = false;
  }

  exports.listDevices(function (err, devices) {
    if (err) return next(err);

    for (var i=0; i<devices.length; i++) {
      if (!desiredSerial || desiredSerial == devices[i].serialNumber) {
        devices[i].claim(stop, function(err) {
          if (err) return next(err);
          return next(null, devices[i]);
        });
        return;
      }
    }

    return next(desiredSerial?"Device not found.":"No devices found.", null);
  });
}

exports.listDevices = function listDevices(next) {
  var devices = usb.getDeviceList().map(function(dev) {
    if ((dev.deviceDescriptor.idVendor == TESSEL_VID) && (dev.deviceDescriptor.idProduct == TESSEL_PID)) {
      if (dev.deviceDescriptor.bcdDevice >> 8 != 0) { // Exclude devices in bootloader mode
        return new Tessel(dev);
      }
    }
  }).filter(function(x) {return x});

  async.each(devices, function(dev, cb) { dev.init(cb) }, function(err) { next(err, devices)} );
}
