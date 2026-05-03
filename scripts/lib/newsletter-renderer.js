const target = require.resolve('../newsroom/render/newsletter-renderer');
delete require.cache[target];
module.exports = require(target);
