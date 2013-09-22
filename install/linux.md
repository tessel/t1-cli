Setup on Linux
==============

(Tested on Fedora 18, should work on most recent distributions)

First, you have to install a udev rules file to set up permissions and settings. By default, udev only allows root to access the device. ModemManager also thinks the serial port is a modem, and sends it AT commands that confuse it.

	sudo cp 10-tessel.rules /etc/udev/rules.d/
	sudo udevadm control --reload-rules

Plug in the Tessel, and push your code.

	% tessel push blinky.js
	TESSEL! Connected to /dev/ttyACM1.          
	Downloading 15466 byte script...
	Running script...
