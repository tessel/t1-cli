var mma8452 = require('./mma8452');

mma8452.initialize();
while (1) {
  var accel = mma8452.getAcceleration();  // Read the x/y/z adc values
  console.log("x:", accel[0], "y:", accel[1], "z:", accel[2]);
}