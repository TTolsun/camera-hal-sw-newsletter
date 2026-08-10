// Story Contract v2 (T3) — v2 공개 기사의 텍스트 필드가 누수 스캐너에 전부 걸리는지 본다.
//
// 스캐너는 필드 이름을 열거한다. 새 필드를 계약에 넣고 스캐너 목록에 안 넣으면 스캔이
// 아예 안 돌아 "통과"로 보인다 — 무음 fail-open이다. 그래서 개별 필드를 손으로 나열하지
// 않고, **계약 키 집합에서 파생**해 검사한다. 계약에 키가 늘면 이 테스트가 먼저 깨진다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PUBLIC_ARTICLE_V2_ALLOWED_KEYS,
  validatePublicArticle
} = require('../../reporter/public-article-contract');

// 텍스트가 아닌 키는 각자 다른 검증기가 본다. 여기 적힌 이유가 그 근거다.
// 계약에 새 키가 생기면 아래 둘 중 하나에 반드시 분류돼야 하고, 아니면 이 파일이 깨진다.
const NON_TEXT_KEYS = Object.freeze({
  source_links: 'URL·역할 검증은 sourceLinkIssues가 따로 본다(문자열 누수 스캔 대상 아님)',
  story_contract_version: '숫자 마커. storyContractMarkers가 본다',
  decision_metadata: 'enum 집합. validateDecisionMetadataShape가 본다'
});

// 누수 스캐너가 반드시 잡아야 하는 내부 식별자 하나. HARD_PUBLIC_IDENTIFIERS에 있다.
const LEAKED_IDENTIFIER = 'hal_signal_capsule';

const V2_ISSUE = Object.freeze({
  public_contract_version: 'story-v2',
  generation_contract_version: 2
});

function v2Section(overrides = {}) {
  return {
    headline: 'Himax HM1246 서브디바이스 드라이버 패치',
    sources: [{ title: 'linux-media', url: 'https://lore.kernel.org/linux-media/example/' }],
    public_article: {
      headline: 'Himax HM1246 서브디바이스 드라이버가 v10까지 온 이유',
      lead: '센서 하나를 올리는 패치가 열 번을 도는 동안 무엇이 걸렸는지 본다.',
      body_markdown: [
        '패치가 v10까지 온 이유는 센서 하나가 아니라 서브디바이스 계약이었다.',
        '',
        'v4l2_subdev_format 협상 경로에서 프레임 간격을 누가 정하느냐가 매번 걸렸다.'
      ].join('\n'),
      camera_hal_takeaway: 'HAL 쪽은 서브디바이스 포맷 협상 경로만 확인하면 된다.',
      reader_checkpoints: ['Camera ITS preview latency를 대표 기기 1대에서 확인합니다.'],
      source_links: [{ title: 'linux-media', url: 'https://lore.kernel.org/linux-media/example/' }],
      story_contract_version: 2,
      source_subtitle: 'linux-media · 2026-08-10',
      editorial_story: {
        not_to_overclaim: 'source가 말하지 않는 HAL runtime 변경으로 확대하지 않습니다.',
        editor_take: '검증 대상은 source가 확인한 범위 안에서만 잡습니다.'
      },
      decision_metadata: {
        impact: 'Medium',
        scope: ['HAL'],
        action: ['Watch'],
        overclaim_risk: 'Low'
      },
      ...overrides
    }
  };
}

// 필드마다 값의 모양이 다르다. 누수 문자열을 그 모양에 맞게 심는다.
function withLeak(key) {
  const leaked = `내부 식별자 ${LEAKED_IDENTIFIER} 가 새어 나왔다.`;
  if (key === 'reader_checkpoints') return v2Section({ [key]: [leaked] });
  if (key === 'editorial_story') {
    return v2Section({ editorial_story: { not_to_overclaim: leaked, editor_take: leaked } });
  }
  return v2Section({ [key]: leaked });
}

test('every v2 contract key is classified as text-scanned or explicitly non-text', () => {
  const unclassified = PUBLIC_ARTICLE_V2_ALLOWED_KEYS.filter(key => !(key in NON_TEXT_KEYS));

  // 분류 자체가 목적이다. 새 키가 생기면 여기서 먼저 걸려 사람이 판단하게 된다.
  assert.deepEqual(unclassified, [
    'headline',
    'lead',
    'body_markdown',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'source_subtitle',
    'editorial_story'
  ]);
});

for (const key of ['headline', 'lead', 'body_markdown', 'camera_hal_takeaway', 'reader_checkpoints', 'source_subtitle', 'editorial_story']) {
  test(`v2 leakage scan covers public_article.${key}`, () => {
    const issues = validatePublicArticle(withLeak(key), 0, { issue: V2_ISSUE });
    const leakage = issues.filter(issue => issue.type === 'public_article_leakage');

    assert.equal(
      leakage.some(issue => issue.key === key),
      true,
      `${key}에 심은 ${LEAKED_IDENTIFIER}가 누수 스캔에 안 걸렸다 — 스캐너 목록에서 빠졌다는 뜻이다`
    );
  });
}

// 필드 이름 자체가 독자 글에 나오면 누수다. v1 본문 키(body_paragraphs)는 이 목록에
// 없었지만 v2 키는 T1의 소제목 deny-list에도 올라 있어, 두 목록을 같은 판정으로 맞춘다.
test('the v2 body field name is a forbidden public identifier', () => {
  const { HARD_PUBLIC_IDENTIFIERS } = require('../../reporter/public-prose-leakage');
  const { RESERVED_SUBHEADING_TERMS } = require('../../reporter/public-body-markdown');

  assert.equal(HARD_PUBLIC_IDENTIFIERS.includes('body_markdown'), true);
  assert.equal(RESERVED_SUBHEADING_TERMS.includes('body_markdown'), true);
});
