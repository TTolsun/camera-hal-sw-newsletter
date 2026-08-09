const MIN_IMAGE_WIDTH = 320;
const MIN_IMAGE_HEIGHT = 180;
const MIN_IMAGE_AREA = MIN_IMAGE_WIDTH * MIN_IMAGE_HEIGHT;
const MIN_CONTENT_LENGTH = 1024;
const MAX_VALIDATION_CANDIDATES = 4;

const REJECT_PATH_PATTERN = /(?:favicon|apple-touch-icon|mstile|logo|sprite|avatar|tracker|tracking|pixel|beacon|transparent|spacer|blank|placeholder|icon)[^/]*\.(?:png|jpe?g|gif|webp|svg)(?:$|[?#])/i;
const TRACKING_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid'
]);

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function getAttr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const match = tag.match(pattern);
  if (!match) return '';
  return decodeHtml(match[1].replace(/^["']|["']$/g, ''));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeImageUrl(value, articleUrl) {
  const raw = decodeHtml(value || '');
  if (!raw || /^data:/i.test(raw)) return '';
  const withProtocol = raw.startsWith('//') ? `https:${raw}` : raw;
  let url;
  try {
    url = new URL(withProtocol, articleUrl);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') return '';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  const normalized = url.toString();
  if (REJECT_PATH_PATTERN.test(normalized)) return '';
  return normalized;
}

function hasUsableDimensions(candidate) {
  if (!candidate.width || !candidate.height) return true;
  return candidate.width >= MIN_IMAGE_WIDTH &&
    candidate.height >= MIN_IMAGE_HEIGHT &&
    candidate.width * candidate.height >= MIN_IMAGE_AREA;
}

function createCandidate({ url, articleUrl, sourceUrl, sourceKind, width, height, alt, attribution }) {
  const normalizedUrl = normalizeImageUrl(url, articleUrl || sourceUrl);
  if (!normalizedUrl) return null;
  const candidate = {
    url: normalizedUrl,
    sourceUrl: sourceUrl || articleUrl || '',
    articleUrl: articleUrl || sourceUrl || '',
    sourceKind,
    width: numberOrNull(width),
    height: numberOrNull(height),
    alt: decodeHtml(alt || ''),
    contentType: '',
    licenseStatus: 'unknown',
    attribution: attribution || '',
    validationStatus: 'pending'
  };
  if (!hasUsableDimensions(candidate)) return null;
  return candidate;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates.filter(Boolean)) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    result.push(candidate);
  }
  return result;
}

function metaContent(html, names) {
  const values = [];
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = getAttr(tag, 'property') || getAttr(tag, 'name');
    if (!key || !names.includes(key.toLowerCase())) continue;
    const content = getAttr(tag, 'content');
    if (content) values.push({ content, tag });
  }
  return values;
}

function metaValueFromTag(tag, attrName) {
  return getAttr(tag, attrName);
}

function extractJsonLdImageValues(value) {
  if (!value) return [];
  if (typeof value === 'string') return [{ url: value }];
  if (Array.isArray(value)) return value.flatMap(extractJsonLdImageValues);
  if (typeof value === 'object') {
    const url = value.url || value.contentUrl;
    return url ? [{ url, width: value.width, height: value.height, alt: value.caption || value.name }] : [];
  }
  return [];
}

function parseJsonLdBlocks(html) {
  const result = [];
  const blocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeHtml(body));
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (node && typeof node === 'object') {
          result.push(...extractJsonLdImageValues(node.image));
          if (node['@graph']) {
            for (const graphNode of node['@graph']) {
              result.push(...extractJsonLdImageValues(graphNode.image));
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD; the collector should keep processing the article.
    }
  }
  return result;
}

function extractArticleImgValues(html) {
  const images = [];
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags.slice(0, 12)) {
    images.push({
      url: getAttr(tag, 'src') || getAttr(tag, 'data-src') || getAttr(tag, 'data-original'),
      width: getAttr(tag, 'width'),
      height: getAttr(tag, 'height'),
      alt: getAttr(tag, 'alt')
    });
  }
  return images;
}

function extractImageCandidatesFromHtml(html, articleUrl, source) {
  const sourceUrl = source.sourceUrl || source.url || articleUrl;
  const attribution = source.name || source.source_name || '';
  const candidates = [];

  for (const { content, tag } of metaContent(html, ['og:image', 'og:image:secure_url'])) {
    candidates.push(createCandidate({
      url: content,
      articleUrl,
      sourceUrl,
      sourceKind: 'og',
      width: metaValueFromTag(tag, 'width'),
      height: metaValueFromTag(tag, 'height'),
      alt: metaValueFromTag(tag, 'alt'),
      attribution
    }));
  }

  for (const { content, tag } of metaContent(html, ['twitter:image', 'twitter:image:src'])) {
    candidates.push(createCandidate({
      url: content,
      articleUrl,
      sourceUrl,
      sourceKind: 'twitter',
      alt: metaValueFromTag(tag, 'alt'),
      attribution
    }));
  }

  for (const image of parseJsonLdBlocks(html)) {
    candidates.push(createCandidate({
      ...image,
      articleUrl,
      sourceUrl,
      sourceKind: 'json-ld',
      attribution
    }));
  }

  for (const image of extractArticleImgValues(html)) {
    candidates.push(createCandidate({
      ...image,
      articleUrl,
      sourceUrl,
      sourceKind: 'article-img',
      attribution
    }));
  }

  return dedupeCandidates(candidates);
}

function extractImageCandidatesFromRssBlock(block, articleUrl, source) {
  const sourceUrl = source.sourceUrl || source.url || articleUrl;
  const attribution = source.name || '';
  const candidates = [];
  const mediaTags = block.match(/<(?:media:thumbnail|media:content)\b[^>]*>/gi) || [];
  for (const tag of mediaTags) {
    candidates.push(createCandidate({
      url: getAttr(tag, 'url'),
      articleUrl,
      sourceUrl,
      sourceKind: 'rss-media',
      width: getAttr(tag, 'width'),
      height: getAttr(tag, 'height'),
      attribution
    }));
  }

  const enclosureTags = block.match(/<enclosure\b[^>]*>/gi) || [];
  for (const tag of enclosureTags) {
    const type = getAttr(tag, 'type');
    if (!/^image\//i.test(type)) continue;
    candidates.push(createCandidate({
      url: getAttr(tag, 'url'),
      articleUrl,
      sourceUrl,
      sourceKind: 'rss-enclosure',
      attribution
    }));
  }

  return dedupeCandidates(candidates);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function responseLooksLikeImage(response) {
  return validateImageResponse(response).ok;
}

function validateImageResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const contentLength = Number(response.headers.get('content-length') || 0);
  const result = {
    ok: false,
    status: response.status,
    contentType,
    contentLength,
    reason: ''
  };
  if (!response.ok) {
    result.reason = `HTTP ${response.status}`;
    return result;
  }
  if (!/^image\//i.test(contentType)) {
    result.reason = contentType ? `non-image content-type ${contentType}` : 'missing content-type';
    return result;
  }
  if (contentLength > 0 && contentLength < MIN_CONTENT_LENGTH) {
    result.reason = `content-length ${contentLength} is smaller than ${MIN_CONTENT_LENGTH}`;
    return result;
  }
  result.ok = true;
  result.reason = 'ok';
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateImageUrl(url, options = {}) {
  const timeoutMs = options.timeoutMs || 2500;
  const attempts = Math.max(1, options.attempts || 1);
  const backoffMs = options.backoffMs || 250;
  const headers = {
    'user-agent': 'camera-hal-sw-newsletter/1.0',
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    ...(options.headers || {})
  };
  let lastResult = {
    ok: false,
    status: 0,
    contentType: '',
    contentLength: 0,
    reason: 'not checked'
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const headResponse = await fetchWithTimeout(url, { method: 'HEAD', headers }, timeoutMs);
      lastResult = validateImageResponse(headResponse);
      if (lastResult.ok) return lastResult;
    } catch (error) {
      lastResult = {
        ok: false,
        status: 0,
        contentType: '',
        contentLength: 0,
        reason: error.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error.message
      };
    }

    try {
      const getResponse = await fetchWithTimeout(
        url,
        { method: 'GET', headers: { ...headers, range: 'bytes=0-2047' } },
        timeoutMs
      );
      lastResult = validateImageResponse(getResponse);
      if (lastResult.ok) return lastResult;
    } catch (error) {
      lastResult = {
        ok: false,
        status: 0,
        contentType: '',
        contentLength: 0,
        reason: error.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error.message
      };
    }

    if (attempt < attempts) await sleep(backoffMs * attempt);
  }

  return lastResult;
}

async function validateImageCandidate(candidate) {
  const result = await validateImageUrl(candidate.url);
  if (!result.ok) return null;
  return {
    ...candidate,
    contentType: result.contentType,
    contentLength: result.contentLength,
    validationStatus: 'ok'
  };
}

async function validateImageCandidates(candidates) {
  const valid = [];
  for (const candidate of dedupeCandidates(candidates).slice(0, MAX_VALIDATION_CANDIDATES)) {
    const checked = await validateImageCandidate(candidate);
    if (checked) valid.push(checked);
    if (valid.length >= 3) break;
  }
  return valid;
}

function isSafeExternalImageUrl(value) {
  return Boolean(normalizeImageUrl(value, value));
}

// 렌더될 그림 경로가 repo 안의 fallback 그림을 가리키는지 판정합니다.
// 이 판정이 필요한 이유는 fallback 그림이 "어느 기사에서도 오지 않은 그림"이기 때문입니다.
// 렌더러는 이 그림에 출처 캡션을 붙이면 안 되고, 렌더 결과를 검사하는 게이트는 반대로 이
// 그림에 출처 캡션이 붙어 있으면 막아야 합니다. 두 곳이 같은 답을 내도록 이 함수를 공유합니다.
//
// 주의: 이것이 저장소 전체의 유일한 fallback 경로 판정은 아닙니다. 그림을 고르는 단계
// (article-image-resolver.js)와 감사·주간 산출물 쪽에 규칙이 조금씩 다른 판정이 따로 있습니다.
// 여기 있는 것은 "렌더 결과의 캡션 규칙"을 렌더러와 게이트가 함께 쓰는 한 벌입니다.
function isFallbackImagePath(value) {
  return /^(?:(?:\.\.\/){1,3})?assets\/images\/fallback\//.test(String(value || '').replace(/\\/g, '/'));
}

module.exports = {
  MIN_CONTENT_LENGTH,
  extractImageCandidatesFromHtml,
  extractImageCandidatesFromRssBlock,
  fetchWithTimeout,
  responseLooksLikeImage,
  validateImageResponse,
  validateImageUrl,
  validateImageCandidates,
  isSafeExternalImageUrl,
  isFallbackImagePath,
  normalizeImageUrl,
  REJECT_PATH_PATTERN
};
