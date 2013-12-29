var zlib = require('zlib');
var fs = require('fs');

var builtinBuf = fs.readFileSync("builtin.tar.gz");

zlib.inflate(builtinBuf, function(err, inflated) {
  if (!err) {
  
    fs.writeFileSync("builtin.tar", inflated);
    console.log("wrote builtin.tar");
  
  } else {
    console.error(err);
  }
});