'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  readRenderedNewsletterArticles,
  renderedHeadlineState
} = require('../../reporter/headline-render-reconciliation');
const { buildHtml } = require('../../render/newsletter-renderer');
const { validSections } = require('../../../shared/test/helpers/quality-builders');
const {
  writePublicNewsletterArtifacts
} = require('../../../shared/test/helpers/workflow-fixtures');

const DATE = '2026-06-03';
// The default fixture renders one article whose source is the CameraX 1.0.0 release note.
const RENDERED_SOURCE_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.0.0';
// A retained headline from a prior run pointing at a different release that is NOT in this
// render; its anchor must not exist in the freshly rendered index.html.
const STALE_HEADLINE_ANCHOR = 'article-camerax-1-6-0-api';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'headline-reconcile-'));
}

function renderedArticleAnchorIds(root, date) {
  const html = fs.readFileSync(path.join(root, 'articles', 'newsletters', date, 'index.html'), 'utf8');
  return [...html.matchAll(/\bid="(article-[^"]+)"/g)]
    .map(match => match[1])
    .filter(id => !id.endsWith('-title'));
}

function selectedRenderedArticle() {
  return {
    title: 'CameraX release note',
    source_url: RENDERED_SOURCE_URL,
    url: RENDERED_SOURCE_URL,
    published_date: '2026-03-25',
    has_dated_evidence: true,
    relevance_bucket: 'direct_aosp_camera',
    final_selection_eligibility: 'main',
    reliability: 'official'
  };
}

function staleHeadlineState() {
  return {
    schemaVersion: 1,
    updated_at: `${DATE}T00:00:00+09:00`,
    current_headline: {
      article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
      title: 'CameraX 1.6.0 정식 출시',
      summary: 'CameraX 1.6.0 릴리스 요약입니다.',
      source_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
      newsletter_date: DATE,
      newsletter_url: `newsletters/${DATE}/index.html`,
      newsletter_article_url: `newsletters/${DATE}/index.html#${STALE_HEADLINE_ANCHOR}`,
      selected_at: DATE,
      base_score: 70,
      current_score: 70,
      last_scored_at: DATE,
      date_evidence: { date: '2026-03-25', publish_ready_date_evidence: true },
      quality_flags: {},
      score_breakdown: {},
      snapshot: { category: 'direct_aosp_camera', source_name: 'Android Developers' }
    },
    headline_history: [],
    policy: {}
  };
}

test('retained headline whose article is not in the render is reconciled to a rendered anchor', () => {
  const root = tempRoot();
  writePublicNewsletterArtifacts(root, DATE);
  const anchors = renderedArticleAnchorIds(root, DATE);
  assert.ok(anchors.length >= 1, 'fixture must render at least one article anchor');
  assert.ok(
    !anchors.includes(STALE_HEADLINE_ANCHOR),
    'precondition: the stale headline anchor must be absent from the render'
  );

  const shortlist = {
    selected_articles: [selectedRenderedArticle()],
    homepage_headline_state: staleHeadlineState()
  };
  const { state, reconciliation } = renderedHeadlineState({
    root,
    date: DATE,
    state: shortlist.homepage_headline_state,
    shortlist
  });

  assert.ok(reconciliation?.applied, 'reconciliation must apply when the headline is not rendered');
  const [, anchor = ''] = String(state.current_headline.newsletter_article_url).split('#');
  assert.ok(anchor, 'reconciled headline keeps a deep-link anchor');
  assert.ok(
    anchors.includes(anchor),
    `reconciled anchor "${anchor}" must exist in the rendered index.html so validate:site passes`
  );
});

test('rendered article parsing survives a fallback image that carries no caption', () => {
  // fallback 이미지 기사에는 figcaption이 없다. 이 파서는 figcaption 앵커를 먼저 보므로,
  // 캡션이 사라져도 기사를 놓치지 않고 출처를 source-list에서 읽어야 한다.
  const root = tempRoot();
  const date = '2026-06-10';
  const fallbackPath = '../../assets/images/fallback/newsletter-default.svg';
  const sections = validSections(3).map((item, index) => (index === 0
    ? {
        ...item,
        selectedImage: fallbackPath,
        imageAlt: 'Fallback illustration',
        // 캡션이 붙던 시절 이름('Example image source')과 출처 목록의 이름('Source')을 다르게
        // 둬야, 파서가 실제로 어느 쪽을 읽는지 아래 단정이 구분할 수 있다.
        imageAttribution: 'Example image source',
        resolvedImage: { url: fallbackPath, src: fallbackPath, usedFallback: true }
      }
    : item));
  const html = buildHtml({
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Fallback image parsing regression.',
    briefing: ['One', 'Two', 'Three'],
    sections,
    references: [{ title: 'Reference', url: 'https://example.com/reference' }]
  });
  assert.doesNotMatch(html, /article-image-caption/, 'fallback image must render without a caption');

  fs.mkdirSync(path.join(root, 'articles', 'newsletters', date), { recursive: true });
  fs.writeFileSync(path.join(root, 'articles', 'newsletters', date, 'index.html'), html, 'utf8');

  const articles = readRenderedNewsletterArticles(root, date);

  assert.equal(articles.length, sections.length, 'every rendered article must still be parsed');
  assert.equal(articles[0].source_url, 'https://example.com/a');
  assert.equal(articles[0].source_name, 'Source', 'source name must fall back to the source list');
  assert.equal(articles[0].image_url, fallbackPath);
});

test('retained headline that is rendered gets its stale anchor refreshed to the rendered anchor', () => {
  const root = tempRoot();
  writePublicNewsletterArtifacts(root, DATE);
  const anchors = renderedArticleAnchorIds(root, DATE);

  const state = staleHeadlineState();
  // Point the headline at the article that IS rendered, but keep a stale anchor.
  state.current_headline.article_identity_key = 'url:' + RENDERED_SOURCE_URL;
  state.current_headline.source_url = RENDERED_SOURCE_URL;

  const shortlist = { selected_articles: [selectedRenderedArticle()], homepage_headline_state: state };
  const { state: reconciled } = renderedHeadlineState({
    root,
    date: DATE,
    state,
    shortlist
  });

  const [, anchor = ''] = String(reconciled.current_headline.newsletter_article_url).split('#');
  assert.notEqual(anchor, STALE_HEADLINE_ANCHOR, 'stale anchor must be replaced');
  assert.ok(
    anchors.includes(anchor),
    `refreshed anchor "${anchor}" must exist in the rendered index.html`
  );
});

// 홈 히어로 메타는 `날짜 · 발행처`다. 발행된 이슈 HTML의 앵커 라벨은 문서 제목이라
// (예: "[PATCH v2 0/2] media: i2c: Add ...") 그 값으로 스냅샷을 덮으면 메타가 기사 제목을
// 한 번 더 반복한다. 발행처는 수집 단계의 candidate.source가 정본이고, reconcile은 anchor·
// title·image처럼 렌더에서만 알 수 있는 것만 맞춘다. 두 분기를 모두 잠근다.
test('retained headline keeps the candidate source name instead of the rendered anchor label', () => {
  const root = tempRoot();
  writePublicNewsletterArtifacts(root, DATE);

  const state = staleHeadlineState();
  state.current_headline.article_identity_key = 'url:' + RENDERED_SOURCE_URL;
  state.current_headline.source_url = RENDERED_SOURCE_URL;

  const renderedLabel = readRenderedNewsletterArticles(root, DATE)
    .find(article => article.source_url === RENDERED_SOURCE_URL)?.source_name;
  assert.ok(renderedLabel, 'precondition: the parser still reads an anchor label');
  assert.notEqual(
    renderedLabel,
    'Android Developers',
    'precondition: 앵커 라벨과 후보 발행처가 달라야 어느 쪽이 쓰였는지 구분된다'
  );

  const shortlist = { selected_articles: [selectedRenderedArticle()], homepage_headline_state: state };
  const { state: reconciled } = renderedHeadlineState({ root, date: DATE, state, shortlist });

  assert.equal(reconciled.current_headline.snapshot.source_name, 'Android Developers');
});

test('fallback headline takes its source name from the shortlist candidate, not the rendered anchor label', () => {
  const root = tempRoot();
  writePublicNewsletterArtifacts(root, DATE);

  // 헤드라인 기사가 이 호에 렌더되지 않아 fallback 분기를 탄다(anchor·url 모두 stale).
  // 후보의 발행처를 snapshot 에만 둬야 이 분기의 우선순위를 실제로 구분할 수 있다 —
  // 최상위 source/source_name 이 있으면 headlineSnapshotFromCandidate 가 그쪽을 먼저 읽어
  // 이 분기가 무엇을 넣든 결과가 같아진다.
  const state = staleHeadlineState();
  const candidate = {
    ...selectedRenderedArticle(),
    snapshot: { source_name: 'lore.kernel.org linux-media list' }
  };
  const shortlist = { selected_articles: [candidate], homepage_headline_state: state };

  const { state: reconciled, reconciliation } = renderedHeadlineState({
    root,
    date: DATE,
    state,
    shortlist
  });

  assert.ok(reconciliation?.applied, 'precondition: fallback 분기를 타야 한다');
  assert.equal(reconciled.current_headline.snapshot.source_name, 'lore.kernel.org linux-media list');
});

test('fallback headline recovers the shortlist candidate by url when the identity key does not match', () => {
  const root = tempRoot();
  writePublicNewsletterArtifacts(root, DATE);

  // 후보의 identity key 가 렌더된 기사와 어긋나는 경우. URL 보조 매칭이 없으면 후보를 못 찾아
  // 발행처 이름과 official-source 점수 신호가 통째로 사라진다.
  const state = staleHeadlineState();
  const candidate = {
    ...selectedRenderedArticle(),
    article_identity_key: 'content:legacy-key-mismatch',
    source: 'lore.kernel.org linux-media list'
  };
  const shortlist = { selected_articles: [candidate], homepage_headline_state: state };

  const { state: reconciled, reconciliation } = renderedHeadlineState({
    root,
    date: DATE,
    state,
    shortlist
  });

  assert.ok(reconciliation?.applied, 'precondition: fallback 분기를 타야 한다');
  assert.equal(reconciled.current_headline.snapshot.source_name, 'lore.kernel.org linux-media list');
});
