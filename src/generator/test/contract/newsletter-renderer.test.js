const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  articleSectionContractMarkdown,
  buildHtml,
  buildMarkdown
} = require('../../render/newsletter-renderer');
const {
  siteHeaderHtml
} = require('../../../../articles/assets/js/site-header');
const {
  STORY_CONTRACT_VERSIONS,
  publicContractVersionFor
} = require('../../../shared/common/story-contract-version');

// 지원 집합 바로 위 값. 숫자를 박아 두면 계약 버전이 추가될 때 이 테스트가 지원
// 버전을 검사하게 되어 조용히 공허해진다.
const UNSUPPORTED_FUTURE_STORY_VERSION = Math.max(...STORY_CONTRACT_VERSIONS) + 1;

function issue(overrides = {}) {
  return {
    date: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [{
      category: 'Tooling Watch / Fallback',
      headline: 'Internal fallback headline must not render',
      confirmed_facts: ['Legacy fact must not render.'],
      action_items: ['Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.'],
      public_article: {
        headline: 'CameraX release gives HAL teams a target',
        lead: 'CameraX release gives HAL teams a dated compatibility validation signal.',
        body_paragraphs: [
          'The release can be read as a framework-adjacent compatibility signal for Camera HAL owners.',
          'The article does not claim a direct HAL API change without source evidence.'
        ],
        camera_hal_takeaway: 'Check stream, buffer, metadata, and Camera ITS compatibility only where source evidence supports it.',
        reader_checkpoints: [
          'Run Camera ITS preview latency checks on one representative device.',
          'Compare stream and metadata behavior for the CameraX-backed capture path.'
        ],
        source_links: [{
          title: 'Source article',
          url: 'https://example.com/source',
          source_role: 'primary'
        }]
      },
      article_sections: {
        verified_facts: ['Normalized source-backed fact must not render as a checklist.'],
        background_context: 'Normalized context must not render directly.',
        hal_driver_impact: 'Normalized impact must not render directly.',
        action_items: ['Run Camera ITS preview latency checks.'],
        team_share_points: 'Normalized team review takeaway must not render directly.',
        do_not_claim: ['Do not claim vendor HAL binary updates.']
      },
      hal_signal_capsule: {
        why_now: 'Internal dated validation trigger.',
        reader_owners: ['camera_hal_owner', 'camera_test_owner'],
        check_within_2_weeks: 'Run Camera ITS preview latency and metadata checks within 2 weeks.',
        impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
        do_not_overstate: ['Do not claim direct HAL API changes.']
      },
      sources: [{
        title: 'Legacy source',
        url: 'https://example.com/legacy-source'
      }]
    }],
    action_items: ['Top-level internal action must not render.'],
    references: [{
      title: 'Reference',
      url: 'https://example.com/reference'
    }],
    ...overrides
  };
}

function storyIssue() {
  const base = issue();
  return {
    ...base,
    public_contract_version: 'story-v1',
    generation_contract_version: 1,
    sections: base.sections.map(section => ({
      ...section,
      public_article: {
        ...section.public_article,
        story_contract_version: 1,
        source_subtitle: 'Android Developers · CameraX release note',
        body_paragraphs: [
          'Android Developers가 CameraX 변경점을 공개했습니다. 본문은 공개 출처가 말한 app/framework 계층의 변경 내용을 먼저 설명합니다.',
          'Camera HAL 독자는 이 항목을 preview/capture regression 범위 지정에 참고할 수 있습니다.'
        ],
        editorial_story: {
          reader_scenario: 'CameraX preview 회귀를 triage하면서 app/framework 변경이 HAL 검증 범위에 들어오는지 확인해야 하는 상황을 가정합니다.',
          what_happened: 'Android Developers가 CameraX 변경점을 공개했습니다.',
          why_it_matters: 'Camera HAL 독자는 이 항목을 preview/capture regression 범위 지정에 참고할 수 있습니다.',
          field_scenario: 'Camera ITS와 preview latency log를 비교하는 리뷰 흐름에 연결합니다.',
          not_to_overclaim: 'source가 직접 말하지 않는 HAL runtime 변경으로 확대하지 않습니다.',
          editor_take: '검증 범위는 app/framework 관찰 항목으로 제한하는 편이 안전합니다.'
        },
        decision_metadata: {
          impact: 'Medium',
          scope: ['Framework'],
          action: ['Watch', 'Test'],
          overclaim_risk: 'Medium'
        }
      }
    }))
  };
}

function textFromHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function siteNavLabels(html) {
  const siteNavMatch = html.match(/<nav\b[^>]*class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i);
  const homepageHeaderMatch = html.match(/<header\b[^>]*class=["'][^"']*\bhomepage-site-header\b[^"']*["'][^>]*>[\s\S]*?<\/header>/i);
  const matchedHeader = siteNavMatch || homepageHeaderMatch;
  const siteHeader = matchedHeader ? matchedHeader[0] : siteHeaderHtml({ rootPath: '../../' });
  return [...siteHeader.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => textFromHtml(match[1]))
    .filter(label => label && !label.startsWith('Camera HAL') && !label.startsWith('Camera SW'));
}

test('newsletter renderer uses public_article for public markdown and HTML', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /CameraX release gives HAL teams a target/);
  assert.match(markdown, /Camera HAL\/Driver 관점에서의 의미/);
  assert.doesNotMatch(markdown, /Run Camera ITS preview latency checks/);
  assert.match(markdown, /\[Source article\]\(https:\/\/example\.com\/source\)/);
  assert.match(html, /CameraX release gives HAL teams a target/);
  assert.match(html, /camera-hal-takeaway/);
  assert.doesNotMatch(html, /reader-checkpoints/);

  for (const leaked of [
    /HAL Signal Capsule/,
    /why_now/,
    /impact_axes/,
    /do_not_overstate/,
    /Internal fallback headline must not render/,
    /Legacy fact must not render/,
    /Normalized source-backed fact must not render/,
    /Do not claim vendor HAL binary updates/,
    /Top-level internal action must not render/,
    /Publication 전에 source URL/
  ]) {
    assert.doesNotMatch(markdown, leaked);
    assert.doesNotMatch(html, leaked);
  }
});

test('newsletter renderer keeps generated issue nav labels on the newsroom Korean set', () => {
  const html = buildHtml(issue());
  const labels = siteNavLabels(html);

  assert.match(html, /<body class="homepage newsletter-issue-page">/);
  assert.match(html, /<header class="site-header homepage-site-header">/);
  assert.match(html, /<div class="homepage-nav content-wrap">/);
  assert.match(html, /<footer class="site-footer">/);
  assert.match(html, /<span class="brand-name">Camera SW <span class="brand-subtitle">Newsroom<\/span><\/span>/);
  assert.match(html, /<title>Camera SW Newsletter - 2026-05-03<\/title>/);
  assert.doesNotMatch(html, /data-site-header|site-header\.js/);
  assert.deepEqual(labels.slice(0, 3), ['\ud648', '\uc544\uce74\uc774\ube0c', 'GitHub']);
  assert.equal(labels.includes('Sources'), false);
  assert.equal(labels.includes('\ucd5c\uc2e0\ud638'), false);
  assert.equal(labels.includes('Home'), false);
  assert.equal(labels.includes('Archive'), false);
  assert.equal(labels.includes('\ucd9c\ucc98'), false);
});

test('shared site header renders consistent root-relative links', () => {
  const homeHeader = siteHeaderHtml();
  const issueHeader = siteHeaderHtml({ rootPath: '../../' });

  assert.match(homeHeader, /href="index\.html">홈<\/a>/);
  assert.match(homeHeader, /href="archive\.html">아카이브<\/a>/);
  assert.doesNotMatch(homeHeader, /docs\/NEWS_SOURCES\.md/);
  assert.match(issueHeader, /href="\.\.\/\.\.\/index\.html">홈<\/a>/);
  assert.match(issueHeader, /href="\.\.\/\.\.\/archive\.html">아카이브<\/a>/);
  assert.doesNotMatch(issueHeader, /\.\.\/\.\.\/docs\/NEWS_SOURCES\.md/);
  assert.deepEqual(siteNavLabels(`<header class="site-header" data-site-header data-site-root="../../"></header><script src="../../assets/js/site-header.js" defer></script>`).slice(0, 3), [
    '홈',
    '아카이브',
    'GitHub'
  ]);
});

test('newsletter renderer renders a single main article without empty sections', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /^## 2\. CameraX release gives HAL teams a target/m);
  assert.match(html, /<section class="section issue-story issue-section article-card[^"]*" id="article-camerax-release-gives-hal-teams-a-target"/);
  assert.doesNotMatch(markdown, /^## 3\./m);
  assert.equal((html.match(/\barticle-card\b/g) || []).length, 1);
  for (const rendered of [markdown, html]) {
    assert.doesNotMatch(rendered, /\bundefined\b|\bnull\b|\bNaN\b/);
  }
});

test('newsletter renderer keeps article anchors unique when titles repeat', () => {
  const duplicateIssue = issue({
    sections: [
      issue().sections[0],
      issue().sections[0]
    ]
  });
  const html = buildHtml(duplicateIssue);

  assert.match(html, /id="article-camerax-release-gives-hal-teams-a-target"/);
  assert.match(html, /id="article-camerax-release-gives-hal-teams-a-target-2"/);
});

test('newsletter renderer structures issue pages as newsroom flow articles', () => {
  const html = buildHtml(issue());

  assert.match(html, /<main class="site-main article-page newsletter-main">/);
  assert.match(html, /<article class="wrap issue-wrap">/);
  assert.match(html, /<header class="article-header issue-hero">/);
  assert.match(html, /<h1 class="issue-title"><span>Camera SW<\/span><span>Newsletter - 2026-05-03<\/span><\/h1>/);
  assert.match(html, /<a class="issue-back" href="\.\.\/\.\.\/index\.html">← 뉴스룸<\/a>/);
  assert.doesNotMatch(html, /issue-hero-mascot/);
  assert.match(html, /<div class="issue-briefing-card">/);
  // mockup: 제로패딩 번호 + 카테고리 눈썹이 카드 프레임 없는 섹션 헤더로 흐른다.
  assert.match(html, /<div class="issue-story-eyebrow">\s*<span class="issue-story-number" aria-label="Article 1">01<\/span>\s*<span class="issue-story-category">Camera<\/span>/);
  assert.match(html, /<section class="section issue-story issue-section article-card[^"]*"/);
  assert.doesNotMatch(html, /article-feature-row|section-icon-list/);
  assert.match(html, /<h2 id="article-camerax-release-gives-hal-teams-a-target-title" class="article-title">CameraX release gives HAL teams a target<\/h2>/);
  assert.match(html, /<section class="section issue-references" aria-labelledby="issue-references-title">/);
  // mockup 하단 내비: 뉴스룸/아카이브 이동 링크.
  assert.match(html, /<nav class="issue-footer-navigation"[^>]*>[\s\S]*?← 뉴스룸으로[\s\S]*?아카이브 전체 보기 →[\s\S]*?<\/nav>/);
  assert.match(html, /<a href="\.\.\/\.\.\/archive\.html">아카이브<\/a>/);
  assert.doesNotMatch(html, /아카이브로 돌아가기|MD 원본 보기|newsletter\.md|bottom-nav|issue-actions/);
});

test('newsletter renderer article structure table uses shared row semantics', () => {
  const markdown = articleSectionContractMarkdown(issue());

  assert.match(markdown, /\| # \| Article \| 5-section \| Fact boundary \| HAL impact axis \| Actionability \| Limitations \|/);
  assert.match(markdown, /\| 1 \| Internal fallback headline must not render \| pass \| present\+guarded \| framework_hal_contract, stream_buffer_metadata \| present \| guardrail-only \|/);
  assert.doesNotMatch(markdown, /source-backed guarded/);
  assert.doesNotMatch(markdown, /source-backed/);
  assert.doesNotMatch(markdown, /Do not claim vendor HAL binary updates/);
});

test('newsletter renderer does not synthesize public prose for legacy sections', () => {
  const draft = issue();
  draft.sections[0].what_changed = 'Review-only Fallback candidate passed a quality gate for review.';
  draft.sections[0].sources[0].title = 'Fallback candidate source';
  delete draft.sections[0].public_article;

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.match(markdown, /## 2\. Main Article 1/);
  assert.match(markdown, /Camera HAL\/Driver 관점에서의 의미/);
  assert.doesNotMatch(markdown, /Internal fallback headline must not render/);
  assert.doesNotMatch(html, /Internal fallback headline must not render/);
  assert.match(html, /camera-hal-takeaway/);
  assert.doesNotMatch(html, /reader-checkpoints/);
  assert.doesNotMatch(markdown, /HAL Signal Capsule/);
  assert.doesNotMatch(html, /hal-signal-capsule/);
  assert.doesNotMatch(markdown, /Review-only/);
  assert.doesNotMatch(markdown, /Editor review/i);
  assert.doesNotMatch(markdown, /source item passed a quality review/i);
  assert.doesNotMatch(html, /Review-only/);
  assert.doesNotMatch(html, /Editor review/i);
  assert.doesNotMatch(html, /source item passed a quality review/i);
  assert.doesNotMatch(markdown, /Fallback/);
  assert.doesNotMatch(markdown, /quality gate/);
  assert.doesNotMatch(markdown, /candidate/);
  assert.doesNotMatch(markdown, /Publication 전에 source URL/);
});

test('newsletter renderer adds a series thread link for lore patch-series sources', () => {
  const draft = issue();
  draft.sections[0].public_article.source_links = [{
    title: 'PATCH 1/2 media: arm: mali-c55',
    url: 'https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com/',
    source_role: 'primary'
  }];
  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);
  assert.match(markdown, /전체 패치 시리즈\]\(https:\/\/lore\.kernel\.org\/linux-media\/[^)]*\/T\/#t\)/);
  assert.match(html, /전체 패치 시리즈<\/a>/);
  // 보조 링크를 더해도 원래 patch source 링크(claim binding)는 그대로 남는다.
  assert.match(markdown, /\]\(https:\/\/lore\.kernel\.org\/linux-media\/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard\.com\/\)/);

  const nonSeries = issue();
  nonSeries.sections[0].public_article.source_links = [{ title: 'Android', url: 'https://developer.android.com/x', source_role: 'primary' }];
  assert.doesNotMatch(buildMarkdown(nonSeries), /전체 패치 시리즈/);
});

test('newsletter renderer renders story v1 as natural prose without public story labels', () => {
  const markdown = buildMarkdown(storyIssue());
  const html = buildHtml(storyIssue());

  assert.match(markdown, /Android Developers가 CameraX 변경점을 공개했습니다/);
  assert.doesNotMatch(markdown, /Camera ITS와 preview latency log를 비교하는 리뷰 흐름/);
  assert.match(markdown, /### Camera HAL\/Driver 관점에서의 의미/);
  assert.match(html, /Android Developers가 CameraX 변경점을 공개했습니다/);
  // HTML 관점 박스는 mockup 라벨, markdown 은 기존 헤딩을 유지한다(재렌더 시 md 불변).
  assert.match(html, /Camera HAL · Driver 관점/);
  assert.doesNotMatch(html, /관점에서의 의미/);
  assert.doesNotMatch(html, /article-decision-metadata/);
  for (const label of [
    /^### 현업 장면/m,
    /^### 확인된 변화/m,
    /^### 왜 봐야 하나/m,
    /^### 디버깅\/리뷰 시나리오/m,
    /^### 편집자 판단/m,
    /^### 과장 금지/m,
    /영향도:/,
    /권장 행동/,
    /과장 위험/,
    /편집자 판단/,
    /과장 금지/
  ]) {
    assert.doesNotMatch(markdown, label);
    assert.doesNotMatch(html, label);
  }
  for (const leaked of [
    /story_contract_version/,
    /source_subtitle/,
    /source_links/,
    /decision_metadata/,
    /editorial_story/,
    /reader_scenario/,
    /what_happened/,
    /not_to_overclaim/
  ]) {
    assert.doesNotMatch(markdown, leaked);
    assert.doesNotMatch(html, leaked);
  }
});

// 미지원 버전은 조용히 v1 비-story로 떨어뜨리지 않는다. 무음 다운렌더는 게이트를
// 전부 통과한 채 본문 형태만 잃는 경로라, 발행 전에 소리가 나야 한다.
// validation이 선차단하는 것이 정상 경로이고 이 throw는 최후 방어선이다.
test('newsletter renderer fails instead of silently downrendering an unsupported contract version', () => {
  const futureIssue = storyIssue();
  futureIssue.public_contract_version = publicContractVersionFor(UNSUPPORTED_FUTURE_STORY_VERSION);
  futureIssue.sections[0].public_article.story_contract_version = UNSUPPORTED_FUTURE_STORY_VERSION;

  assert.throws(() => buildMarkdown(futureIssue), /unsupported_story_contract_version/);
  assert.throws(() => buildHtml(futureIssue), /unsupported_story_contract_version/);
});

// 세 마커가 서로 다른 버전을 가리키면 예외 메시지가 어느 마커가 무엇을 선언했는지 밝혀야
// 한다. family mismatch 항목에는 value가 없어서, value만 읽으면 이유가 undefined로 지워진다.
test('newsletter renderer names the declared versions when the contract family disagrees', () => {
  const familyMismatchIssue = storyIssue();
  familyMismatchIssue.sections[0].public_article.story_contract_version = 2;

  assert.throws(
    () => buildMarkdown(familyMismatchIssue),
    /public_contract_version=1 generation_contract_version=1 story_contract_version=2/
  );
});

// v2 본문은 문단 배열이 아니라 단일 markdown이다. 소제목은 `### `라 md 기사 splitter
// (`^## \d+.`)에 구조적으로 안 걸린다.
function storyV2Issue() {
  const issue = storyIssue();
  issue.public_contract_version = 'story-v2';
  issue.generation_contract_version = 2;
  const article = issue.sections[0].public_article;
  article.story_contract_version = 2;
  delete article.body_paragraphs;
  // 소제목에 이스케이프 대상 문자를 일부러 넣는다. 없으면 escapeHtml을 지워도 테스트가
  // 통과해 "이스케이프한다"는 주장이 공허해진다(body_markdown은 LLM 산출물이다).
  article.body_markdown = [
    '첫 문단이다. CameraX 변경이 무엇을 바꿨는지 장면으로 연다.',
    '',
    '### AE & AWB <드라이버> 영향',
    '',
    '둘째 문단이다. R&D 팀이 확인할 범위를 좁힌다.'
  ].join('\n');
  article.editorial_story = {
    not_to_overclaim: 'source가 직접 말하지 않는 HAL runtime 변경으로 확대하지 않습니다.',
    editor_take: '검증 범위는 app/framework 관찰 항목으로 제한하는 편이 안전합니다.'
  };
  return issue;
}

test('newsletter renderer renders a story v2 body from body_markdown', () => {
  const markdown = buildMarkdown(storyV2Issue());

  assert.match(markdown, /첫 문단이다\. CameraX 변경이 무엇을 바꿨는지 장면으로 연다\./);
  assert.match(markdown, /^### AE & AWB <드라이버> 영향$/m);
  assert.match(markdown, /둘째 문단이다\. R&D 팀이 확인할 범위를 좁힌다\./);
  // 시그니처 박스와 출처는 v1과 같은 자리·같은 라벨로 남는다.
  assert.match(markdown, /### Camera HAL\/Driver 관점에서의 의미/);
  assert.match(markdown, /\*\*출처\*\*/);
  assert.match(markdown, /_Android Developers · CameraX release note_/);
  // 기사 splitter는 `## N.`만 본다. v2 소제목(`### `)이 기사 경계를 늘리면 안 되므로
  // 같은 입력의 v1 렌더와 경계 수가 같아야 한다.
  const v1Boundaries = buildMarkdown(storyIssue()).match(/^## \d+\./gm).length;
  assert.equal(markdown.match(/^## \d+\./gm).length, v1Boundaries);
  assert.doesNotMatch(markdown, /body_markdown|story_contract_version/);
  // v2 editorial_story는 안전 필드(not_to_overclaim·editor_take)라 공개 산출물로 나가지 않는다.
  // 키 이름만 보면 값이 새도 통과하므로 두 필드의 **값 문구**를 함께 검사한다.
  assert.doesNotMatch(markdown, /not_to_overclaim|editor_take/);
  assert.doesNotMatch(markdown, /source가 직접 말하지 않는/);
  assert.doesNotMatch(markdown, /검증 범위는 app\/framework 관찰 항목으로/);
});

test('newsletter renderer renders story v2 subheadings as escaped html blocks', () => {
  const html = buildHtml(storyV2Issue());

  assert.match(html, /<h3 class="article-subheading">AE &amp; AWB &lt;드라이버&gt; 영향<\/h3>/);
  assert.doesNotMatch(html, /<h3 class="article-subheading">[^<]*<드라이버>/);
  assert.match(html, /<p>첫 문단이다\. CameraX 변경이 무엇을 바꿨는지 장면으로 연다\.<\/p>/);
  assert.match(html, /R&amp;D 팀이 확인할 범위를 좁힌다\./);
  assert.match(html, /class="[^"]*article-card story-article[^"]*"/);
  // v1 카드 셸(눈썹·제목·시그니처 박스·출처)은 그대로 재사용한다.
  assert.match(html, /<div class="article-block camera-hal-takeaway">/);
  assert.match(html, /<div class="source-list"><strong>출처<\/strong>/);
  assert.doesNotMatch(html, /not_to_overclaim|editor_take/);
  assert.doesNotMatch(html, /source가 직접 말하지 않는/);
  assert.doesNotMatch(html, /검증 범위는 app\/framework 관찰 항목으로/);
});

// 선언 버전이 v2인데 본문이 비면 v1 경로로 떨어뜨리지 않는다. 그렇게 하면 게이트를 전부
// 통과한 채 리드·관점·출처만 남은 0문단 기사가 발행된다 — 이 PR이 막으려는 무음
// 다운렌더와 같은 부류다.
test('newsletter renderer fails instead of rendering a story v2 article with an empty body', () => {
  const emptyBodyIssue = storyV2Issue();
  emptyBodyIssue.sections[0].public_article.body_markdown = '';

  assert.throws(() => buildMarkdown(emptyBodyIssue), /empty body_markdown/);
  assert.throws(() => buildHtml(emptyBodyIssue), /empty body_markdown/);
});

// 이슈 마커만 v2이고 섹션에 story 필드가 없는 상태도 같은 결로 막는다. 계약 정규화는
// 이때 body_markdown만 만들고 body_paragraphs를 만들지 않으므로, 옛 판정(정규화된 필드
// 유무)으로는 조용히 빈 본문이 됐다.
test('newsletter renderer fails when only the issue declares v2 and the section body is missing', () => {
  const partialIssue = issue();
  partialIssue.public_contract_version = 'story-v2';

  assert.throws(() => buildMarkdown(partialIssue), /empty body_markdown/);
});

// v1 바이트 불변 잠금.
//
// v2 분기는 additive여야 한다 — v1 산출물의 바이트가 한 글자라도 달라지면 과거 호
// 재렌더(syncWeeklyArticleImages)와 quality recompute가 조용히 달라진다. 구조 단언은
// 그 종류의 드리프트를 못 잡으므로 산출물 전체를 해시로 잠근다.
//
// 픽스처 파일이 아니라 해시인 이유: 이 저장소의 fixture ledger는 use 값을
// good/bad/linked-evidence/parser-source-html/workflow-shape로 제한해 렌더 산출물 골든이
// 들어갈 자리가 없다. 정책을 넓히는 것은 이 변경의 범위가 아니다.
//
// 불일치가 나면 해시를 갱신하지 말고 먼저 원인을 보라. v1 출력이 바뀌었다면 그것이 결함이다.
// 어느 픽스처가 어긋났는지는 실패 메시지의 키가 알려주고, 실제 문자열은 이 파일의 픽스처를
// 그대로 써서 다시 뽑는다:
//   node --test --test-name-pattern "byte-identical" src/generator/test/contract/newsletter-renderer.test.js
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

test('newsletter renderer keeps v1 output byte-identical', () => {
  // CONTEXT 모드는 기사 셸 밖(이슈 수준 note)을 타는 별도 분기라 함께 잠근다.
  const contextIssue = issue({ publish_mode: 'CONTEXT' });
  assert.deepEqual({
    plainMarkdown: sha256(buildMarkdown(issue())),
    plainHtml: sha256(buildHtml(issue())),
    storyMarkdown: sha256(buildMarkdown(storyIssue())),
    storyHtml: sha256(buildHtml(storyIssue())),
    contextMarkdown: sha256(buildMarkdown(contextIssue)),
    contextHtml: sha256(buildHtml(contextIssue))
  }, {
    plainMarkdown: 'c48f47e42dc73097',
    plainHtml: '92cf196be12cfb3d',
    storyMarkdown: 'f3602357add8a9ff',
    storyHtml: '73f0e99343b11f73',
    contextMarkdown: 'baa3a66bce12cd3b',
    contextHtml: 'd4b8200319f8c5b9'
  });
});
