const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractSourceFacts
} = require('../../../extract-source-facts');
const {
  validateCandidateEvidence
} = require('../../../validate-candidate-evidence');

function candidate(overrides = {}) {
  return {
    title: 'Camera candidate',
    url: 'https://example.com/camera',
    finalSelectionEligibility: 'main',
    source_quality_bucket: 'strong_candidate',
    duplicate_of_selected_source: false,
    source_gap_risk: false,
    ...overrides
  };
}

function recordingFetch(bodyByUrl) {
  const requestedUrls = [];
  const fetchImpl = async requestedUrl => {
    requestedUrls.push(requestedUrl);
    return { ok: true, text: async () => bodyByUrl[requestedUrl] ?? 'source evidence body' };
  };
  return { requestedUrls, fetchImpl };
}

// 같은 기사 URL이 registry 수집본(id 없음)과 gemini 발견본(`gemini-…` id)으로 두 번 들어온다.
// 원문은 한 번만 받되 사본마다 fact가 있어야 한다. 사본이 fact를 잃으면 그 후보는
// not_checked 로 아무것도 막지 않고 통과한다.
test('duplicate candidate records share one fetch and still each get their own fact', async () => {
  const url = 'https://example.com/duplicated';
  const registryCopy = candidate({ url, origin: 'source_registry' });
  const geminiCopy = candidate({ id: 'gemini-duplicated', url, origin: 'gemini_discovery' });
  const { requestedUrls, fetchImpl } = recordingFetch({});

  const facts = await extractSourceFacts([registryCopy, geminiCopy], { fetch: true, fetchImpl });

  assert.deepEqual(requestedUrls, [url]);
  assert.equal(facts.sources.length, 2);
  assert.equal(new Set(facts.sources.map(source => source.id)).size, 2);
  assert.ok(facts.sources.every(source => source.source_fetch_status === 'success'));

  const evidence = validateCandidateEvidence([registryCopy, geminiCopy], facts, { newsletterDate: '2026-05-16' });
  const notChecked = evidence.report.candidates.filter(item => item.evidence_validation_status === 'not_checked');

  assert.deepEqual(notChecked.map(item => item.url), []);
});

// 수신을 출처당 1회로 합치면서 생긴 동작 변경이다. 예전에는 사본 수만큼 재시도돼 두 번째에
// 성공할 수 있었지만 이제 한 번의 실패가 그 출처의 모든 사본에 그대로 적용된다.
// 실패는 감추지 않고 editor 검토로 올라가야 한다.
test('a failed fetch is shared by every copy of the same source instead of being retried', async () => {
  const url = 'https://example.com/unreachable';
  const copies = [
    candidate({ url }),
    candidate({ id: 'gemini-unreachable', url })
  ];
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    throw new Error('fetch failed: 503');
  };

  const facts = await extractSourceFacts(copies, { fetch: true, fetchImpl });

  assert.equal(attempts, 1);
  assert.equal(facts.sources.length, 2);
  assert.ok(facts.sources.every(source => source.source_fetch_status === 'failed'));
  assert.deepEqual(new Set(facts.sources.map(source => source.source_fetch_error)), new Set(['fetch failed: 503']));

  const evidence = validateCandidateEvidence(copies, facts, { newsletterDate: '2026-05-16' });

  assert.deepEqual(
    evidence.report.candidates.map(item => item.evidence_validation_status),
    ['fetch_failed_review_required', 'fetch_failed_review_required']
  );
});

// 수신을 합치는 키는 대상을 고르는 쪽과 같아야 한다. 목록·검색 페이지는 query만으로 서로
// 다른 문서이므로 각자 받아온다. Android 문서의 hl 로케일 파라미터만 같은 문서로 본다.
test('the fetch cache separates sources by query but ignores the android locale parameter', async () => {
  const searchPages = [
    candidate({ url: 'https://blog.example.com/search?q=camera' }),
    candidate({ id: 'second-query', url: 'https://blog.example.com/search?q=hal' })
  ];
  const searchFetch = recordingFetch({});
  await extractSourceFacts(searchPages, { fetch: true, fetchImpl: searchFetch.fetchImpl });
  assert.equal(searchFetch.requestedUrls.length, 2);

  const localeVariants = [
    candidate({ url: 'https://developer.android.com/jetpack/camera?hl=ko' }),
    candidate({ id: 'no-locale', url: 'https://developer.android.com/jetpack/camera' })
  ];
  const localeFetch = recordingFetch({});
  await extractSourceFacts(localeVariants, { fetch: true, fetchImpl: localeFetch.fetchImpl });
  assert.equal(localeFetch.requestedUrls.length, 1);
});
