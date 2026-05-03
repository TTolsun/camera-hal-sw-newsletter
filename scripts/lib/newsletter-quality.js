const target = require.resolve('../newsroom/validate/newsletter-quality');
delete require.cache[target];
module.exports = require(target);
