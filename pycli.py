import serial, sys, select

def stdin_hasdata():
  return select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], [])

ser = serial.Serial('/dev/cu.usbmodem1a1241', 19200, timeout=0)
while True:
  n = ser.inWaiting()
  if n:
    sys.stdout.write(ser.read(n))

  if stdin_hasdata():
    ser.write(sys.stdin.read())