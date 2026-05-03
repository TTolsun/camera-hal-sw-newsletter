const target = require.resolve('../newsroom/render/article-image-resolver');
delete require.cache[target];
module.exports = require(target);
