const target = require.resolve('../newsroom/generate/gemini-client');
delete require.cache[target];
module.exports = require(target);
