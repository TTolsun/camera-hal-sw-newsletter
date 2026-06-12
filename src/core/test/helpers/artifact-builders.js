function artifactManifestEntry(overrides = {}) {
  return {
    path: overrides.path || 'content/newsroom/2026-05-05/editor-draft.json',
    exists: overrides.exists !== undefined ? overrides.exists : true,
    sha256: overrides.sha256 || '0'.repeat(64),
    bytes: overrides.bytes !== undefined ? overrides.bytes : 128,
    ...overrides
  };
}

module.exports = {
  artifactManifestEntry
};
