const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeNewsletterIssue,
  providerRawFieldNames,
  toEditorDraftArtifact,
  toLegacyEditorIssue
} = require('../../../scripts/newsroom/domain/newsletter-domain-normalize');
const {
  validateNewsletterIssueModel
} = require('../../../scripts/newsroom/domain/newsletter-domain-validate');
const {
  section
} = require('../../helpers/quality-builders');

function legacyEditor(sectionOverrides = {}, editorOverrides = {}) {
  return {
    date: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [section({
      headline: 'CameraX release gives HAL teams a target',
      source_candidate_hash: 'camerax-release',
      compactEvidence: { summary: 'CameraX source-backed release evidence.' },
      evidencePackIds: ['seed-camerax-pack'],
      primaryEvidenceIds: ['seed-camerax-primary'],
      linkedEvidenceIds: ['linked-camerax-doc'],
      sourceExtractionRef: 'seed-evidence-pack.json#/packs/0',
      seedUsed: true,
      mergeMode: 'seed_plus_gemini',
      ...sectionOverrides
    })],
    ...editorOverrides
  };
}

function validDomainArticle(overrides = {}) {
  return {
    id: 'article-camerax',
    headline: 'CameraX release gives HAL teams a target',
    category: 'Android Camera',
    evidenceSummary: 'CameraX 1.5.0 release note gives a dated compatibility validation target.',
    sourceRefs: [{
      title: 'CameraX release note',
      url: 'https://example.com/camerax',
      sourceName: 'Android Developers',
      evidenceRole: 'primary'
    }],
    sourceVerificationNotes: ['Official source, dated release evidence.'],
    halPerspective: 'Validate stream, buffer, metadata, and Camera ITS behavior on representative devices.',
    actionItems: [{ description: 'Run Camera ITS preview latency checks within 2 weeks.' }],
    doNotOverstate: ['Do not claim a direct HAL API change.'],
    selectedImage: 'assets/images/fallback/camera-hal.svg',
    ...overrides
  };
}

function validDomainIssue(articleOverrides = {}, issueOverrides = {}) {
  return {
    schemaVersion: 1,
    newsletterDate: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    articles: [validDomainArticle(articleOverrides)],
    references: [{
      title: 'CameraX release note',
      url: 'https://example.com/camerax',
      sourceName: 'Android Developers',
      evidenceRole: 'primary'
    }],
    ...issueOverrides
  };
}

test('domain issue validates and preserves evidence boundary fields', () => {
  const issue = normalizeNewsletterIssue(legacyEditor());
  const article = issue.articles[0];
  const validation = validateNewsletterIssueModel(issue);

  assert.equal(validation.ok, true);
  assert.equal(article.compactEvidence.summary, 'CameraX source-backed release evidence.');
  assert.deepEqual(article.evidencePackIds, ['seed-camerax-pack']);
  assert.deepEqual(article.primaryEvidenceIds, ['seed-camerax-primary']);
  assert.deepEqual(article.linkedEvidenceIds, ['linked-camerax-doc']);
  assert.equal(article.sourceExtractionRef, 'seed-evidence-pack.json#/packs/0');
  assert.equal(article.seedUsed, true);
  assert.equal(article.mergeMode, 'seed_plus_gemini');
});

test('legacy sections normalize to articles and repair missing ids as warnings', () => {
  const issue = normalizeNewsletterIssue(legacyEditor({ source_candidate_hash: '' }));
  const validation = validateNewsletterIssueModel(issue);

  assert.equal(validation.ok, true);
  assert.match(issue.articles[0].id, /^article-1-/);
  assert.ok(validation.warnings.some(item =>
    item.code === 'legacy_field_repaired' &&
    item.path === 'articles[0].id' &&
    item.severity === 'warning'
  ));
});

test('domain validation reports missing article id, source URL, sourceRefs, and action items', () => {
  const missingId = validateNewsletterIssueModel(validDomainIssue({ id: '' }));
  const missingSourceUrl = validateNewsletterIssueModel(validDomainIssue({
    sourceRefs: [{ title: 'Source', url: '', sourceName: 'Source' }]
  }));
  const missingSourceRefs = validateNewsletterIssueModel(validDomainIssue({ sourceRefs: [] }));
  const missingActionItems = validateNewsletterIssueModel(validDomainIssue({ actionItems: [] }));

  assert.ok(missingId.errors.some(item => item.path === 'articles[0].id'));
  assert.ok(missingSourceUrl.errors.some(item => item.path === 'articles[0].sourceRefs[0].url'));
  assert.ok(missingSourceRefs.errors.some(item => item.path === 'articles[0].sourceRefs'));
  assert.ok(missingActionItems.errors.some(item => item.path === 'articles[0].actionItems'));
});

test('public article only legacy sections fail until domain fields can be derived', () => {
  const validation = validateNewsletterIssueModel(legacyEditor({
    evidence_summary: '',
    camera_hal_perspective: '',
    article_sections: {},
    action_items: [],
    sources: [],
    public_article: {
      headline: 'Public-only article',
      lead: 'Public text without domain evidence fields.',
      body_paragraphs: ['Public paragraph.'],
      source_links: []
    }
  }));

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(item => item.path === 'articles[0].evidenceSummary'));
  assert.ok(validation.errors.some(item => item.path === 'articles[0].halPerspective'));
  assert.ok(validation.errors.some(item => item.path === 'articles[0].sourceRefs'));
  assert.ok(validation.errors.some(item => item.path === 'articles[0].actionItems'));
});

test('editor draft artifact exposes domain issue while preserving legacy reader compatibility', () => {
  const draft = toEditorDraftArtifact(legacyEditor(), {
    date: '2026-05-03',
    provider: 'gemini',
    providerModel: 'gemini-3.5-flash'
  });
  const legacy = toLegacyEditorIssue(draft);

  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.newsletterDate, '2026-05-03');
  assert.equal(draft.model.provider, 'gemini');
  assert.equal(draft.issue.articles.length, 1);
  assert.equal(legacy.sections.length, 1);
  assert.equal(legacy.sections[0].public_article.headline, draft.sections[0].public_article.headline);
});

test('optional image absence and dropped provider fields are warnings', () => {
  const fieldName = providerRawFieldNames()[0];
  const validation = validateNewsletterIssueModel({
    ...validDomainIssue({ selectedImage: '' }),
    [fieldName]: { provider: 'raw payload' }
  });

  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some(item => item.code === 'optional_image_missing'));
  assert.ok(validation.warnings.some(item => item.code === 'provider_raw_field_dropped'));
});

test('valid domain issues without legacy renderer fields stay valid with compatibility warning', () => {
  const validation = validateNewsletterIssueModel(validDomainIssue(), {
    requireLegacyRendererFields: true
  });

  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some(item =>
    item.code === 'legacy_renderer_field_missing' &&
    item.severity === 'warning'
  ));
});
