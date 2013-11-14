#DFU OpenSec

This uses dfu-util to upload firmware over usb for OSX and Linux. Current implementation is hacky but will work.

## Requirements
* [DFU Util](http://dfu-util.gnumonks.org/)
* OSX/Linux

## Usage

1. Bridge the two pins by Tessel's RAM
2. Plug Tessel into USB port
3. Hit the Reset button
4. 
```
node binGenerator.js <new_firmware.bin>
./dfu-runner-<new_firmware>.sh
```
5. Remove the bridge between the two pins
6. Hit Reset. New firmware should now be working.