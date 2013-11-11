Installing on Windows
=====================

(Tested on Windows 7)

Install Node from http://nodejs.org/. Install Java from http://java.com/.

Plug in the Tessel.

Ignore the alerts that the device was not successfully installed.

Open the **Control Panel**, go to icon view, and select **Device Manager**.

Right click **NXP LPC18xx VCOM**, and select **Update Driver Software**, then **Browse my computer for driver software**. Select this `install` folder containing `tessel.inf`.

At the security prompt, click **Install this driver software anyway**.

Open a command prompt (Start menu, search for `cmd`). 

	tessel push blinky.js

At the Windows Firewall prompt, click **Allow Access**.