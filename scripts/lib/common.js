const target = require.resolve('../newsroom/common/common');
delete require.cache[target];
module.exports = require(target);
