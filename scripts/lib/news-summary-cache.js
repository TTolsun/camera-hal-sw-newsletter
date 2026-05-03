const target = require.resolve('../newsroom/generate/news-summary-cache');
delete require.cache[target];
module.exports = require(target);
