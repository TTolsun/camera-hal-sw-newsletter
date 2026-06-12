const fs = require('fs');
const path = require('path');

const {
  buildHtml,
  buildMarkdown,
  ensureArray
} = require('./newsletter-renderer');
const {
  REJECT_PATH_PATTERN,
  validateImageUrl
} = require('../../core/render/image-candidates');
const {
  assertKnownImageReasonCode,
  imageReasonLabelKo,
  imageReasonTextKo
} = require('./newsletter-image-audit-labels.ko');
const {
  syncWeeklyArticleImages
} = require('./weekly-newsletter-output');

const DIRECT_EXTRACTION_SOURCE_KINDS = new Set([
  'og',
  'og:image',
  'twitter',
  'twitter:image',
  'twitter:image:src',
  'rss-media',
  'rss-enclosure',
  'article-img',
  'json-ld'
]);

const RASTER_CONTENT_TYPE_PATTERN = /^image\/(?:png|jpe?g|webp|gif|avif|apng)$/i;
const SVG_CONTENT_TYPE_PATTERN = /^image\/svg\+xml$/i;
const IMAGE_CONTENT_TYPE_PATTERN = /^image\//i;
const MIN_IMAGE_SIDE = 160;
const TRACKING_PATTERN = /(?:tracker|tracking|pixel|beacon|transparent|spacer|blank|1x1)/i;
const LOGO_PATTERN = /(?:^|[/-])(?:favicon|apple-touch-icon|mstile|logo|sprite|avatar|icon)(?:[./_-]|$)/i;

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function urlOrEmpty(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).toString();
  } catch {
    return '';
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function originOf(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function firstSource(section = {}) {
  return ensureArray(section.sources)[0] || ensureArray(section.public_article?.source_links)[0] || {};
}

function sourceUrlForSection(section = {}) {
  return String(
    section.source_candidate_url ||
    firstSource(section).url ||
    section.public_article?.source_links?.[0]?.url ||
    ''
  ).trim();
}

function comparableUrl(value) {
  const normalized = urlOrEmpty(value);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function selectedImageComparable(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalizedUrl = comparableUrl(raw);
  return normalizedUrl || toPosixPath(raw);
}

function isRepoLocalFallbackImage(value) {
  const normalized = toPosixPath(String(value || '').trim());
  return Boolean(normalized && !/^https?:\/\//i.test(normalized) && normalized.includes('assets/images/fallback/'));
}

function articleTitle(section = {}, index = 0) {
  return String(
    section.public_article?.headline ||
    section.article_sections?.headline ||
    section.headline ||
    section.category ||
    `Article ${index + 1}`
  ).trim();
}

function normalizeSourceKind(value) {
  return String(value || '').trim().toLowerCase();
}

function candidateSourceUrl(candidate = {}, section = {}) {
  return String(
    candidate.extractedFromUrl ||
    candidate.extracted_from_url ||
    candidate.articleUrl ||
    candidate.article_url ||
    candidate.sourceUrl ||
    candidate.source_url ||
    sourceUrlForSection(section)
  ).trim();
}

function candidateAttribution(candidate = {}, section = {}) {
  return String(candidate.attribution || section.imageAttribution || firstSource(section).title || '').trim();
}

function candidateLicenseStatus(candidate = {}) {
  return String(candidate.licenseStatus || candidate.license_status || '').trim();
}

function candidateContentType(candidate = {}) {
  return String(candidate.contentType || candidate.content_type || '').trim().toLowerCase();
}

function candidateDimensions(candidate = {}) {
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  return {
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null
  };
}

function candidateUrlLooksLikeLogo(url) {
  return LOGO_PATTERN.test(String(url || '')) || REJECT_PATH_PATTERN.test(String(url || ''));
}

function candidateUrlLooksTracking(url) {
  return TRACKING_PATTERN.test(String(url || ''));
}

function extractionEvidence(candidate = {}, section = {}) {
  const sourceKind = normalizeSourceKind(candidate.sourceKind || candidate.source_kind || candidate.extractedFrom);
  const canonicalSourceUrl = sourceUrlForSection(section);
  const sourceUrl = candidateSourceUrl(candidate, section);
  const candidateOrigin = originOf(candidate.url);
  const canonicalOrigin = originOf(canonicalSourceUrl);
  const sourceOrigin = originOf(sourceUrl);
  const sameOrigin = Boolean(candidateOrigin && canonicalOrigin && candidateOrigin === canonicalOrigin);
  const sourceMatchesCanonical = Boolean(
    sourceUrl &&
    canonicalSourceUrl &&
    (
      comparableUrl(sourceUrl) === comparableUrl(canonicalSourceUrl) ||
      (sourceOrigin && canonicalOrigin && sourceOrigin === canonicalOrigin)
    )
  );
  const directExtraction = DIRECT_EXTRACTION_SOURCE_KINDS.has(sourceKind) && sourceMatchesCanonical;
  return {
    sourceKind,
    sourceUrl,
    canonicalSourceUrl,
    sameOrigin,
    directExtraction,
    ok: Boolean(canonicalSourceUrl && (sameOrigin || directExtraction))
  };
}

function exclusion(reasonCode, candidate = {}, details = {}) {
  assertKnownImageReasonCode(reasonCode);
  return {
    candidate_url: candidate.url || '',
    reasonCode,
    reasonLabel: imageReasonLabelKo(reasonCode),
    reasonText: imageReasonTextKo(reasonCode),
    sourceKind: candidate.sourceKind || candidate.source_kind || '',
    contentType: candidateContentType(candidate),
    validationStatus: candidate.validationStatus || candidate.validation_status || '',
    ...details
  };
}

function reasonEvidence(reasonCode, details = {}) {
  assertKnownImageReasonCode(reasonCode);
  return {
    reasonCode,
    reasonLabel: imageReasonLabelKo(reasonCode),
    reasonText: imageReasonTextKo(reasonCode),
    ...details
  };
}

async function validationEvidence(candidate, options = {}) {
  const status = String(candidate.validationStatus || candidate.validation_status || '').trim().toLowerCase();
  if (status === 'ok') {
    return {
      ok: true,
      validationStatus: 'ok',
      validationSource: 'candidate_metadata',
      raw: null
    };
  }
  if (!options.liveValidation) {
    return {
      ok: false,
      reasonCode: status ? 'validator_failed_transient' : 'missing_candidate_metadata',
      validationStatus: status || 'unknown',
      validationSource: 'not_run',
      raw: null
    };
  }

  const validate = options.validateImageUrl || validateImageUrl;
  const raw = await validate(candidate.url, {
    timeoutMs: options.timeoutMs || 8000,
    attempts: options.attempts || 1,
    backoffMs: options.backoffMs || 250
  });
  if (raw.ok) {
    return {
      ok: true,
      validationStatus: 'ok',
      validationSource: 'live_validator',
      raw
    };
  }
  const reason = String(raw.reason || '').toLowerCase();
  let reasonCode = 'validator_failed_transient';
  if (reason.includes('timeout')) reasonCode = 'validator_timeout';
  if (raw.status >= 400 && raw.status < 500) reasonCode = 'validator_failed_permanent';
  if (raw.status >= 300 && raw.status < 400) reasonCode = 'redirect_validation_failed';
  return {
    ok: false,
    reasonCode,
    validationStatus: 'failed',
    validationSource: 'live_validator',
    raw
  };
}

async function analyzeImageCandidate(candidate = {}, section = {}, options = {}) {
  const url = urlOrEmpty(candidate.url);
  if (!url) return { valid: false, exclusion: exclusion('unsafe_url', candidate) };
  if (!isHttpsUrl(url)) return { valid: false, exclusion: exclusion('non_https_url', candidate) };

  const extraction = extractionEvidence({ ...candidate, url }, section);
  if (!extraction.ok) {
    return {
      valid: false,
      exclusion: exclusion('missing_extraction_source', { ...candidate, url }, extraction)
    };
  }

  const contentType = candidateContentType(candidate);
  if (contentType && !IMAGE_CONTENT_TYPE_PATTERN.test(contentType)) {
    return {
      valid: false,
      exclusion: exclusion(contentType.includes('html') ? 'html_response' : 'unsupported_content_type', { ...candidate, url })
    };
  }
  if (!contentType) {
    return {
      valid: false,
      exclusion: exclusion('missing_candidate_metadata', { ...candidate, url })
    };
  }

  const { width, height } = candidateDimensions(candidate);
  if ((width && width < MIN_IMAGE_SIDE) || (height && height < MIN_IMAGE_SIDE)) {
    return {
      valid: false,
      exclusion: exclusion('too_small', { ...candidate, url }, { width, height })
    };
  }

  if (candidateUrlLooksTracking(url)) {
    return {
      valid: false,
      exclusion: exclusion('generic_or_unrelated_image', { ...candidate, url })
    };
  }
  if (candidateUrlLooksLikeLogo(url)) {
    return {
      valid: false,
      exclusion: exclusion('logo_only', { ...candidate, url })
    };
  }

  const sourceKind = extraction.sourceKind;
  const isSvg = SVG_CONTENT_TYPE_PATTERN.test(contentType) || /\.svg(?:$|[?#])/i.test(url);
  if (isSvg && !['og', 'og:image', 'twitter', 'twitter:image', 'twitter:image:src'].includes(sourceKind)) {
    return {
      valid: false,
      exclusion: exclusion('svg_rejected', { ...candidate, url })
    };
  }

  const attribution = candidateAttribution(candidate, section);
  const sourceUrl = extraction.sourceUrl;
  const licenseStatus = candidateLicenseStatus(candidate);
  if (!attribution || !sourceUrl || !licenseStatus) {
    return {
      valid: false,
      exclusion: exclusion('missing_attribution', { ...candidate, url }, {
        hasAttribution: Boolean(attribution),
        hasSourceUrl: Boolean(sourceUrl),
        hasLicenseStatus: Boolean(licenseStatus)
      })
    };
  }

  const validation = await validationEvidence({ ...candidate, url }, options);
  if (!validation.ok) {
    return {
      valid: false,
      exclusion: exclusion(validation.reasonCode || 'validator_failed', { ...candidate, url }, {
        validationStatus: validation.validationStatus,
        validationSource: validation.validationSource,
        validationResult: validation.raw
      })
    };
  }

  const rasterBonus = RASTER_CONTENT_TYPE_PATTERN.test(contentType) ? 30 : 0;
  const sourceKindScore = {
    og: 100,
    'og:image': 100,
    twitter: 90,
    'twitter:image': 90,
    'twitter:image:src': 90,
    'rss-media': 80,
    'rss-enclosure': 80,
    'json-ld': 70,
    'article-img': 40
  }[sourceKind] || 10;
  const area = width && height ? Math.min(width * height, 1000000) / 100000 : 0;

  return {
    valid: true,
    candidate: {
      ...candidate,
      url,
      sourceKind,
      contentType,
      attribution,
      sourceUrl,
      licenseStatus,
      width,
      height,
      validationStatus: validation.validationStatus,
      validationSource: validation.validationSource,
      validationResult: validation.raw,
      score: sourceKindScore + rasterBonus + area
    }
  };
}

function analyzeImageCandidateFromMetadata(candidate = {}, section = {}) {
  const url = urlOrEmpty(candidate.url);
  if (!url) return { valid: false, exclusion: exclusion('unsafe_url', candidate) };
  if (!isHttpsUrl(url)) return { valid: false, exclusion: exclusion('non_https_url', candidate) };

  const extraction = extractionEvidence({ ...candidate, url }, section);
  if (!extraction.ok) {
    return {
      valid: false,
      exclusion: exclusion('missing_extraction_source', { ...candidate, url }, extraction)
    };
  }

  const contentType = candidateContentType(candidate);
  if (contentType && !IMAGE_CONTENT_TYPE_PATTERN.test(contentType)) {
    return {
      valid: false,
      exclusion: exclusion(contentType.includes('html') ? 'html_response' : 'unsupported_content_type', { ...candidate, url })
    };
  }
  if (!contentType) {
    return {
      valid: false,
      exclusion: exclusion('missing_candidate_metadata', { ...candidate, url })
    };
  }

  const { width, height } = candidateDimensions(candidate);
  if ((width && width < MIN_IMAGE_SIDE) || (height && height < MIN_IMAGE_SIDE)) {
    return {
      valid: false,
      exclusion: exclusion('too_small', { ...candidate, url }, { width, height })
    };
  }

  if (candidateUrlLooksTracking(url)) {
    return {
      valid: false,
      exclusion: exclusion('generic_or_unrelated_image', { ...candidate, url })
    };
  }
  if (candidateUrlLooksLikeLogo(url)) {
    return {
      valid: false,
      exclusion: exclusion('logo_only', { ...candidate, url })
    };
  }

  const sourceKind = extraction.sourceKind;
  const isSvg = SVG_CONTENT_TYPE_PATTERN.test(contentType) || /\.svg(?:$|[?#])/i.test(url);
  if (isSvg && !['og', 'og:image', 'twitter', 'twitter:image', 'twitter:image:src'].includes(sourceKind)) {
    return {
      valid: false,
      exclusion: exclusion('svg_rejected', { ...candidate, url })
    };
  }

  const attribution = candidateAttribution(candidate, section);
  const sourceUrl = extraction.sourceUrl;
  const licenseStatus = candidateLicenseStatus(candidate);
  if (!attribution || !sourceUrl || !licenseStatus) {
    return {
      valid: false,
      exclusion: exclusion('missing_attribution', { ...candidate, url }, {
        hasAttribution: Boolean(attribution),
        hasSourceUrl: Boolean(sourceUrl),
        hasLicenseStatus: Boolean(licenseStatus)
      })
    };
  }

  const validationStatus = String(candidate.validationStatus || candidate.validation_status || '').trim().toLowerCase();
  if (validationStatus !== 'ok') {
    return {
      valid: false,
      exclusion: exclusion(validationStatus ? 'validator_failed_transient' : 'missing_candidate_metadata', { ...candidate, url }, {
        validationStatus: validationStatus || 'unknown',
        validationSource: 'candidate_metadata'
      })
    };
  }

  const rasterBonus = RASTER_CONTENT_TYPE_PATTERN.test(contentType) ? 30 : 0;
  const sourceKindScore = {
    og: 100,
    'og:image': 100,
    twitter: 90,
    'twitter:image': 90,
    'twitter:image:src': 90,
    'rss-media': 80,
    'rss-enclosure': 80,
    'json-ld': 70,
    'article-img': 40
  }[sourceKind] || 10;
  const area = width && height ? Math.min(width * height, 1000000) / 100000 : 0;
  return {
    valid: true,
    candidate: {
      ...candidate,
      url,
      sourceKind,
      contentType,
      attribution,
      sourceUrl,
      licenseStatus,
      width,
      height,
      validationStatus: 'ok',
      validationSource: 'candidate_metadata',
      score: sourceKindScore + rasterBonus + area
    }
  };
}

function selectImageForSectionFromMetadata(section = {}, index = 0) {
  const evidence = [];
  const valid = [];
  for (const candidate of ensureArray(section.imageCandidates)) {
    const result = analyzeImageCandidateFromMetadata(candidate, section);
    if (result.valid) {
      valid.push(result.candidate);
      evidence.push({
        candidate_url: result.candidate.url,
        reasonCode: 'selected',
        reasonLabel: imageReasonLabelKo('selected'),
        reasonText: imageReasonTextKo('selected'),
        valid: true,
        score: result.candidate.score,
        sourceKind: result.candidate.sourceKind,
        contentType: result.candidate.contentType,
        validationStatus: result.candidate.validationStatus,
        validationSource: result.candidate.validationSource
      });
    } else {
      evidence.push({
        ...result.exclusion,
        valid: false
      });
    }
  }
  valid.sort((left, right) => right.score - left.score || String(left.url).localeCompare(String(right.url)));
  const selected = valid[0] || null;
  return {
    index: index + 1,
    headline: articleTitle(section, index),
    selectedCandidate: selected,
    valid_image_candidate_count: valid.length,
    candidateEvidence: evidence,
    reasonCode: selected ? 'selected' : (ensureArray(section.imageCandidates).length === 0 ? 'no_candidate' : evidence[0]?.reasonCode || 'missing_candidate_metadata')
  };
}

async function analyzeSectionImages(section = {}, index = 0, options = {}) {
  const candidates = ensureArray(section.imageCandidates);
  const evidence = [];
  const valid = [];
  for (const candidate of candidates) {
    const result = await analyzeImageCandidate(candidate, section, options);
    if (result.valid) {
      valid.push(result.candidate);
      evidence.push({
        candidate_url: result.candidate.url,
        reasonCode: 'selected',
        reasonLabel: imageReasonLabelKo('selected'),
        reasonText: imageReasonTextKo('selected'),
        valid: true,
        score: result.candidate.score,
        sourceKind: result.candidate.sourceKind,
        contentType: result.candidate.contentType,
        validationStatus: result.candidate.validationStatus,
        validationSource: result.candidate.validationSource
      });
    } else {
      evidence.push({
        ...result.exclusion,
        valid: false
      });
    }
  }

  valid.sort((left, right) => right.score - left.score || String(left.url).localeCompare(String(right.url)));
  const selected = valid[0] || null;
  const selectedImage = String(section.selectedImage || '').trim();
  const selectedImageKey = selectedImageComparable(selectedImage);
  const candidateUrlKeys = new Set(candidates
    .map(candidate => selectedImageComparable(candidate.url))
    .filter(Boolean));
  const validCandidateUrlKeys = new Set(valid
    .map(candidate => selectedImageComparable(candidate.url))
    .filter(Boolean));
  const selectedImageIsFallback = isRepoLocalFallbackImage(selectedImage);
  const selectedImageInCandidates = Boolean(selectedImage && candidateUrlKeys.has(selectedImageKey));
  const selectedImageHasValidCandidate = Boolean(selectedImage && validCandidateUrlKeys.has(selectedImageKey));
  const selectedImageNotInCandidates = Boolean(
    selectedImage &&
    !selectedImageIsFallback &&
    !selectedImageInCandidates
  );
  const selectedImageWithoutValidCandidate = Boolean(
    selectedImage &&
    !selectedImageIsFallback &&
    !selectedImageHasValidCandidate
  );
  const repairable = Boolean(!selectedImage && selected);
  const reasonCode = selected ? 'selected' : (candidates.length === 0 ? 'no_candidate' : evidence[0]?.reasonCode || 'missing_candidate_metadata');
  const selectedImageEvidence = selectedImageWithoutValidCandidate
    ? reasonEvidence(
      selectedImageNotInCandidates ? 'selected_image_not_in_candidates' : 'selected_image_without_valid_candidate',
      {
        selectedImage,
        selectedImageInCandidates,
        selectedImageHasValidCandidate,
        selectedImageIsFallback
      }
    )
    : null;

  return {
    index: index + 1,
    headline: articleTitle(section, index),
    selectedImage,
    image_candidate_count: candidates.length,
    valid_image_candidate_count: valid.length,
    selected_image_is_fallback: selectedImageIsFallback,
    selected_image_in_candidates: selectedImageInCandidates,
    selected_image_has_valid_candidate: selectedImageHasValidCandidate,
    selected_image_not_in_candidates: selectedImageNotInCandidates,
    selected_image_without_valid_candidate: selectedImageWithoutValidCandidate,
    selected_image_evidence: selectedImageEvidence,
    repairable,
    reasonCode,
    reasonLabel: imageReasonLabelKo(reasonCode),
    reasonText: imageReasonTextKo(reasonCode),
    selectedCandidate: selected,
    candidateEvidence: evidence
  };
}

function selectedImagesFromIssue(issue = {}) {
  return ensureArray(issue.sections)
    .map(section => String(section.selectedImage || '').trim())
    .filter(Boolean);
}

function countRenderedImages(html) {
  return (String(html || '').match(/<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)/gi) || []).length;
}

function countFallbackVisuals(html) {
  return (String(html || '').match(/article-placeholder-visual/g) || []).length;
}

function countMarkdownImages(markdown) {
  return (String(markdown || '').match(/^!\[/gm) || []).length;
}

function imageAppearsInPublicArtifacts(selectedImage, markdown, html) {
  const htmlImage = selectedImage.replace(/&/g, '&amp;');
  return {
    markdown: markdown.includes(selectedImage),
    html: html.includes(selectedImage) || html.includes(htmlImage)
  };
}

function isRenderedPublicIssueScope(issue = {}, status = {}) {
  const publicationMode = String(issue.publication_mode || status.publication_mode || '').trim();
  const runMode = String(status.run_mode || '').trim();
  const publicState = String(status.public_state || '').trim();
  return publicationMode === 'fallback_public' ||
    publicationMode === 'review_only' ||
    runMode === 'review_only_public' ||
    publicState === 'REVIEW_ONLY_PUBLIC_CREATED';
}

function renderConsistency(issue, markdown, html, options = {}) {
  const mismatches = [];
  const publicArtifactsOnly = options.publicArtifactsOnly === true;
  for (const [index, section] of ensureArray(issue.sections).entries()) {
    const selectedImage = String(section.selectedImage || '').trim();
    if (!selectedImage) continue;
    const rendered = imageAppearsInPublicArtifacts(selectedImage, markdown, html);
    if (publicArtifactsOnly && !rendered.markdown && !rendered.html) continue;
    if (!rendered.markdown || !rendered.html) {
      mismatches.push({
        index: index + 1,
        headline: articleTitle(section, index),
        selectedImage,
        markdown: rendered.markdown,
        html: rendered.html,
        reasonCode: 'render_mismatch',
        reasonLabel: imageReasonLabelKo('render_mismatch'),
        reasonText: imageReasonTextKo('render_mismatch')
      });
    }
  }
  return mismatches;
}

function publishTarget(issue = {}, status = {}) {
  return Boolean(
    issue.final_publish_ready === true ||
    issue.automatic_publish_ready === true ||
    status.final_publish_ready === true ||
    status.has_ai_publish_ready === true ||
    status.automatic_publish_ready === true ||
    issue.publication_mode === 'public'
  );
}

function reportPaths(root, date) {
  const dateDir = path.join(root, 'content', 'newsroom', date);
  return {
    dateDir,
    editorPath: path.join(dateDir, 'editor-draft.json'),
    editorMarkdownPath: path.join(dateDir, 'editor-draft.md'),
    newsletterMarkdownPath: path.join(root, 'newsletters', date, 'newsletter.md'),
    newsletterHtmlPath: path.join(root, 'newsletters', date, 'index.html'),
    generationStatusPath: path.join(dateDir, 'generation-status.json'),
    jsonPath: path.join(dateDir, 'image-audit-report.json'),
    markdownPath: path.join(dateDir, 'image-audit-report.md')
  };
}

async function buildNewsletterImageAuditReport(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  const paths = reportPaths(root, date);
  const editorIssue = readJsonIfExists(paths.editorPath);
  const markdown = readTextIfExists(paths.newsletterMarkdownPath);
  const html = readTextIfExists(paths.newsletterHtmlPath);
  const status = readJsonIfExists(paths.generationStatusPath) || {};
  const publicArtifactScope = isRenderedPublicIssueScope(editorIssue || {}, status);
  const issue = editorIssue;
  const sourceOfTruth = `content/newsroom/${date}/editor-draft.json`;
  const warnings = [];
  const errors = [];

  if (!issue) {
    warnings.push({
      type: 'missing_source_of_truth',
      message: 'editor-draft.json is missing; image audit cannot inspect this date.',
      source_artifact: sourceOfTruth
    });
  }

  const articles = [];
  if (issue) {
    for (const [index, section] of ensureArray(issue.sections).entries()) {
      articles.push(await analyzeSectionImages(section, index, options));
    }
  }

  const mismatches = issue ? renderConsistency(issue, markdown, html, {
    publicArtifactsOnly: publicArtifactScope
  }) : [];
  for (const mismatch of mismatches) {
    errors.push({
      type: 'selected_image_render_mismatch',
      ...mismatch
    });
  }

  const selectedImageCount = issue ? selectedImagesFromIssue(issue).length : 0;
  const repairableArticles = articles.filter(article => article.repairable);
  const articleCount = ensureArray(issue?.sections).length;
  const rawCandidateCount = articles.reduce((sum, article) => sum + article.image_candidate_count, 0);
  const validCandidateCount = articles.reduce((sum, article) => sum + article.valid_image_candidate_count, 0);
  const unrepairableNoCandidateCount = articles.filter(article => article.image_candidate_count === 0).length;
  const excludedValidatorFailedCount = articles.reduce((sum, article) =>
    sum + article.candidateEvidence.filter(item => /^validator_/.test(item.reasonCode) || item.reasonCode === 'validator_failed').length, 0);
  const excludedAttributionMissingCount = articles.reduce((sum, article) =>
    sum + article.candidateEvidence.filter(item => item.reasonCode === 'missing_attribution').length, 0);
  const selectedImageRenderMismatchCount = mismatches.length;
  const isPublishTarget = publishTarget(issue || {}, status);
  const selectedMissingWithValidCandidates = articles.filter(article =>
    article.valid_image_candidate_count > 0 && !article.selectedImage
  ).length;
  const selectedImageWithoutValidCandidateArticles = articles.filter(article =>
    article.selected_image_without_valid_candidate
  );
  const selectedImageNotInCandidateArticles = articles.filter(article =>
    article.selected_image_not_in_candidates
  );
  const selectedByImageSelectionCount = issue
    ? ensureArray(issue.sections).filter(section =>
      String(section.selectedImage || '').trim() &&
      section.imageSelection?.reasonCode === 'selected'
    ).length
    : 0;
  for (const article of selectedImageWithoutValidCandidateArticles) {
    const item = {
      type: 'selected_image_without_valid_candidate',
      index: article.index,
      headline: article.headline,
      selectedImage: article.selectedImage,
      reasonCode: article.selected_image_evidence?.reasonCode || 'selected_image_without_valid_candidate',
      reasonLabel: article.selected_image_evidence?.reasonLabel || imageReasonLabelKo('selected_image_without_valid_candidate'),
      reasonText: article.selected_image_evidence?.reasonText || imageReasonTextKo('selected_image_without_valid_candidate')
    };
    if (isPublishTarget) {
      errors.push(item);
    } else {
      warnings.push(item);
    }
  }
  const publishBlockingIssueCount = isPublishTarget
    ? selectedMissingWithValidCandidates + selectedImageRenderMismatchCount
      + selectedImageWithoutValidCandidateArticles.length
    : selectedImageRenderMismatchCount;

  return {
    schemaVersion: 1,
    date,
    source_of_truth: sourceOfTruth,
    public_artifacts: {
      markdown: `newsletters/${date}/newsletter.md`,
      html: `newsletters/${date}/index.html`
    },
    mode: isPublishTarget ? 'publish-target' : 'review-or-draft',
    render_consistency_scope: publicArtifactScope ? 'rendered_public_issue' : 'editor_draft',
    summary: {
      article_count: articleCount,
      rendered_image_count: countRenderedImages(html),
      markdown_image_count: countMarkdownImages(markdown),
      fallback_visual_count: countFallbackVisuals(html),
      image_candidates_count: rawCandidateCount,
      valid_image_candidate_count: validCandidateCount,
      selected_image_count: selectedImageCount,
      empty_selected_with_candidates_count: articles.filter(article => !article.selectedImage && article.image_candidate_count > 0).length,
      selected_image_without_valid_candidate_count: selectedImageWithoutValidCandidateArticles.length,
      selected_image_not_in_candidates_count: selectedImageNotInCandidateArticles.length,
      repairable_article_count: repairableArticles.length,
      selected_by_image_selection_count: selectedByImageSelectionCount,
      repaired_in_this_run_count: Number(options.repairedInThisRunCount || 0),
      repaired_article_count: Number(options.repairedInThisRunCount || 0),
      unrepairable_no_candidate_count: unrepairableNoCandidateCount,
      excluded_validator_failed_count: excludedValidatorFailedCount,
      excluded_attribution_missing_count: excludedAttributionMissingCount,
      selected_image_render_mismatch_count: selectedImageRenderMismatchCount,
      publish_blocking_issue_count: publishBlockingIssueCount
    },
    repairable: repairableArticles.length > 0,
    repairable_articles: repairableArticles.map(article => ({
      index: article.index,
      headline: article.headline,
      selected_candidate_url: article.selectedCandidate.url,
      reasonCode: 'selected',
      reasonLabel: imageReasonLabelKo('selected'),
      reasonText: imageReasonTextKo('selected')
    })),
    articles: articles.map(article => ({
      index: article.index,
      headline: article.headline,
      selectedImage: article.selectedImage,
      image_candidate_count: article.image_candidate_count,
      valid_image_candidate_count: article.valid_image_candidate_count,
      selected_image_is_fallback: article.selected_image_is_fallback,
      selected_image_in_candidates: article.selected_image_in_candidates,
      selected_image_has_valid_candidate: article.selected_image_has_valid_candidate,
      selected_image_not_in_candidates: article.selected_image_not_in_candidates,
      selected_image_without_valid_candidate: article.selected_image_without_valid_candidate,
      selected_image_evidence: article.selected_image_evidence,
      repairable: article.repairable,
      reasonCode: article.reasonCode,
      reasonLabel: article.reasonLabel,
      reasonText: article.reasonText,
      selected_candidate_url: article.selectedCandidate?.url || '',
      candidate_evidence: article.candidateEvidence
    })),
    consistency: {
      selected_image_render_mismatches: mismatches,
      selected_image_without_valid_candidate_articles: selectedImageWithoutValidCandidateArticles.map(article => ({
        index: article.index,
        headline: article.headline,
        selectedImage: article.selectedImage,
        reasonCode: article.selected_image_evidence?.reasonCode || 'selected_image_without_valid_candidate',
        reasonLabel: article.selected_image_evidence?.reasonLabel || imageReasonLabelKo('selected_image_without_valid_candidate'),
        reasonText: article.selected_image_evidence?.reasonText || imageReasonTextKo('selected_image_without_valid_candidate')
      }))
    },
    warnings,
    errors
  };
}

function reportStatusCode(report) {
  if (report.summary.publish_blocking_issue_count > 0) return 'publish_blocking';
  if (report.summary.repairable_article_count > 0) return 'repairable';
  if (report.summary.selected_image_without_valid_candidate_count > 0) return 'provenance_warning';
  if (report.summary.unrepairable_no_candidate_count === report.summary.article_count) return 'no_candidate';
  return 'ok';
}

function reportStatusText(report) {
  if (report.summary.publish_blocking_issue_count > 0) return '차단';
  if (report.summary.repairable_article_count > 0) return '복원 가능';
  if (report.summary.selected_image_without_valid_candidate_count > 0) return '출처 근거 재검토 필요';
  if (report.summary.unrepairable_no_candidate_count === report.summary.article_count) return '후보 없음';
  return '정상 또는 조치 없음';
}

function renderNewsletterImageAuditMarkdown(report) {
  const none = '없음';
  const lines = [
    `# 이미지 감사 리포트 - ${report.date}`,
    '',
    '## 요약',
    '',
    `- 상태: ${reportStatusText(report)}`,
    `- 기사 수 (\`article_count\`): ${report.summary.article_count}`,
    `- 렌더된 이미지 수 (\`rendered_image_count\`): ${report.summary.rendered_image_count}`,
    `- Markdown 이미지 수 (\`markdown_image_count\`): ${report.summary.markdown_image_count}`,
    `- 임시 시각 요소 수 (\`fallback_visual_count\`): ${report.summary.fallback_visual_count}`,
    `- 이미지 후보 수 (\`image_candidates_count\`): ${report.summary.image_candidates_count}`,
    `- 검증 통과 이미지 후보 수 (\`valid_image_candidate_count\`): ${report.summary.valid_image_candidate_count}`,
    `- 선택된 대표 이미지 수 (\`selected_image_count\`): ${report.summary.selected_image_count}`,
    `- 출처 근거 부족 대표 이미지 수 (\`selected_image_without_valid_candidate_count\`): ${report.summary.selected_image_without_valid_candidate_count}`,
    `- 후보 목록 불일치 대표 이미지 수 (\`selected_image_not_in_candidates_count\`): ${report.summary.selected_image_not_in_candidates_count}`,
    `- 복원 가능 기사 수 (\`repairable_article_count\`): ${report.summary.repairable_article_count}`,
    `- 이번 repair 실행 복원 수 (\`repaired_in_this_run_count\`): ${report.summary.repaired_in_this_run_count}`,
    `- imageSelection 선택 상태 수 (\`selected_by_image_selection_count\`): ${report.summary.selected_by_image_selection_count}`,
    `- publish 차단 이슈 수 (\`publish_blocking_issue_count\`): ${report.summary.publish_blocking_issue_count}`,
    '',
    '## 기사별 상태',
    '',
    '| # | 기사 | 선택된 대표 이미지 | 후보 | 검증 통과 후보 | 상태 |',
    '| ---: | --- | --- | ---: | ---: | --- |'
  ];
  for (const article of report.articles) {
    const status = `${article.reasonLabel} (${article.reasonCode})`;
    const selectedStatus = article.selectedImage
      ? (article.selected_image_without_valid_candidate ? '있음, 출처 근거 재검토 필요' : '있음')
      : none;
    lines.push(`| ${article.index} | ${article.headline.replace(/\|/g, '\\|')} | ${selectedStatus} | ${article.image_candidate_count} | ${article.valid_image_candidate_count} | ${status.replace(/\|/g, '\\|')} |`);
  }
  lines.push('', '## 복원 가능 기사', '');
  if (report.repairable_articles.length === 0) {
    lines.push(`- ${none}`);
  } else {
    for (const item of report.repairable_articles) {
      lines.push(`- ${item.index}. ${item.headline}: ${item.reasonLabel} (${item.reasonCode}) - ${item.selected_candidate_url}`);
    }
  }
  lines.push('', '## 대표 이미지 출처 근거 재검토', '');
  if (report.consistency.selected_image_without_valid_candidate_articles.length === 0) {
    lines.push(`- ${none}`);
  } else {
    for (const item of report.consistency.selected_image_without_valid_candidate_articles) {
      lines.push(`- ${item.index}. ${item.headline}: ${item.reasonLabel} (${item.reasonCode}) - ${item.selectedImage}`);
    }
  }
  lines.push('', '## 렌더 일관성', '');
  if (report.consistency.selected_image_render_mismatches.length === 0) {
    lines.push('- 불일치 없음');
  } else {
    for (const item of report.consistency.selected_image_render_mismatches) {
      lines.push(`- ${item.index}. ${item.headline}: ${item.reasonLabel} (${item.reasonCode})`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function writeNewsletterImageAuditArtifacts(options = {}) {
  const root = options.root || process.cwd();
  const report = await buildNewsletterImageAuditReport(options);
  const paths = reportPaths(root, report.date);
  writeJson(paths.jsonPath, report);
  writeText(paths.markdownPath, renderNewsletterImageAuditMarkdown(report));
  if (options.failOnPublishBlocking && report.summary.publish_blocking_issue_count > 0) {
    const error = new Error(`Newsletter image audit found ${report.summary.publish_blocking_issue_count} publish-blocking issue(s) for ${report.date}.`);
    error.report = report;
    throw error;
  }
  return {
    report,
    jsonPath: paths.jsonPath,
    markdownPath: paths.markdownPath
  };
}

function listNewsletterDates(root = process.cwd()) {
  const newsroomRoot = path.join(root, 'content', 'newsroom');
  if (!fs.existsSync(newsroomRoot)) return [];
  return fs.readdirSync(newsroomRoot, { withFileTypes: true })
    .filter(item => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name))
    .filter(item => fs.existsSync(path.join(newsroomRoot, item.name, 'editor-draft.json')))
    .map(item => item.name)
    .sort();
}

function aggregateReports(root, reports) {
  const summary = {
    auditedIssueCount: reports.length,
    auditedArticleCount: reports.reduce((sum, report) => sum + report.summary.article_count, 0),
    repairableArticleCount: reports.reduce((sum, report) => sum + report.summary.repairable_article_count, 0),
    repairedArticleCount: reports.reduce((sum, report) => sum + (report.summary.repaired_in_this_run_count || 0), 0),
    repairedInThisRunCount: reports.reduce((sum, report) => sum + (report.summary.repaired_in_this_run_count || 0), 0),
    selectedByImageSelectionCount: reports.reduce((sum, report) => sum + (report.summary.selected_by_image_selection_count || 0), 0),
    unrepairableNoCandidateCount: reports.reduce((sum, report) => sum + report.summary.unrepairable_no_candidate_count, 0),
    excludedValidatorFailedCount: reports.reduce((sum, report) => sum + report.summary.excluded_validator_failed_count, 0),
    excludedAttributionMissingCount: reports.reduce((sum, report) => sum + report.summary.excluded_attribution_missing_count, 0),
    selectedImageWithoutValidCandidateCount: reports.reduce((sum, report) => sum + (report.summary.selected_image_without_valid_candidate_count || 0), 0),
    selectedImageNotInCandidatesCount: reports.reduce((sum, report) => sum + (report.summary.selected_image_not_in_candidates_count || 0), 0),
    selectedImageRenderMismatchCount: reports.reduce((sum, report) => sum + report.summary.selected_image_render_mismatch_count, 0),
    publishBlockingIssueCount: reports.reduce((sum, report) => sum + report.summary.publish_blocking_issue_count, 0)
  };
  return {
    schemaVersion: 1,
    source: 'newsletter-image-audit',
    summary,
    repairableDates: reports
      .filter(report => report.summary.repairable_article_count > 0)
      .map(report => report.date),
    unrepairableNoCandidateDates: reports
      .filter(report => report.summary.article_count > 0 && report.summary.unrepairable_no_candidate_count === report.summary.article_count)
      .map(report => report.date),
    reports: reports.map(report => ({
      date: report.date,
      status_code: reportStatusCode(report),
      status: reportStatusText(report),
      article_count: report.summary.article_count,
      repairable_article_count: report.summary.repairable_article_count,
      repaired_in_this_run_count: report.summary.repaired_in_this_run_count,
      selected_by_image_selection_count: report.summary.selected_by_image_selection_count,
      selected_image_without_valid_candidate_count: report.summary.selected_image_without_valid_candidate_count,
      selected_image_not_in_candidates_count: report.summary.selected_image_not_in_candidates_count,
      selected_image_render_mismatch_count: report.summary.selected_image_render_mismatch_count,
      publish_blocking_issue_count: report.summary.publish_blocking_issue_count,
      report: `content/newsroom/${report.date}/image-audit-report.json`
    }))
  };
}

function renderAggregateMarkdown(aggregate) {
  const lines = [
    '# 이미지 감사 전체 리포트',
    '',
    '## 요약',
    '',
    `- 감사한 issue 수: ${aggregate.summary.auditedIssueCount}`,
    `- 감사한 article 수: ${aggregate.summary.auditedArticleCount}`,
    `- 복원 가능 article 수: ${aggregate.summary.repairableArticleCount}`,
    `- 이번 repair 실행 복원 수: ${aggregate.summary.repairedInThisRunCount}`,
    `- imageSelection 선택 상태 수: ${aggregate.summary.selectedByImageSelectionCount}`,
    `- 후보 없음 article 수: ${aggregate.summary.unrepairableNoCandidateCount}`,
    `- validator 제외 수: ${aggregate.summary.excludedValidatorFailedCount}`,
    `- attribution 부족 제외 수: ${aggregate.summary.excludedAttributionMissingCount}`,
    `- 출처 근거 부족 대표 이미지 수: ${aggregate.summary.selectedImageWithoutValidCandidateCount}`,
    `- 후보 목록 불일치 대표 이미지 수: ${aggregate.summary.selectedImageNotInCandidatesCount}`,
    `- 렌더 결과 불일치 수: ${aggregate.summary.selectedImageRenderMismatchCount}`,
    `- publish 차단 이슈 수: ${aggregate.summary.publishBlockingIssueCount}`,
    '',
    '## 복원 가능 날짜',
    '',
    aggregate.repairableDates.length > 0 ? aggregate.repairableDates.map(date => `- ${date}`).join('\n') : '- 없음',
    '',
    '## 날짜별 상태',
    '',
    '| 날짜 | 상태 | 기사 | 복원 가능 | 출처 근거 부족 | 렌더 불일치 | publish 차단 |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...aggregate.reports.map(report => `| ${report.date} | ${report.status} | ${report.article_count} | ${report.repairable_article_count} | ${report.selected_image_without_valid_candidate_count} | ${report.selected_image_render_mismatch_count} | ${report.publish_blocking_issue_count} |`)
  ];
  return `${lines.join('\n')}\n`;
}

function aggregatePaths(root) {
  return {
    jsonPath: path.join(root, 'content', 'newsroom', 'image-audit-aggregate-report.json'),
    markdownPath: path.join(root, 'content', 'newsroom', 'image-audit-aggregate-report.md')
  };
}

async function writeNewsletterImageAuditAggregate(options = {}) {
  const root = options.root || process.cwd();
  const dates = options.dates || listNewsletterDates(root);
  const repairedInThisRunByDate = options.repairedInThisRunByDate || {};
  const reports = [];
  for (const date of dates) {
    const result = await writeNewsletterImageAuditArtifacts({
      ...options,
      root,
      date,
      repairedInThisRunCount: Number(repairedInThisRunByDate[date] || 0),
      failOnPublishBlocking: false
    });
    reports.push(result.report);
  }
  const aggregate = aggregateReports(root, reports);
  const paths = aggregatePaths(root);
  writeJson(paths.jsonPath, aggregate);
  writeText(paths.markdownPath, renderAggregateMarkdown(aggregate));
  if (options.failOnPublishBlocking && aggregate.summary.publishBlockingIssueCount > 0) {
    const error = new Error(`Newsletter image audit found ${aggregate.summary.publishBlockingIssueCount} publish-blocking issue(s).`);
    error.aggregate = aggregate;
    throw error;
  }
  return {
    aggregate,
    jsonPath: paths.jsonPath,
    markdownPath: paths.markdownPath
  };
}

function applySelectedCandidate(section, article) {
  const candidate = article.selectedCandidate;
  if (!candidate) return false;
  section.selectedImage = candidate.url;
  section.imageSource = candidate.sourceUrl;
  section.imageAttribution = candidate.attribution;
  section.imageAlt = String(candidate.alt || article.headline || 'Article image').trim();
  section.imageLicenseStatus = candidate.licenseStatus;
  section.imageUsageDecisionReason = imageReasonTextKo('selected');
  section.imageSelection = {
    reasonCode: 'selected',
    reasonText: imageReasonTextKo('selected'),
    sourceUrl: candidate.sourceUrl,
    attribution: candidate.attribution,
    licenseStatus: candidate.licenseStatus,
    validationStatus: candidate.validationStatus,
    validationSource: candidate.validationSource,
    candidateUrl: candidate.url,
    exclusionEvidence: article.candidateEvidence.filter(item => item.valid === false)
  };
  section.resolvedImage = {
    url: candidate.url,
    src: candidate.url,
    originalUrl: '',
    originalSrc: '',
    usedFallback: false,
    reason: 'selected image candidate'
  };
  return true;
}

async function repairNewsletterImagesForDate(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  const before = await buildNewsletterImageAuditReport({
    ...options,
    root,
    date,
    useEditorDraftForAudit: true
  });
  if (before.summary.repairable_article_count === 0) {
    await writeNewsletterImageAuditArtifacts({ ...options, root, date, failOnPublishBlocking: false });
    // 수리할 기사가 없어도 weekly는 이전 실행에서 stale 상태로 남아 있을 수 있으므로
    // 항상 daily editor-draft 기준으로 동기화한다(재실행 수렴 경로).
    const draft = readJsonIfExists(reportPaths(root, date).editorPath);
    const weeklySync = syncWeeklyArticleImages({ root, date, sections: draft && draft.sections });
    return { date, repairedArticleCount: 0, weeklySync, report: before };
  }

  const paths = reportPaths(root, date);
  const issue = readJsonIfExists(paths.editorPath);
  if (!issue) throw new Error(`Missing source of truth: content/newsroom/${date}/editor-draft.json`);
  const analyses = [];
  for (const [index, section] of ensureArray(issue.sections).entries()) {
    analyses.push(await analyzeSectionImages(section, index, options));
  }
  let repairedArticleCount = 0;
  for (const article of analyses) {
    if (!article.repairable) continue;
    const section = ensureArray(issue.sections)[article.index - 1];
    if (applySelectedCandidate(section, article)) repairedArticleCount += 1;
  }

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);
  writeJson(paths.editorPath, issue);
  writeText(paths.editorMarkdownPath, markdown);
  writeText(paths.newsletterMarkdownPath, markdown);
  writeText(paths.newsletterHtmlPath, html);

  // weekly 산출물은 생성 중에 이미 작성되었고 같은 identity 기사는 exact-duplicate로 거부되므로,
  // 수리된 이미지 상태를 weekly issue/index(article_images)로 직접 동기화한다.
  const weeklySync = syncWeeklyArticleImages({ root, date, sections: issue.sections });

  const result = await writeNewsletterImageAuditArtifacts({
    ...options,
    root,
    date,
    useEditorDraftForAudit: true,
    repairedInThisRunCount: repairedArticleCount,
    failOnPublishBlocking: false
  });
  return {
    date,
    repairedArticleCount,
    weeklySync,
    report: result.report
  };
}

async function repairNewsletterImages(options = {}) {
  const root = options.root || process.cwd();
  const dates = options.allRepairable
    ? (await writeNewsletterImageAuditAggregate({ ...options, root, failOnPublishBlocking: false })).aggregate.repairableDates
    : [options.date].filter(Boolean);
  if (dates.length === 0 && options.allRepairable) return [];
  if (dates.length === 0) throw new Error('No newsletter dates selected for image repair.');
  const repairs = [];
  for (const date of dates) {
    repairs.push(await repairNewsletterImagesForDate({ ...options, root, date }));
  }
  const repairedInThisRunByDate = Object.fromEntries(
    repairs.map(item => [item.date, item.repairedArticleCount])
  );
  await writeNewsletterImageAuditAggregate({
    ...options,
    root,
    repairedInThisRunByDate,
    failOnPublishBlocking: false
  });
  return repairs;
}

module.exports = {
  analyzeImageCandidateFromMetadata,
  analyzeImageCandidate,
  analyzeSectionImages,
  buildNewsletterImageAuditReport,
  listNewsletterDates,
  renderAggregateMarkdown,
  renderNewsletterImageAuditMarkdown,
  repairNewsletterImages,
  repairNewsletterImagesForDate,
  selectImageForSectionFromMetadata,
  writeNewsletterImageAuditAggregate,
  writeNewsletterImageAuditArtifacts
};
