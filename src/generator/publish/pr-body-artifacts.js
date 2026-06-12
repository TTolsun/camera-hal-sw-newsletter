// PR-body artifact IO and location.
//
// Single responsibility: locating and loading the newsroom/collected-news artifacts that the
// PR-body renderers summarize. Renderers stay focused on formatting and call these loaders
// instead of repeating fs + path.join boilerplate. Pure IO (no markdown, no rendering).

const fs = require('fs');
const path = require('path');

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function readJsonObjectIfExists(filePath) {
  const value = readJsonIfExists(filePath);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function newsroomArtifactPath(root, date, name) {
  return path.join(root, 'content', 'newsroom', date, name);
}

function collectedArtifactPath(root, date, name) {
  return path.join(root, 'content', 'collected-news', date, name);
}

function loadNewsroomJson(root, date, name) {
  return readJsonIfExists(newsroomArtifactPath(root, date, name));
}

function loadNewsroomReport(root, date, name) {
  return readJsonObjectIfExists(newsroomArtifactPath(root, date, name));
}

function loadCollectedReport(root, date, name) {
  return readJsonObjectIfExists(collectedArtifactPath(root, date, name));
}

module.exports = {
  collectedArtifactPath,
  loadCollectedReport,
  loadNewsroomJson,
  loadNewsroomReport,
  newsroomArtifactPath,
  readJsonIfExists,
  readJsonObjectIfExists,
  readTextIfExists
};
