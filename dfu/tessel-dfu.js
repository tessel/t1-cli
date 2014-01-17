var fs  = require('fs');
var usb = require('usb');
var DFU = require('./dfu');

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var NXP_ROM_VID = 0x1fc9;
var NXP_ROM_PID = 0x000c;

function fixedWidth(num, len) {
    var s = num.toFixed(0);
    return '          '.slice(0, len - s.length) + s
}

function showStatus(pos, len) {
    var percent = fixedWidth(pos/len*100, 3);
    process.stdout.write("Writing flash: " + percent + "%  " + fixedWidth(pos,7) + "/" + fixedWidth(pos,7) + '\r')
}

function findDevice() {
    return usb.findByIds(TESSEL_VID, TESSEL_PID) || usb.findByIds(NXP_ROM_VID, NXP_ROM_PID);
}

function guessDeviceState(device) {
    if (!device) {
        return undefined;
    } else if (device.configDescriptor.bmAttributes === 0xC0) {
        // The DFU ROM claims it is self-powered.
        return 'rom';
    } else if (device.deviceDescriptor.bcdDevice === 0x0001) {
        return 'dfu';
    } else {
        return 'app';
    }
}

exports.flashTessel = function(fw_image_filename) {
    var device = findDevice();

    if (!device) {
        console.error("No Tessel found");
        process.exit(1);
    }

    var state = guessDeviceState(device);

    if (state === 'app'){
        console.error("Tessel is not in DFU mode.");
        console.error("Connect the pins above the TESSEL logo together and press the reset button");
        process.exit(1);
    } else if (state === 'rom') {
        bootload();
    } else if (state === 'dfu') {
        stage2();
    }

    function bootload() {
        var dfu = new DFU(device);

        // This file is compiled in the boot/ directory of the Tessel firmware source
        var image = fs.readFileSync(__dirname + '/stage2.bin');

        var header = new Buffer(16);
        header.fill(0)
        header.writeUInt8(0xda, 0);
        header.writeUInt8(0xff, 1);
        header.writeUInt16LE(Math.floor(image.length / 512)+1, 2);
        header.writeUInt32LE(0xFFFFFFFF, 12)

        process.stdout.write("Loading flash bootloader...\n");
        dfu.dnload(Buffer.concat([header, image]), function(error) {
            process.stdout.write("Waiting for bootloader....\n");
            setTimeout(function() {
                device = findDevice();
                state = guessDeviceState(device);
                if (state !== 'dfu') {
                    console.error("Failed to load bootloader: found state "+ state);
                    process.exit(2);
                }
                stage2();
            }, 1000);
        });
    }

    function stage2_read() {
        var dfu = new DFU(device);
        dfu.upload(function(error, data){
            if (error) {
                return console.log('read error', error);
            }
            fs.writeFileSync('out.bin', data);
        });
    }

    function stage2() {
        var dfu = new DFU(device);
        var image = fs.readFileSync(fw_image_filename);

        dfu.dnload(image, function(error) {
            if (error) {
                return console.log(error);
            }
            process.stdout.write("\nDone! \n");
        }, showStatus);
    }
}