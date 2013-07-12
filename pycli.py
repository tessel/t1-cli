import serial, sys, select

if len(sys.argv) < 2:
  print('Usage: python pycli.py /path/to/serial')
  os.exit(1)

def stdin_hasdata():
  return select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], [])

ser = serial.Serial(sys.argv[1], 9600, timeout=0, writeTimeout=30)
while True:
  n = ser.inWaiting()
  if n:
    sys.stdout.write(ser.read(n))
    sys.stdout.flush()

  if stdin_hasdata():
    b = bytearray()
    while stdin_hasdata():
      b.append(bytes(sys.stdin.read(1)))
    sys.stderr.write("Sent " + str(ser.write(b)) + " bytes...\n")
      