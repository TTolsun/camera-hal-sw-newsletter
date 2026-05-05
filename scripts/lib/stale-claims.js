const target = require.resolve('../newsroom/common/stale-claims');
delete require.cache[target];
module.exports = require(target);
