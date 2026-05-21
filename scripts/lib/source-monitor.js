const target = require.resolve('../newsroom/collect/source-monitor');
delete require.cache[target];
module.exports = require(target);
