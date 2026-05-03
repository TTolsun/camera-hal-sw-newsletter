const target = require.resolve('../newsroom/render/image-candidates');
delete require.cache[target];
module.exports = require(target);
