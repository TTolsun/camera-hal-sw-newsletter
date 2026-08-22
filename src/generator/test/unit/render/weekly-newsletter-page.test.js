'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildWeeklyNewsletterPage
} = require('../../../render/weekly-newsletter-page');

// A minimal but renderer-valid publish-ready editor draft (mirrors the known-good public issue shape
// used by tests/helpers/workflow-fixtures.js writePublicNewsletterArtifacts).
function publishReadyDraft() {
  return {
    date: '2026-06-04',
    title: 'Camera HAL / SW Newsletter - 2026-06-04',
    summary: '주간 집계 테스트용 요약입니다.',
    briefing: ['첫 번째 요약입니다.', '두 번째 요약입니다.', '세 번째 요약입니다.'],
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX SessionConfig stable API',
        what_changed: 'CameraX가 SessionConfig stable API를 추가했습니다.',
        evidence_summary: 'Android Developers 날짜 있는 릴리스 노트를 출처로 사용합니다.',
        confirmed_facts: ['릴리스 노트가 존재합니다.', '출처 링크에 날짜가 있습니다.'],
        specificity_checks: ['version=1.7.0', 'component=CameraX'],
        source_verification_notes: ['출처 URL은 공식입니다.'],
        camera_hal_checks: ['stream configuration을 확인합니다.', 'metadata 호환성을 확인합니다.'],
        action_items: ['Camera ITS smoke test를 실행합니다.', 'stream/buffer 호환성을 확인합니다.'],
        article_sections: {
          verified_facts: ['릴리스 노트가 존재합니다.', '출처 링크에 날짜가 있습니다.'],
          background_context: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
          hal_driver_impact: 'Camera HAL 팀은 stream, buffer, metadata 영향을 확인합니다.',
          action_items: ['Camera ITS smoke test를 실행합니다.', 'stream/buffer 호환성을 확인합니다.'],
          team_share_points: 'Camera 팀이 호환성 영향을 검토해야 합니다.'
        },
        public_article: {
          headline: 'CameraX SessionConfig stable API',
          lead: 'CameraX SessionConfig stable API는 Camera HAL 독자에게 호환성 확인 신호를 제공합니다.',
          body_paragraphs: [
            '이 릴리스 노트는 날짜 있는 공식 Android camera 근거로 취급됩니다.',
            '공개 해석 범위는 CameraX 호환성, Camera ITS smoke test, stream configuration으로 제한합니다.'
          ],
          camera_hal_takeaway: '이 항목은 app-framework 검증 트리거로 다룹니다.',
          reader_checkpoints: ['Camera ITS smoke test를 실행합니다.', 'stream/buffer 호환성을 확인합니다.'],
          source_links: [{
            title: 'Android Developers Camera',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0',
            source_role: 'primary'
          }]
        },
        sources: [{ title: 'Android Developers Camera', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
      }
    ],
    action_items: ['Camera ITS smoke test를 실행합니다.'],
    references: [{ title: 'Android Developers Camera', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
  };
}

test('buildWeeklyNewsletterPage keys a single publish-ready draft by its ISO week and renders html+md', () => {
  const page = buildWeeklyNewsletterPage(publishReadyDraft(), { date: '2026-06-04' });
  assert.equal(page.weeklyKey, '2026-W23');
  assert.equal(page.weekStartDate, '2026-06-01');
  assert.equal(page.weekEndDate, '2026-06-07');
  assert.equal(page.indexRoute, 'newsletters/2026-W23/index.html');
  assert.equal(page.markdownRoute, 'newsletters/2026-W23/newsletter.md');
  assert.equal(page.issue.title, '2026 W23 (06.01 ~ 06.07)');
  assert.equal(page.issue.weekly_key, '2026-W23');
  assert.equal(page.issue.sections.length, 1);
  // The under-title list is the week's article titles (not a 3-line briefing).
  assert.deepEqual(page.issue.briefing, ['CameraX SessionConfig stable API']);
  assert.ok(typeof page.html === 'string' && page.html.length > 0);
  assert.ok(typeof page.markdown === 'string' && page.markdown.length > 0);
});

test('weekly issue site footer always links to the AI Engineering learning page exactly once', () => {
  const page = buildWeeklyNewsletterPage(publishReadyDraft(), { date: '2026-06-04' });
  const hrefMatches = page.html.match(/\.\.\/\.\.\/learning\/ai-engineering\/index\.html/g) || [];
  const issueFooterNavigation = page.html.match(/<nav class="issue-footer-navigation"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal(hrefMatches.length, 1);
  assert.match(page.html, /<footer class="site-footer">[\s\S]*?<span class="footer-col-title">리소스<\/span>\s*<a class="footer-link" href="\.\.\/\.\.\/learning\/ai-engineering\/index\.html">AI Engineering Lab<\/a>/);
  assert.doesNotMatch(issueFooterNavigation, /learning\/ai-engineering/);
});

test('buildWeeklyNewsletterPage accepts an explicit weeklyKey', () => {
  const page = buildWeeklyNewsletterPage(publishReadyDraft(), { weeklyKey: '2026-W23' });
  assert.equal(page.weeklyKey, '2026-W23');
  assert.equal(page.indexRoute, 'newsletters/2026-W23/index.html');
});

test('buildWeeklyNewsletterPage drops duplicate-topic articles within the issue, keeping one', () => {
  const draft = publishReadyDraft();
  // Same article appended twice (duplicate topic): only one copy must survive.
  draft.sections = [draft.sections[0], JSON.parse(JSON.stringify(draft.sections[0]))];
  const page = buildWeeklyNewsletterPage(draft, { weeklyKey: '2026-W23' });
  assert.equal(page.issue.sections.length, 1);
  assert.deepEqual(page.issue.briefing, ['CameraX SessionConfig stable API']);
});

test('coverage 필드가 있으면 제목·표시가 대상 주 기준이 된다', () => {
  const page = buildWeeklyNewsletterPage({
    sections: [],
    coverage_week_key: '2026-W33',
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-16',
    coverage_mode: 'iso_week',
    generation_anchor_date: '2026-08-17'
  }, { date: '2026-08-17' });
  assert.equal(page.weeklyKey, '2026-W34');                       // 발행 identity 불변
  assert.equal(page.issue.title, '2026 W33 (08.10 ~ 08.16)');     // 표시는 coverage
  assert.equal(page.issue.coverage_week_key, '2026-W33');
  assert.match(page.html, /2026\.08\.10 – 08\.16/);
  assert.doesNotMatch(page.html, /08\.17 ~ 08\.23/);              // 미래 기간 표시 제거
});

test('coverage 필드가 없으면 기존 출력과 동일하다', () => {
  const before = buildWeeklyNewsletterPage({ sections: [] }, { date: '2026-08-17' });
  assert.equal(before.issue.title, '2026 W34 (08.17 ~ 08.23)');
});

test('coverage_week_key만 있고 날짜가 없으면 깨진 문자열 없이 발행 주 표시로 폴백한다', () => {
  const page = buildWeeklyNewsletterPage({
    sections: [],
    coverage_week_key: '2026-W33'
    // coverage_start_date/coverage_end_date 누락
  }, { date: '2026-08-17' });
  assert.equal(page.issue.title, '2026 W34 (08.17 ~ 08.23)');
  assert.doesNotMatch(page.issue.title, /ined/);
  assert.doesNotMatch(page.html, /ined/);
});

// 리뷰 fix 3: legacy_rolling은 ISO 주 라벨을 붙일 근거가 없다(실제 rolling 조회 범위일 뿐이라).
// 주 라벨(및 발행 identity)은 발행 주(2026-W34)를 그대로 쓰고, 괄호 안 날짜 range만 실제 rolling
// 범위(coverage_start_date~coverage_end_date)로 바꾼다 — 라벨과 range가 서로 다른 근거의
// 날짜를 섞어 보여주지 않는다.
test('coverage_mode가 legacy_rolling이면 주 라벨은 발행 주, range만 rolling 범위로 표시한다', () => {
  const page = buildWeeklyNewsletterPage({
    sections: [],
    coverage_start_date: '2026-08-10',
    coverage_end_date: '2026-08-17',
    coverage_mode: 'legacy_rolling',
    generation_anchor_date: '2026-08-17'
    // coverage_week_key 없음 — legacy_rolling은 의도적으로 기록하지 않는다.
  }, { date: '2026-08-17' });
  assert.equal(page.weeklyKey, '2026-W34');                       // 발행 identity 불변
  assert.equal(page.issue.title, '2026 W34 (08.10 ~ 08.17)');     // 라벨=발행 주, range=rolling
  assert.match(page.html, /2026\.08\.10 – 08\.17/);
  assert.match(page.html, />2026 W34</);
  assert.doesNotMatch(page.html, /08\.17 ~ 08\.23/);
});

test('coverage_mode가 legacy_rolling인데 날짜가 없으면 완전히 발행 주 표시로 폴백한다(추측하지 않는다)', () => {
  const page = buildWeeklyNewsletterPage({
    sections: [],
    coverage_mode: 'legacy_rolling'
    // coverage_start_date/coverage_end_date 누락
  }, { date: '2026-08-17' });
  assert.equal(page.issue.title, '2026 W34 (08.17 ~ 08.23)');
});
