// generates erase and write binaries for dfu
// takes in the dfu rom
var fs = require('fs'),
  path = require('path'),
  sys = require('sys'),
  exec = require('child_process').exec;

  var writeByte = 0x08;
  var eraseByte = 0x07;

function puts(error, stdout, stderr) { sys.puts(stdout) }

function BinGenerator (path){
  this.path = path;
  this.chunkSize = 2048;
  this.writeStart = [0x14, 0x00, 0x00, 0x00];
  this.eraseStat = [0x00, 0x02, 0x00, 0x00];
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

BinGenerator.prototype.writeFile = function (name, buff){
  var fd =  fs.openSync(name, 'w');
  fs.writeSync(fd, buff, 0, buff.length, 0);
  console.log("finished writing ", name);
  
  return path.basename(name, '.bin');
}

  // if it doesnt generate an erase file that looks like dis
  // unsigned char buf [] = {
    // 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 
    // 0x00, 0x00, 0x02, 0x00, 0x0B, 0x01, 0x43, 0x18}; // erase
    // 07 00 00 00 00 00 00 14 
    // 00 00 02 00 0b 01 43 18
BinGenerator.prototype.eraseCmd = function(size, name) {
  name = name || this.path;

  var eraseName = path.basename(name, '.bin') + '-erase.bin';
  if (this.fileExists(eraseName)) return;

  var buff = new Buffer([eraseByte, 0x00, 0x00, 0x00, this.writeStart[3], 
    this.writeStart[2], this.writeStart[1], this.writeStart[0], 
    this.eraseStat[3], this.eraseStat[2], this.eraseStat[1], 
    this.eraseStat[0], 0x0B, 0x01, 0x43, 0x18], 'binary');

  return this.writeFile(eraseName, buff);

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
BinGenerator.prototype.writeCmd = function(size, offset, name) {
  name = name || this.path;
  offset = offset || 0;
  var writeName = path.basename(name, '.bin') + '-write.bin';
  if (this.fileExists(writeName)) return;

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

  return this.writeFile(writeName, buff);
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
BinGenerator.prototype.split = function (file, size) {
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

    res.push({ name: this.writeFile(path.basename(file, '.bin')+'-'+chunks+'.bin', buff), 
      size: splitSize});
    len = len - this.chunkSize;
    chunks++;
  }

  return res;
}

BinGenerator.prototype.makeScript = function (size){
  var that = this;
  var download = 'dfu-util -D ';
  var upload = 'dfu-util -U ';
  var cmdByteLen = 16;

  var splits = [this.path];
  if (size > this.chunkSize) {
    // its too big, we need to split it into multiple chunks
    splits = this.split(this.path, size);
  }

  // get erase command
  var eraseBin = this.eraseCmd(size);
  // get write command for each chunk
  var num = splits.length;
  var offset = 0;
  splits.forEach(function(split){
    that.writeCmd(split.size, offset, split.name);
    offset = offset + split.size;
  });

  // all the commands
  var cmds = [
    'rm *-res.bin',
    download + 'iram_dfu_util_any.bin.hdr', 
    'echo "Sleeping for 4 seconds so that usb can reboot"',
    'sleep 4s', // wait for dfu to reconfigure on Tessel's ram
    upload + 'iram-res.bin -t 80', 
    "node -e \"var fs = require('fs'); console.log(fs.readFileSync('iram-res.bin', 'utf8'));\"", 
    download + 'cmd1.bin -t 16',
    upload + 'cmd1-res.bin -t 80',
    download + 'cmd2.bin -t 16', 
    upload + 'cmd2-res.bin -t 80',
    download + eraseBin+'.bin -t 16',
    'echo "Sleeping for 2 seconds until erase finishes"',
    'sleep 2s', // wait for erase to finish
    upload + eraseBin+'-res.bin -t 80',
    "node -e \"var fs = require('fs'); console.log(fs.readFileSync('"+eraseBin+"-res.bin', 'utf8'));\""
  ];

  splits.forEach(function(split, index) {
    cmds.push(download+split.name+'-write.bin -t 16');
    cmds.push(download+split.name+'.bin -t '+split.size);
    cmds.push(upload+split.name+'-res.bin -t 80');
    cmds.push("node -e \"var fs = require('fs'); console.log(fs.readFileSync('"+split.name+"-res.bin', 'utf8'));\"") 
    cmds.push('echo "Done writing chunk #'+index+'"'); 
  });

  //put it all together
  var str = cmds.join('\n');
  // console.log("str ", str);
  var filename = "dfu-runner-"+path.basename(this.path, '.bin')+'.sh';
  var fd =  fs.openSync(filename, 'w');
  fs.writeSync(fd, str);

  console.log("created "+filename);

  // make the new shell script executable
  fs.chmodSync(filename, '755');
}

function usage () {
  console.error("Bin Generator. Generates the bin command files for DFU. \nUsage:\n" +
    "       deadbeef <size>\n" +
    "              Generates a <size> bin filled with deadbeefs\n" +
    "       erase <file>\n" +
    "              Generates the erase bin for the file\n" +
    "       write <file>\n" +
    "              Generates the write bin for the file\n" +
    "       script <file>\n" +
    "              Makes all the bin files and generates the shell script for the file\n"
    );
}

var CMD = process.argv[2];
var FILE = process.argv[3];
if (!CMD || !FILE) usage();
else {
  if (CMD == 'deadbeef') {
    var bin = new BinGenerator("", FILE)
    bin.makeTestBin(FILE);
  } else {
    fs.lstat(FILE, function (err, stat){
      var bin = new BinGenerator(FILE, stat.size)
      if (CMD == 'erase') {
        bin.eraseCmd(stat.size);
      } else if (CMD == 'write') {
        bin.writeCmd(stat.size);
      } else if (CMD == 'script') {
        bin.makeScript(stat.size);
      } else {
        usage();
      }
     
    });
  }
}
