print('[[start colony mem: ' .. collectgarbage('count') .. 'kb]]');

local colony = (function ()
-- print('[[start colony mem: ' .. collectgarbage('count') .. 'kb]]');

-- requires
-- luarocks install bit32
-- luarocks install json
-- luarocks install lrexlib-pcre

local bit = require('bit32')
--local _, rex = pcall(require, 'lrexlib')
local rex = nil


-- namespace

local global = {}

-- built-in prototypes

local obj_proto, func_proto, bool_proto, num_proto, str_proto, arr_proto, regex_proto = {}, {}, {}, {}, {}, {}, {}

-- get from prototype chain while maintaining "self"

function proto_get (self, proto, key)
  return rawget(proto, key) or (getmetatable(proto) and getmetatable(proto).__index and getmetatable(proto).__index(self, key)) or nil
end

-- introduce metatables to built-in types using debug library:
-- this can cause conflicts with other modules if they utilize the string prototype
-- (or expect number/booleans to have metatables)

local func_mt, str_mt, nil_mt = {}, {}, {}
debug.setmetatable((function () end), func_mt)
debug.setmetatable(true, {
  __index=function (self, key)
    return proto_get(self, bool_proto, key)
  end
})
debug.setmetatable(0, {
  __index=function (self, key)
    return proto_get(self, num_proto, key)
  end
})
debug.setmetatable("", str_mt)
debug.setmetatable(nil, nil_mt)

-- nil metatable

nil_mt.__eq = function (op1, op2)
  return op2 == nil
end

nil_mt.__gt = function (op1, op2)
  return op2 == nil
end

nil_mt.__lt = function (op1, op2)
  return op2 == nil
end

-- object prototype and constructor

global._obj = function (o)
  local mt = getmetatable(o) or {}
  mt.__index = function (self, key)
    return proto_get(self, obj_proto, key)
  end
  setmetatable(o, mt)
  return o
end

-- all prototypes inherit from object

global._obj(func_proto)
global._obj(num_proto)
global._obj(bool_proto)
global._obj(str_proto)
global._obj(arr_proto)

-- function constructor

global._func = function (f)
  return f
end
local luafunctor = function (f)
  return (function (this, ...) return f(...) end)
end

funccache = {}
setmetatable(funccache, {__mode = 'k'})

func_mt.__index = function (self, p)
  local fobj = funccache[self]
  if p == 'prototype' then
    if fobj == nil then
      funccache[self] = {}
      fobj = funccache[self]
    end
    if fobj[p] == nil then
      fobj[p] = global._obj({})
    end
  end
  if fobj and fobj[p] ~= nil then
    return fobj[p]
  end
  return proto_get(self, func_proto, key)
end
func_mt.__newindex = function (self, p, v)
  local pt = funccache[self] or {}
  pt[p] = v
  funccache[self] = pt
end
func_mt.__tojson=function ()
  return "{}"
end

-- string metatable

str_mt.__index = function (str, p)
  if (p == "length") then
    return string.len(str)
  elseif (tonumber(p) == p) then
    return string.sub(str, p+1, p+1)
  else
    return proto_get(str, str_proto, p)
  end
end

str_mt.__add = function (op1, op2)
  return op1 .. tostring(op2)
end

-- array prototype and constructor

local arr_mt = {
  __index = function (arr, key)
    if (key == "length") then
      if arr[0] then return #arr + 1 end
      return #arr
    else
      return proto_get(self, arr_proto, key)
    end
  end,
  __tojson = function (arg)
    local arr = {};
    for i=0,arg.length do
      table.insert(arr, arg[i])
    end
    return dkjson.encode(arr, {indent = true})
  end
}
global._arr = function (a)
  setmetatable(a, arr_mt)
  return a
end

-- void function for expression statements (which lua disallows)

global._void = function () end

-- null object (nil is "undefined")

global._null = {}

-- pairs

global._pairs = pairs;

-- typeof operator

global._typeof = function (arg)
  if arg == nil then
    return 'undefined'
  elseif type(arg) == 'table' then
    return 'object'
  end
  return type(arg)
end

-- instanceof

-- NOW broken
global._instanceof = function (self, arg)
  return getmetatable(self).__index == arg.prototype
end

-- "new" invocation

global._new = function (f, ...)
  local o = {}
  setmetatable(o, {
    __index = function (self, key)
      return proto_get(self, f.prototype, key)
    end,
    __proto = f.prototype
  })
  local r = f(o, ...)
  if r then return r end
  return o
end

--[[
Standard Library
]]--

-- number prototype

num_proto.toFixed = function (num, n)
  return string.format("%." .. n .. "f", num)
end

-- string prototype

str_proto.charCodeAt = function (str, i, a)
  return string.byte(str, i+1)
end
str_proto.charAt = function (str, i)
  return string.sub(str, i+1, i+1)
end
str_proto.substr = function (str, i, len)
  if len then
    return string.sub(str, i+1, i + len)
  else
    return string.sub(str, i+1)
  end
end
str_proto.slice = function (str, i, len)
  return string.sub(str, i+1, len or -1)
end
str_proto.toLowerCase = function (str)
  return string.lower(str)
end
str_proto.toUpperCase = function (str)
  return string.upper(str)
end
str_proto.indexOf = function (str, needle)
  local ret = string.find(str, tostring(needle), 1, true) 
  if ret == null then return -1; else return ret - 1; end
end
str_proto.split = function (str, sep, max)
  if sep == '' then
    local ret = global._arr({})
    for i=0,str.length-1 do
      ret:push(str:charAt(i));
    end
    return ret
  end

  local ret = {}
  if string.len(str) > 0 then
    max = max or -1

    local i, start=1, 1
    local first, last = string.find(str, sep, start, true)
    while first and max ~= 0 do
      ret[i] = string.sub(str, start, first-1)
      i, start = i+1, last+1
      first, last = string.find(str, sep, start, true)
      max = max-1
    end
    ret[i] = string.sub(str, start)
  end
  return global._arr(ret)
end
str_proto.replace = function (str, match, out)
  if type(match) == 'string' then
    return string.gsub(str, string.gsub(match, "(%W)","%%1"), out)
  elseif global._instanceof(match, global.RegExp) then
    if type(out) == 'function' then 
      print('REGEX REPLACE NOT SUPPORTED')
    end
    local count = 1
    if string.find(match.flags, 'g') ~= nil then
      count = nil
    end
    return rex.gsub(str, match.pattern, out, count)
  else
    error('Unknown regex invocation object: ' .. type(match))
  end
end

-- object prototype

obj_proto.hasInstance = function (ths, p)
  return toboolean(rawget(ths, p))
end
obj_proto.hasOwnProperty = function (ths, p)
  return rawget(ths, p) ~= nil
end
obj_proto.__defineGetter__ = function (self, key, fn)
  local idx = getmetatable(self).__index
  getmetatable(self).__index = function (self, getkey)
    if key == getkey then
      return fn(self)
    else
      if type(idx) == 'function' then
        return idx(self, getkey)
      else
        return idx[getkey]
      end
    end
  end
end

-- local obj_mt = {}
-- setmetatable(obj_proto, obj_mt)


-- function prototype

func_proto.call = function (func, ths, ...)
  return func(ths, ...)
end
func_proto.apply = function (func, ths, args)
  -- copy args to new args array
  local luargs = {}
  for i=0,args.length-1 do luargs[i+1] = args[i] end
  return func(ths, unpack(luargs))
end

-- array prototype

arr_proto.push = function (ths, elem)
  if ths.length == 0 then
    ths[0] = elem
  else
    table.insert(ths, ths.length, elem)
  end
  return ths.length
end
arr_proto.pop = function (ths)
  if ths.length == 1 then
    local _val = ths[0]
    ths[0] = nil
    return _val
  end
  return table.remove(ths, ths.length-1)
end
arr_proto.shift = function (ths)
  local ret = ths[0]
  ths[0] = table.remove(ths, 1)
  return ret
end
arr_proto.unshift = function (ths, elem)
  local _val = nil
  if ths.length > 0 then
    _val = table.insert(ths, 1, elem[0])
  end
  ths[0] = elem
  return _val
end
arr_proto.reverse = function (ths)
  local arr = global._arr({})
  for i=0,ths.length-1 do
    arr[ths.length - 1 - i] = ths[i]
  end
  return arr
end
arr_proto.slice = function (ths, start, len)
  local a = global._arr({})
  if not len then
    len = ths.length - (start or 0)
  end
  for i=start or 0,len do
    a:push(ths[i])
  end
  return a
end
arr_proto.concat = function (src1, src2)
  local a = global._arr({})
  for i=0,src1.length-1 do
    a:push(src1[i])
  end
  for i=0,src2.length-1 do
    a:push(src2[i])
  end
  return a
end
arr_proto.join = function (ths, str)
  local _r = ""
  for i=0,ths.length-1 do
    if not ths[i] or ths[i] == _null then _r = _r .. str
    else _r = _r .. ths[i] .. str end
  end
  return string.sub(_r, 1, string.len(_r) - string.len(str))
end
arr_proto.indexOf = function (ths, val)
  for i=0,ths.length-1 do
    if ths[i] == val then
      return i
    end
  end
  return -1
end
arr_proto.map = function (ths, fn)
  local a = global._arr({})
  for i=0,ths.length-1 do
    a:push(fn(ths, ths[i], i))
  end
  return a
end
arr_proto.forEach = function (ths, fn)
  for i=0,ths.length-1 do
    fn(ths, ths[i], i)
  end
  return ths
end
arr_proto.filter = function (ths, fn)
  local a = global._arr({})
  for i=0,ths.length-1 do
    if global._truthy(fn(ths, ths[i], i)) then
      a:push(ths[i])
    end
  end
  return a
end

--[[
Globals
]]--

global.this, global.global = global, global

-- Object

global.Object = {}
global.Object.prototype = obj_proto
global.Object.keys = function (ths, obj)
  local a = global._arr({})
  -- TODO debug this one:
  if type(obj) == 'function' then
    return a
  end
  for k,v in pairs(obj) do
    a:push(k)
  end
  return a
end

-- Array

function table.pack(...)
  return { length = select("#", ...), ... }
end

global.Array = luafunctor(function (one, ...)
  local a = table.pack(...)
  if a.length > 0 or type(one) ~= 'number' then
    a[0] = one
    return global._arr(a)
  elseif one ~= nil then
    local a = {}
    for i=0,tonumber(one)-1 do a[i]=null end
    return global._arr(a)
  end
  return global._arr({})
end)
global.Array.prototype = arr_proto
global.Array.isArray = luafunctor(function (a)
  return (getmetatable(a) or {}) == arr_mt
end)

-- String

global.String = luafunctor(function (str)
  if type(str) == 'table' and type(str.toString) == 'function' then
    return str:toString()
  end
  return tostring(str)
end)
global.String.prototype = str_proto
global.String.fromCharCode = luafunctor(function (ord)
  if ord == nil then return nil end
  if ord < 32 then return string.format('\\x%02x', ord) end
  if ord < 126 then return string.char(ord) end
  if ord < 65539 then return string.format("\\u%04x", ord) end
  if ord < 1114111 then return string.format("\\u%08x", ord) end
end)

-- Math

global.Math = global._obj({
  max = luafunctor(math.max),
  sqrt = luafunctor(math.sqrt),
  floor = luafunctor(math.floor),
  random = luafunctor(math.random)
})

-- Error

global.Error = global._func(function (self, str)
  getmetatable(self).__tostring = function (self)
    return self.message
  end
  self.message = str
  self.stack = ""
end)

-- Console

local function logger (out, ...)
  for i=1,select('#',...) do
    local x = select(i,...)
    if x == nil then 
      out:write("undefined")
    elseif x == null then
      out:write("null")
    elseif type(x) == 'function' then
      out:write("function () { ... }")
    elseif type(x) == 'string' then
      out:write(x)
    else 
      out:write(tostring(x))
      --out:write(global.JSON:stringify(x))
    end
    out:write(' ')
  end
  out:write('\n')
end

global.console = global._obj({
  log = function (self, ...)
    logger(io.stdout, ...)
  end,
  error = function (self, ...)
    logger(io.stderr, ...)
  end
});

-- break/cont flags

global._break = {}; global._cont = {}

-- truthy values

global._truthy = function (o)
  return o and o ~= 0 and o ~= ""
end

-- in-code references

global._bit = bit
global._debug = debug
global._xpcall = xpcall
global._error = error

-- arguments

global._arguments = function (...)
  local arguments = global._arr((function (...)
    local a = {}
    for i=1,select('#', ...) do
      local val, _ = select(i, ...)
      table.insert(a, val)
    end
    return a
  end)(...))
  arguments:shift()
  return arguments
end

-- require function

global.require = luafunctor(require)

-- parseFloat, parseInt

global.parseFloat = luafunctor(function (str)
  return tonumber(str)
end)

global.parseInt = luafunctor(function (str)
  return math.floor(tonumber(str))
end)

-- regexp library

if rex then
  global.RegExp = function (pat, flags)
    local o = {pattern=pat, flags=flags}
    setmetatable(o, {__index=global.RegExp.prototype})
    return o
  end
end

-- json library

-- global.JSON = global._obj({
--  parse = function (ths, arg)
--    return json.decode(arg)
--  end,
--  stringify = function (ths, arg)
--    return json.encode(arg, { indent = true })
--  end,
-- })

-- return namespace

-- eval stub

global.eval = global._func(function () end)

-- NODE JS
-- Emulation

-- process

global.process = global._obj({
  memoryUsage = function (ths)
    return global._obj({
      heapUsed=collectgarbage('count')*1024
    });
  end,
  binding = function (self, key)
    return _G['_colony_binding_' + key](global);
  end
})

-- buffer

local buf_proto = {
  
}

local buffer_mt = {
  __index = function (self, p)
    if (p == "length") then
      if self[0] then return #self + 1 end
      return #self
    else
      return buf_proto[p]
    end
  end
}

global.Buffer = global._func(function (self, size)
  setmetatable(self, buffer_mt)
  return self
end)
global.Buffer.prototype = buf_proto

-- poor man's eval

global.luaeval = global._func(function (self, str)
  local fn = load(str, nil, "t")
  io.stdout:write('stillgood ' + tostring(collectgarbage('count')) + '\n')
  if fn then
    local code, res = pcall(fn)
    return res
  else
    return "[Syntax error in submitted code]"
  end
end)

-- _tm = global._obj(_tm)

-- print('[[end colony mem: ' .. collectgarbage('count') .. 'kb]]');

-- stdio settings

io.stdout:setvbuf('no')

if not setfenv then -- Lua 5.2
  -- based on http://lua-users.org/lists/lua-l/2010-06/msg00314.html
  -- this assumes f is a function
  local function findenv(f)
    local level = 1
    repeat
      local name, value = debug.getupvalue(f, level)
      if name == '_ENV' then return level, value end
      level = level + 1
    until name == nil
    return nil end
  getfenv = function (f) return(select(2, findenv(f)) or _G) end
  setfenv = function (f, t)
    local level = findenv(f)
    if level then debug.setupvalue(f, level, t) end
    return f end
end

colony = {
  global = global,
  enter = function (deps, entry)
    local req = function (self, key)
      return colony.run(deps[deps[entry].deps[key]].func, req)
    end
    return colony.run(deps[entry].func, req)
  end,
  run = function (fn, req)
    local myglobal = {}
    setmetatable(myglobal, {__index = global})
    myglobal.require = req
    setfenv(fn, myglobal)
    return fn(myglobal)
  end
}
return colony
end)()

local deps = {
["/Users/tim/Code/technical/cli/examples/accelerometer.js"] = {
	func = function (_ENV)
local string, math, print, type, pairs = nil, nil, nil, nil, nil;
local _module = {exports={}}; local exports, module = _module.exports, _module;

local mma8452, accel = mma8452, accel;
mma8452 = require(global, ("./mma8452"));
if mma8452:initialize() then end;
while _truthy((1)) do

accel = mma8452:getAcceleration();
if console:log(("x:"), accel[(0)], ("y:"), accel[(1)], ("z:"), accel[(2)]) then end;

end

return _module.exports;
end
,
deps = { ["./mma8452"] = "/Users/tim/Code/technical/cli/examples/mma8452/index.js" }
},
["/Users/tim/Code/technical/cli/examples/mma8452/index.js"] = {
	func = function (_ENV)
local string, math, print, type, pairs = nil, nil, nil, nil, nil;
local _module = {exports={}}; local exports, module = _module.exports, _module;

local tm, ADDRESS, GSCALE, OUT____X____MSB, XYZ____DATA____CFG, WHO____AM____I, CTRL____REG1, read____registers, read____register, write____register, mode____standby, mode____active, getAcceleration, initialize = tm, ADDRESS, GSCALE, OUT____X____MSB, XYZ____DATA____CFG, WHO____AM____I, CTRL____REG1, read____registers, read____register, write____register, mode____standby, mode____active, getAcceleration, initialize;
read__registers = _func(function (this, addressToRead, bytesToRead)
local read__registers = _debug.getinfo(1, 'f').func;
if true then return (function () local base, prop = tm, "i2c_master_request_blocking"; return base[prop](base, tm.I2C_1, ADDRESS, _arr({[0]=addressToRead}), bytesToRead); end)(); end;
end);
read__register = _func(function (this, addressToRead)
local read__register = _debug.getinfo(1, 'f').func;
if true then return (read__registers(global, addressToRead, (1)))[(0)]; end;
end);
write__register = _func(function (this, addressToWrite, dataToWrite)
local write__register = _debug.getinfo(1, 'f').func;
if (function () local base, prop = tm, "i2c_master_send_blocking"; return base[prop](base, tm.I2C_1, ADDRESS, _arr({[0]=addressToWrite, dataToWrite})); end)() then end;
end);
mode__standby = _func(function (this)
local mode__standby = _debug.getinfo(1, 'f').func;
local c = c;
c = read__register(global, CTRL__REG1);
if write__register(global, CTRL__REG1, _bit.band(c, _bit.bnot((1)))) then end;
end);
mode__active = _func(function (this)
local mode__active = _debug.getinfo(1, 'f').func;
local c = c;
c = read__register(global, CTRL__REG1);
if write__register(global, CTRL__REG1, _bit.bor(c, (1))) then end;
end);
getAcceleration = _func(function (this)
local getAcceleration = _debug.getinfo(1, 'f').func;
local rawData, out, i, gCount = rawData, out, i, gCount;
rawData = read__registers(global, OUT__X__MSB, (6));
out = _arr({});
i = (0);
while (i < (3)) do

gCount = _bit.bor(_bit.lshift((rawData)[(i*(2))], (8)), (rawData)[(((i*(2)))+(1))]);
gCount = _bit.rshift(gCount, (4));
if ((rawData)[(i*(2))] > (127)) then
gCount = (-((((1) + (4095)) - gCount)));
end
(out)[i] = (gCount / (((_bit.lshift((1), (12)))/(((2)*GSCALE)))));

(function () local _r = i; i = _r + 1; return _r end)()
end
if true then return out; end;
end);
initialize = _func(function (this)
local initialize = _debug.getinfo(1, 'f').func;
local c, fsr = c, fsr;
if (function () local base, prop = tm, "i2c_initialize"; return base[prop](base, tm.I2C_1); end)() then end;
if (function () local base, prop = tm, "i2c_master_enable"; return base[prop](base, tm.I2C_1); end)() then end;
c = read__register(global, WHO__AM__I);
if _truthy((c == (42))) then
if console:log(("MMA8452Q is online...")) then end;
else
if console:log(("Could not connect to MMA8452Q:"), c) then end;
while _truthy((1)) do
local _c = nil; repeat
_c = _cont; break;
until true;
if _c == _break then break end
end
end
if mode__standby(global) then end;
fsr = GSCALE;
if (fsr > (8)) then
fsr = (8);
end
fsr = fsr > (2);
if write__register(global, XYZ__DATA__CFG, fsr) then end;
if mode__active(global) then end;
end);
tm = process:binding(("tm"));
ADDRESS = (29);
GSCALE = (2);
OUT__X__MSB = (1);
XYZ__DATA__CFG = (14);
WHO__AM__I = (13);
CTRL__REG1 = (42);
(exports)["initialize"] = initialize;
(exports)["getAcceleration"] = getAcceleration;

return _module.exports;
end
,
deps = {  }
},
}

print('[[end colony mem: ' .. collectgarbage('count') .. 'kb]]');

return colony.enter(deps, "/Users/tim/Code/technical/cli/examples/accelerometer.js")
