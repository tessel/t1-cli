// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var fs  = require('fs');
var usb = require('usb');
var DFU = require('./dfu');
var Tessel = require('../src/tessel_usb').Tessel;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

function fixedWidth(num, len) {
    var s = num.toFixed(0);
    return '          '.slice(0, len - s.length) + s
}

function showStatus(pos, len) {
    var percent = fixedWidth(pos/len*100, 3);
    process.stdout.write("Writing: " + percent + "%  " + fixedWidth(pos,7) + " /" + fixedWidth(len,7) + '\r')
}

function findDevice() {
    return usb.findByIds(TESSEL_VID, TESSEL_PID);
}

function guessDeviceState(device) {
    if (!device) {
        return undefined;
    } else if (device.deviceDescriptor.bcdDevice>>8 === 0) {
        return 'dfu';
    } else {
        return 'app';
    }
}

/// Write `filename` to flash
exports.write = function(image, next) {
    exports.enterStage2(function(device) {
        var dfu = new DFU(device);
        dfu.claim(function(e) {
            if (e) throw e;
            dfu.dnload(image, function(error) {
                if (error) {
                    next && next(error);
                    return console.log(error);
                }
                process.stdout.write("\nDone! \n");
                next && next(null);
            }, showStatus);
        });
    });
}

exports.runRam = function(image, next) {
    exports.enterStage2(function(device) {
        var dfu = new DFU(device, 1);
        dfu.claim(function (e) {
            if (e) throw e;
            dfu.dnload(image, function(e) {
                if (e) throw e;
                process.stdout.write("\nDone! \n");
                next && next(null);
            }, showStatus);
        });
    });
}

function waitForBootloader(callback) {
    process.stdout.write("Waiting for bootloader....\n");

    var retrycount = 8;
    setTimeout(function retry (error) {
        var device = findDevice();
        state = guessDeviceState(device);
        if (state !== 'dfu') {
            if (--retrycount > 0) {
                if (device) {
                    device.__destroy(); // Workaround for https://github.com/libusb/libusb/issues/7
                }
                return setTimeout(retry, 1000)
            } else {
                console.error("Failed to load bootloader: found state", state);
                process.exit(2);
            }
        }
        callback(device);
    }, 1000);
}

/// Boot into stage2 and call `callback` with the resulting device
exports.enterStage2 = function(callback) {
    var device = findDevice();

    if (!device) {
        console.error("Could not find a Tessel connected by USB.");
        process.exit(1);
    }

    var state = guessDeviceState(device);

    if (state === 'app'){
        var t = new Tessel(device);
        t.rx = false;
        t.init(function() {
            t.claim(true, function(e) {
                if (e) throw e;
                t.enterBootloader();
                waitForBootloader(callback);
            })
        })
    } else if (state === 'dfu') {
        callback(device);
    }
}

exports.findDevice = findDevice;
exports.guessDeviceState = guessDeviceState;
