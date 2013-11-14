rm *-res.bin
dfu-util -D iram_dfu_util_any.bin.hdr
echo "Sleeping for 4 seconds so that usb can reboot"
sleep 4s
dfu-util -U iram-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('iram-res.bin', 'utf8'));"
dfu-util -D cmd1.bin -t 16
dfu-util -U cmd1-res.bin -t 80
dfu-util -D cmd2.bin -t 16
dfu-util -U cmd2-res.bin -t 80
dfu-util -D main-erase.bin -t 16
echo "Sleeping for 2 seconds until erase finishes"
sleep 2s
dfu-util -U main-erase-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-erase-res.bin', 'utf8'));"
dfu-util -D main-0-write.bin -t 16
dfu-util -D main-0.bin -t 2048
dfu-util -U main-0-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-0-res.bin', 'utf8'));"
echo "Done writing chunk #0"
dfu-util -D main-1-write.bin -t 16
dfu-util -D main-1.bin -t 2048
dfu-util -U main-1-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-1-res.bin', 'utf8'));"
echo "Done writing chunk #1"
dfu-util -D main-2-write.bin -t 16
dfu-util -D main-2.bin -t 2048
dfu-util -U main-2-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-2-res.bin', 'utf8'));"
echo "Done writing chunk #2"
dfu-util -D main-3-write.bin -t 16
dfu-util -D main-3.bin -t 2048
dfu-util -U main-3-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-3-res.bin', 'utf8'));"
echo "Done writing chunk #3"
dfu-util -D main-4-write.bin -t 16
dfu-util -D main-4.bin -t 2048
dfu-util -U main-4-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-4-res.bin', 'utf8'));"
echo "Done writing chunk #4"
dfu-util -D main-5-write.bin -t 16
dfu-util -D main-5.bin -t 2048
dfu-util -U main-5-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-5-res.bin', 'utf8'));"
echo "Done writing chunk #5"
dfu-util -D main-6-write.bin -t 16
dfu-util -D main-6.bin -t 2048
dfu-util -U main-6-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-6-res.bin', 'utf8'));"
echo "Done writing chunk #6"
dfu-util -D main-7-write.bin -t 16
dfu-util -D main-7.bin -t 2048
dfu-util -U main-7-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-7-res.bin', 'utf8'));"
echo "Done writing chunk #7"
dfu-util -D main-8-write.bin -t 16
dfu-util -D main-8.bin -t 2048
dfu-util -U main-8-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-8-res.bin', 'utf8'));"
echo "Done writing chunk #8"
dfu-util -D main-9-write.bin -t 16
dfu-util -D main-9.bin -t 2048
dfu-util -U main-9-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-9-res.bin', 'utf8'));"
echo "Done writing chunk #9"
dfu-util -D main-10-write.bin -t 16
dfu-util -D main-10.bin -t 2048
dfu-util -U main-10-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-10-res.bin', 'utf8'));"
echo "Done writing chunk #10"
dfu-util -D main-11-write.bin -t 16
dfu-util -D main-11.bin -t 2048
dfu-util -U main-11-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-11-res.bin', 'utf8'));"
echo "Done writing chunk #11"
dfu-util -D main-12-write.bin -t 16
dfu-util -D main-12.bin -t 2048
dfu-util -U main-12-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-12-res.bin', 'utf8'));"
echo "Done writing chunk #12"
dfu-util -D main-13-write.bin -t 16
dfu-util -D main-13.bin -t 2048
dfu-util -U main-13-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-13-res.bin', 'utf8'));"
echo "Done writing chunk #13"
dfu-util -D main-14-write.bin -t 16
dfu-util -D main-14.bin -t 2048
dfu-util -U main-14-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-14-res.bin', 'utf8'));"
echo "Done writing chunk #14"
dfu-util -D main-15-write.bin -t 16
dfu-util -D main-15.bin -t 2048
dfu-util -U main-15-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-15-res.bin', 'utf8'));"
echo "Done writing chunk #15"
dfu-util -D main-16-write.bin -t 16
dfu-util -D main-16.bin -t 2048
dfu-util -U main-16-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-16-res.bin', 'utf8'));"
echo "Done writing chunk #16"
dfu-util -D main-17-write.bin -t 16
dfu-util -D main-17.bin -t 2048
dfu-util -U main-17-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-17-res.bin', 'utf8'));"
echo "Done writing chunk #17"
dfu-util -D main-18-write.bin -t 16
dfu-util -D main-18.bin -t 2048
dfu-util -U main-18-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-18-res.bin', 'utf8'));"
echo "Done writing chunk #18"
dfu-util -D main-19-write.bin -t 16
dfu-util -D main-19.bin -t 2048
dfu-util -U main-19-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-19-res.bin', 'utf8'));"
echo "Done writing chunk #19"
dfu-util -D main-20-write.bin -t 16
dfu-util -D main-20.bin -t 2048
dfu-util -U main-20-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-20-res.bin', 'utf8'));"
echo "Done writing chunk #20"
dfu-util -D main-21-write.bin -t 16
dfu-util -D main-21.bin -t 2048
dfu-util -U main-21-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-21-res.bin', 'utf8'));"
echo "Done writing chunk #21"
dfu-util -D main-22-write.bin -t 16
dfu-util -D main-22.bin -t 2048
dfu-util -U main-22-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-22-res.bin', 'utf8'));"
echo "Done writing chunk #22"
dfu-util -D main-23-write.bin -t 16
dfu-util -D main-23.bin -t 2048
dfu-util -U main-23-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-23-res.bin', 'utf8'));"
echo "Done writing chunk #23"
dfu-util -D main-24-write.bin -t 16
dfu-util -D main-24.bin -t 2048
dfu-util -U main-24-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-24-res.bin', 'utf8'));"
echo "Done writing chunk #24"
dfu-util -D main-25-write.bin -t 16
dfu-util -D main-25.bin -t 2048
dfu-util -U main-25-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-25-res.bin', 'utf8'));"
echo "Done writing chunk #25"
dfu-util -D main-26-write.bin -t 16
dfu-util -D main-26.bin -t 2048
dfu-util -U main-26-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-26-res.bin', 'utf8'));"
echo "Done writing chunk #26"
dfu-util -D main-27-write.bin -t 16
dfu-util -D main-27.bin -t 2048
dfu-util -U main-27-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-27-res.bin', 'utf8'));"
echo "Done writing chunk #27"
dfu-util -D main-28-write.bin -t 16
dfu-util -D main-28.bin -t 2048
dfu-util -U main-28-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-28-res.bin', 'utf8'));"
echo "Done writing chunk #28"
dfu-util -D main-29-write.bin -t 16
dfu-util -D main-29.bin -t 2048
dfu-util -U main-29-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-29-res.bin', 'utf8'));"
echo "Done writing chunk #29"
dfu-util -D main-30-write.bin -t 16
dfu-util -D main-30.bin -t 2048
dfu-util -U main-30-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-30-res.bin', 'utf8'));"
echo "Done writing chunk #30"
dfu-util -D main-31-write.bin -t 16
dfu-util -D main-31.bin -t 2048
dfu-util -U main-31-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-31-res.bin', 'utf8'));"
echo "Done writing chunk #31"
dfu-util -D main-32-write.bin -t 16
dfu-util -D main-32.bin -t 2048
dfu-util -U main-32-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-32-res.bin', 'utf8'));"
echo "Done writing chunk #32"
dfu-util -D main-33-write.bin -t 16
dfu-util -D main-33.bin -t 2048
dfu-util -U main-33-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-33-res.bin', 'utf8'));"
echo "Done writing chunk #33"
dfu-util -D main-34-write.bin -t 16
dfu-util -D main-34.bin -t 2048
dfu-util -U main-34-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-34-res.bin', 'utf8'));"
echo "Done writing chunk #34"
dfu-util -D main-35-write.bin -t 16
dfu-util -D main-35.bin -t 2048
dfu-util -U main-35-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-35-res.bin', 'utf8'));"
echo "Done writing chunk #35"
dfu-util -D main-36-write.bin -t 16
dfu-util -D main-36.bin -t 2048
dfu-util -U main-36-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-36-res.bin', 'utf8'));"
echo "Done writing chunk #36"
dfu-util -D main-37-write.bin -t 16
dfu-util -D main-37.bin -t 2048
dfu-util -U main-37-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-37-res.bin', 'utf8'));"
echo "Done writing chunk #37"
dfu-util -D main-38-write.bin -t 16
dfu-util -D main-38.bin -t 2048
dfu-util -U main-38-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-38-res.bin', 'utf8'));"
echo "Done writing chunk #38"
dfu-util -D main-39-write.bin -t 16
dfu-util -D main-39.bin -t 2048
dfu-util -U main-39-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-39-res.bin', 'utf8'));"
echo "Done writing chunk #39"
dfu-util -D main-40-write.bin -t 16
dfu-util -D main-40.bin -t 2048
dfu-util -U main-40-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-40-res.bin', 'utf8'));"
echo "Done writing chunk #40"
dfu-util -D main-41-write.bin -t 16
dfu-util -D main-41.bin -t 2048
dfu-util -U main-41-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-41-res.bin', 'utf8'));"
echo "Done writing chunk #41"
dfu-util -D main-42-write.bin -t 16
dfu-util -D main-42.bin -t 2048
dfu-util -U main-42-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-42-res.bin', 'utf8'));"
echo "Done writing chunk #42"
dfu-util -D main-43-write.bin -t 16
dfu-util -D main-43.bin -t 2048
dfu-util -U main-43-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-43-res.bin', 'utf8'));"
echo "Done writing chunk #43"
dfu-util -D main-44-write.bin -t 16
dfu-util -D main-44.bin -t 2048
dfu-util -U main-44-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-44-res.bin', 'utf8'));"
echo "Done writing chunk #44"
dfu-util -D main-45-write.bin -t 16
dfu-util -D main-45.bin -t 2048
dfu-util -U main-45-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-45-res.bin', 'utf8'));"
echo "Done writing chunk #45"
dfu-util -D main-46-write.bin -t 16
dfu-util -D main-46.bin -t 2048
dfu-util -U main-46-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-46-res.bin', 'utf8'));"
echo "Done writing chunk #46"
dfu-util -D main-47-write.bin -t 16
dfu-util -D main-47.bin -t 2048
dfu-util -U main-47-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-47-res.bin', 'utf8'));"
echo "Done writing chunk #47"
dfu-util -D main-48-write.bin -t 16
dfu-util -D main-48.bin -t 2048
dfu-util -U main-48-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-48-res.bin', 'utf8'));"
echo "Done writing chunk #48"
dfu-util -D main-49-write.bin -t 16
dfu-util -D main-49.bin -t 2048
dfu-util -U main-49-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-49-res.bin', 'utf8'));"
echo "Done writing chunk #49"
dfu-util -D main-50-write.bin -t 16
dfu-util -D main-50.bin -t 2048
dfu-util -U main-50-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-50-res.bin', 'utf8'));"
echo "Done writing chunk #50"
dfu-util -D main-51-write.bin -t 16
dfu-util -D main-51.bin -t 2048
dfu-util -U main-51-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-51-res.bin', 'utf8'));"
echo "Done writing chunk #51"
dfu-util -D main-52-write.bin -t 16
dfu-util -D main-52.bin -t 2048
dfu-util -U main-52-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-52-res.bin', 'utf8'));"
echo "Done writing chunk #52"
dfu-util -D main-53-write.bin -t 16
dfu-util -D main-53.bin -t 2048
dfu-util -U main-53-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-53-res.bin', 'utf8'));"
echo "Done writing chunk #53"
dfu-util -D main-54-write.bin -t 16
dfu-util -D main-54.bin -t 2048
dfu-util -U main-54-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-54-res.bin', 'utf8'));"
echo "Done writing chunk #54"
dfu-util -D main-55-write.bin -t 16
dfu-util -D main-55.bin -t 2048
dfu-util -U main-55-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-55-res.bin', 'utf8'));"
echo "Done writing chunk #55"
dfu-util -D main-56-write.bin -t 16
dfu-util -D main-56.bin -t 2048
dfu-util -U main-56-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-56-res.bin', 'utf8'));"
echo "Done writing chunk #56"
dfu-util -D main-57-write.bin -t 16
dfu-util -D main-57.bin -t 2048
dfu-util -U main-57-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-57-res.bin', 'utf8'));"
echo "Done writing chunk #57"
dfu-util -D main-58-write.bin -t 16
dfu-util -D main-58.bin -t 2048
dfu-util -U main-58-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-58-res.bin', 'utf8'));"
echo "Done writing chunk #58"
dfu-util -D main-59-write.bin -t 16
dfu-util -D main-59.bin -t 2048
dfu-util -U main-59-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-59-res.bin', 'utf8'));"
echo "Done writing chunk #59"
dfu-util -D main-60-write.bin -t 16
dfu-util -D main-60.bin -t 2048
dfu-util -U main-60-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-60-res.bin', 'utf8'));"
echo "Done writing chunk #60"
dfu-util -D main-61-write.bin -t 16
dfu-util -D main-61.bin -t 2048
dfu-util -U main-61-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-61-res.bin', 'utf8'));"
echo "Done writing chunk #61"
dfu-util -D main-62-write.bin -t 16
dfu-util -D main-62.bin -t 2048
dfu-util -U main-62-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-62-res.bin', 'utf8'));"
echo "Done writing chunk #62"
dfu-util -D main-63-write.bin -t 16
dfu-util -D main-63.bin -t 2048
dfu-util -U main-63-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-63-res.bin', 'utf8'));"
echo "Done writing chunk #63"
dfu-util -D main-64-write.bin -t 16
dfu-util -D main-64.bin -t 2048
dfu-util -U main-64-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-64-res.bin', 'utf8'));"
echo "Done writing chunk #64"
dfu-util -D main-65-write.bin -t 16
dfu-util -D main-65.bin -t 2048
dfu-util -U main-65-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-65-res.bin', 'utf8'));"
echo "Done writing chunk #65"
dfu-util -D main-66-write.bin -t 16
dfu-util -D main-66.bin -t 2048
dfu-util -U main-66-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-66-res.bin', 'utf8'));"
echo "Done writing chunk #66"
dfu-util -D main-67-write.bin -t 16
dfu-util -D main-67.bin -t 2048
dfu-util -U main-67-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-67-res.bin', 'utf8'));"
echo "Done writing chunk #67"
dfu-util -D main-68-write.bin -t 16
dfu-util -D main-68.bin -t 2048
dfu-util -U main-68-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-68-res.bin', 'utf8'));"
echo "Done writing chunk #68"
dfu-util -D main-69-write.bin -t 16
dfu-util -D main-69.bin -t 2048
dfu-util -U main-69-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-69-res.bin', 'utf8'));"
echo "Done writing chunk #69"
dfu-util -D main-70-write.bin -t 16
dfu-util -D main-70.bin -t 2048
dfu-util -U main-70-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-70-res.bin', 'utf8'));"
echo "Done writing chunk #70"
dfu-util -D main-71-write.bin -t 16
dfu-util -D main-71.bin -t 2048
dfu-util -U main-71-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-71-res.bin', 'utf8'));"
echo "Done writing chunk #71"
dfu-util -D main-72-write.bin -t 16
dfu-util -D main-72.bin -t 2048
dfu-util -U main-72-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-72-res.bin', 'utf8'));"
echo "Done writing chunk #72"
dfu-util -D main-73-write.bin -t 16
dfu-util -D main-73.bin -t 2048
dfu-util -U main-73-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-73-res.bin', 'utf8'));"
echo "Done writing chunk #73"
dfu-util -D main-74-write.bin -t 16
dfu-util -D main-74.bin -t 2048
dfu-util -U main-74-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-74-res.bin', 'utf8'));"
echo "Done writing chunk #74"
dfu-util -D main-75-write.bin -t 16
dfu-util -D main-75.bin -t 2048
dfu-util -U main-75-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-75-res.bin', 'utf8'));"
echo "Done writing chunk #75"
dfu-util -D main-76-write.bin -t 16
dfu-util -D main-76.bin -t 2048
dfu-util -U main-76-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-76-res.bin', 'utf8'));"
echo "Done writing chunk #76"
dfu-util -D main-77-write.bin -t 16
dfu-util -D main-77.bin -t 2048
dfu-util -U main-77-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-77-res.bin', 'utf8'));"
echo "Done writing chunk #77"
dfu-util -D main-78-write.bin -t 16
dfu-util -D main-78.bin -t 2048
dfu-util -U main-78-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-78-res.bin', 'utf8'));"
echo "Done writing chunk #78"
dfu-util -D main-79-write.bin -t 16
dfu-util -D main-79.bin -t 2048
dfu-util -U main-79-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-79-res.bin', 'utf8'));"
echo "Done writing chunk #79"
dfu-util -D main-80-write.bin -t 16
dfu-util -D main-80.bin -t 2048
dfu-util -U main-80-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-80-res.bin', 'utf8'));"
echo "Done writing chunk #80"
dfu-util -D main-81-write.bin -t 16
dfu-util -D main-81.bin -t 2048
dfu-util -U main-81-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-81-res.bin', 'utf8'));"
echo "Done writing chunk #81"
dfu-util -D main-82-write.bin -t 16
dfu-util -D main-82.bin -t 2048
dfu-util -U main-82-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-82-res.bin', 'utf8'));"
echo "Done writing chunk #82"
dfu-util -D main-83-write.bin -t 16
dfu-util -D main-83.bin -t 2048
dfu-util -U main-83-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-83-res.bin', 'utf8'));"
echo "Done writing chunk #83"
dfu-util -D main-84-write.bin -t 16
dfu-util -D main-84.bin -t 2048
dfu-util -U main-84-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-84-res.bin', 'utf8'));"
echo "Done writing chunk #84"
dfu-util -D main-85-write.bin -t 16
dfu-util -D main-85.bin -t 2048
dfu-util -U main-85-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-85-res.bin', 'utf8'));"
echo "Done writing chunk #85"
dfu-util -D main-86-write.bin -t 16
dfu-util -D main-86.bin -t 2048
dfu-util -U main-86-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-86-res.bin', 'utf8'));"
echo "Done writing chunk #86"
dfu-util -D main-87-write.bin -t 16
dfu-util -D main-87.bin -t 2048
dfu-util -U main-87-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-87-res.bin', 'utf8'));"
echo "Done writing chunk #87"
dfu-util -D main-88-write.bin -t 16
dfu-util -D main-88.bin -t 1088
dfu-util -U main-88-res.bin -t 80
node -e "var fs = require('fs'); console.log(fs.readFileSync('main-88-res.bin', 'utf8'));"
echo "Done writing chunk #88"