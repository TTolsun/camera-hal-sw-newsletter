'use strict';

// #724: 결정론 coverage 재조정 불변식을 고정한다. LLM은 coverage 등급을 제안만 하고,
// 이 순수 함수가 승급 자격 가드·cap clamp·발행 floor backfill을 강제한다.
const assert = require('node:assert/strict');
const test = require('node:test');

const { reconcileCoverage } = require('../../select/coverage-reconciliation');

function mainEligible(overrides = {}) {
  return {
    url: 'u',
    url_hash: undefined,
    title: 't',
    relevance_bucket: 'direct_aosp_camera',
    deterministic_score: 60,
    main_article_source_allowed: true,
    main_article_score_eligible: true,
    ...overrides
  };
}

function plan(candidate, coverage_decision, impact_level = 'medium') {
  return { url: candidate.url, coverage_decision, impact_level };
}

test('OFF flag returns deterministic selected unchanged (same reference)', () => {
  const selected = [mainEligible({ url: 'a' })];
  const shortlistReport = { selected_articles: selected, reserve_candidates: [] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport: { editorial_plans: [] }, enabled: false });
  assert.equal(out.selected, selected);
  assert.deepEqual(out.diff, { enabled: false, changes: [] });
});

test('LLM cannot promote a reserve candidate that is not deterministically main-eligible', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', main_article_source_allowed: false })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'high')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(!out.selected.map(a => a.url).includes('b'), 'ineligible reserve must not become main');
  assert.ok(out.diff.changes.some(c => c.action === 'promotion_blocked_ineligible'));
});

test('forbidden-bucket reserve candidate cannot be promoted even if LLM asks', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', relevance_bucket: 'generic_tech_watchlist' })]
  };
  const editorialPlanReport = { editorial_plans: [plan({ url: 'b' }, 'main_article', 'high')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(!out.selected.map(a => a.url).includes('b'));
});

test('cap clamp keeps at most mainArticleCount.max, ordered by impact then score', () => {
  const many = Array.from({ length: 7 }, (_, i) => mainEligible({ url: `u${i}`, deterministic_score: 50 + i }));
  const shortlistReport = { selected_articles: many, reserve_candidates: [] };
  const editorialPlanReport = {
    editorial_plans: many.map((c, i) => plan(c, 'main_article', i === 0 ? 'high' : 'low'))
  };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.equal(out.selected.length, 5);
  assert.equal(out.selected[0].url, 'u0');
});

test('supporting-main bucket count is clamped to supportingMainMaxAllowed', () => {
  const primary = mainEligible({ url: 'p', relevance_bucket: 'direct_aosp_camera' });
  const s1 = mainEligible({ url: 's1', relevance_bucket: 'soc_platform_signal' });
  const s2 = mainEligible({ url: 's2', relevance_bucket: 'soc_platform_signal' });
  const shortlistReport = { selected_articles: [primary, s1, s2], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [primary, s1, s2].map(c => plan(c, 'main_article')) };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  const supporting = out.selected.filter(a =>
    ['android_multimedia_camera_output', 'soc_platform_signal', 'cpp_ai_tooling_fallback'].includes(a.relevance_bucket)
  );
  assert.ok(supporting.length <= 1);
});

test('floor backfill restores min main count when LLM excludes everything', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const b = mainEligible({ url: 'b', deterministic_score: 65 });
  const shortlistReport = { selected_articles: [a, b], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [plan(a, 'exclude', 'low'), plan(b, 'exclude', 'low')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(out.selected.length >= 1);
  assert.equal(out.selected[0].url, 'a');
  assert.ok(out.diff.changes.some(c => c.action === 'floor_backfill'));
});

test('diff records demotions and promotions vs deterministic', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const r = mainEligible({ url: 'r', deterministic_score: 40 });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [r] };
  const editorialPlanReport = { editorial_plans: [plan(a, 'reference_only', 'low'), plan(r, 'main_article', 'high')] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(out.selected.map(x => x.url).includes('r'));
  assert.ok(out.diff.changes.some(c => c.action === 'promoted'));
  assert.ok(out.diff.changes.some(c => c.action === 'demoted'));
});

test('ungraded candidate keeps its deterministic tier', () => {
  const a = mainEligible({ url: 'a' });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport: { editorial_plans: [] }, enabled: true });
  assert.deepEqual(out.selected.map(x => x.url), ['a']);
});
