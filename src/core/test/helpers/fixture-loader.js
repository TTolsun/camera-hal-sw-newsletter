const fs = require('fs');
const path = require('path');

const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

function resolveFixturePath(relativePath) {
  const resolved = path.resolve(fixturesRoot, relativePath);
  const relative = path.relative(fixturesRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Fixture path escapes tests/fixtures: ${relativePath}`);
  }
  return resolved;
}

function readTextFixture(relativePath) {
  return fs.readFileSync(resolveFixturePath(relativePath), 'utf8');
}

function readJsonFixture(relativePath) {
  return JSON.parse(readTextFixture(relativePath));
}

function listFixtureFiles(relativeDir, extension = '') {
  const dir = resolveFixturePath(relativeDir);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRelative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFixtureFiles(childRelative, extension));
    } else if (!extension || entry.name.endsWith(extension)) {
      files.push(resolveFixturePath(childRelative));
    }
  }
  return files;
}

module.exports = {
  fixturesRoot,
  listFixtureFiles,
  readJsonFixture,
  readTextFixture,
  resolveFixturePath
};
