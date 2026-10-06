const assert = require('node:assert/strict');
const test = require('node:test');
const { candidateFromEvent } = require('../../../shared/collect/source-monitor');
const { decorateCandidate } = require('../../select/newsroom-selection');
const { resolvePatchworkLibcameraPatchItems } = require('../../../shared/collect/patchwork-libcamera-patches');
const { normalizeCandidate } = require('../../../shared/cli/collect-news-candidates');
const registry = require('../../../shared/data/news-sources.json');
const { normalizeEnabledSources } = require('../../../shared/collect/news-source-section-resolver');
const { buildReferenceArticles } = require('../../render/reference-articles');

// #1252: libcamera는 Exynos Camera HAL이 아닌 기술 동향 참고 대상이다. 가져온 커밋 설명이 근거를
// 보강하는 것(요약, source_gap_risk)은 그대로이지만, 그 근거로 main 자격을 얻지는 않는다. Android Camera HAL을
// 직접 다루는 근거가 아니면 trend_reference_project blocker가 붙어 참고 섹션으로만 노출된다.
// 출처는 운영 수집기와 같이 normalizeEnabledSources를 거친 것을 쓴다. 원본 레지스트리 항목을 직접 넘기면
// 정규화가 새 필드를 버려도 이 테스트가 통과한다(#1252 리뷰에서 실제로 그랬다).
test('control patches gain evidence from fetched commit prose, never metadata alone, but stay trend references', async () => {
  const source = normalizeEnabledSources(registry).sources.find(item => item.id === 'patchwork-libcamera-patches');
  const row = {
    id: 99001, name: '[1/2] libcamera: controls: Extend white balance controls',
    web_url: 'https://patchwork.libcamera.org/patch/99001/', date: '2026-10-01T12:00:00',
    state: 'new', series: [{ id: 9900 }]
  };
  const prose = 'Add white balance state metadata and a trigger control to restart convergence while gains are locked.';
  const mail = `Subject: [PATCH 1/2] libcamera: controls: Extend white balance controls\nContent-Type: text/plain\n\n${prose}\nSigned-off-by: Developer <dev@example.org>\n---\ndiff --git a/src/libcamera/control_ids_core.yaml b/src/libcamera/control_ids_core.yaml\n`;
  async function collect(body) {
    const [raw] = await resolvePatchworkLibcameraPatchItems(JSON.stringify([row]), source, {
      now: new Date('2026-10-05'),
      fetchTextImpl: async url => url.endsWith('/mbox/') ? body : '[]'
    });
    return decorateCandidate(normalizeCandidate(raw), '2026-10-05');
  }
  const enriched = await collect(mail);
  assert.match(enriched.summary, /state metadata/);
  assert.match(enriched.summary, /proposed change not yet landed/);
  assert.equal(enriched.source_gap_risk, false);
  assert.equal(enriched.main_article_source_allowed, false);
  assert.ok(enriched.main_article_source_blockers.includes('trend_reference_project'));
  // 참고 레인에는 남고, 그 항목은 기술 동향 참고로 표시된다.
  const [referenceItem] = buildReferenceArticles([enriched]);
  assert.equal(referenceItem.note, '오픈소스 camera HAL 프로젝트 변경 · 기술 동향 참고');
  for (const invalid of ['', '<html>not a patch</html>', mail.replace('Extend white balance controls', 'Unrelated patch')]) {
    const blocked = await collect(invalid);
    assert.equal(blocked.main_article_source_allowed, false);
  }
});

test('dated ITS source events retain scope scores through selection', () => {
  const source = { source_id: 'camera-tests', expected_categories: ['aosp'], source_priority: 'high' };
  const event = {
    candidate_allowed: true, main_article_allowed: true,
    title: 'Android Camera Image Test Suite release notes',
    url: 'https://source.android.com/docs/compatibility/cts/its-release-notes-17',
    effective_date: '2026-10-01', date_source: 'visible_last_updated', date_confidence: 85,
    event_type: 'last_updated_changed',
    release_note_evidence: { api_or_component: 'Camera ITS', behavior_change: 'Adds camera metadata validation tests.' }
  };
  const candidate = decorateCandidate(candidateFromEvent(event, source), '2026-10-05');
  assert.equal(candidate.relevance_bucket, 'direct_aosp_camera');
  assert.equal(candidate.main_article_score_eligible, true);
  const undated = decorateCandidate(candidateFromEvent({ ...event, effective_date: '', date_source: '' }, source), '2026-10-05');
  assert.equal(undated.main_eligible, false);
  const unrelated = candidateFromEvent({ ...event, title: 'Website navigation refresh', release_note_evidence: null }, source);
  assert.equal(unrelated.relevance_bucket, 'generic_tech_watchlist');
});
