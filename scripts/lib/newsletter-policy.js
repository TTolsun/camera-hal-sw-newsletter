const target = require.resolve('../newsroom/common/newsletter-policy');
delete require.cache[target];
module.exports = require(target);
