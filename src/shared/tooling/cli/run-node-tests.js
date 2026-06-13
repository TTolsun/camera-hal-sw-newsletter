const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function toDisplayPath(filePath, root = process.cwd()) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function collectTestFiles(entryPath, root = process.cwd(), output = []) {
  const absolutePath = path.resolve(root, entryPath);
  const stats = fs.statSync(absolutePath);

  if (stats.isDirectory()) {
    for (const child of fs.readdirSync(absolutePath).sort()) {
      collectTestFiles(path.join(absolutePath, child), root, output);
    }
    return output;
  }

  if (stats.isFile() && /\.test\.js$/.test(absolutePath)) {
    output.push(absolutePath);
  }

  return output;
}

function collectTestFilesForArgs(args, root = process.cwd()) {
  const inputs = args.length > 0 ? args : ['tests'];
  const files = [];

  for (const input of inputs) {
    collectTestFiles(input, root, files);
  }

  return [...new Set(files)]
    .sort()
    .map(filePath => toDisplayPath(filePath, root));
}

function runNodeTests(args = process.argv.slice(2), options = {}) {
  const root = options.root || process.cwd();
  const files = collectTestFilesForArgs(args, root);

  if (files.length === 0) {
    console.error(`No Node test files found under: ${(args.length > 0 ? args : ['tests']).join(', ')}`);
    return 1;
  }

  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: root,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (require.main === module) {
  process.exit(runNodeTests());
}

module.exports = {
  collectTestFiles,
  collectTestFilesForArgs,
  runNodeTests
};
