var usb = require('usb');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var REQ_FW_STATUS = 0x01;

var DEBUG_INTF = 0;

var MSG_INTF   = 1;
var REQ_RESET_MSG_STATE = 0x01;
var REQ_STOP_APP = 0x11;

var RECIPIENT_VENDOR_INTERFACE = usb.LIBUSB_RECIPIENT_INTERFACE|usb.LIBUSB_REQUEST_TYPE_VENDOR;

function Tessel(dev) {
	this.usb = dev;
}

exports.Tessel = Tessel;

util.inherits(Tessel, EventEmitter);

Tessel.prototype.init = function init(next) {
	var self = this;
	this.usb.open();
	this.initCommands();

	this.usb.getStringDescriptor(this.usb.deviceDescriptor.iSerialNumber, function (error, data) {
		if (error) return next(error);
		self.serialNumber = data;
		next(null, self);
	})
}

Tessel.prototype.close = function close() {
	this.usb.close();
}

Tessel.prototype.listen = function listen(colors, logLevel) {
	var intf = this.usb.interface(DEBUG_INTF);
	intf.claim();
	intf.setAltSetting(1, function(error) {
		if (error) throw error;
		var ep_debug = intf.endpoints[0];

		ep_debug.startStream(2, 4096);
		ep_debug.on('data', function(data) {
			// Log level is wrapped with ASCII SOH STX. Throw it away for now
			data = data.toString().replace(/\x01(.)\x02/g, '')
			process.stdout.write(data);
		});
	});
}

// TODO: move this to usb module
usb.OutEndpoint.prototype.transfer_with_zlp = function (buf, cb) {
	if (buf.length % this.descriptor.wMaxPacketSize == 0) {
		this.transfer(buf);
		this.transfer(new Buffer(0), cb);
	} else {
		this.transfer(buf, cb);
	}
}

Tessel.prototype.postMessage = function postMessage(tag, buf, cb) {
	var intf = this.usb.interface(MSG_INTF);
	intf.claim();

	var header = new Buffer(8);
	header.writeUInt32LE(buf.length, 0);
	header.writeUInt32LE(tag, 4);
	var data = Buffer.concat([header, buf]);

	var msg_out_endpoint = intf.endpoints[1];
	msg_out_endpoint.transfer_with_zlp(data, function(error) {
		cb && cb(error);
	});
}

Tessel.prototype.command = function command(cmd, buf) {
	this.postMessage(0x01000000 | cmd.charCodeAt(0), buf);
}

Tessel.prototype.receiveMessages = function listenForMessages() {
	var self = this;
	var intf = this.usb.interface(MSG_INTF);
	intf.claim();

	var transferSize = 4096;
	var msg_in_endpoint = intf.endpoints[0];
	msg_in_endpoint.startStream(2, transferSize);

	var buffers = [];
	msg_in_endpoint.on('data', function(data) {
		buffers.push(data);
		if (data.length < transferSize) {
			var first = buffers.shift();
			buffers.unshift(first.slice(8)); // Remove header
			var tag = first.readUint32LE(4);

			self.emit('rawMessage', tag, Buffer.concat(buffers));

			// backwards compatibility
			if (tag >> 24 == 0x01) {
				self.emit('command', tag&0xff, buf);
			}

			buffers = [];
		}
	});
};

// TODO: multiple device support (by serial number)
exports.findTessel = function findTessel(next) {
	var dev = usb.findByIds(TESSEL_VID, TESSEL_PID);
	if (dev) {
		var tessel = new Tessel(dev);
		tessel.init(next);
	} else {
		setImmediate(next);
	}
}
