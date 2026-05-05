const target = require.resolve('../newsroom/common/aosp-camera-scope');
delete require.cache[target];
module.exports = require(target);
