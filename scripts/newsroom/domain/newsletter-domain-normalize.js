const { ensureArray } = require('../common/value-coercion');
const {
  NEWSLETTER_DOMAIN_SCHEMA_VERSION
} = require('./newsletter-domain-schema');
const {
  domainIssue
} = require('./newsletter-domain-errors');

function text(value) {
  return String(value ?? '').trim();
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function slug(value, fallback = 'article') {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function issuePayload(input = {}) {
  if (input && typeof input === 'object' && input.issue && typeof input.issue === 'object') {
    return input.issue;
  }
  return input || {};
}

function isDomainDraftArtifact(input = {}) {
  return Boolean(input && typeof input === 'object' && input.issue && typeof input.issue === 'object');
}

function providerRawFieldNames() {
  return [
    ['raw', 'Response'].join(''),
    ['provider', 'Response'].join(''),
    ['gemini', 'Response'].join(''),
    ['openapi', 'Response'].join(''),
    ['output', 'json'].join('_')
  ];
}

function normalizeSourceRef(source = {}, fallback = {}) {
  const url = text(source.url || source.href || fallback.url);
  const title = text(source.title || source.name || fallback.title || url);
  const sourceName = text(
    source.sourceName ||
    source.source_name ||
    source.publisher ||
    source.source ||
    fallback.sourceName ||
    title ||
    url
  );
  return {
    title,
    url,
    sourceName,
    publishedDate: text(source.publishedDate || source.published_date || source.checked_at || fallback.publishedDate),
    evidenceRole: text(source.evidenceRole || source.evidence_role || source.source_role || fallback.evidenceRole || 'primary')
  };
}

function sourceRefsFromLegacySection(section = {}) {
  const refs = ensureArray(section.sourceRefs || section.source_refs)
    .concat(ensureArray(section.sources))
    .concat(ensureArray(section.public_article?.source_links));
  const seen = new Set();
  return refs
    .map(source => normalizeSourceRef(source, {
      title: section.headline,
      url: section.source_candidate_url
    }))
    .filter(source => {
      const key = source.url || `${source.title}:${source.sourceName}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeActionItem(item) {
  if (item && typeof item === 'object') {
    return {
      owner: text(item.owner),
      test: text(item.test),
      log: text(item.log),
      metric: text(item.metric),
      deviceClass: text(item.deviceClass || item.device_class),
      dueWindow: text(item.dueWindow || item.due_window || '1-2 weeks'),
      description: text(item.description || item.action || item.text)
    };
  }
  return {
    owner: '',
    test: '',
    log: '',
    metric: '',
    deviceClass: '',
    dueWindow: '1-2 weeks',
    description: text(item)
  };
}

function legacyActionItems(article = {}, legacySection = {}) {
  return ensureArray(
    article.actionItems ||
    article.action_items ||
    legacySection.article_sections?.action_items ||
    legacySection.action_items
  ).map(normalizeActionItem);
}

function normalizeArticle(input = {}, index = 0, diagnostics = [], options = {}) {
  const legacySection = input.metadata?.legacySection || input.legacySection || input;
  const sourceRefs = ensureArray(input.sourceRefs || input.source_refs).length > 0
    ? ensureArray(input.sourceRefs || input.source_refs).map(normalizeSourceRef)
    : sourceRefsFromLegacySection(legacySection);
  const id = text(
    input.id ||
    legacySection.id ||
    legacySection.article_id ||
    legacySection.source_candidate_hash ||
    legacySection.article_group_key
  );
  const shouldRepairId = !id && options.legacy === true;
  const repairedId = shouldRepairId
    ? `article-${index + 1}-${slug(input.headline || legacySection.headline, String(index + 1))}`
    : id;
  if (shouldRepairId) {
    diagnostics.push(domainIssue(
      'legacy_field_repaired',
      `articles[${index}].id`,
      'Legacy article id was missing and was derived from article position/headline.',
      'warning',
      { mappedTo: 'id' }
    ));
  }
  const actionItems = legacyActionItems(input, legacySection);
  return {
    id: repairedId,
    headline: text(input.headline || legacySection.headline || legacySection.public_article?.headline),
    category: text(input.category || legacySection.category || legacySection.article_type || 'article'),
    sourceRefs,
    evidenceSummary: text(input.evidenceSummary || input.evidence_summary || legacySection.evidence_summary),
    specificityChecks: input.specificityChecks || legacySection.specificity_checks || {},
    sourceVerificationNotes: ensureArray(
      input.sourceVerificationNotes ||
      input.source_verification_notes ||
      legacySection.source_verification_notes
    ).map(text).filter(Boolean),
    compactEvidence: input.compactEvidence || input.compact_evidence || legacySection.compactEvidence || legacySection.compact_evidence || null,
    evidencePackIds: ensureArray(input.evidencePackIds || input.evidence_pack_ids || legacySection.evidencePackIds || legacySection.evidence_pack_ids).map(text).filter(Boolean),
    primaryEvidenceIds: ensureArray(input.primaryEvidenceIds || input.primary_evidence_ids || legacySection.primaryEvidenceIds || legacySection.primary_evidence_ids).map(text).filter(Boolean),
    linkedEvidenceIds: ensureArray(input.linkedEvidenceIds || input.linked_evidence_ids || legacySection.linkedEvidenceIds || legacySection.linked_evidence_ids).map(text).filter(Boolean),
    sourceExtractionRef: text(input.sourceExtractionRef || input.source_extraction_ref || legacySection.sourceExtractionRef || legacySection.source_extraction_ref),
    seedUsed: input.seedUsed ?? input.seed_used ?? legacySection.seedUsed ?? legacySection.seed_used ?? null,
    mergeMode: text(input.mergeMode || input.merge_mode || legacySection.mergeMode || legacySection.merge_mode),
    halPerspective: text(
      input.halPerspective ||
      legacySection.article_sections?.hal_driver_impact ||
      legacySection.camera_hal_perspective ||
      legacySection.public_article?.camera_hal_takeaway
    ),
    actionItems,
    doNotOverstate: ensureArray(
      input.doNotOverstate ||
      input.do_not_overstate ||
      legacySection.do_not_overstate ||
      legacySection.article_sections?.do_not_claim ||
      legacySection.hal_signal_capsule?.do_not_overstate
    ).map(text).filter(Boolean),
    teamShareLine: text(input.teamShareLine || input.team_share_line || legacySection.team_summary || legacySection.article_sections?.team_share_points),
    selectedImage: input.selectedImage ?? legacySection.selectedImage ?? null,
    resolvedImage: input.resolvedImage || legacySection.resolvedImage || null,
    qualityHints: input.qualityHints || input.quality_hints || legacySection.quality_hints || {},
    metadata: {
      ...(input.metadata || {}),
      legacySection: cloneJson(legacySection)
    }
  };
}

function normalizeNewsletterIssue(input = {}, options = {}) {
  const source = issuePayload(input);
  const diagnostics = [];
  const legacy = !Array.isArray(source.articles) && Array.isArray(source.sections);
  const rawArticles = Array.isArray(source.articles) ? source.articles : ensureArray(source.sections);
  for (const fieldName of providerRawFieldNames()) {
    if (
      Object.prototype.hasOwnProperty.call(input, fieldName) ||
      Object.prototype.hasOwnProperty.call(source, fieldName)
    ) {
      diagnostics.push(domainIssue(
        'provider_raw_field_dropped',
        fieldName,
        'Provider raw response field was dropped at the domain boundary.',
        'warning'
      ));
    }
  }
  const newsletterDate = text(source.newsletterDate || source.newsletter_date || source.date || input.newsletterDate || input.date || options.date);
  const issue = {
    schemaVersion: Number(source.schemaVersion || source.schema_version || NEWSLETTER_DOMAIN_SCHEMA_VERSION),
    newsletterDate,
    title: text(source.title || input.title || (newsletterDate ? `Camera HAL / SW Newsletter - ${newsletterDate}` : 'Camera HAL / SW Newsletter')),
    summary: text(source.summary || input.summary),
    briefing: ensureArray(source.briefing || input.briefing).map(text).filter(Boolean),
    articles: rawArticles.map((article, index) => normalizeArticle(article, index, diagnostics, { legacy })),
    actionItems: ensureArray(source.actionItems || source.action_items || input.action_items).map(normalizeActionItem),
    references: ensureArray(source.references || input.references).map(normalizeSourceRef),
    metadata: {
      ...(source.metadata || {}),
      legacy,
      artifactSchemaVersion: input.schemaVersion || input.schema_version || null,
      model: input.model || null,
      adapterDiagnostics: input.adapterDiagnostics || input.adapter_diagnostics || null
    }
  };
  if (diagnostics.length > 0) issue.metadata.normalizationDiagnostics = diagnostics;
  return issue;
}

function actionItemsToLegacyStrings(items = []) {
  return ensureArray(items)
    .map(item => {
      if (typeof item === 'string') return text(item);
      return text(item?.description || item?.test || item?.metric || item?.owner);
    })
    .filter(Boolean);
}

function sourceRefsToLegacySources(sourceRefs = []) {
  return ensureArray(sourceRefs).map(source => ({
    title: source.title || source.sourceName || source.url,
    url: source.url
  })).filter(source => source.url);
}

function toLegacySection(article = {}, index = 0) {
  const legacy = cloneJson(article.metadata?.legacySection || {});
  const sources = sourceRefsToLegacySources(article.sourceRefs);
  const actionItems = actionItemsToLegacyStrings(article.actionItems);
  return {
    ...legacy,
    category: legacy.category || article.category,
    headline: legacy.headline || article.headline,
    evidence_summary: legacy.evidence_summary || article.evidenceSummary,
    specificity_checks: legacy.specificity_checks || article.specificityChecks || {},
    source_verification_notes: legacy.source_verification_notes || article.sourceVerificationNotes || [],
    camera_hal_perspective: legacy.camera_hal_perspective || article.halPerspective,
    action_items: legacy.action_items || actionItems,
    do_not_overstate: legacy.do_not_overstate || article.doNotOverstate || [],
    selectedImage: legacy.selectedImage ?? article.selectedImage ?? '',
    resolvedImage: legacy.resolvedImage || article.resolvedImage || null,
    sources: ensureArray(legacy.sources).length > 0 ? legacy.sources : sources,
    public_article: legacy.public_article || {
      headline: article.headline,
      lead: article.evidenceSummary || article.summary || '',
      body_paragraphs: [],
      camera_hal_takeaway: article.halPerspective || '',
      reader_checkpoints: actionItems,
      source_links: sources,
      story_contract_version: 1,
      source_subtitle: ''
    },
    article_sections: legacy.article_sections || {
      verified_facts: [],
      background_context: legacy.background || '',
      hal_driver_impact: article.halPerspective || '',
      action_items: actionItems,
      team_share_points: article.teamShareLine || ''
    },
    source_candidate_hash: legacy.source_candidate_hash || article.id || `article-${index + 1}`
  };
}

function toLegacyEditorIssue(input = {}, options = {}) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input.sections) && !isDomainDraftArtifact(input)) return input;
  const issue = normalizeNewsletterIssue(input, options);
  return {
    date: issue.newsletterDate,
    public_contract_version: input.public_contract_version || issue.metadata.public_contract_version,
    generation_contract_version: input.generation_contract_version || issue.metadata.generation_contract_version,
    title: issue.title,
    summary: issue.summary,
    briefing: issue.briefing,
    sections: issue.articles.map(toLegacySection),
    action_items: actionItemsToLegacyStrings(issue.actionItems),
    references: sourceRefsToLegacySources(issue.references),
    tags: input.tags || issue.metadata.tags,
    publication_mode: input.publication_mode || issue.metadata.publication_mode,
    review_publication_ready: input.review_publication_ready ?? issue.metadata.review_publication_ready,
    fallback_only: input.fallback_only ?? issue.metadata.fallback_only,
    publication_notice: input.publication_notice || issue.metadata.publication_notice
  };
}

function toEditorDraftArtifact(editor = {}, context = {}) {
  const issue = normalizeNewsletterIssue(editor, { date: context.newsletterDate || context.date });
  const legacy = toLegacyEditorIssue(issue);
  return {
    schemaVersion: 1,
    newsletterDate: issue.newsletterDate,
    model: {
      provider: context.provider || 'gemini',
      providerModel: context.providerModel || 'unknown'
    },
    issue,
    adapterDiagnostics: {
      warnings: ensureArray(context.warnings),
      repairedFields: ensureArray(context.repairedFields),
      droppedFields: ensureArray(context.droppedFields),
      rawResponseStored: context.rawResponseStored === true
    },
    ...legacy
  };
}

module.exports = {
  ensureArray,
  isDomainDraftArtifact,
  normalizeNewsletterIssue,
  providerRawFieldNames,
  sourceRefsFromLegacySection,
  toEditorDraftArtifact,
  toLegacyEditorIssue
};
