'use strict';

// 같은 저장소에 oversize 정책 두 개가 의도적으로 공존한다 —
// 증거 해석용(linked-evidence-resolver.js의 responseText)은 접두사 유지,
// 수집 예산용(이 파일)은 본문 폐기.

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_USER_AGENT = 'camera-hal-sw-newsletter/1.0';
const DEFAULT_ACCEPT = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8';
const MAX_BYTES_PER_ARTICLE = 750 * 1024;
const MAX_BYTES_PER_INDEX_PAGE = 1536 * 1024;
const MAX_BYTES_PER_SOURCE_RUN = 6 * 1024 * 1024;
// 첫 시도 + 재시도 1회. 재시도는 429·5xx에만 적용한다(네트워크 오류·timeout은 재시도하지 않는다).
const MAX_ATTEMPTS = 2;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

// 실제 fetch 응답의 headers는 Headers 인스턴스지만 테스트가 주입하는 가짜 응답은 평범한 객체다.
// 두 경우를 같은 소문자 키 평면 객체로 만들어 호출자가 한 가지 모양만 다루게 한다.
function plainHeaders(response) {
  const headers = response && response.headers;
  const plain = {};
  if (!headers) return plain;
  if (typeof headers.forEach === 'function' && typeof headers.get === 'function') {
    headers.forEach((value, key) => {
      plain[String(key).toLowerCase()] = String(value);
    });
    return plain;
  }
  for (const [key, value] of Object.entries(headers)) {
    plain[String(key).toLowerCase()] = String(value);
  }
  return plain;
}

async function cancelBody(response) {
  const stream = response && response.body;
  if (stream && typeof stream.cancel === 'function') {
    await stream.cancel().catch(() => {});
  }
}

function describeFetchError(cause, timeoutMs) {
  if (cause && cause.name === 'AbortError') return `timeout_after_${timeoutMs}ms`;
  return String((cause && cause.message) || cause || 'fetch_failed');
}

function boundedFetchResult(fields = {}) {
  return {
    url: '', ok: false, status: 0, headers: {}, body: '',
    receivedBytes: 0, truncated: false,
    limitedBy: '',              // '' | 'request' | 'source-run'
    sourceBudgetExhausted: false,
    attempts: 0, error: '',
    ...fields
  };
}

// 상한까지만 읽고 그 이상은 스트림을 끊는다.
// truncated면 body는 빈 문자열이다 — 잘린 본문을 파싱하지 못하게 구조로 막는다.
//
// 바이트 단위 주의: undici가 gzip을 투명하게 풀기 때문에 여기서 세는 바이트는 압축 해제 후
// 바이트다(실측: claude.com 기사 wire 108,489 -> 해제 557,949). 상한은 파싱 대상 크기의
// 상한이지 회선 바이트의 상한이 아니다.
async function readBoundedBody(response, limitBytes) {
  const stream = response && response.body;
  if (!stream || typeof stream.getReader !== 'function') {
    // 스트림을 주지 않는 구현(테스트 stub 등)은 전부 받은 뒤 크기만 검사한다.
    // 이 경로는 대역폭을 아끼지 못한다. 메모리 상한만 지킨다.
    const text = response && typeof response.text === 'function' ? await response.text() : '';
    const receivedBytes = Buffer.byteLength(text, 'utf8');
    return receivedBytes > limitBytes
      ? { body: '', receivedBytes, truncated: true }
      : { body: text, receivedBytes, truncated: false };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let receivedBytes = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || []);
      receivedBytes += chunk.byteLength;
      if (receivedBytes > limitBytes) {
        truncated = true;
        await reader.cancel();
        break;
      }
      body += decoder.decode(chunk, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    // 우리가 상한 때문에 끊은 뒤 늦게 도착한 오류는 삼킨다. 그 외 오류는 호출자에게 올린다.
    // 다만 끊기기 전까지 이미 수신한 바이트는 실제로 회선을 탔으므로 예산에서 빠져야 한다.
    // 이 값을 잃으면 실패가 잦은 호스트에서 소스 누적 상한이 사실상 무제한이 된다.
    if (!truncated) {
      error.partialReceivedBytes = receivedBytes;
      throw error;
    }
  }

  return truncated
    ? { body: '', receivedBytes, truncated: true }
    : { body, receivedBytes, truncated: false };
}

// maxBytes는 양수만 유효하다. 0/음수/NaN은 기본값(MAX_BYTES_PER_ARTICLE)으로 대체된다 —
// 0을 '받지 않겠다'로 읽으면 안 된다.
function createBoundedFetchClient(options = {}) {
  const maxBytesPerSourceRun = positiveNumber(options.maxBytesPerSourceRun, MAX_BYTES_PER_SOURCE_RUN);
  const timeoutMs = positiveNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const retryDelayMs = Number.isFinite(Number(options.retryDelayMs)) && Number(options.retryDelayMs) >= 0
    ? Number(options.retryDelayMs)
    : DEFAULT_RETRY_DELAY_MS;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : fetch;

  // 소스 run 전체가 공유하는 hard counter.
  // 지금 호출부의 동시성은 1이라 "남은 예산 확인 -> 수신 -> 가산"이 원자적이다.
  // 동시성을 올리려면 요청 전에 상한만큼 예약했다가 실제 수신량으로 되돌리는 방식으로
  // 바꿔야 한다. 이 카운터를 그대로 두고 동시성만 올리면 예산을 넘긴다.
  let consumedBytes = 0;
  let requestCount = 0;

  function remainingBytes() {
    return Math.max(0, maxBytesPerSourceRun - consumedBytes);
  }

  async function requestOnce(target, { maxBytes, accept }) {
    requestCount += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(target, {
        signal: controller.signal,
        headers: {
          'user-agent': userAgent,
          accept: accept || DEFAULT_ACCEPT
        }
      });
      const status = response ? response.status : 0;
      const headers = plainHeaders(response);

      if (isRetryableStatus(status)) {
        // 재시도 대상 status면 본문을 읽지 않고 연결만 반납한다(읽으면 예산만 축낸다).
        await cancelBody(response);
        return { status, headers, body: '', receivedBytes: 0, truncated: false };
      }

      // 남은 예산이 요청 상한 이하면 실제로 스트림을 끊는 것은 소스 누적 상한이다.
      // (limitBytes < maxBytes 만 보면 두 값이 같은 경계에서 'request'로 잘못 보고된다.)
      const cappedBySourceRun = remainingBytes() <= maxBytes;
      const limitBytes = Math.min(maxBytes, remainingBytes());
      const { body, receivedBytes, truncated } = await readBoundedBody(response, limitBytes);
      consumedBytes += receivedBytes;

      return {
        status, headers, body, receivedBytes, truncated,
        limitedBy: truncated ? (cappedBySourceRun ? 'source-run' : 'request') : ''
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchBounded(target, { maxBytes, accept } = {}) {
    const effectiveMaxBytes = positiveNumber(maxBytes, MAX_BYTES_PER_ARTICLE);

    if (remainingBytes() <= 0) {
      return boundedFetchResult({
        url: target,
        sourceBudgetExhausted: true,
        attempts: 0,
        error: 'source_run_budget_exhausted'
      });
    }

    let attempts = 0;
    let receivedBytesTotal = 0;

    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      let attempt;
      try {
        attempt = await requestOnce(target, { maxBytes: effectiveMaxBytes, accept });
      } catch (cause) {
        // 실패한 시도가 이미 읽어 들인 바이트도 예산에 가산한다(누수 차단).
        const partialBytes = Number(cause && cause.partialReceivedBytes) || 0;
        consumedBytes += partialBytes;
        receivedBytesTotal += partialBytes;
        return boundedFetchResult({
          url: target,
          attempts,
          receivedBytes: receivedBytesTotal,
          error: describeFetchError(cause, timeoutMs)
        });
      }

      receivedBytesTotal += attempt.receivedBytes;

      if (isRetryableStatus(attempt.status) && attempts < MAX_ATTEMPTS) {
        if (retryDelayMs > 0) await sleep(retryDelayMs);
        continue;
      }

      const httpOk = attempt.status >= 200 && attempt.status < 300;
      const ok = httpOk && !attempt.truncated;

      return boundedFetchResult({
        url: target,
        ok,
        status: attempt.status,
        headers: attempt.headers,
        body: attempt.body,
        receivedBytes: attempt.receivedBytes,
        truncated: attempt.truncated,
        limitedBy: attempt.limitedBy || '',
        attempts,
        // 상한에 걸린 2xx의 error가 빈 문자열이면 `if (!ok) throw new Error(result.error || ...)`를
        // 쓰는 호출자가 'http_200'을 던진다.
        error: attempt.truncated
          ? 'truncated_at_byte_limit'
          : (httpOk ? '' : `http_${attempt.status}`)
      });
    }

    // 도달하지 않음(루프는 항상 위에서 return한다). 방어적 폴백.
    return boundedFetchResult({ url: target, attempts, receivedBytes: receivedBytesTotal, error: 'retry_exhausted' });
  }

  return {
    fetchBounded,
    remainingBytes,
    consumedBytes: () => consumedBytes,
    requestCount: () => requestCount,
    maxBytesPerSourceRun
  };
}

module.exports = {
  createBoundedFetchClient,
  MAX_BYTES_PER_ARTICLE,
  MAX_BYTES_PER_INDEX_PAGE,
  MAX_BYTES_PER_SOURCE_RUN
};
