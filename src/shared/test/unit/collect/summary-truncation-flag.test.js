const assert = require('node:assert/strict');
const test = require('node:test');

const registry = require('../../../data/news-sources.json');
const { normalizeEnabledSources } = require('../../../collect/news-source-section-resolver');
const { resolveAiCodingReleaseItems } = require('../../../collect/ai-coding-releases');
const { resolveDatedArticleIndexItems } = require('../../../collect/dated-article-index-resolver');
const { resolveRaspberryPiLibcameraReleaseItems } = require('../../../collect/raspberrypi-libcamera-releases');
const { createBoundedFetchClient } = require('../../../collect/bounded-fetch-client');
const { normalizeCandidate, parseRss } = require('../../../cli/collect-news-candidates');

// 이슈 #1226: 후보 요약(summary)은 수집 단계에서 500자로 잘리는데, 잘렸다는 표시가 어디에도 없어서
// 잘린 요약만 받은 기자와 fact-check가 잘린 뒤쪽의 결론("철저한 조사 완료", "정렬 테스트 통과")을
// 추론해 썼다. 표시는 요약 문자열 끝에 덧붙이지 않고 별도 boolean 필드 summary_truncated로 싣는다
// (요약 길이·behavior_change 파생·news-summary-cache 키가 모두 요약 문자열에 묶여 있다).

const SOURCE = {
  id: 'lore-linux-media-list',
  name: 'lore.kernel.org linux-media list',
  url: 'https://lore.kernel.org/linux-media/',
  sourceUrl: 'https://lore.kernel.org/linux-media/',
  category: 'camera-hal',
  section: 'Kernel / Media',
  priority: 'high',
  reliability: 'project-official',
  keywords: ['camera', 'media', 'V4L2'],
  requiresCrossCheck: false,
  candidateOnly: false
};

function rawCandidate(summary, overrides = {}) {
  return {
    source: SOURCE,
    title: '[PATCH v7] media: i2c: imx681: Add a driver for the Sony IMX681 sensor',
    url: 'https://lore.kernel.org/linux-media/20260901-imx681-v7@example.org/',
    publishedAt: '2026-09-01',
    summary,
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    ...overrides
  };
}

// 500번째 글자(0부터 499번째)가 공백이고 그 뒤로 내용이 이어지는 긴 문장. 요약을 500자에서 자른 뒤
// 끝 공백을 다듬는(trim) 파서는 이 입력에서 499자를 돌려준다.
// leadingLength는 이 문장 앞에 파서가 붙이는 글자 수다(자르는 위치는 파서가 보는 전체 본문 기준이다).
function textWithSpaceAtCut(lead, tail = 'and the rest of this sentence continues after the cut point.', leadingLength = 0) {
  const head = lead.padEnd(499 - leadingLength, 'x');
  assert.equal(head.length + leadingLength, 499);
  return `${head} ${tail}`;
}

test('normalizeCandidate flags a summary that the 500 character cap cut (#1226)', () => {
  const item = normalizeCandidate(rawCandidate(`${'The first stage of testing is described here. '.repeat(20)}`));
  assert.equal(item.summary.length, 500);
  assert.equal(item.summary_truncated, true);
});

test('normalizeCandidate leaves the summary text itself unmarked when it flags the cut (#1226)', () => {
  // 요약 문자열에 표식을 덧붙이지 않는다. 길이가 정확히 500자여야 behavior_change 파생·캐시 키가 그대로다.
  const long = 'Sentence about the sensor bring up sequence continues here. '.repeat(20);
  const item = normalizeCandidate(rawCandidate(long));
  assert.equal(item.summary, long.trim().slice(0, 500));
  assert.ok(!/\.\.\.|truncated|잘림/i.test(item.summary));
});

test('normalizeCandidate does not flag a summary that fits under the cap (#1226)', () => {
  const item = normalizeCandidate(rawCandidate('The driver adds a new I2C sensor binding and a test pattern control.'));
  assert.equal(item.summary_truncated, false);
});

test('normalizeCandidate reads a candidate with no summary as not truncated (#1226)', () => {
  assert.equal(normalizeCandidate(rawCandidate('')).summary_truncated, false);
  const { summary: _omitted, ...withoutSummary } = rawCandidate('x');
  assert.equal(normalizeCandidate(withoutSummary).summary_truncated, false);
});

test('normalizeCandidate keeps the truncation flag a collector set instead of re-deriving it from the length (#1226)', () => {
  // 날짜 기사 해석기는 문장 경계로 요약을 가르므로 요약이 짧아도 기사는 이어진다. 길이 기준으로 다시
  // 유도하면 그 잘림이 조용히 꺼진다. 반대로 수집기가 온전하다고 실은 긴 요약도 뒤집지 않는다.
  const short = 'The driver adds a new I2C sensor binding and a test pattern control.';
  assert.equal(normalizeCandidate(rawCandidate(short, { summary_truncated: true })).summary_truncated, true);

  const long = 'Sentence about the sensor bring up sequence continues here. '.repeat(20);
  assert.equal(normalizeCandidate(rawCandidate(long, { summary_truncated: false })).summary_truncated, false);
});

test('normalizeCandidate ignores a truncation flag that is not a boolean (#1226)', () => {
  const long = 'Sentence about the sensor bring up sequence continues here. '.repeat(20);
  assert.equal(normalizeCandidate(rawCandidate(long, { summary_truncated: 'false' })).summary_truncated, true);
});

test('normalizeCandidate measures the summary after markup removal, not the raw markup length (#1226)', () => {
  // 태그가 많아 원문은 500자를 넘지만 텍스트는 짧다. 잘린 것이 아니므로 표시하면 안 된다.
  const markupHeavy = '<p><span class="a">hi</span></p>'.repeat(40);
  assert.ok(markupHeavy.length > 500, 'fixture raw length must exceed the cap');
  const item = normalizeCandidate(rawCandidate(markupHeavy));
  assert.ok(item.summary.length < 500, 'fixture text length must stay under the cap');
  assert.equal(item.summary_truncated, false);
});

test('lore atom entry longer than the cap reaches the candidate flagged as truncated (#1226)', () => {
  // IMX681 v7 테스트 보고 경로: lore RSS/Atom 항목은 파서를 거치지 않고 normalizeCandidate로 들어간다.
  const report = `${'Test report for the v7 series. 1) The first stage exercised the sensor bring up path and '.repeat(8)}Problems found: none listed here.`;
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    '<title>[PATCH v7 0/3] media: i2c: imx681: test report</title>',
    '<updated>2026-09-25T10:00:00Z</updated>',
    '<link href="https://lore.kernel.org/linux-media/20260925-imx681-report@example.org/"/>',
    '<id>urn:uuid:imx681-report</id>',
    `<content type="text">${report}</content>`,
    '</entry>',
    '</feed>'
  ].join('\n');
  const [candidate] = parseRss(atom, SOURCE);
  assert.ok(candidate, 'the atom entry should become a candidate');
  assert.equal(candidate.summary.length, 500);
  assert.equal(candidate.summary_truncated, true);
});

// 아래는 요약을 500자에서 직접 자르는 생산자들이다. 단일 지점 판정(normalizeCandidate가 정규화 후
// 길이로 판정)이 성립하려면 이들이 자르고 넘긴 값도 표시되어야 한다. 500번째 글자가 공백인 입력을
// 쓰는 이유: 자른 뒤 끝 공백을 다듬는 생산자와 normalizeCandidate의 마크업 제거(공백 정리)는 그때
// 요약을 499자로 넘기므로, 판정이 "500자 이상"이면 이 경우만 조용히 빠진다.

test('Raspberry Pi libcamera release body cut at the cap is flagged after normalization (#1226)', () => {
  const body = textWithSpaceAtCut('Fixed a regression in the software ISP debayer path where');
  const atom = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    '<id>tag:github.com,2008:Repository/1/v0.8.0+rpt20260909</id>',
    '<updated>2026-09-09T07:36:01Z</updated>',
    '<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/v0.8.0%2Brpt20260909"/>',
    '<title>v0.8.0+rpt20260909</title>',
    `<content type="html">${body}</content>`,
    '</entry>',
    '</feed>'
  ].join('');
  const rpiSource = {
    ...SOURCE,
    id: 'raspberrypi-libcamera-releases',
    name: 'Raspberry Pi libcamera Releases',
    url: 'https://github.com/raspberrypi/libcamera/releases',
    sourceUrl: 'https://github.com/raspberrypi/libcamera/releases',
    rssUrl: 'https://github.com/raspberrypi/libcamera/releases.atom'
  };
  const [raw] = resolveRaspberryPiLibcameraReleaseItems(atom, rpiSource);
  assert.ok(raw, 'the release entry should resolve');
  assert.ok(raw.summary.endsWith(' '), 'fixture must cut right before a space so the text arrives one short of the cap');
  const item = normalizeCandidate(raw);
  assert.equal(item.summary.length, 499);
  assert.equal(item.summary_truncated, true);
});

test('official AI coding release body cut at the cap is flagged after normalization (#1226)', async () => {
  const sources = normalizeEnabledSources(registry).sources;
  const source = sources.find(row => row.id === 'codex-releases');
  assert.ok(source, 'codex-releases source must exist in the registry');
  // 목록 표식("- ")은 생산자가 떼어 낸 뒤 이어 붙이므로 자르는 위치 계산에서 빠진다.
  const bullet = `- ${textWithSpaceAtCut('Fixed Codex CLI sessions failing to run build and test tools inside the sandbox where')}`;
  const rows = await resolveAiCodingReleaseItems(JSON.stringify([{
    tag_name: 'rust-v0.155.1',
    html_url: 'https://github.com/openai/codex/releases/tag/rust-v0.155.1',
    published_at: '2026-09-18T12:00:00Z',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z',
    draft: false,
    prerelease: false,
    body: `## Bug fixes\n${bullet}`
  }]), source, {
    now: new Date('2026-09-21T00:00:00Z'),
    fetchClient: { fetchBounded: async () => { throw new Error('unexpected fetch'); } }
  });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].summary.endsWith(' '), 'fixture must cut right before a space so the text arrives one short of the cap');
  const item = normalizeCandidate(rows[0]);
  assert.equal(item.summary.length, 499);
  assert.equal(item.summary_truncated, true);
});

test('dated article intro cut at the summary limit is flagged after normalization (#1226)', async () => {
  // Anthropic Opus 5.5 경로: 도입부 500자를 summary로 가져가고 뒤는 근거 추출로 간다.
  const origin = 'https://claude.com';
  const indexUrl = `${origin}/blog`;
  const articleUrl = `${indexUrl}/long-intro`;
  const claudeSource = {
    id: 'claude-blog',
    name: 'Claude Blog',
    sourceUrl: indexUrl,
    url: indexUrl,
    category: 'ai-agents',
    section: 'AI / Agents / Workflow',
    priority: 'medium',
    reliability: 'official',
    candidateOnly: false,
    requiresCrossCheck: false,
    keywords: ['Claude Code', 'CI/CD', 'agent']
  };
  const indexHtml = '<div role="listitem" class="blog_cms_item w-dyn-item">'
    + '<div class="u-text-style-caption">Aug 18, 2026</div>'
    + '<a href="/blog/long-intro">Long intro</a></div>';
  // 본문 평문은 <h1>부터 시작하므로 제목·날짜·소제목 글자가 도입부 앞에 붙는다.
  const bodyLead = 'Long intro Aug 18, 2026 Body ';
  const intro = textWithSpaceAtCut('We ran our automated behavioral audit against the new model and', undefined, bodyLead.length);
  const articleHtml = `<link href="${articleUrl}" rel="canonical"/><h1>Long intro</h1><div>Aug 18, 2026</div><h2>Body</h2><p>${intro}</p>`;
  const fetchClient = createBoundedFetchClient({
    fetchImpl: async target => ({
      status: 200,
      headers: {},
      text: async () => (target === indexUrl ? indexHtml : articleHtml)
    }),
    retryDelayMs: 0
  });
  const items = await resolveDatedArticleIndexItems({
    html: indexHtml,
    source: claudeSource,
    fetchClient,
    now: new Date('2026-08-22T00:00:00Z'),
    lookbackDays: 21
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].summary.length, 499, 'the resolver trims the cut summary, so it arrives one short of the cap');
  assert.equal(normalizeCandidate(items[0]).summary_truncated, true);
});

// 이월 후보는 이전 주 산출물을 정규화 없이 읽어 오므로 필드가 없다. 읽는 쪽 함수는 수집기와 같은 기준으로
// 요약 길이에서 유도하되, 수집기가 실어 둔 boolean은 뒤집지 않는다.
test('isSummaryTruncated derives from the summary only when the collector left no boolean (#1226)', () => {
  const { isSummaryTruncated } = require('../../../common/summary-truncation');
  assert.equal(isSummaryTruncated({ summary: 'x'.repeat(500) }), true);
  assert.equal(isSummaryTruncated({ summary: 'x'.repeat(499) }), true);
  assert.equal(isSummaryTruncated({ summary: 'x'.repeat(498) }), false);
  assert.equal(isSummaryTruncated({}), false);
  assert.equal(isSummaryTruncated({ summary: 'x'.repeat(500), summary_truncated: false }), false);
  assert.equal(isSummaryTruncated({ summary: 'short', summary_truncated: true }), true);
  // 정규화가 만든 후보를 그대로 다시 읽어도 같은 값이다(이월 후보가 이 경로다).
  const cut = normalizeCandidate(rawCandidate('word '.repeat(200)));
  const { summary_truncated: _dropped, ...carried } = cut;
  assert.equal(isSummaryTruncated(carried), cut.summary_truncated);
  assert.equal(cut.summary_truncated, true);
});
