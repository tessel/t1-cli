var net = require('net');
var fs = require('fs');
var path = require('path')
  , temp = require('temp')
  , colonyCompiler = require('colony-compiler')
  , async = require('async')
  , fstream = require('fstream')
  , tar = require('tar')
  , osenv = require('osenv')
  , effess = require('effess')
  , debug = require('debug')('tessel')
  ;

// We want to force node-tar to not use extended headers.
// We patch the module here.
;(function () {
  var fn = require('tar/lib/header').encode;
  require('tar/lib/header').encode = function (obj) {
    var ret = fn(obj);
    obj.needExtended = false
    return ret;
  }
})();

exports.bundleFiles = function (startpath, args, files, next)
{
  temp.mkdir('colony', function (err, dirpath) {
    var mkdirp = require('mkdirp');
    Object.keys(files).forEach(function (filename) {
      mkdirp.sync(path.join(dirpath, 'app', path.dirname(filename)));
      fs.writeFileSync(path.join(dirpath, 'app', filename), fs.readFileSync(files[filename], 'binary'), 'binary');
    })

    var stub
      = 'process.env.DEPLOY_IP = ' + JSON.stringify(require('my-local-ip')()) + ';\n'
      + 'process.argv = ' + JSON.stringify(args) + ';\n'
      + 'require(' + JSON.stringify('./app/' + startpath.replace('\\', '/')) + ');';
    fs.writeFileSync(path.join(dirpath, '_start.js'), stub);

    // Create list of (tesselpath, localfspath) files to compile.
    var docompile = [];
    effess.readdirRecursiveSync(path.join(dirpath)).forEach(function (f) {
      // console.log("current file", f);
      if (f.match(/\.js$/)) {
        docompile.push([f, path.join(dirpath, f)]);
      }
    });

    var compileBytecode = true;

    // compile with compile_lua
    async.each(docompile, function (_f, next) {
      var f = _f[0], fullpath = _f[1];

      debug('compiling', f);

      try {
        var source = fs.readFileSync(fullpath, 'utf-8');
        var res = colonyCompiler.colonize(source);
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          throw e;
        }

        // Create a readable SyntaxError message.
        var message = [
          e.message,
          '',
          fs.realpathSync(f.substr(4)) + ':' + e.loc.line,
          source.split(/\n/)[e.loc.line-2] || '',
          Array(e.loc.column || 0).join(' ') + '^'
        ].join('\n');
        // Files with syntax errors can't be compiled.
        // We can pretend they were thrown by our parser though, at runtime.
        var res = colonyCompiler.colonize('throw new SyntaxError(' + JSON.stringify(message) + ')')
      }

      if (!compileBytecode) {
        fs.writeFileSync(fullpath, res.source);
        next(null);
      } else {
        try {
          colonyCompiler.toBytecode(res, '/' + f.split(path.sep).join('/'), function (err, bytecode) {
            debug('writing', f);
            !err && fs.writeFileSync(fullpath, bytecode);
            next(err);
          });
        } catch (e) {
          console.log('ERR'.red, 'Compilation process failed for the following file:');
          console.log('ERR'.red, ' ', f.replace(/^[^/]+/, '.'))
          console.log('ERR'.red, 'This is a compilation bug! Please file an issue at');
          console.log('ERR'.red, 'https://github.com/tessel/beta/issues with this text');
          console.log('ERR'.red, 'and a copy of the file that failed to compile.')
          process.exit(1);
        }
      }

    }, function (err) {
      exports.tarCode(dirpath, '', next);
    });
  });
};


// TODO should not be public,
// relied on by debug push code path
exports.tarCode = function (dirpath, pushdir, next)
{
  var fstr = fstream.Reader({path: dirpath, type: "Directory"})
  fstr.basename = '';

  fstr.on('entry', function (e) {
    e.root = {path: e.path};
  })

  fstr.on('error', function (err) {
    console.error('Error bundling code archive: ' + err);
    process.exit(1);
  })

  var bufs = [];
  var p = tar.Pack();
  p._noProprietary = true;
  fstr.pipe(p).on('data', function (buf) {
    bufs.push(buf);
  }).on('end', function () {
    var bundle = Buffer.concat(bufs);

    var hasIndex = false;
    var p = tar.Parse().on('entry', function (a) {
      if (a.path == '_start.js') {
        hasIndex = true;
      }
    }).on('end', function () {
      if (!hasIndex) {
        console.error('ERR'.red, 'Command line generated bundle without an /_start.js file. Please report this error.');
        process.exit(1);
      }

      next(null, bundle);
    })
    p.write(bundle);
    p.end();
  }).on('error', function (err) {
    console.error('ERR'.red, 'Error in compressing code archive: ' + err);
    process.exit(1);
  });
}