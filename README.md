**[UNMAINTAINED] This library does not have a maintainer. The source code and repository will be kept at this URL indefinitely. If you'd like to help maintain this codebase, create an issue on this repo explaining why you'd like to become a maintainer and tag @tessel/maintainers in the body.**

# tessel cli and module

This is the Node module for communicating with Tessel by the commandline, pushing code and controlling network settings / configuration, or for programmatically interacting with Tessel.

```
npm install tessel
```

## Module API

You can interact with Tessel programmatically.

```js
var tessel = require('tessel');
```

<!--markdocs-->
<!--generated by https://github.com/tcr/markdocs-->

### Module
This module creates a single-threaded local server to which multiple processes can connect to a single Tessel over USB, as well as a `TesselClient` object that acts as a connection to the Tessel.

```
var tessel = require('tessel-client');
```

&#x20;<a href="#api-Object-tessel-descriptors" name="api-Object-tessel-descriptors">#</a> <i>Object</i>&nbsp; tessel<b>.descriptors</b>  
Hash of USB descriptors.

```
{
  TESSEL_VID: 0x1d50, TESSEL_PID: 0x6097,
  TESSEL_OLD_VID: 0x1fc9, TESSEL_OLD_PID: 0x2002,
  NXP_ROM_VID: 0x1fc9, NXP_ROM_PID: 0x000c
}
```

&#x20;<a href="#api-tessel-connect-port-host-TesselClient" name="api-tessel-connect-port-host-TesselClient">#</a> tessel<b>.connect</b>( port, host ) &rarr; <i>TesselClient</i>  
Connects to a local Tessel server.

&#x20;<a href="#api-tessel-connectServer-path-callback-err-port-" name="api-tessel-connectServer-path-callback-err-port-">#</a> tessel<b>.connectServer</b>( path, callback(err, port) )  
Connects a detached child server to a Tessel USB port. Returns the port at which the local Tessel server is listening.

&#x20;<a href="#api-tessel-detectModems-callback-err-paths-" name="api-tessel-detectModems-callback-err-paths-">#</a> tessel<b>.detectModems</b>( callback(err, paths) )  
Retrieve the path of each Tessel connected by USB in an array.

&#x20;<a href="#api-tessel-selectModem-onnotfound-callback-err-path-" name="api-tessel-selectModem-onnotfound-callback-err-path-">#</a> tessel<b>.selectModem</b>( onnotfound(), callback(err, path) )  
Interactive menu for selecting a Tessel to connect to. Will continue to poll until a suitable client is found, calling the `onnotfound` callback (perhaps continuously). Once a device is found, if multiple options exist, user is prompted for a selection. Then the `callback` is passed the path of the chosen device.

&#x20;<a href="#api-tessel-acquire-path-callback-err-client-" name="api-tessel-acquire-path-callback-err-client-">#</a> tessel<b>.acquire</b>( [path, ], callback(err, client) )  
Acquires a Tessel client, either interactively (via `selectModem`) or directly given the supplied `path`. The callback is passed a `TesselClient` object.

&#x20;<a href="#api-tessel-bundleFiles-relpath-args-files-callback-err-bundle-" name="api-tessel-bundleFiles-relpath-args-files-callback-err-bundle-">#</a> tessel<b>.bundleFiles</b>( relpath, args, files, callback(err, bundle) )  
`relpath` is the starting path of the application relative to root. `args` is the `process.argv` array. `files` is a map of tessel filesystem paths to local filesystem paths from the computer. This function returns to the callback with a bundle that can be deployed to Tessel.

### `TesselClient` object
Created by `tessel.connect`.

&#x20;<a href="#api-DuplexStream-client-stdout" name="api-DuplexStream-client-stdout">#</a> <i>DuplexStream</i>&nbsp; client<b>.stdout</b>  
Stream of output from the client module.

&#x20;<a href="#api-client-send-json-" name="api-client-send-json-">#</a> client<b>.send</b>( json )  
Sends a message to be read by `process.on('message', callback)` by the child script.

&#x20;<a href="#api-client-wifiStatus-callback-err-wifiStatus-" name="api-client-wifiStatus-callback-err-wifiStatus-">#</a> client<b>.wifiStatus</b>( callback(err, wifiStatus) )  
Returns the status of the board's Wifi. `wifiStatus` has the properties "connected" and "ip".

&#x20;<a href="#api-client-configureWifi-ssid-pass-security-opts-callback-err-wifiStatus-" name="api-client-configureWifi-ssid-pass-security-opts-callback-err-wifiStatus-">#</a> client<b>.configureWifi</b>( ssid, pass, security, [opts,] callback(err, wifiStatus) )  
Connects to the given Wifi network. `security` can be one of "wpa2", "wep", or null. `pass` can be null if no security is chosen. `err` is true if the network could not be connected to. An optional `opts` object allows an integer `timeout` number to be specified in seconds.

&#x20;<a href="#api-client-deployBundle-tarbundle-opts-onScriptStart-err-" name="api-client-deployBundle-tarbundle-opts-onScriptStart-err-">#</a> client<b>.deployBundle</b>( tarbundle, opts, onScriptStart(err) )  
Deploys a tar bundle of code to the device. `opts` can have a flag `save` to write the bundle to the local filesystem, or `flash` to flash the device instead of running from RAM.

&#x20;<a href="#api-client-erase-" name="api-client-erase-">#</a> client<b>.erase</b>()  
Erases internal flash on the device of any running code.

&#x20;<a href="#api-client-stop-" name="api-client-stop-">#</a> client<b>.stop</b>()  
Stops the current script.

&#x20;<a href="#api-client-deploy-filepath-argv-onScriptStart-err-" name="api-client-deploy-filepath-argv-onScriptStart-err-">#</a> client<b>.deploy</b>( filepath, argv, onScriptStart(err) )  
Given a file path, automatically deploys the file and its nearest directory with a `package.json` file to Tessel.

&#x20;<a href="#api-client-emits-script-start-" name="api-client-emits-script-start-">#</a> client &rarr; <i>emits "script-start"</i>  
Emitted when a client script starts.

&#x20;<a href="#api-client-emits-script-stop-" name="api-client-emits-script-stop-">#</a> client &rarr; <i>emits "script-stop"</i>  
Emitted when a client script exits.

<!--/markdocs-->

## License

MIT or Apache 2.0, at your option
