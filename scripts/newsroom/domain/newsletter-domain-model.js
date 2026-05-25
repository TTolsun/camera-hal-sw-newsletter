const {
  normalizeNewsletterIssue,
  toEditorDraftArtifact,
  toLegacyEditorIssue
} = require('./newsletter-domain-normalize');

function createNewsletterIssue(input = {}, options = {}) {
  return normalizeNewsletterIssue(input, options);
}

module.exports = {
  createNewsletterIssue,
  normalizeNewsletterIssue,
  toEditorDraftArtifact,
  toLegacyEditorIssue
};
