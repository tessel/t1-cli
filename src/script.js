var tessel = require('./');

// client#run(pushpath, args, next(err))
// Run and deploy a script to this Tessel.
// Meant to be a simplification of the bundling process.

tessel.Tessel.prototype.run = function (pushpath, argv, bundleopts, next)
{
  var self = this;
  var verbose = bundleopts;
  if (typeof bundleopts == 'function') {
    next = bundleopts;
    bundleopts = {};
  }

  // Bundle code based on file path.
  var ret = bundle(pushpath, bundleopts);
  if (ret.warning) {
    console.error(('WARN').yellow, ret.warning.grey);
  }
  verbose && console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);

  // Create archive and deploy it to tessel.
  tessel.bundleFiles(ret.relpath, argv, ret.files, function (err, tarbundle) {
    // if (argv.save) {
    //   if (argv.savePath) {
    //     // save the bundle to the path
    //     fs.writeFile(argv.savePath, tarbundle, function(err){
    //       if (err) throw err;
    //     });
    //   } else {
    //     // save to any rando location 
    //     fs.writeFile('tarbundle.tar', tarbundle, function(err){
    //       if (err) throw err;
    //     });
    //   }
    // }

    verbose && console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
    self.deployBundle(tarbundle, options, next);
  })
}


// tessel.script(pushpath, args, next(err))
// Dead-simple mechanism for pushing code to Tessel.

function script (pushpath, args, next)
{
  tessel.findTessel(null, function (err, client) {
    // client.listen(true, [10, 11, 12, 13, 20, 21, 22])

    if (err) {
      throw new Error('No tessel connected, aborting: ' + err);
    }

    client.run(pushpath, args, function (err) {
      // Log errors.
      client.on('error', function (err) {
        console.error('Error: Cannot connect to Tessel locally.', err);
      })

      // Bundle and upload code.
      console.error('uploading tessel code...'.grey);

      // When this script ends, stop the client.
      client.once('script-stop', function (code) {
        // console.log('stopped.'.grey);
        client.close();
      });

      // Handle running script.
      next(err, client);
    })
  });
}

tessel.script = script;