const target = require.resolve('../newsroom/generate/selection-diagnostics');
delete require.cache[target];
module.exports = require(target);
