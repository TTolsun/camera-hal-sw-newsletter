const target = require.resolve('../newsroom/collect/source-item-parsers');
delete require.cache[target];
module.exports = require(target);
