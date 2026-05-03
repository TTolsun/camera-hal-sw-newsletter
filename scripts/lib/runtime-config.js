const target = require.resolve('../newsroom/common/runtime-config');
delete require.cache[target];
module.exports = require(target);
