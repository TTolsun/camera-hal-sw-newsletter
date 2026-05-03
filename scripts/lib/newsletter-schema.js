const target = require.resolve('../newsroom/render/newsletter-schema');
delete require.cache[target];
module.exports = require(target);
