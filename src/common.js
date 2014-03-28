var fs = require('fs');
var path = require('path');

var hardwareResolve = require('hardware-resolve');
var effess = require('effess');

// bundle (string arg, { verbose, single }) -> { pushdir, relpath, files, size }
// Given a command-line file path, resolve whether we are bundling a file, 
// its directory, or its ancestral node module.

function bundle (arg, opts)
{
  function duparg (arr) {
    var obj = {};
    arr.forEach(function (arg) {
      obj[arg] = arg;
    })
    return obj;
  }

  var ret = {};

  hardwareResolve.root(arg, function (err, pushdir, relpath) {
    var files;
    if (opts.single || !pushdir) {
      if (!opts.single && fs.lstatSync(arg).isDirectory()) {
        ret.warning = String(err || 'Warning.').replace(/\.( |$)/, ', pushing just this directory.');

        pushdir = fs.realpathSync(arg);
        relpath = fs.lstatSync(path.join(arg, 'index.js')) && 'index.js';
        files = duparg(effess.readdirRecursiveSync(arg, {
          inflateSymlinks: true,
          excludeHiddenUnix: true
        }))
      } else {
        ret.warning = String(err || 'Warning.').replace(/\.( |$)/, ', pushing just this file.');

        pushdir = path.dirname(fs.realpathSync(arg));
        relpath = path.basename(arg);
        files = duparg([path.basename(arg)]);
      }
    } else {
      // Parse defaults from command line for inclusion or exclusion
      var defaults = {};
      if (typeof opts.x == 'string') {
        opts.x = [opts.x];
      }
      if (opts.x) {
        opts.x.forEach(function (arg) {
          defaults[arg] = false;
        })
      }
      if (typeof opts.i == 'string') {
        opts.i = [opts.i];
      }
      if (opts.i) {
        opts.i.forEach(function (arg) {
          defaults[arg] = true;
        })
      }

      // Get list of hardware files.
      files = hardwareResolve.list(pushdir, null, null, defaults);
      // Ensure the requested file from command line is included, even if blacklisted
      if (!(relpath in files)) {
        files[relpath] = relpath;
      }
    }

    ret.pushdir = pushdir;
    ret.relpath = relpath;
    ret.files = files;

    // Update files values to be full paths in pushFiles.
    Object.keys(ret.files).forEach(function (file) {
      ret.files[file] = fs.realpathSync(path.join(pushdir, ret.files[file]));
    })
  })

  // Dump stats for files and their sizes.
  var sizelookup = {};
  Object.keys(ret.files).forEach(function (file) {
    sizelookup[file] = fs.lstatSync(ret.files[file]).size;
    var dir = file;
    do {
      dir = path.dirname(dir);
      sizelookup[dir + '/'] = (sizelookup[dir + '/'] || 0) + sizelookup[file];
    } while (path.dirname(dir) != dir);
  });
  if (opts.verbose) {
    Object.keys(sizelookup).sort().forEach(function (file) {
      console.error('LOG'.cyan.blueBG, file.match(/\/$/) ? ' ' + file.underline : ' \u2192 ' + file, '(' + humanize.filesize(sizelookup[file]) + ')');
    });
    console.error('LOG'.cyan.blueBG, 'Total file size:', humanize.filesize(sizelookup['./'] || 0));
  }
  ret.size = sizelookup['./'] || 0;

  return ret;
}

function pushCode (client, file, args, options)
{
  // Bundle code based on file path.
  var ret = bundle(file, argv);
  if (ret.warning) {
    verbose && console.error(('WARN').yellow, ret.warning.grey);
  }
  verbose && console.error(('Bundling directory ' + ret.pushdir + ' (~' + humanize.filesize(ret.size) + ')').grey);

  // Create archive and deploy it to tessel.
  tessel.bundleFiles(ret.relpath, args, ret.files, function (err, tarbundle) {
    verbose && console.error(('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...').grey);
    client.deployBundle(tarbundle, options);
  })
}

exports.bundle = bundle;
exports.pushCode = pushCode;