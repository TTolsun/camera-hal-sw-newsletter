const NEWSLETTER_DOMAIN_SCHEMA_VERSION = 1;

const REQUIRED_ISSUE_FIELDS = Object.freeze([
  'schemaVersion',
  'newsletterDate',
  'title',
  'summary',
  'briefing',
  'articles',
  'references'
]);

const REQUIRED_ARTICLE_FIELDS = Object.freeze([
  'id',
  'headline',
  'category',
  'sourceRefs',
  'evidenceSummary',
  'sourceVerificationNotes',
  'halPerspective',
  'actionItems',
  'doNotOverstate'
]);

const REQUIRED_SOURCE_REF_FIELDS = Object.freeze([
  'title',
  'url',
  'sourceName'
]);

module.exports = {
  NEWSLETTER_DOMAIN_SCHEMA_VERSION,
  REQUIRED_ARTICLE_FIELDS,
  REQUIRED_ISSUE_FIELDS,
  REQUIRED_SOURCE_REF_FIELDS
};
