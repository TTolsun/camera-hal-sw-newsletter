// 현재 기사 원문만 읽는다. 이전 발행본이나 다른 기사의 이미지는 복구 원천이 아니다.
const { extractImageCandidatesFromHtml, validateImageCandidates } = require('./image-candidates');
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const transientStatus = status => status === 408 || status === 429 || status >= 500;

async function fetchArticlePage(url, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { 'user-agent': 'camera-hal-sw-newsletter/1.0', accept: 'text/html' } });
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, reason: 'http_error', status: response.status, retryable: transientStatus(response.status) };
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      return { ok: false, reason: 'non_html', retryable: false };
    }
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: 'empty_body', retryable: false };
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PAGE_BYTES) {
        await reader.cancel();
        return { ok: false, reason: 'page_size_limit', retryable: false };
      }
      chunks.push(Buffer.from(value));
    }
    return { ok: true, html: Buffer.concat(chunks).toString('utf8') };
  } catch (error) {
    return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'network_error', retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

async function collectArticleImages(articleUrl, source = {}, existing = [], options = {}) {
  const diagnostics = { article_url: articleUrl, page_attempts: [], validation_failures: [], extracted_count: 0, valid_count: 0 };
  if (!/^https:\/\//i.test(articleUrl || '')) {
    diagnostics.outcome = 'invalid_article_url';
    return { images: [], diagnostics };
  }
  const deadline = Date.now() + 40000;
  const fetchPage = options.fetchPage || fetchArticlePage;
  let page;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    page = await fetchPage(articleUrl, { ...options, timeoutMs: Math.min(options.timeoutMs || 12000, Math.max(1, deadline - Date.now())) });
    diagnostics.page_attempts.push({ attempt, ok: page.ok, reason: page.reason || 'ok', status: page.status || 0 });
    if (page.ok || !page.retryable || attempt === 2) break;
    await (options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms))))(250);
  }
  const extracted = page.ok ? extractImageCandidatesFromHtml(page.html, articleUrl, source) : [];
  diagnostics.extracted_count = extracted.length;
  const images = await validateImageCandidates([...existing, ...extracted], {
    attempts: 2,
    timeoutMs: 8000,
    deadline,
    ...options.imageValidation,
    onDiagnostic: event => diagnostics.validation_failures.push(event)
  });
  diagnostics.valid_count = images.length;
  diagnostics.outcome = images.length ? 'available' : !page.ok ? 'page_fetch_failed' : !extracted.length && !existing.length ? 'no_image_extracted' : 'image_validation_failed';
  return { images, diagnostics };
}

module.exports = { collectArticleImages, fetchArticlePage, MAX_PAGE_BYTES };
