const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const { BUCKET_PRIORITY } = require('../../../shared/domain/aosp-camera-scope');
const {
  buildShortlistReport,
  policyDriverCandidate,
  policyPrimaryCandidate
} = require('../../../shared/test/helpers/selection-builders');
const { normalizeShortlistReport } = require('../../select/selection-diagnostics');
const {
  buildReferenceArticlesForIssue,
  referenceArticleCandidatePool
} = require('../../render/reference-articles');

// 라이브 결함(2026-08-10: 창 안 적격 후보 12건 중 기사 2건, 나머지는 어느 섹션에도 없음)을
// 실제로 고친 것은 "참고 섹션을 shortlistReport 전체에서 만든다"는 발행 파이프라인 배선이다.
// 모듈 단위 테스트는 buildReferenceArticlesForIssue 안쪽만 보므로, 호출부가 예전처럼 특정
// 창 후보만 넘기도록 되돌아가도 전 테스트가 초록이었다(QA 뮤테이션으로 실증).
// 이 파일은 그 배선 자체를 계약으로 고정한다. 같은 파일을 소스 텍스트로 검사하는 선례는
// prompt-contract.test.js에 있다.
function publishHostSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
}

test('the publish host builds the reference section from the whole shortlist report', () => {
  const source = publishHostSource();

  assert.match(
    source,
    /editor\.reference_articles = buildReferenceArticlesForIssue\(shortlistReport\);/,
    '참고 섹션은 shortlistReport 하나를 그대로 넘겨 만든다(특정 창 후보만 추려 넘기지 않는다)'
  );
});

test('the publish host does not assemble the reference pool itself', () => {
  const source = publishHostSource();

  // 풀 조립·제외·상한·정렬 규칙이 호출부로 새면 모듈 테스트가 그 규칙을 더 이상 지키지 못한다.
  assert.doesNotMatch(
    source,
    /\bbuildReferenceArticles\(/,
    '저수준 빌더를 직접 부르지 않는다 — 조립은 reference-articles 모듈 안에서만 한다'
  );
  assert.doesNotMatch(
    source,
    /\breferenceArticleCandidatePool\(|\breferenceArticleExcludeUrls\(/,
    '풀/제외 헬퍼도 호출부에서 직접 조합하지 않는다'
  );
});

// 참고 섹션 정렬의 첫 항은 후보의 freshness_window를 읽는다(render/reference-articles.js).
// 그 값은 select가 붙여 selection-diagnostics의 정규화와 orchestrator-finalize를 거쳐 render까지
// 스프레드로 실려 온다. 중간 어디서든 필드를 명시 투영으로 바꿔 이 값이 떨어지면 정렬 첫 항이
// 모든 후보에 대해 0이 되고, 순서는 이 PR 이전(버킷 우선순위 우선)으로 조용히 되돌아간다.
// 산출물은 여전히 그럴듯해서 커밋 이력만으로는 판정할 수 없다 — 이 저장소가 #963에서 이미
// 겪은 실패 유형(배선이 끊겼는데 건강한 주와 산출물이 바이트 동일)이다.
// 그래서 값의 존재와 그 값이 실제로 순서를 바꾸는지를 함께 잠근다.
//
// 입력 anchor 2026-08-19(수)의 coverage 주는 2026-W33(08-10~08-16)이다.
// 창 안: camera_driver_image_pipeline(버킷 우선순위 2) 패치들.
// 창 밖: direct_aosp_camera(버킷 우선순위 1) 문서 갱신 2건 — 버킷만 보면 이쪽이 먼저다.
function shortlistReportWithBothWindows() {
  const inWindow = [
    ['imx708 image sensor bindings patch', 'driver-imx708', '2026-08-14'],
    ['uvcvideo status buffer overread fix', 'driver-uvcvideo', '2026-08-13'],
    ['v4l2-isp zero-sized parameter block rejection', 'driver-v4l2-isp', '2026-08-12'],
    ['atomisp redundant assignment cleanup', 'driver-atomisp', '2026-08-11'],
    ['AR0234 global shutter sensor driver', 'driver-ar0234', '2026-08-10'],
    ['imx576 camera sensor driver series', 'driver-imx576', '2026-08-15'],
    ['software_isp egl filter parameter buffers', 'driver-egl', '2026-08-16']
  ].map(([title, slug, published_date], index) => policyDriverCandidate(index, {
    title,
    url: `https://example.com/${slug}`,
    published_date
  }));

  return buildShortlistReport('2026-08-19', [
    policyPrimaryCandidate(0, {
      title: 'Camera ITS tests documentation update',
      url: 'https://example.com/aosp-its-tests',
      published_date: '2026-07-20'
    }),
    policyPrimaryCandidate(1, {
      title: 'Compatibility Test Suite site refresh',
      url: 'https://example.com/aosp-cts-site',
      published_date: '2026-07-19'
    }),
    ...inWindow
  ], { minArticles: 1 });
}

test('selection stamps a freshness window on every candidate the reference builder reads', () => {
  const report = shortlistReportWithBothWindows();
  // 발행 파이프라인이 render에 넘기는 모양은 정규화를 한 번 거친 shortlistReport다.
  const renderInput = normalizeShortlistReport(report, null);

  for (const [label, source] of [['buildShortlistReport', report], ['normalizeShortlistReport', renderInput]]) {
    for (const field of ['shortlisted_candidates', 'reference_context_candidates']) {
      const candidates = source[field];
      assert.ok(Array.isArray(candidates) && candidates.length > 0, `${label}.${field}가 비어 있으면 이 계약을 검증할 수 없다`);
      for (const item of candidates) {
        assert.ok(
          typeof item.freshness_window === 'string' && item.freshness_window.trim() !== '',
          `${label}.${field}의 '${item.title}'에 freshness_window가 없다 — 참고 섹션 정렬의 창 항이 죽는다`
        );
      }
    }
  }
});

test('the reference section orders coverage-week candidates ahead of a higher-priority bucket from outside the week', () => {
  const renderInput = normalizeShortlistReport(shortlistReportWithBothWindows(), null);
  const pool = referenceArticleCandidatePool(renderInput);
  const items = buildReferenceArticlesForIssue(renderInput);

  const poolByTitle = new Map(pool.map(candidate => [candidate.title, candidate]));
  const rendered = items.map(item => poolByTitle.get(item.title));
  assert.ok(rendered.every(Boolean), '렌더된 항목은 모두 풀에서 온다');

  const inWindow = rendered.filter(candidate => candidate.freshness_window === 'primary');
  const outOfWindow = rendered.filter(candidate => candidate.freshness_window !== 'primary');
  // 두 집합이 모두 실제로 렌더돼야 이 테스트가 무언가를 잠근다.
  assert.ok(inWindow.length > 0 && outOfWindow.length > 0, '창 안·창 밖이 모두 렌더돼야 순서를 검증할 수 있다');
  // 그리고 창 밖 쪽 버킷이 더 앞선 우선순위여야 "창 항이 버킷보다 앞선다"를 증명한다.
  assert.ok(
    BUCKET_PRIORITY[outOfWindow[0].relevance_bucket] < BUCKET_PRIORITY[inWindow[0].relevance_bucket],
    '창 밖 후보의 버킷 우선순위가 더 높아야 이 배치가 버킷만으로 정해지지 않았음을 보인다'
  );

  const lastInWindowSlot = rendered.reduce(
    (last, candidate, index) => (candidate.freshness_window === 'primary' ? index : last),
    -1
  );
  const firstOutOfWindowSlot = rendered.findIndex(candidate => candidate.freshness_window !== 'primary');
  assert.ok(
    lastInWindowSlot < firstOutOfWindowSlot,
    '창 안 항목이 모두 앞에 오고 창 밖 항목은 남은 자리만 채운다'
  );
});
