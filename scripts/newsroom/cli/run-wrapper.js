const path = require('path');
const { spawnSync } = require('child_process');

function runWrapper(parentFilename, target) {
  const targetPath = path.join(path.dirname(parentFilename), target);
  if (require.main?.filename === parentFilename) {
    const result = spawnSync(process.execPath, [targetPath, ...process.argv.slice(2)], {
      stdio: 'inherit'
    });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
  return require(targetPath);
}

module.exports = runWrapper;
