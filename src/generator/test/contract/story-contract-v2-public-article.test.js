// Story Contract v2 계약 코어(T2) — public_article의 v2 정규화·검증 분기.
//
// v2는 본문을 body_paragraphs(문자열 배열)가 아니라 body_markdown(단일 markdown
// 문자열)로 받는다. v1 경로(compactText/normalizeStringArray)는 문단 경계를 파괴하고
// 같은 문구의 소제목을 무음 drop하므로 절대 타지 않는다.
//
// 이 PR 이후에도 어떤 producer도 v2를 만들지 않는다. 게이트가 v2를 수용만 한다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  publicArticleForSection,
  validatePublicArticle
} = require('../../reporter/public-article-contract');

const V2_ISSUE = Object.freeze({
  public_contract_version: 'story-v2',
  generation_contract_version: 2
});

const V1_ISSUE = Object.freeze({
  public_contract_version: 'story-v1',
  generation_contract_version: 1
});

const BODY_MARKDOWN = [
  'Himax HM1246 드라이버 패치가 v10까지 온 이유는 센서 하나가 아니라 서브디바이스 계약이었다.',
  '',
  '### 리뷰어가 열 번 되돌린 지점',
  '',
  'v4l2_subdev_format 협상 경로에서 프레임 간격을 누가 정하느냐가 매번 걸렸다.'
].join('\n');

function v2Section(publicArticleOverrides = {}) {
  return {
    headline: 'Himax HM1246 이미지 센서용 V4L2 서브디바이스 드라이버 패치 v10 제안',
    sources: [{ title: 'linux-media', url: 'https://lore.kernel.org/linux-media/example/' }],
    public_article: {
      headline: 'Himax HM1246 서브디바이스 드라이버가 v10까지 온 이유',
      lead: '센서 하나를 올리는 패치가 열 번을 도는 동안 무엇이 걸렸는지 본다.',
      body_markdown: BODY_MARKDOWN,
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
      ...publicArticleOverrides
    }
  };
}

function v1Section() {
  return {
    headline: 'CameraX release note',
    public_article: {
      headline: 'CameraX release note',
      lead: '앱 계층 변경이 HAL 검증 범위에 닿는지 본다.',
      body_paragraphs: ['첫 문단입니다.', '둘째 문단입니다.'],
      camera_hal_takeaway: 'HAL 변경 근거는 없음으로 제한합니다.',
      reader_checkpoints: ['release note 범위만 추적합니다.'],
      source_links: [{ title: 'Android Developers', url: 'https://developer.android.com/example' }],
      story_contract_version: 1,
      source_subtitle: 'Android Developers · 2026-08-10',
      editorial_story: {
        reader_scenario: '리뷰 중 확인이 필요한 상황을 가정합니다.',
        what_happened: 'source가 변경점을 공개했습니다.',
        why_it_matters: 'regression 검증 후보로 볼 수 있습니다.',
        field_scenario: 'preview latency log를 비교합니다.',
        not_to_overclaim: 'HAL runtime 변경으로 확대하지 않습니다.',
        editor_take: 'source 범위 안에서만 잡습니다.'
      },
      decision_metadata: {
        impact: 'Low',
        scope: ['App'],
        action: ['Watch'],
        overclaim_risk: 'Low'
      }
    }
  };
}

function issueTypes(section, issue) {
  return validatePublicArticle(section, 0, { issue }).map(item => item.type);
}

test('v2 public article normalizes body_markdown instead of body_paragraphs', () => {
  const normalized = publicArticleForSection(v2Section(), { issue: V2_ISSUE });

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'body_paragraphs'), false);
  assert.match(normalized.body_markdown, /^### 리뷰어가 열 번 되돌린 지점$/m);
  assert.match(normalized.body_markdown, /\n\n/);
});

test('v2 public article stamps the version its markers declared', () => {
  const normalized = publicArticleForSection(v2Section(), { issue: V2_ISSUE });

  assert.equal(normalized.story_contract_version, 2);
});

test('v1 public article keeps its paragraphs and its version stamp', () => {
  const normalized = publicArticleForSection(v1Section(), { issue: V1_ISSUE });

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'body_markdown'), false);
  assert.deepEqual(normalized.body_paragraphs, ['첫 문단입니다.', '둘째 문단입니다.']);
  assert.equal(normalized.story_contract_version, 1);
});

test('v2 editorial story keeps only the two safety keys', () => {
  const normalized = publicArticleForSection(v2Section(), { issue: V2_ISSUE });

  assert.deepEqual(Object.keys(normalized.editorial_story), ['not_to_overclaim', 'editor_take']);
});

test('v2 validation accepts body_markdown as a contract key', () => {
  const types = issueTypes(v2Section(), V2_ISSUE);

  assert.equal(types.includes('unexpected_public_article_keys'), false);
  assert.equal(types.includes('insufficient_public_body_paragraphs'), false);
});

test('v2 validation rejects a v1 body field', () => {
  const section = v2Section({ body_paragraphs: ['v1 본문이 남아 있습니다.', '두 번째 문단.'] });
  const issues = validatePublicArticle(section, 0, { issue: V2_ISSUE });
  const unexpected = issues.find(issue => issue.type === 'unexpected_public_article_keys');

  assert.deepEqual(unexpected?.keys, ['body_paragraphs']);
});

test('v2 validation surfaces body_markdown lint failures', () => {
  const section = v2Section({
    body_markdown: [
      '- 리스트로 쓰면 안 된다.',
      '',
      '두 번째 문단입니다.'
    ].join('\n')
  });
  const issues = validatePublicArticle(section, 0, { issue: V2_ISSUE });
  const lintIssue = issues.find(issue => issue.type === 'body_markdown_forbidden_construct');

  assert.equal(lintIssue?.key, 'body_markdown');
  assert.equal(lintIssue?.construct, 'list_marker');
});

test('v2 validation reports too few body paragraphs through the markdown lint', () => {
  const section = v2Section({ body_markdown: '문단이 하나뿐입니다.' });
  const issues = validatePublicArticle(section, 0, { issue: V2_ISSUE });
  const shortBody = issues.find(issue => issue.type === 'insufficient_public_body_paragraphs');

  assert.equal(shortBody?.key, 'body_markdown');
  assert.equal(shortBody?.actualCount, 1);
});

test('v2 validation still fails an empty camera_hal_takeaway', () => {
  const section = v2Section({ camera_hal_takeaway: '' });
  const issues = validatePublicArticle(section, 0, { issue: V2_ISSUE });

  assert.ok(issues.some(issue =>
    issue.type === 'empty_public_article_field' && issue.key === 'camera_hal_takeaway'
  ));
});

test('v2 validation does not demand the four dropped editorial story slots', () => {
  const types = issueTypes(v2Section(), V2_ISSUE);

  assert.equal(types.includes('empty_editorial_story_field'), false);
});
