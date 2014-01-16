var fs  = require('fs')
var DFU = require('./dfu');

function fixedWidth(num, len) {
    var s = num.toFixed(0);
    return '          '.slice(0, len - s.length) + s
}

function showStatus(pos, len) {
    var percent = fixedWidth(pos/len*100, 3);
    process.stdout.write("Writing flash: " + percent + "%  " + fixedWidth(pos,7) + "/" + fixedWidth(pos,7) + '\r')
}

exports.flashTessel = function(fw_image_filename) {
    // Connect to the NXP ROM DFU bootloader and give it an image that can write to flash
    try {
        var dfu = new DFU(0x1fc9, 0x000c);
    } catch (e) {
        // If it's not found, maybe our stage2 is already running
        return stage2();
    }

    // This file is compiled in the boot/ directory of the Tessel firmware source
    var image = fs.readFileSync(__dirname + '/stage2.bin');

    var header = new Buffer(16);
    header.fill(0)
    header.writeUInt8(0xda, 0);
    header.writeUInt8(0xff, 1);
    header.writeUInt16LE(Math.floor(image.length / 512)+1, 2);
    header.writeUInt32LE(0xFFFFFFFF, 12)

    process.stdout.write("Loading flash bootloader...\n")
    dfu.dnload(Buffer.concat([header, image]), function(error) {
        process.stdout.write("Waiting for bootloader....\n");
        setTimeout(stage2, 1000);
    });

    function stage2_read() {
        var dfu = new DFU(0x1fc9, 0x0089);
        dfu.upload(function(error, data){
            if (error) {
                return console.log('read error', error);
            }
            fs.writeFileSync('out.bin', data);
        });
    }

    function stage2() {
        var dfu = new DFU(0x1fc9, 0x0089);

        var image = fs.readFileSync(fw_image_filename);

        dfu.dnload(image, function(error) {
            if (error) {
                return console.log(error);
            }
            process.stdout.write("\nDone! \n");
        }, showStatus);
    }
}