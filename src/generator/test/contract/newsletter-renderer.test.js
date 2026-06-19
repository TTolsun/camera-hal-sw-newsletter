const assert = require('node:assert/strict');
const test = require('node:test');

const {
  articleSectionContractMarkdown,
  buildHtml,
  buildMarkdown
} = require('../../render/newsletter-renderer');
const {
  siteHeaderHtml
} = require('../../../../articles/assets/js/site-header');

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

test('newsletter renderer keeps generated issue nav labels in English', () => {
  const html = buildHtml(issue());
  const labels = siteNavLabels(html);

  assert.match(html, /<body class="homepage newsletter-issue-page">/);
  assert.match(html, /<header class="site-header homepage-site-header">/);
  assert.match(html, /<div class="homepage-nav content-wrap">/);
  assert.match(html, /<footer class="site-footer">/);
  assert.match(html, /<span>Camera SW<\/span>\s*<span class="brand-subtitle">Newsletter<\/span>/);
  assert.match(html, /<title>Camera SW Newsletter - 2026-05-03<\/title>/);
  assert.doesNotMatch(html, /data-site-header|site-header\.js/);
  assert.deepEqual(labels.slice(0, 3), ['Home', 'Archive', 'GitHub']);
  assert.equal(labels.includes('Sources'), false);
  assert.equal(labels.includes('\ucd5c\uc2e0\ud638'), false);
  assert.equal(labels.includes('\uc544\uce74\uc774\ube0c'), false);
  assert.equal(labels.includes('\ucd9c\ucc98'), false);
});

test('shared site header renders consistent root-relative links', () => {
  const homeHeader = siteHeaderHtml();
  const issueHeader = siteHeaderHtml({ rootPath: '../../' });

  assert.match(homeHeader, /href="index\.html">Home<\/a>/);
  assert.match(homeHeader, /href="archive\.html">Archive<\/a>/);
  assert.doesNotMatch(homeHeader, /docs\/NEWS_SOURCES\.md/);
  assert.match(issueHeader, /href="\.\.\/\.\.\/index\.html">Home<\/a>/);
  assert.match(issueHeader, /href="\.\.\/\.\.\/archive\.html">Archive<\/a>/);
  assert.doesNotMatch(issueHeader, /\.\.\/\.\.\/docs\/NEWS_SOURCES\.md/);
  assert.deepEqual(siteNavLabels(`<header class="site-header" data-site-header data-site-root="../../"></header><script src="../../assets/js/site-header.js" defer></script>`).slice(0, 3), [
    'Home',
    'Archive',
    'GitHub'
  ]);
});

test('newsletter renderer renders a single main article without empty sections', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /^## 2\. CameraX release gives HAL teams a target/m);
  assert.match(html, /<section class="section issue-story" id="article-camerax-release-gives-hal-teams-a-target"/);
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

test('newsletter renderer structures issue pages as homepage-shell landing articles', () => {
  const html = buildHtml(issue());

  assert.match(html, /<main class="site-main article-page newsletter-main">/);
  assert.match(html, /<article class="wrap issue-wrap">/);
  assert.match(html, /<header class="article-header issue-hero">/);
  assert.match(html, /<h1 class="issue-title"><span>Camera SW<\/span><span>Newsletter - 2026-05-03<\/span><\/h1>/);
  assert.match(html, /<figure class="issue-hero-mascot" aria-label="HALley mascot">/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/images\/brand\/HALley\.png"/);
  assert.match(html, /<div class="card issue-briefing-card">/);
  assert.match(html, /<span class="issue-story-number" aria-label="Article 1">1<\/span>/);
  assert.match(html, /<div class="article-feature-row">/);
  assert.match(html, /<h2 id="article-camerax-release-gives-hal-teams-a-target-title" class="article-title">CameraX release gives HAL teams a target<\/h2>/);
  assert.match(html, /<section class="section issue-references" aria-labelledby="issue-references-title">/);
  assert.match(html, /<a href="\.\.\/\.\.\/archive\.html">Archive<\/a>/);
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
  assert.match(html, /Camera HAL\/Driver 관점에서의 의미/);
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

test('newsletter renderer does not treat unsupported future story versions as story v1', () => {
  const futureIssue = storyIssue();
  futureIssue.public_contract_version = 'story-v2';
  futureIssue.sections[0].public_article.story_contract_version = 2;

  const markdown = buildMarkdown(futureIssue);
  const html = buildHtml(futureIssue);

  assert.doesNotMatch(markdown, /Android Developers · CameraX release note/);
  assert.doesNotMatch(markdown, /story_contract_version/);
  assert.doesNotMatch(html, /story-article/);
  assert.doesNotMatch(html, /article-decision-metadata/);
});
