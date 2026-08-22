'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCandidate } = require('../../../shared/cli/collect-news-candidates');
const { decorateCandidate } = require('../../select/newsroom-selection');
const { buildArticleCapsule } = require('../../select/article-capsules');
const { validateReporter } = require('../../publish/orchestrator-reporter-normalize');

const DATE = '2026-08-22';
const EVIDENCE_URL = 'https://claude.com/blog';

function collectedCandidate() {
  return normalizeCandidate({
    source: {
      id: 'claude-blog', name: 'Claude Blog',
      url: 'https://claude.com/blog', sourceUrl: 'https://claude.com/blog',
      category: 'ai', section: 'ai-tooling', priority: 'medium',
      reliability: 'official', usageHint: 'official', keywords: ['Claude'],
      sourceRole: 'generic_trend_source'
    },
    title: 'Running CI and on-call with an AI agent',
    url: 'https://claude.com/blog/ai-ci-cd-on-call',
    publishedAt: '',
    effective_date: '2026-08-14',
    date_source: 'release_row_date',
    date_confidence: 95,
    date_evidence_url: EVIDENCE_URL,
    sourceKind: 'blog_post_item',
    summary: 'The team wired a Claude agent into CI and the on-call rotation.',
    api_or_component: 'Claude Code',
    behavior_change: 'Requires human approval before the agent merges a pull request.'
  });
}

test('선정 단계 decoration이 날짜 근거 URL을 나른다', () => {
  const decorated = decorateCandidate(collectedCandidate(), DATE);
  assert.equal(decorated.date_evidence_url, EVIDENCE_URL);
  assert.equal(decorated.date_source, 'release_row_date');
  assert.equal(decorated.date_confidence, 95, '95가 100으로 승격되면 안 된다');
});

test('기사 캡슐이 날짜 근거 URL을 나른다', () => {
  const capsule = buildArticleCapsule(decorateCandidate(collectedCandidate(), DATE), []);
  assert.equal(capsule.date_evidence_url, EVIDENCE_URL);
  assert.equal(capsule.date_source, 'release_row_date');
});

test('reporter 정규화가 수집 단계의 날짜 근거 URL을 되살린다', () => {
  const collected = collectedCandidate();
  const reporter = validateReporter({
    date: DATE,
    candidates: [{
      title: 'LLM rewritten title',
      source: 'Claude Blog',
      url: collected.url,
      summary: 'LLM summary.',
      api_or_component: 'Claude Code',
      behavior_change: 'Requires human approval before the agent merges a pull request.',
      cross_check_status: 'official-source',
      evidence_notes: []
    }]
  }, DATE, [collected]);
  assert.equal(reporter.candidates[0].date_evidence_url, EVIDENCE_URL,
    'LLM 출력에는 이 필드가 없다 — collected 후보에서 되살려야 한다');
});
