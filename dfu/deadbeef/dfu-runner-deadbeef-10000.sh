rm *-res.bin
dfu-util -D iram_dfu_util_any.bin.hdr
sleep 4s
dfu-util -U iram-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('iram-res.bin', 'utf8'));"
dfu-util -D cmd1.bin -t 16
dfu-util -U cmd1-res.bin -t 80
dfu-util -D cmd2.bin -t 16
dfu-util -U cmd2-res.bin -t 80
dfu-util -D deadbeef-10000-erase.bin -t 16
sleep 2s
dfu-util -U deadbeef-10000-erase-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-erase-res.bin', 'utf8'));"
dfu-util -D deadbeef-10000-0-write.bin -t 16
dfu-util -D deadbeef-10000-0.bin -t 2048
dfu-util -U deadbeef-10000-0-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-0-res.bin', 'utf8'));"
dfu-util -D deadbeef-10000-1-write.bin -t 16
dfu-util -D deadbeef-10000-1.bin -t 2048
dfu-util -U deadbeef-10000-1-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-1-res.bin', 'utf8'));"
dfu-util -D deadbeef-10000-2-write.bin -t 16
dfu-util -D deadbeef-10000-2.bin -t 2048
dfu-util -U deadbeef-10000-2-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-2-res.bin', 'utf8'));"
dfu-util -D deadbeef-10000-3-write.bin -t 16
dfu-util -D deadbeef-10000-3.bin -t 2048
dfu-util -U deadbeef-10000-3-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-3-res.bin', 'utf8'));"
dfu-util -D deadbeef-10000-4-write.bin -t 16
dfu-util -D deadbeef-10000-4.bin -t 1808
dfu-util -U deadbeef-10000-4-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('deadbeef-10000-4-res.bin', 'utf8'));"