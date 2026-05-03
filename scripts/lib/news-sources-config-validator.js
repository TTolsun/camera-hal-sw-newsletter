const target = require.resolve('../newsroom/validate/news-sources-config-validator');
delete require.cache[target];
module.exports = require(target);
