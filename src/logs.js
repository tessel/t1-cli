var colors = require('colors');

function checkArg() {
  return arguments && arguments.length > 0;
}

exports.warn = function(){
  if (checkArg(arguments))
    arguments[0] = "WARN ".yellow + arguments[0];

  console.log.apply(console, arguments);
};

exports.err = function(){
  if (checkArg(arguments))
    arguments[0] = "ERR! ".red + arguments[0];

  console.log.apply(console, arguments);
};

exports.info = function(){
  if (checkArg(arguments))
    arguments[0] = "INFO ".grey + arguments[0];
  console.log.apply(console, arguments);
};
