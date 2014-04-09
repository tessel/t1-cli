#!/usr/bin/env node
var os = require("os"), 
  pjson = require("../package.json"),
  common = require('../src/common'),
  temp = require('temp'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  AWS = require('aws-sdk'),
  http = require('http'),
  fs = require('fs'),
  colors = require('colors')
  ;

temp.track();

// var hostname = 'tessel-debug.herokuapp.com';
var hostname = 'localhost';
var id = "";
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-debug')
  .option('script', {
    position: 1,
    full: 'script.js',
    help: 'Run this script on Tessel after default scripts.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function stop(client, logId){
  console.log(colors.green("Done."));
  console.log(colors.cyan("Debug logs can be viewed at"), colors.red("https://"+hostname+"/logs/"+logId));
  console.log(colors.cyan("Please submit this link with your support request"))
  // client.once('script-stop', function (code) {
    // process.exit(code);
  // });

  client.stop();
  process.exit();
}

function postToWeb(path, data, next){
  var options = {
    host: hostname,
    path: path,
    port: 5000,
    method: 'POST',
    headers: {'Content-Type': 'application/json', 
      'Content-Length': Buffer.byteLength(JSON.stringify(data))}
  };

  var req = http.request(options, function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      // check status code
      if (response.statusCode != 200){
        console.error("ERROR: There was an issue uploading the debug files.")
        console.error("Trying with path", path, "with data", data);
        console.log(str);
        process.exit();
      }
      // console.log(str);
      next && next(str);
    });
  });

  req.write(JSON.stringify(data));
  req.end();
}

function initDebug(serial, wifi, info, next){
  postToWeb('/new', { 
    serial: serial,
    firmware: info.firmware_git, 
    runtime: info.runtime_git,
    firmware_date: info.date,
    firmware_time: info.time, 
    wifi: wifi, 
    hostType: os.type(),
    // hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    node: process.version,
    cli: pjson.version }, 
    function(res){
      if (!res) throw err("Could not communicate with host debug server");
      res = JSON.parse(res);
      next && next(res);
    }
  );
}

function Logger(id, credentials, name, client) {
  this.id = id;
  this.client = client;
  this.files = [];
  this.path = temp.mkdirSync(name); 
  console.log("logger path", this.path, name);
  
  var credentialsObj = {credentials: ""};
  credentialsObj.credentials = {accessKeyId: credentials.Credentials.AccessKeyId, 
    secretAccessKey: credentials.Credentials.SecretAccessKey, sessionToken: credentials.Credentials.SessionToken}
  this.s3 = new AWS.S3(credentialsObj.credentials);

  this.logPaths = {};
  this.logPaths[name] = path.join(this.path, name);

  var that = this;
  this.client.on('rawMessage', function(message){
    fs.appendFile(that.logPaths[name], "[RAW]: "+message+"\n", function(err){
      if (err) throw err;
    });
  });

  this.client.on('log', function(level, str){
    fs.appendFile(that.logPaths[name], "[LOG]["+level+"]: "+str+"\n", function(err){
      if (err) throw err;
    });
  });

  this.client.on('command', function(command, str){
    fs.appendFile(that.logPaths[name], "[CMD]["+command+"]: "+str+"\n", function(err){
      if (err) throw err;
    });
  });
}

Logger.prototype.detach = function(){
  this.client.removeListener('rawMessage');
  this.client.removeListener('log');
  this.client.removeListener('command');
}

Logger.prototype.uploadFiles = function(next){
  var count = 0;
  var self = this;
  var keys = Object.keys(self.logPaths);

  keys.forEach(function(logKey){
    var file = fs.readFileSync(self.logPaths[logKey]);
    var date = new Date().toISOString();

    var key = self.id+'-'+date+'-'+logKey;
    var params = {Bucket: 'tessel-debug', Key: key, Body: file};

    self.s3.putObject(params, function(err, data) {
      if (err) throw err;     

      postToWeb('/logs/'+self.id, {key: logKey, keyPath: key}, function(){
        count++;
        if (count >= keys.length){
          next && next();
        }
      });
    });
  });
}

Logger.prototype.addFile = function(key, filepath){
  this.logPaths[key] = filepath;
}

function userScript(id, client, credentials){
  var userLogger = new Logger(id, credentials, 'user.log', client);
  argv.savePath = path.join(userLogger.path, "usercode.tgz");
  console.log("arvg savepath", argv.savePath);
  userLogger.addFile('usercode.tgz', argv.savePath);

  // reconnect
  client.init(function(){
    client.listen(true);

    console.log(colors.green("Running user script... stopping with Ctrl+C or when we hit an error"));
    common.pushCode(client, argv.script, ['tessel', argv.script].concat(argv.arguments || []), 
    {flash: false}, argv, function(){
      // stop on script exit
      process.on('SIGINT', function() {
        userLogger.uploadFiles(function(){
          stop(client, id);
        });
      });

    });
  });
}

common.controller(function (err, client) {
  client.listen(true);
  client._info(function(err, info){
    client.wifiVer(function(err, wifiVer){
      initDebug(client.serialNumber, wifiVer, info, function(init){
        console.log(colors.cyan("Starting debug logs... saving to"), colors.green(hostname+"/log/"+init.id));
        
        var blinkyLogger = new Logger(init.id, init.credentials, 'blinky.log', client);
        argv.save = true;
        argv.savePath = path.join(blinkyLogger.path, "blinky.tgz");
        console.log("arvg savepath", argv.savePath);
        blinkyLogger.addFile('blinky.tgz', argv.savePath);

        var blinkyPath = __dirname+'/../scripts/blink';
        console.log(colors.cyan("Running Blinky test... please wait..."));

        common.pushCode(client, blinkyPath, ['tessel', blinkyPath].concat(argv.arguments || []), 
          {flash: false}, argv, function(){

          setTimeout(function(){
            blinkyLogger.uploadFiles(function (){

              if (argv.script){
                // stop that client
                client.stop();

                setTimeout(function(){
                  console.log("user script hit");
                  userScript(init.id, client, init.credentials);
                }, 1000);
                
              } else {
                console.log(colors.grey("No userscript detected. In order to run a userscript, specify `tessel debug <script.js>`"));
                stop(client, init.id);
              }
            });
            // run blinky for 5 seconds
          }, 5000);

        });
      });
    });
  })
});