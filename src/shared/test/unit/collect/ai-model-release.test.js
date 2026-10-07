const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AI_MODEL_RELEASE_REFERENCE_LIMIT,
  isAiModelReleaseCandidate,
  isAiModelReleaseTitle
} = require('../../../domain/ai-model-release');
const { withAiModelReleaseLane } = require('../../../cli/collect-news-candidates');

function candidate(overrides = {}) {
  return {
    title: 'Claude Sonnet 5.5',
    url: 'https://www.anthropic.com/claude-sonnet-5-5',
    publishedAt: '2026-09-28',
    source_category: 'ai',
    source_reliability: 'official',
    has_published_date: true,
    ...overrides
  };
}

test('model release titles start with a model family name and a version', () => {
  for (const title of [
    'Claude Sonnet 5.5',
    'Introducing Claude Sonnet 5.5',
    'Claude Opus 5',
    'Introducing GPT-6',
    'Gemini 3.1',
    'Meet Llama 5'
  ]) {
    assert.equal(isAiModelReleaseTitle(title), true, title);
  }
});

// 실측 2026-10-05 openai-news/claude-code-changelog/anthropic-news 후보: 모델을 언급만 하는 글,
// 주간 패치 릴리스, 고객 사례는 출시 칸 대상이 아니다.
test('mentions, patch releases and customer stories are not model releases', () => {
  for (const title of [
    'A model guide for the GPT-6 family',
    'Claude Code v2.1.288',
    'Barclays scales Claude to upgrade operations and improve client experience',
    'Introducing the Life Sciences Verification Program',
    'Claude Sonnet 5.5.1 hotfix notes'
  ]) {
    assert.equal(isAiModelReleaseTitle(title), false, title);
  }
});

test('only official ai sources with a read publish date qualify', () => {
  assert.equal(isAiModelReleaseCandidate(candidate()), true);
  assert.equal(isAiModelReleaseCandidate(candidate({ source_category: 'tech-trends' })), false);
  assert.equal(isAiModelReleaseCandidate(candidate({ source_reliability: 'tech-media' })), false);
  assert.equal(isAiModelReleaseCandidate(candidate({ has_published_date: false })), false);
});

test('the lane appends capped-out model releases after the global cap, newest first', () => {
  const ranked = [
    { title: 'camera a', url: 'https://a.example/1' },
    { title: 'camera b', url: 'https://a.example/2' },
    candidate({ title: 'Claude Opus 5.5', url: 'https://www.anthropic.com/claude-opus-5-5', publishedAt: '2026-09-22' }),
    candidate(),
    candidate({ title: 'Gemini 4', url: 'https://blog.google/gemini-4', publishedAt: '2026-09-25' })
  ];

  const result = withAiModelReleaseLane(ranked, 2);

  assert.deepEqual(result.map(item => item.title), ['camera a', 'camera b', 'Claude Sonnet 5.5', 'Gemini 4']);
  assert.equal(result.length - 2, AI_MODEL_RELEASE_REFERENCE_LIMIT);
});

test('model releases already inside the cap count toward the lane limit', () => {
  const ranked = [
    candidate(),
    { title: 'camera a', url: 'https://a.example/1' },
    candidate({ title: 'Gemini 4', url: 'https://blog.google/gemini-4', publishedAt: '2026-09-25' }),
    candidate({ title: 'Claude Opus 5.5', url: 'https://www.anthropic.com/claude-opus-5-5', publishedAt: '2026-09-22' })
  ];

  const result = withAiModelReleaseLane(ranked, 2, { limit: 2 });

  assert.deepEqual(result.map(item => item.title), ['Claude Sonnet 5.5', 'camera a', 'Gemini 4']);
});

test('the lane reads the pool before the per-source cap', () => {
  const sourceCapped = [{ title: 'camera a', url: 'https://a.example/1' }];
  const sonnet = candidate();
  const result = withAiModelReleaseLane(sourceCapped, 1, { lanePool: [sourceCapped[0], sonnet] });

  assert.deepEqual(result.map(item => item.title), ['camera a', 'Claude Sonnet 5.5']);
});
