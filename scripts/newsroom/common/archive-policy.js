const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ARCHIVE_STATUSES = new Set([
  'stable_archive',
  'reviewed_archive',
  'historical_unreviewed',
  'deprecated_archive',
  'removed'
]);

const PUBLIC_VISIBILITIES = new Set([
  'listed',
  'unlisted',
  'removed'
]);

const MATERIAL_REWRITE_STATUS = 'material_rewrite';
const FAKE_SEED_PROVENANCE_PATTERN = /\b(?:seed_evidence|seed-evidence-pack|seed_url|linked_evidence|compact_evidence|source_provenance)\b|Evidence Pack/;
const FORBIDDEN_GOOD_FIXTURE_PROVENANCE = new Set([
  'historically_rewritten_public_article',
  'pre_185_generated_public_article',
  'generated_newsletter_public_article'
]);

module.exports = {
  DATE_PATTERN,
  ARCHIVE_STATUSES,
  PUBLIC_VISIBILITIES,
  MATERIAL_REWRITE_STATUS,
  FAKE_SEED_PROVENANCE_PATTERN,
  FORBIDDEN_GOOD_FIXTURE_PROVENANCE
};
