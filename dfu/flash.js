// generates erase and write binaries for dfu
// takes in the dfu rom
var fs = require('fs'),
  path = require('path'),
  sys = require('sys'),
  exec = require('child_process').exec;

var dfu_util = require('dfu-util-tm')
  , temp = require('temp');


var writeByte = 0x08;
var eraseByte = 0x07;

// temp.track();

function puts(error, stdout, stderr) { sys.puts(stdout) }

function BinGenerator (path){
  this.path = path;
  this.chunkSize = 2048;
  this.writeStart = [0x14, 0x00, 0x00, 0x00];
  this.eraseStart = [0x00, 0x04, 0x00, 0x00];
}

// check if erase file already exists
// todo clean this up
BinGenerator.prototype.fileExists = function (name) {
  if (fs.existsSync(name)) {
    console.log("Error didn't write file because ", name, " already exists");
    return true;
  }
  return false;
}

BinGenerator.prototype.writeFile = function (dirPath, name, buff){
  fs.writeFileSync(path.join(dirPath, name), buff);
  console.log("finished writing =>", path.join(dirPath, name));
  
  return path.basename(name, '.bin');
}

  // if it doesnt generate an erase file that looks like dis
  // unsigned char buf [] = {
    // 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 
    // 0x00, 0x00, 0x02, 0x00, 0x0B, 0x01, 0x43, 0x18}; // erase
    // 07 00 00 00 00 00 00 14 
    // 00 00 02 00 0b 01 43 18
BinGenerator.prototype.eraseCmd = function(dirPath, size, name) {
  name = name || this.path;

  var eraseName = path.basename(name, '.bin') + '-erase.bin';
  // if (this.fileExists(eraseName)) return;

  var buff = new Buffer([eraseByte, 0x00, 0x00, 0x00, this.writeStart[3], 
    this.writeStart[2], this.writeStart[1], this.writeStart[0], 
    this.eraseStart[3], this.eraseStart[2], this.eraseStart[1], 
    this.eraseStart[0], 0x0B, 0x01, 0x43, 0x18], 'binary');

  return this.writeFile(dirPath, eraseName, buff);

  // var fd =  fs.openSync(eraseName, 'w');
  // fs.write(fd, buff, 0, buff.length, 0, function(err,written){
  //   console.log("finished writing ", eraseName);
  // });

  // return path.basename(this.path, '.bin') + '-erase';
}

  // unsigned char buf [] = {
    // 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 
    // 0x20, 0x00, 0x00, 0x00, 0x0B, 0x01, 0x43, 0x18}; // write 32 bytes
// todo clean this up
BinGenerator.prototype.writeCmd = function(dirPath, size, offset, name) {
  name = name || this.path;
  offset = offset || 0;
  var writeName = path.basename(name, '.bin') + '-write.bin';
  // if (this.fileExists(writeName)) return;

  var dataSize = [];
  while(size > 0){
    dataSize.push(size & 0xFF);
    size = size >> 8;
  }

  var writeAddr = [];
  console.log("offset is ", offset);

  offset = offset+0x14000000;
  console.log("added offset ", offset);
  while(offset > 0){
    writeAddr.push(offset & 0xFF);
    offset = offset >> 8;
  }
  console.log("write addr ", writeAddr);

  if (dataSize.length > 4 || size > 2048) {
    return console.log("Can't write to file with this binary. It's too large. Please make it smaller than 2048 bytes.");
  }

  while (dataSize.length < 4){
    dataSize.push(0);
  }

  console.log("size of data is ", dataSize);
  var buff = new Buffer([writeByte, 0x00, 0x00, 0x00, writeAddr[0], 
    writeAddr[1], writeAddr[2], writeAddr[3], 
    dataSize[0], dataSize[1], dataSize[2], dataSize[3], 
    0x0B, 0x01, 0x43, 0x18], 'binary');

  return this.writeFile(dirPath, writeName, buff);
  // var fd =  fs.openSync(writeName, 'w');
  // fs.write(fd, buff, 0, buff.length, 0, function(err,written){
  //   console.log("finished writing ", writeName);
  // });
  // return path.basename(this.path, '.bin') + '-write';
}

   // unsigned char buf[] = {
    // 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 
    // 0x10, 0x00, 0x00, 0x00, 0x0B, 0x01, 0x43, 0x18 }; // read from device, 16 bytes
BinGenerator.prototype.readCmd = function() {

}

// makes a test binary full of deadbeefs
BinGenerator.prototype.makeTestBin = function(size) {
  size = Math.floor(size/4);
  name = "deadbeef-"+size*4+'.bin';
  console.log("genereating "+name);
  arr = [];
  while (size > 0) {
    arr.push(0xde);
    arr.push(0xad);
    arr.push(0xbe);
    arr.push(0xef);
    size--;
  }

  return this.writeFile(name, new Buffer(arr, 'binary'));

  // var fd =  fs.openSync(name, 'w');

  // var buff = new Buffer(arr, 'binary');
  // fs.write(fd, buff, 0, buff.length, 0, function(err,written){
  //   console.log("finished writing ", name);
  // });
}

// splits files into multiple chunks. returns names of the chunks.
BinGenerator.prototype.split = function (dirPath, file, size) {
  var res = [];
  // open up the file
  var data = fs.readFileSync(file);
  console.log("data ", data);
  var len = data.length;
  var chunks = 0;

  while(len > 0) {
    var buff = new Buffer(this.chunkSize);
    var splitSize = this.chunkSize;
    if (this.chunkSize > len) {
      splitSize = size - chunks*this.chunkSize;
      var buff = new Buffer(splitSize);
      data.copy(buff, 0, chunks*this.chunkSize);
    } else {
      data.copy(buff, 0, chunks*this.chunkSize, (chunks+1)*this.chunkSize);
    }
    console.log("buffer ", buff);

    res.push({
      name: this.writeFile(dirPath, path.basename(file, '.bin')+'-'+chunks+'.bin', buff), 
      size: splitSize
    });
    len = len - this.chunkSize;
    chunks++;
  }

  return res;
}

BinGenerator.prototype.makeScript = function (size){
  var that = this;
  var tool = dfu_util.path + ' ';
  var cmdByteLen = 16;

  temp.mkdir('tessel-firmware', function (err, dirPath) {

    var splits = [this.path];
    // its too big, we need to split it into multiple chunks
    splits = this.split(dirPath, this.path, size);

    // generate erase command
    var eraseBin = path.join(dirPath, this.eraseCmd(dirPath, size));

    // generate write command for each chunk
    var num = splits.length;
    var offset = 0;
    splits.forEach(function(split){
      that.writeCmd(dirPath, split.size, offset, split.name);
      offset = offset + split.size;
    });

    // // all the commands
    // var cmds = [
    //   // 'rm *.bin.res',
    //   tool + '-D iram_dfu_util_any.bin.hdr', 
    //   'echo "Sleeping for 4 seconds so that usb can reboot"',
    //   'sleep 4s', // wait for dfu to reconfigure on Tessel's ram
    //   tool + '-t 80 -U iram.bin.res -t 16 -D cmd1.bin -t 80 -U cmd1.bin.res -t 16 -D cmd2.bin -t 80 -U cmd2.bin.res -t 16 -D '+eraseBin+'.bin', 
    //   'echo "Sleeping for 4 seconds until erase finishes"',
    //   'sleep 4s', // wait for erase to finish
    //   tool + '-t 80 -U ' + eraseBin +'.bin.res'
    // ];

    var uploadCmd = tool; 
    // var readBase = 'node read.js ';
    // var reads = [];
    splits.forEach(function(split, index) {
      uploadCmd = uploadCmd+ '-t 16 -D '+path.join(dirPath, split.name)+'-write.bin -t '+split.size+' -D '+path.join(dirPath, split.name)+'.bin -t 80 -U '+path.join(dirPath, split.name)+'.bin.res ';
      // reads.push('echo "'+index+'"\n'+readBase+split.name+'.bin.res');
    });
    // console.log('>>>>>>>>>>>', JSON.stringify(uploadCmd))

    console.log('>>> Initial bootloader write...');
    dfu_util(['-D', 'iram_dfu_util_any.bin.hdr'], {
      stdio: 'inherit'
    }).on('close', function (code) {
      console.log('\n>>> Sleeping for 4 seconds so we can reboot into RAM bootloader...');
      setTimeout(function () {
        
        console.log('\n>>> Erasing...')
        dfu_util(['-t', '80', '-U', path.join(dirPath, 'iram.bin.res'), '-t', '16', '-D', 'cmd1.bin', '-t', '80', '-U', path.join(dirPath, 'cmd1.bin.res'), '-t', '16', '-D', 'cmd2.bin', '-t', '80', '-U', path.join(dirPath, 'cmd2.bin.res'), '-t', '16', '-D', eraseBin + '.bin'], {
          stdio: 'inherit'
        }).on('close', function (code) {
          
          console.log('\n>>> Sleep for 4 seconds until erase finishes...');
          setTimeout(function () {

            console.log('\n>>> Dumping erased binary...');
            dfu_util(['-t', '80', '-U', eraseBin + '.bin.res'], {
              stdio: 'inherit'
            }).on('close', function (code) {

              var uploadCmd = []; 
              splits.forEach(function(split, index) {
                uploadCmd = uploadCmd.concat(['-t', '16', '-D', path.join(dirPath, split.name)+'-write.bin', '-t', split.size, '-D', path.join(dirPath, split.name)+'.bin', '-t', '80', '-U', path.join(dirPath, split.name)+'.bin.res']);
              });

              console.log('\n>>> Writing new binary in chunks...');
              dfu_util(uploadCmd, {
                stdio: 'inherit'
              }).on('close', function (code) {
                console.log('>>> Done writing.');
              });
            });
          }, 4000);
        })
      }, 4000);
    })

    // //put it all together
    // console.log('\n\n\n\n\n');
    // var str = cmds.join('\n')+'\n'+uploadCmd;
    // // console.log("str ", str);
    // fs.writeFileSync('run.sh', str);
    // var filename = "dfu-runner-"+path.basename(this.path, '.bin')+'.sh';
    // var fd =  fs.openSync(filename, 'w');
    // fs.writeSync(fd, str);

    // console.log("created "+filename);

    // // make the new shell script executable
    // fs.chmodSync('run.sh', '755');
  }.bind(this));
}

function usage () {
  console.error("Firmware loader. Loads new firmware file over DFU");
  console.error('');
  console.error("Usage: node flash.js <file>");
  console.error("    Makes all the bin files and generates the shell script for the file");
  process.exit(1);
}

var FILE = process.argv[2];
if (!FILE) {
  usage();
}

fs.lstat(FILE, function (err, stat){
  var bin = new BinGenerator(FILE, stat.size)
  bin.makeScript(stat.size);
});