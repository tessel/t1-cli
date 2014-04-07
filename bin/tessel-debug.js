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

var sts = new AWS.STS();
var hostname = 'tessel-debug.herokuapp.com';
var id = "";
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-debug')
  .option('script', {
    position: 0,
    // required: true,
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
  client.once('script-stop', function (code) {
    process.exit(code);
  });
  setTimeout(function () {
    process.exit(code);
  }, 5000);
  client.stop();
}

function postToWeb(path, data, next){
  // var options = {
  //   host: hostname,
  //   path: path,
  //   method: 'POST',
  //   headers: {'Content-Type': 'application/json', 
  //     'Content-Length': Buffer.byteLength(JSON.stringify(data))}
  // };

  // var req = http.request(options, function(response) {
  //   var str = ''
  //   response.on('data', function (chunk) {
  //     str += chunk;
  //   });

  //   response.on('end', function () {
  //     next && next(str);
  //     console.log(str);
  //   });
  // });

  // req.write(JSON.stringify(data));
  // req.end();

  next("abc123");
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
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release,
    node: process.version,
    cli: pjson.version }, 
    function(res){
      console.log("got this after posting to web", res);
      id = res.id;
      next && next(id, res.credentials);
    }
  );
}

function Logger(credentials, name, client) {
  this.client = client;
  this.files = [];
  this.path = temp.mkdirSync(name); 

  AWS.config.credentials = sts.credentialsFrom(credentials);
  this.s3 = new AWS.S3();
  this.logPaths = {};
  this.logPaths[name] = path.join(this.path, name+'.log');

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

  var keys = Object.keys(this.logPaths);
  var that = this;
  keys.forEach(function(logKey){
    var path = that.logPaths[logKey];
    var file = fs.readFileSync(path);
    console.log("uploading file at", path);
    var date = new Date().toISOString();

    var params = {Bucket: 'tessel-debug', Key: date+'-'+path, Body: file};

    // that.s3.putObject(params, function(err, data) {
    //   if (err) throw err;     
    //   console.log("Successfully uploaded data to myBucket/myKey");  
      count++;
    //   console.log("put object res", data);

    //   postToWeb('/logs/'+id, {key: logKey, link:data}, function(){
        if (count >= keys.length){
          // console.log('calling next');
          next && next();
        }
    //   });
    // });
  });
}

Logger.prototype.addFile = function(key, filepath){
  this.logPaths[key] = filepath;
}

function userScript(client, credentials){
  // reconnect
  client.init(function(){
    client.listen(true);

    var userLogger = new Logger(credentials, 'user-log', client);
    argv.savePath = path.join(userLogger.path, "usercode.tgz");
    userLogger.addFile('user-tar', argv.savePath);

    console.log(colors.green("Running user script... stopping with Ctrl+C or when we hit an error"));
    common.pushCode(client, argv.script, ['tessel', argv.script].concat(argv.arguments || []), 
    {flash: false}, argv, function(){
      // stop on script exit
      process.on('SIGINT', function() {
        stop(client, id);
      });

      client.once('script-stop', function (code) {
        userLogger.uploadFiles();
      });
    });
  });
}

common.controller(function (err, client) {
  client.listen(true);
  client._info(function(err, info){
    console.log("tessel info", info);
    client.wifiVer(function(err, wifiVer){
      initDebug(client.serialNumber, wifiVer, info, function(id, credentials){
        console.log(colors.cyan("Starting debug logs... saving to"), colors.green(hostname+"/log/"+id));

        var blinkyLogger = new Logger(credentials, 'blinky-log', client);
        argv.save = true;
        argv.savePath = path.join(blinkyLogger.path, "blinky.tgz");
        blinkyLogger.addFile('blinky-tar', argv.savePath);

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
                  userScript(client, credentials, id);
                }, 1000);
                
              } else {
                console.log("No userscript detected. In order to run a userscript, specify `tessel debug <script.js>`");
                stop(client, id);
              }
            });
          }, 500);

        });
      });
    });
  })
});