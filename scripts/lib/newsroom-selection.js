const target = require.resolve('../newsroom/generate/newsroom-selection');
delete require.cache[target];
module.exports = require(target);
