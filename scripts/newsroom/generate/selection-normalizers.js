'use strict';

const crypto = require('crypto');

function text(value) {
  return String(value || '').trim();
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const hash = parsed.hash;
    const preserveHash = parsed.hostname.toLowerCase() === 'developer.android.com' &&
      ['/jetpack/androidx/releases/camera', '/jetpack/androidx/releases/media3'].includes(parsed.pathname) &&
      /^#(?:(?:camera-[a-z0-9-]+|media3)-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(hash);
    if (!preserveHash) parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizedUrlHash(value) {
  return crypto.createHash('sha256').update(normalizeUrl(value)).digest('hex');
}

function normalizeTitle(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&[#a-z0-9]+;/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const right = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

module.exports = {
  normalizeUrl,
  normalizedUrlHash,
  normalizeTitle,
  titleSimilarity
};
