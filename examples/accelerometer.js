var mma8452q = require('mma8452q');

mma8452q.initialize();
while (1) {
  var accel = mma8452q.getAcceleration();  // Read the x/y/z adc values
  console.log("x:", accel[0], "y:", accel[1], "z:", accel[2]);
}