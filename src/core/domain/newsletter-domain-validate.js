const {
  NEWSLETTER_DOMAIN_SCHEMA_VERSION
} = require('../../../scripts/newsroom/domain/newsletter-domain-schema');
const {
  NewsletterDomainValidationError,
  domainIssue
} = require('../../../scripts/newsroom/domain/newsletter-domain-errors');
const {
  ensureArray,
  normalizeNewsletterIssue
} = require('./newsletter-domain-normalize');

function text(value) {
  return String(value ?? '').trim();
}

function isUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function pushMissing(errors, path, message) {
  errors.push(domainIssue('missing_required_field', path, message));
}

function validateNewsletterIssueModel(input, options = {}) {
  const issue = normalizeNewsletterIssue(input, options);
  const errors = [];
  const warnings = ensureArray(issue.metadata?.normalizationDiagnostics);

  if (issue.schemaVersion !== NEWSLETTER_DOMAIN_SCHEMA_VERSION) {
    errors.push(domainIssue(
      'unsupported_schema_version',
      'schemaVersion',
      `Unsupported newsletter domain schemaVersion: ${issue.schemaVersion}.`
    ));
  }
  if (!text(issue.newsletterDate)) pushMissing(errors, 'newsletterDate', 'Newsletter date is required.');
  if (!text(issue.title)) pushMissing(errors, 'title', 'Newsletter title is required.');
  if (!text(issue.summary)) pushMissing(errors, 'summary', 'Newsletter summary is required.');
  if (!Array.isArray(issue.briefing)) {
    errors.push(domainIssue('invalid_type', 'briefing', 'Newsletter briefing must be an array.'));
  }
  if (!Array.isArray(issue.articles) || issue.articles.length === 0) {
    errors.push(domainIssue('missing_required_field', 'articles', 'Newsletter articles must contain at least one article.'));
  }
  if (!Array.isArray(issue.references)) {
    errors.push(domainIssue('invalid_type', 'references', 'Newsletter references must be an array.'));
  }

  const articleIds = new Set();
  ensureArray(issue.articles).forEach((article, index) => {
    const basePath = `articles[${index}]`;
    if (!text(article.id)) {
      pushMissing(errors, `${basePath}.id`, 'Article id is required.');
    } else if (articleIds.has(article.id)) {
      errors.push(domainIssue('duplicate_article_id', `${basePath}.id`, `Duplicate article id: ${article.id}.`));
    } else {
      articleIds.add(article.id);
    }
    if (!text(article.headline)) pushMissing(errors, `${basePath}.headline`, 'Article headline is required.');
    if (!text(article.category)) pushMissing(errors, `${basePath}.category`, 'Article category is required.');
    if (!text(article.evidenceSummary)) pushMissing(errors, `${basePath}.evidenceSummary`, 'Article evidence summary is required.');
    if (!Array.isArray(article.sourceVerificationNotes)) {
      errors.push(domainIssue('invalid_type', `${basePath}.sourceVerificationNotes`, 'Article sourceVerificationNotes must be an array.'));
    }
    if (!text(article.halPerspective)) pushMissing(errors, `${basePath}.halPerspective`, 'Article HAL perspective is required.');
    if (!Array.isArray(article.actionItems) || article.actionItems.length === 0) {
      errors.push(domainIssue('missing_required_field', `${basePath}.actionItems`, 'Article actionItems must contain at least one item.'));
    }
    if (!Array.isArray(article.doNotOverstate)) {
      errors.push(domainIssue('invalid_type', `${basePath}.doNotOverstate`, 'Article doNotOverstate must be an array.'));
    }
    if (!Array.isArray(article.sourceRefs) || article.sourceRefs.length === 0) {
      pushMissing(errors, `${basePath}.sourceRefs`, 'Article sourceRefs must contain at least one source.');
    }
    if (text(article.selectedImage) === '') {
      warnings.push(domainIssue(
        'optional_image_missing',
        `${basePath}.selectedImage`,
        'Optional article image is absent.',
        'warning'
      ));
    }
    ensureArray(article.sourceRefs).forEach((source, sourceIndex) => {
      const sourcePath = `${basePath}.sourceRefs[${sourceIndex}]`;
      if (!text(source.title)) pushMissing(errors, `${sourcePath}.title`, 'Article source title is required.');
      if (!text(source.sourceName)) pushMissing(errors, `${sourcePath}.sourceName`, 'Article source name is required.');
      if (!text(source.url)) {
        pushMissing(errors, `${sourcePath}.url`, 'Article source URL is required.');
      } else if (!isUrl(source.url)) {
        errors.push(domainIssue('invalid_source_url', `${sourcePath}.url`, `Article source URL is invalid: ${source.url}.`));
      }
    });
    if (options.requireLegacyRendererFields === true) {
      const legacy = article.metadata?.legacySection || {};
      if (!legacy.public_article || !Array.isArray(legacy.sources)) {
        warnings.push(domainIssue(
          'legacy_renderer_field_missing',
          basePath,
          'Domain issue is valid but lacks complete legacy renderer fields.',
          'warning'
        ));
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: issue
  };
}

function assertNewsletterIssueModel(input, options = {}) {
  const result = validateNewsletterIssueModel(input, options);
  if (!result.ok) {
    throw new NewsletterDomainValidationError(result.errors);
  }
  return result.normalized;
}

module.exports = {
  NewsletterDomainValidationError,
  assertNewsletterIssueModel,
  validateNewsletterIssueModel
};
