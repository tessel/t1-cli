board.led(3).output();
board.led(4).output();
console.log("Starting blinking.");

while (true) {
  board.led(3).low()
  board.led(4).low()
  console.log("LOW")
  board.delay(10000)
  board.led(3).high()
  board.led(4).high()
  console.log("HIGH")
  board.delay(10000)
}