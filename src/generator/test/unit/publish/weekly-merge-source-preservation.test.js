'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateMergedWeeklyArticle } = require('../../../publish/orchestrator-report-builders');

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
function storySection(headline, sourceLinks) {
  return {
    category: 'Camera HAL',
    headline,
    sources: sourceLinks,
    source_candidate_url: sourceLinks[0].url,
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
test('원본을 넘기지 않으면 병합 결과를 채택하지 않는다', () => {
  const merged = storySection('센서 드라이버 패치와 CameraX 릴리스', [patchLink(), releaseLink()]);
  const validation = validateMergedWeeklyArticle(merged, {}, STORY_ISSUE_MARKERS);
  assert.equal(validation.ok, false);
  assert.deepEqual(issueTypes(validation), [
    'merged_article_source_not_in_origin',
    'merged_article_source_not_in_origin'
  ]);
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
