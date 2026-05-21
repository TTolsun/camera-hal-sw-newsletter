const target = require.resolve('../newsroom/validate/source-monitor-registry-validator');
delete require.cache[target];
module.exports = require(target);
