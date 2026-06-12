'use strict';

// CameraX / Media3 release-note domain rules: page identity, version maturity ranking, and
// source-extraction integrity. Extracted from newsroom-selection.js so the selection flow does
// not also own this CameraX-specific knowledge (single responsibility). Every helper operates on
// a candidate object and is pure.

const { ensureArray } = require('../../../src/core/common/value-coercion');
function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function candidateUrl(candidate) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

// Normalized base URL of an androidx camera/media3 release-note page (fragment/query stripped),
// or '' when the candidate is not a CameraX/Media3 release-note page. Two candidates that share a
// non-empty key are different versions of the same rolling release page.
function cameraReleasePageKey(candidate) {
  const raw = candidateUrl(candidate);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (
      parsed.hostname.toLowerCase() === 'developer.android.com' &&
      ['/jetpack/androidx/releases/camera', '/jetpack/androidx/releases/media3'].includes(parsed.pathname)
    ) {
      parsed.hash = '';
      parsed.search = '';
      return parsed.toString().replace(/\/$/, '').toLowerCase();
    }
  } catch {
    return '';
  }
  return '';
}

function sourceExtractionItems(candidate) {
  return [
    ...(Array.isArray(candidate?.source_extraction?.release?.sections) ? candidate.source_extraction.release.sections : []),
    ...(Array.isArray(candidate?.source_extraction?.minor_line_context?.sections) ? candidate.source_extraction.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(candidate) {
  return sourceExtractionItems(candidate).some(item => text(item?.text || item?.source_text));
}

function hasGenericCameraXFallbackMetadata(candidate) {
  const value = text(candidate.behavior_change || candidate.behaviorChange || candidate.what_changed || candidate.summary);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released)(?:\.)?$/i.test(value) ||
    /Maven Group versions?|View the Camera Library|This library was last updated on:/i.test(value);
}

function cameraReleaseExtractionViolation(candidate) {
  if (!cameraReleasePageKey(candidate)) return '';
  const quality = candidate.extraction_quality || candidate.source_extraction?.extraction_quality || {};
  if (quality.used_fallback === true) return 'source_extraction.used_fallback=true';
  if (quality.main_article_allowed === false) return 'source_extraction.main_article_allowed=false';
  if (!hasSourceExtractionBullet(candidate) && hasGenericCameraXFallbackMetadata(candidate)) {
    return 'CameraX release-note candidate has no concrete source_extraction bullet';
  }
  if (candidate.source_extraction && !hasSourceExtractionBullet(candidate)) return 'source_extraction.release.sections has no concrete bullet';
  return '';
}

// Maturity rank for ordering different versions of the same release page: lower kind sorts first
// (stable patch < first minor < pre-release), and higher weight is a newer version within a kind.
function cameraReleaseVersionRank(candidate) {
  if (!cameraReleasePageKey(candidate)) return { kind: 99, weight: 0 };
  const value = text(candidate.version_or_release || candidate.versionOrRelease || candidate.title);
  const match = value.match(/\b(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\d*)?/i);
  if (!match) return { kind: 50, weight: 0 };
  const suffix = text(match[4]).toLowerCase();
  const patch = number(match[3]);
  return {
    kind: suffix ? 2 : patch > 0 ? 0 : 1,
    weight: number(match[1]) * 1000000 + number(match[2]) * 10000 + patch * 100
  };
}

function selectedHasSameCameraReleasePage(selected, candidate) {
  const key = cameraReleasePageKey(candidate);
  return Boolean(key) && ensureArray(selected).some(item => cameraReleasePageKey(item) === key);
}

module.exports = {
  cameraReleaseExtractionViolation,
  cameraReleasePageKey,
  cameraReleaseVersionRank,
  hasGenericCameraXFallbackMetadata,
  hasSourceExtractionBullet,
  selectedHasSameCameraReleasePage,
  sourceExtractionItems
};
