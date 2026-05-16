const path = require('path');

const CONTENT_ROOT = 'content';
const COLLECTED_NEWS_ROOT = `${CONTENT_ROOT}/collected-news`;
const NEWSROOM_ROOT = `${CONTENT_ROOT}/newsroom`;

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function collectedNewsDir(root, date) {
  return path.join(root, CONTENT_ROOT, 'collected-news', date);
}

function collectedCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'candidates.json');
}

function collectedCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/candidates.json`;
}

function manualCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'manual-candidates.json');
}

function manualCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/manual-candidates.json`;
}

function mergedCandidatesPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'merged-candidates.json');
}

function mergedCandidatesRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/merged-candidates.json`;
}

function rawCandidateManifestPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'raw-candidate-manifest.json');
}

function rawCandidateManifestRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/raw-candidate-manifest.json`;
}

function mergedCandidateManifestPath(root, date) {
  return path.join(collectedNewsDir(root, date), 'merged-candidate-manifest.json');
}

function mergedCandidateManifestRelPath(date) {
  return `${COLLECTED_NEWS_ROOT}/${date}/merged-candidate-manifest.json`;
}

function newsroomDir(root, date) {
  return path.join(root, CONTENT_ROOT, 'newsroom', date);
}

function newsroomRelPath(date, filename = '') {
  return filename ? `${NEWSROOM_ROOT}/${date}/${filename}` : `${NEWSROOM_ROOT}/${date}`;
}

function changedArtifactDate(relPath) {
  const normalized = toPosix(relPath);
  const match = normalized.match(/^(?:newsletters|content\/newsroom|content\/collected-news)\/(\d{4}-\d{2}-\d{2})(?:\/|$)/);
  return match ? match[1] : '';
}

module.exports = {
  COLLECTED_NEWS_ROOT,
  CONTENT_ROOT,
  NEWSROOM_ROOT,
  changedArtifactDate,
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  collectedNewsDir,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  toPosix
};
