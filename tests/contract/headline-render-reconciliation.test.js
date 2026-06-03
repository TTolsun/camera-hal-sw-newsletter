'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  renderedHeadlineState
} = require('../../scripts/newsroom/common/headline-render-reconciliation');
const {
  writePublicNewsletterArtifacts
} = require('../helpers/workflow-fixtures');

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
  const html = fs.readFileSync(path.join(root, 'newsletters', date, 'index.html'), 'utf8');
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
