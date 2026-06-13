const fs = require('fs');
const path = require('path');
const {
  MIN_CONTENT_LENGTH,
  validateImageUrl
} = require('../../shared/render/image-candidates');
const {
  analyzeImageCandidateFromMetadata
} = require('./newsletter-image-audit');

function comparableUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return raw;
  }
}

function selectedImageHasValidCandidate(selectedImage, section) {
  const candidates = Array.isArray(section.imageCandidates) ? section.imageCandidates : [];
  if (candidates.length === 0) return false;
  const selectedKey = comparableUrl(selectedImage) || selectedImage;
  for (const candidate of candidates) {
    const candidateKey = comparableUrl(candidate.url) || String(candidate.url || '');
    if (candidateKey && candidateKey === selectedKey) {
      const result = analyzeImageCandidateFromMetadata(candidate, section);
      if (result.valid) return true;
    }
  }
  return false;
}

const FALLBACKS = {
  ai: 'assets/images/fallback/ai.svg',
  android: 'assets/images/fallback/android.svg',
  cpp: 'assets/images/fallback/cpp.svg',
  default: 'assets/images/fallback/newsletter-default.svg'
};

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+/, '');
}

function issueRelativePath(assetPath, depth = 2) {
  return `${'../'.repeat(depth)}${normalizePath(assetPath)}`;
}

function labelForSection(section = {}) {
  return [
    section.article_type,
    section.category,
    Array.isArray(section.tags) ? section.tags.join(' ') : '',
    section.headline
  ].join(' ').toLowerCase();
}

function fallbackKindForSection(section = {}) {
  const label = labelForSection(section);
  if (/\b(ai|gemini|llm|agent|npu|gpu)\b/.test(label)) return 'ai';
  if (/\b(c\+\+|cpp|clang|llvm|native)\b/.test(label)) return 'cpp';
  if (/\b(android|aosp|camera|camerax|hal)\b/.test(label)) return 'android';
  return 'default';
}

function fallbackAssetForSection(section = {}) {
  return FALLBACKS[fallbackKindForSection(section)] || FALLBACKS.default;
}

// 서빙 URL 기준의 assets/ 경로는 디스크상으로 articles/assets/ 아래에 있다(#262 phase 6).
function repoLocalPath(root, src) {
  const normalized = normalizePath(src);
  const withoutIssuePrefix = normalized.replace(/^(\.\.\/){2}/, '');
  if (!withoutIssuePrefix.startsWith('assets/')) return '';
  const absPath = path.resolve(root, 'articles', withoutIssuePrefix);
  const rootPath = path.resolve(root);
  if (absPath !== rootPath && !absPath.startsWith(`${rootPath}${path.sep}`)) return '';
  return absPath;
}

function fallbackExists(root, assetPath) {
  return fs.existsSync(path.resolve(root, 'articles', assetPath));
}

function localImageExists(root, src) {
  const localPath = repoLocalPath(root, src);
  return Boolean(localPath && fs.existsSync(localPath));
}

function formatValidationReason(result) {
  const status = result.status || 'n/a';
  const contentType = result.contentType || 'n/a';
  const contentLength = result.contentLength || 'n/a';
  return `status=${status}; content-type=${contentType}; content-length=${contentLength}; reason=${result.reason || 'unknown'}`;
}

function resolvedImage({ url, originalUrl = '', usedFallback = false, reason = '' }) {
  return {
    url,
    src: url,
    originalUrl,
    originalSrc: originalUrl,
    usedFallback,
    reason
  };
}

async function resolveArticleImage(section = {}, options = {}) {
  const root = options.root || process.cwd();
  const selectedImage = String(section.selectedImage || '').trim();
  const preservedOriginal = String(
    section.originalImage ||
    section.resolvedImage?.originalUrl ||
    section.resolvedImage?.originalSrc ||
    ''
  ).trim();
  const fallbackAsset = fallbackAssetForSection(section);
  const fallbackSrc = issueRelativePath(fallbackAsset, options.relativeDepth ?? 2);

  if (!selectedImage) {
    return resolvedImage({
      url: fallbackSrc,
      originalUrl: preservedOriginal,
      usedFallback: true,
      reason: fallbackExists(root, fallbackAsset)
        ? 'no selected image; local fallback visual used'
        : `fallback missing: ${fallbackAsset}; no selected image`
    });
  }

  if (!isHttpsUrl(selectedImage)) {
    if (localImageExists(root, selectedImage)) {
      return resolvedImage({
        url: selectedImage,
        originalUrl: preservedOriginal,
        usedFallback: Boolean(section.resolvedImage?.usedFallback || /(?:^|\/)assets\/images\/fallback\//.test(normalizePath(selectedImage))),
        reason: section.resolvedImage?.reason || 'repo-local article image selected'
      });
    }
    if (!fallbackExists(root, fallbackAsset)) {
      return resolvedImage({
        url: selectedImage,
        originalUrl: preservedOriginal || selectedImage,
        usedFallback: false,
        reason: `fallback missing: ${fallbackAsset}`
      });
    }
    return resolvedImage({
      url: fallbackSrc,
      originalUrl: preservedOriginal || selectedImage,
      usedFallback: true,
      reason: 'selected image is not an HTTPS URL'
    });
  }

  const validate = options.validateImageUrl || validateImageUrl;
  const result = await validate(selectedImage, {
    timeoutMs: options.timeoutMs || 8000,
    attempts: options.attempts || 2,
    backoffMs: options.backoffMs || 500
  });

  if (result.ok) {
    // Uses the same metadata-based valid-candidate decision as the audit; intentionally falls back rather than emitting an unvalidated external URL.
    if (!selectedImageHasValidCandidate(selectedImage, section)) {
      if (!fallbackExists(root, fallbackAsset)) {
        return resolvedImage({
          url: selectedImage,
          originalUrl: preservedOriginal || selectedImage,
          usedFallback: false,
          reason: `fallback missing: ${fallbackAsset}; no valid provenance candidate for selected image`
        });
      }
      return resolvedImage({
        url: fallbackSrc,
        originalUrl: preservedOriginal || selectedImage,
        usedFallback: true,
        reason: 'selected image has no valid provenance candidate; local fallback visual used'
      });
    }
    return resolvedImage({
      url: selectedImage,
      originalUrl: preservedOriginal,
      usedFallback: false
    });
  }

  if (!fallbackExists(root, fallbackAsset)) {
    return resolvedImage({
      url: selectedImage,
      originalUrl: preservedOriginal || selectedImage,
      usedFallback: false,
      reason: `fallback missing: ${fallbackAsset}; ${formatValidationReason(result)}`
    });
  }

  return resolvedImage({
    url: fallbackSrc,
    originalUrl: preservedOriginal || selectedImage,
    usedFallback: true,
    reason: formatValidationReason(result)
  });
}

async function resolveIssueArticleImages(issue = {}, options = {}) {
  if (!Array.isArray(issue.sections)) return issue;
  for (const section of issue.sections) {
    section.resolvedImage = await resolveArticleImage(section, options);
    if (section.resolvedImage.originalUrl) {
      section.originalImage = section.resolvedImage.originalUrl;
    }
    if (section.resolvedImage.url) {
      section.selectedImage = section.resolvedImage.url;
    }
  }
  return issue;
}

module.exports = {
  FALLBACKS,
  MIN_CONTENT_LENGTH,
  fallbackAssetForSection,
  fallbackKindForSection,
  formatValidationReason,
  isHttpsUrl,
  issueRelativePath,
  localImageExists,
  repoLocalPath,
  resolveArticleImage,
  resolveIssueArticleImages
};
