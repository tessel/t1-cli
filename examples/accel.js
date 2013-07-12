local MMA8452____ADDRESS, GSCALE, OUT____X____MSB, XYZ____DATA____CFG, WHO____AM____I, CTRL____REG1, mma8452____read____registers, mma8452____read____register, mma8452____write____register, mma8452____mode____standby, mma8452____mode____active, mma8452____accel____read, mma8452____initialize, accel;
mma8452__read__registers = _JS._func(function (this, addressToRead, bytesToRead)
local mma8452__read__registers = debug.getinfo(1, 'f').func;
if true then return (function () local base, prop = _tm, "i2c_master_request_blocking"; return base[prop](base, _tm.I2C_1, MMA8452__ADDRESS, _JS._arr({[0]=addressToRead}), bytesToRead); end)(); end;
end);
mma8452__read__register = _JS._func(function (this, addressToRead)
local mma8452__read__register = debug.getinfo(1, 'f').func;
if true then return (mma8452__read__registers(global, addressToRead, (1)))[(0)]; end;
end);
mma8452__write__register = _JS._func(function (this, addressToWrite, dataToWrite)
local mma8452__write__register = debug.getinfo(1, 'f').func;
if (function () local base, prop = _tm, "i2c_master_send_blocking"; return base[prop](base, _tm.I2C_1, MMA8452__ADDRESS, _JS._arr({[0]=addressToWrite, dataToWrite})); end)() then end;
end);
mma8452__mode__standby = _JS._func(function (this)
local mma8452__mode__standby = debug.getinfo(1, 'f').func;
local c;
c = mma8452__read__register(global, CTRL__REG1);
if mma8452__write__register(global, CTRL__REG1, _JS._bit.band(c, _JS._bit.bnot((1)))) then end;
end);
mma8452__mode__active = _JS._func(function (this)
local mma8452__mode__active = debug.getinfo(1, 'f').func;
local c;
c = mma8452__read__register(global, CTRL__REG1);
if mma8452__write__register(global, CTRL__REG1, _JS._bit.bor(c, (1))) then end;
end);
mma8452__accel__read = _JS._func(function (this)
local mma8452__accel__read = debug.getinfo(1, 'f').func;
local rawData, out, i, gCount;
rawData = mma8452__read__registers(global, OUT__X__MSB, (6));
out = _JS._arr({});
i = (0);
while (i < (3)) do

gCount = _JS._bit.bor(_JS._bit.lshift((rawData)[(i*(2))], (8)), (rawData)[(((i*(2)))+(1))]);
gCount = _JS._bit.rshift(gCount, (4));
if ((rawData)[(i*(2))] > (127)) then
gCount = (-((((1) + (4095)) - gCount)));
end
(out)[i] = (gCount / (((_JS._bit.lshift((1), (12)))/(((2)*GSCALE)))));

(function () local _r = i; i = _r + 1; return _r end)()
end
if true then return out; end;
end);
mma8452__initialize = _JS._func(function (this)
local mma8452__initialize = debug.getinfo(1, 'f').func;
local c, fsr;
c = mma8452__read__register(global, WHO__AM__I);
if _JS._truthy((c == (42))) then
if console:log(("MMA8452Q is online...")) then end;
else
if console:log(("Could not connect to MMA8452Q:"), c) then end;
while _JS._truthy((1)) do
local _c = nil; repeat
_c = _JS._cont; break;
until true;
if _c == _JS._break then break end
end
end
if mma8452__mode__standby(global) then end;
fsr = GSCALE;
if (fsr > (8)) then
fsr = (8);
end
fsr = fsr > (2);
if mma8452__write__register(global, XYZ__DATA__CFG, fsr) then end;
if mma8452__mode__active(global) then end;
end);
MMA8452__ADDRESS = (29);
GSCALE = (2);
OUT__X__MSB = (1);
XYZ__DATA__CFG = (14);
WHO__AM__I = (13);
CTRL__REG1 = (42);
if (function () local base, prop = _tm, "i2c_initialize"; return base[prop](base, _tm.I2C_1); end)() then end;
if (function () local base, prop = _tm, "i2c_master_enable"; return base[prop](base, _tm.I2C_1); end)() then end;
if mma8452__initialize(global) then end;
while _JS._truthy((1)) do

accel = mma8452__accel__read(global);
if console:log(("x:"), accel[(0)], ("y:"), accel[(1)], ("z:"), accel[(2)]) then end;

end