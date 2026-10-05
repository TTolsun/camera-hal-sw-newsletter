const assert = require('node:assert/strict');
const test = require('node:test');
const { candidateFromEvent } = require('../../../shared/collect/source-monitor');
const { decorateCandidate } = require('../../select/newsroom-selection');
const { resolvePatchworkLibcameraPatchItems } = require('../../../shared/collect/patchwork-libcamera-patches');
const { normalizeCandidate } = require('../../../shared/cli/collect-news-candidates');
const registry = require('../../../shared/data/news-sources.json');

test('control patches gain eligibility from fetched commit prose, never metadata alone', async () => {
  const source = registry.sources.find(item => item.id === 'patchwork-libcamera-patches');
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
  assert.equal(enriched.main_article_source_allowed, true);
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
