// 심층(deep-dive) shadow 격리 계약(Task 7) — 큐 파일 유무(=심층 selection 결과)와 무관하게
// writeWeeklyNewsletterArtifacts가 쓰는 공개 산출물 3종(index.html/newsletter.md/issue.json)은
// byte 동일해야 하고, issue.json에는 deep_dive 키가 없어야 한다.
//
// weekly-deep-dive.js는 runWeeklyDeepDive 결과를 deep-dive-report.json(운영 전용 파일)에만
// 쓰고, writeWeeklyNewsletterArtifacts 반환값의 deepDive 필드로만 노출한다(files에도,
// mergedDraft/issue.json에도 넣지 않는다 — weekly-newsletter-output.js:285 주석). 이 테스트는
// 그 격리가 실제로 지켜지는지 "같은 editor fixture, 큐만 다른 두 tmp root" 로 고정한다.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { tempRoot } = require('../../../shared/test/helpers/fs');
const { saveDeepDiveTopicQueue } = require('../../../shared/collect/deep-dive-topic-queue');
const { writeWeeklyNewsletterArtifacts } = require('../../render/weekly-newsletter-output');

// weekly-newsletter-output.test.js의 section()/draft() 와 같은 모양(렌더러가 요구하는 최소
// 유효 섹션)이다. relevance_bucket을 비워 두면 sectionRelevanceBucket()이 ''를 반환해
// direct_aosp_camera count가 0이 되고, weeklyDeepDiveTrigger가 두 root 모두에서 activated:
// true를 내도록 만든다 — 즉 두 실행 모두 큐를 실제로 들여다본다(발동 안 됨으로 우연히
// 격리되는 거짓 통과를 막는다).
function section(id, url) {
  return {
    category: 'Android Camera',
    headline: `CameraX ${id}`,
    what_changed: `CameraX ${id} 변경 사항입니다.`,
    evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
    confirmed_facts: [`${id} 릴리스 노트가 존재합니다.`, '날짜가 있습니다.'],
    specificity_checks: [`version=${id}`],
    source_verification_notes: ['공식 URL'],
    camera_hal_checks: ['stream 확인', 'metadata 확인'],
    action_items: ['ITS smoke', '호환성 확인'],
    score: 1,
    source_candidate_url: url,
    article_sections: {
      verified_facts: [`${id} 릴리스 노트가 존재합니다.`],
      background_context: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
      hal_driver_impact: 'Camera HAL 팀 확인',
      action_items: ['ITS smoke'],
      team_share_points: 'Camera 팀 검토'
    },
    public_article: {
      headline: `CameraX ${id}`,
      lead: `CameraX ${id}는 호환성 확인 신호를 제공합니다.`,
      body_paragraphs: ['공식 근거입니다.', '검증 범위로 제한합니다.'],
      camera_hal_takeaway: '검증 트리거로 다룹니다.',
      reader_checkpoints: ['ITS smoke', '호환성 확인'],
      source_links: [{ title: 'Android', url, source_role: 'primary' }]
    },
    sources: [{ title: 'Android', url }]
  };
}

function draft(sections) {
  return {
    date: '2026-06-04',
    title: 'Daily',
    summary: '요약',
    briefing: ['하나', '둘', '셋'],
    sections,
    action_items: ['a'],
    references: []
  };
}

const DATE = '2026-06-04';
const WEEKLY_KEY = '2026-W23';

function editorFixture() {
  return draft([section('1.7.0', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')]);
}

function weeklyArtifactPaths(root) {
  const dir = path.join(root, 'articles', 'newsletters', WEEKLY_KEY);
  return {
    indexHtml: path.join(dir, 'index.html'),
    markdown: path.join(dir, 'newsletter.md'),
    issueJson: path.join(dir, 'issue.json')
  };
}

function readWeeklyArtifacts(root) {
  const { indexHtml, markdown, issueJson } = weeklyArtifactPaths(root);
  return {
    indexHtml: fs.readFileSync(indexHtml, 'utf8'),
    markdown: fs.readFileSync(markdown, 'utf8'),
    issueJson: fs.readFileSync(issueJson, 'utf8')
  };
}

function readDeepDiveReport(root) {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', DATE, 'deep-dive-report.json'), 'utf8')
  );
}

test('weekly deep-dive selection (queue empty vs queued topic) leaves public artifacts byte-identical and issue.json free of a deep_dive key', async () => {
  // root A: 큐 파일이 아예 없다 — loadDeepDiveTopicQueue가 빈 큐로 본다(queue_empty).
  const rootEmpty = tempRoot('deep-dive-isolation-empty-');
  // root B: queued 주제 1개가 있다 — selectDeepDiveTopic이 실제로 하나를 고른다(shadow_selected).
  const rootQueued = tempRoot('deep-dive-isolation-queued-');
  saveDeepDiveTopicQueue(rootQueued, {
    schemaVersion: 1,
    topics: [
      {
        topic_key: 'android-17-camera-feature-page',
        title: 'Android 17 카메라 기능 페이지',
        bucket: 'android_platform_camera_adjacent',
        status: 'queued',
        evidence: [
          {
            fingerprint: 'fp-android-17-camera-feature-page-1',
            source: 'https://developer.android.com/about/versions/17/features',
            detected_at: '2026-06-01',
            effective_date: '2026-06-01'
          }
        ]
      }
    ]
  });

  await writeWeeklyNewsletterArtifacts({ root: rootEmpty, date: DATE, editor: editorFixture(), tags: [] });
  await writeWeeklyNewsletterArtifacts({ root: rootQueued, date: DATE, editor: editorFixture(), tags: [] });

  // 전제 확인: 두 실행이 실제로 다르게 행동했다(격리 주장이 우연한 통과가 아님을 보증).
  const reportEmpty = readDeepDiveReport(rootEmpty);
  const reportQueued = readDeepDiveReport(rootQueued);
  assert.equal(reportEmpty.activated, true);
  assert.equal(reportEmpty.status, 'skipped');
  assert.equal(reportEmpty.skip_reason, 'queue_empty');
  assert.equal(reportQueued.activated, true);
  assert.equal(reportQueued.status, 'shadow_selected');
  assert.equal(reportQueued.selected_topic_key, 'android-17-camera-feature-page');

  // 계약: 공개 산출물 3종은 byte 동일하다.
  const artifactsEmpty = readWeeklyArtifacts(rootEmpty);
  const artifactsQueued = readWeeklyArtifacts(rootQueued);
  assert.equal(artifactsEmpty.indexHtml, artifactsQueued.indexHtml);
  assert.equal(artifactsEmpty.markdown, artifactsQueued.markdown);
  assert.equal(artifactsEmpty.issueJson, artifactsQueued.issueJson);

  // 계약: issue.json에 deep_dive 키가 없다(어느 root에서든).
  const issueEmpty = JSON.parse(artifactsEmpty.issueJson);
  const issueQueued = JSON.parse(artifactsQueued.issueJson);
  assert.equal('deep_dive' in issueEmpty, false);
  assert.equal('deep_dive' in issueQueued, false);
});
