const target = require.resolve('../newsroom/collect/news-source-section-resolver');
delete require.cache[target];
module.exports = require(target);
