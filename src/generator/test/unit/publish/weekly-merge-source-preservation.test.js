'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateMergedWeeklyArticle } = require('../../../publish/orchestrator-report-builders');
const { resolveWeeklyArticles } = require('../../../reporter/weekly-duplicate-merge');

// #870: weekly LLM 병합 결과를 채택하기 전에 "원본의 출처를 그대로 이어받았는가"를 강제한다.
// 검증기가 LLM 출력 하나만 보면 sources와 public_article.source_links를 같은 모델이 함께
// 만든 탓에 서로 맞는 게 당연해져(자기증명), 지어낸 출처도 통과한다. weekly issue.json의
// section은 이후 어떤 게이트도 다시 보지 않으므로 여기가 마지막 방어선이다.

// 이슈 레벨 계약 마커. 오늘 editor draft가 선언하는 값과 같은 모양이다.
const STORY_ISSUE_MARKERS = { public_contract_version: 'story-v1', generation_contract_version: 1 };

const PATCH_URL = 'https://lore.kernel.org/linux-media/patch-v2-sensor-driver/';
const RELEASE_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0';

// validatePublicArticle을 실제로 통과하는 story 계약 v1 section. 여기서 통과하지 못하면
// "정상 병합이 채택된다"는 절반을 증명할 수 없다.
// sources(인용 가능 URL의 allow-list)와 source_links(실제로 발행되는 인용 목록)는 서로 다른
// 필드다. 기본값은 같게 두되, 둘이 어긋난 병합을 만들 수 있도록 따로 받는다.
function storySection(headline, sources, sourceLinks = sources) {
  return {
    category: 'Camera HAL',
    headline,
    sources,
    source_candidate_url: sources[0].url,
    public_article: {
      headline,
      lead: '이번 주 리눅스 미디어 메일링 리스트에 카메라 센서 드라이버 패치가 올라왔습니다. 드라이버 계층에서 확인할 부분을 정리했습니다.',
      body_paragraphs: [
        '패치는 센서 드라이버가 MIPI CSI-2로 내보내는 RAW Bayer 포맷을 정의합니다. 드라이버가 노출하는 포맷은 상위 파이프라인이 버퍼를 준비하는 방식에 그대로 이어집니다.',
        '프레임 레이트가 높아지면 버퍼 순환 주기가 짧아집니다. 스트림을 길게 돌려 프레임 드롭이 생기는지 확인하는 편이 좋습니다.'
      ],
      camera_hal_takeaway: '센서 드라이버가 선언한 포맷과 프레임 레이트가 실제 스트림에서 유지되는지 확인해야 합니다.',
      reader_checkpoints: [
        'MIPI CSI-2 레인 수를 1~4로 바꿔가며 전송이 끊기지 않는지 확인한다.',
        '1920x1200 120fps 스트림에서 프레임 드롭과 버퍼 큐 지연을 측정한다.'
      ],
      source_links: sourceLinks,
      story_contract_version: 1,
      source_subtitle: 'lore.kernel.org linux-media list',
      editorial_story: {
        reader_scenario: '고속 촬영이 필요한 기기에서 글로벌 셔터 센서를 새로 얹어야 하는 상황이라고 가정해 봅시다.',
        what_happened: '리눅스 미디어 리스트에 센서 드라이버 패치 시리즈가 제출되었습니다.',
        why_it_matters: '드라이버가 선언한 포맷과 프레임 레이트는 상위 카메라 파이프라인 설계에 그대로 영향을 줍니다.',
        field_scenario: '개발 보드에서 고속 스트림을 돌리고 압축 포맷을 켠 채 아티팩트가 생기는지 확인합니다.',
        not_to_overclaim: '아직 제안 단계이며 표준 메타데이터 계약이 바뀐다는 뜻은 아닙니다.',
        editor_take: '특수 목적 기기의 카메라 파이프라인을 준비하는 팀이라면 눈여겨볼 만합니다.'
      },
      decision_metadata: {
        impact: 'Medium',
        scope: ['HAL', 'Driver'],
        action: ['Watch', 'Test'],
        overclaim_risk: 'Low'
      }
    }
  };
}

function patchLink() {
  return { title: '센서 드라이버 패치 시리즈', url: PATCH_URL };
}

function releaseLink() {
  return { title: 'CameraX 1.7.0 릴리스 노트', url: RELEASE_URL };
}

function origins() {
  return {
    existing: storySection('센서 드라이버 패치 시리즈', [patchLink()]),
    incoming: storySection('CameraX 1.7.0 릴리스 노트', [releaseLink()])
  };
}

function issueTypes(validation) {
  return validation.issues.map(issue => issue.type);
}

test('원본 두 기사의 출처를 모두 이어받은 병합 결과는 채택된다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink(), releaseLink()]);
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.deepEqual(issueTypes(validation), []);
  assert.equal(validation.ok, true);
});

test('원본에 없던 출처를 들고 온 병합 결과는 거부된다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [
    patchLink(),
    releaseLink(),
    { title: '지어낸 근거', url: 'https://example.invalid/fabricated-evidence' }
  ]);
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['merged_article_source_not_in_origin']);
  assert.match(validation.reason, /merged_article_source_not_in_origin/);
});

test('원본이 발행하던 출처를 떨어뜨린 병합 결과는 거부된다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink()]);
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['merged_article_dropped_origin_source']);
});

// 유실 판정을 sources에서 하면 이 모양이 통과한다. sources에는 두 출처가 다 있지만 독자가
// 보는 인용 목록에서 한쪽이 빠져, 발행 지면에서는 그 근거가 사라진다. 병합 프롬프트가
// source_links를 sources의 진부분집합으로 허용하므로 이건 규칙을 지킨 정상 응답 모양이다.
test('sources를 모두 이어받았어도 발행 인용 목록에서 원본 출처를 빼면 거부된다', () => {
  const merged = storySection(
    '센서 드라이버 패치와 CameraX 릴리스',
    [patchLink(), releaseLink()],
    [patchLink()]
  );
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['merged_article_dropped_origin_source']);
  assert.equal(validation.issues[0].url, RELEASE_URL);
});

// 빈 sources는 allow-list를 비우고, 빈 allow-list는 source_link URL 검사를 통째로
// 건너뛴다. 부분집합 검사만으로는 빈 집합이 언제나 통과하므로 따로 막는다.
test('sources를 비운 병합 결과는 source_link가 남아 있어도 거부된다', () => {
  const merged = storySection('출처 없는 병합', [patchLink()]);
  merged.sources = [];
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['merged_article_has_no_source']);
});

// 대조할 원본이 없으면 보존을 증명할 수 없다. 호출부가 원본을 빠뜨려도 채택되지 않는다.
// per-URL 위반("이 URL이 원본에 없다")이 아니라 전용 오류 하나로 남는다 — 원본 자체가 없어
// 대조하지 못한 상황과 실제 지어낸 출처를 리포트에서 바로 구분하기 위해서다.
test('원본을 넘기지 않으면 전용 오류 하나로 거부된다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink(), releaseLink()]);
  const validation = validateMergedWeeklyArticle(merged, {}, STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['no_origin_articles_provided']);
  assert.equal(validation.reason, 'no_origin_articles_provided');
});

// url 없는 sources 항목은 키가 없다. 객체를 그대로 URL 정규화기에 넘기면 문자열화되어
// "[object object]"라는 비어있지 않은 키가 나오고, 서로 다른 url 없는 항목이 한 키로 뭉쳐
// 합집합에서 조용히 사라진다. 그 키가 인용 allow-list에도 등록되면 더 나쁘다.
test('url이 없는 sources 항목은 키를 만들지 않아 서로 뭉치지 않는다', () => {
  const existing = storySection('센서 드라이버 패치 시리즈', [patchLink(), { title: '메모만 있는 항목' }]);
  const incoming = storySection('CameraX 1.7.0 릴리스 노트', [releaseLink(), { title: '다른 메모' }]);
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink(), releaseLink()]);
  const validation = validateMergedWeeklyArticle(merged, { existing, incoming }, STORY_ISSUE_MARKERS);
  assert.deepEqual(issueTypes(validation), []);
  assert.equal(validation.ok, true);
});

// 마커를 넘기지 않으면 story 계약 기사는 섹션 마커 하나만 보여 항상 mismatch가 난다.
// 병합 채택 경로가 통째로 닫혀 있던 원인이다.
test('이슈 계약 마커 없이는 정상 병합도 계약 불일치로 거부된다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink(), releaseLink()]);
  const validation = validateMergedWeeklyArticle(merged, origins(), {});
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), ['story_contract_version_mismatch']);
});

// 실패 사유가 weekly-merge-report.json에서 읽히는 형태여야 한다. 이슈 객체를 그대로
// join하면 `[object Object]`만 남는다.
test('실패 사유는 이슈 타입 문자열과 구조화된 이슈 목록으로 함께 남는다', () => {
  const merged = storySection('출처 없는 병합', [patchLink()]);
  merged.sources = [];
  const validation = validateMergedWeeklyArticle(merged, origins(), STORY_ISSUE_MARKERS);
  assert.equal(validation.reason, 'merged_article_has_no_source');
  assert.doesNotMatch(validation.reason, /\[object Object\]/);
});

// ── 실제 배선으로 한 번 돌려 본다 ────────────────────────────────────────────────
// 채택 section을 만드는 쪽(resolveWeeklyArticles)과 그것을 판정하는 쪽
// (validateMergedWeeklyArticle)은 서로 다른 모듈이다. 인자 모양이 어긋나면 두 모듈의 단위
// 테스트는 그대로 통과하면서 실제 병합 경로만 조용히 죽는다. 이 경로는 아직 운영에서 한 번도
// 돈 적이 없으므로 여기서 실물로 한 번 돌린다.

const CAMERAX_V16_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0';

function releaseLinkV16() {
  return { title: 'CameraX 1.6.0 릴리스 노트', url: CAMERAX_V16_URL };
}

// 같은 release-note 페이지의 다른 버전이라 near-duplicate로 잡혀 LLM 병합 경로로 들어간다.
function weeklyOrigins() {
  const existing = storySection('CameraX 1.6.0 릴리스 노트', [releaseLinkV16()]);
  existing.selectedImage = 'https://images.example/verified.png';
  existing.resolvedImage = { url: 'https://images.example/verified.png' };
  return { existing, incoming: storySection('CameraX 1.7.0 릴리스 노트', [releaseLink()]) };
}

async function resolveWithRealValidator(mergedPublicArticle) {
  const { existing, incoming } = weeklyOrigins();
  const result = await resolveWeeklyArticles({
    existingArticles: [existing],
    incomingArticles: [incoming],
    mergeDuplicate: async () => ({
      decision: 'merge',
      reason: 'same release note page',
      mergedArticle: {
        headline: 'CameraX 1.6.0/1.7.0 릴리스 노트',
        selectedImage: 'https://attacker.example/not-validated.png',
        sources: [{ title: '지어낸 근거', url: 'https://example.invalid/fabricated-evidence' }],
        public_article: mergedPublicArticle
      }
    }),
    validateMerged: (mergedArticle, mergeOrigins) =>
      validateMergedWeeklyArticle(mergedArticle, mergeOrigins, STORY_ISSUE_MARKERS)
  });
  return { existing, result };
}

function mergedPublicArticle(sourceLinks) {
  return { ...storySection('CameraX 1.6.0/1.7.0 릴리스 노트', [releaseLinkV16()]).public_article, source_links: sourceLinks };
}

test('실제 배선: 두 원본의 인용을 모두 이어받은 병합은 채택되고 결정론 필드는 기존 기사 것이 남는다', async () => {
  const { result } = await resolveWithRealValidator(mergedPublicArticle([releaseLinkV16(), releaseLink()]));
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.decisions.map(item => item.decision), ['merge']);
  const adopted = result.existingArticles[0];
  assert.deepEqual(adopted.public_article.source_links.map(link => link.url), [CAMERAX_V16_URL, RELEASE_URL]);
  assert.deepEqual(adopted.sources.map(source => source.url), [CAMERAX_V16_URL, RELEASE_URL]);
  // LLM이 써 보낸 이미지가 아니라 기존 기사가 이미 검증해 둔 이미지가 남아야 한다.
  assert.equal(adopted.selectedImage, 'https://images.example/verified.png');
});

test('실제 배선: 원본 인용을 하나 떨어뜨린 병합은 거부되고 기존 기사가 남는다', async () => {
  const { existing, result } = await resolveWithRealValidator(mergedPublicArticle([releaseLinkV16()]));
  assert.equal(result.existingArticles[0], existing);
  assert.equal(result.appendedArticles.length, 0);
  assert.deepEqual(
    result.warnings[0].issues.map(issue => issue.type),
    ['merged_article_dropped_origin_source']
  );
});

// sources를 결정론적으로 만들면 인용 allow-list도 결정론이 되고, 지어낸 인용은 기존 계약
// 검증기(source_link allow-list 검사)가 그대로 잡는다.
test('실제 배선: 원본에 없던 URL을 인용한 병합은 거부되고 기존 기사가 남는다', async () => {
  const { existing, result } = await resolveWithRealValidator(mergedPublicArticle([
    releaseLinkV16(),
    releaseLink(),
    { title: '지어낸 근거', url: 'https://example.invalid/fabricated-evidence' }
  ]));
  assert.equal(result.existingArticles[0], existing);
  assert.deepEqual(result.warnings[0].issues.map(issue => issue.type), ['invalid_source_link']);
  assert.equal(result.warnings[0].issues[0].reason, 'url_not_in_allowed_source_set');
});
