// 심층(deep-dive) shadow 격리 계약(Task 7) — 큐 파일 유무(=심층 selection 결과)와 무관하게
// writeWeeklyNewsletterArtifacts가 쓰는 공개 산출물 3종(index.html/newsletter.md/issue.json)은
// byte 동일해야 하고, issue.json에는 deep_dive 키가 없어야 한다.
//
// 호출 순서도 계약이다: 심층은 위클리 공개 산출물이 기록된 **뒤에** 돈다
// (orchestrator-publish-decision.js가 weekly try/catch 다음에 runWeeklyDeepDive를 부른다).
// 그래서 이 테스트도 같은 순서로 두 단계를 직접 부르고, 심층이 공개 산출물을 건드리지 않으며
// 심층 구현 오류(큐 JSON 손상)가 공개 산출물을 지우지도, 조용한 skip으로 위장되지도 않음을
// 함께 고정한다.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { tempRoot } = require('../../../shared/test/helpers/fs');
const {
  DEEP_DIVE_QUEUE_REL_PATH,
  saveDeepDiveTopicQueue
} = require('../../../shared/collect/deep-dive-topic-queue');
const { runWeeklyDeepDive } = require('../../render/weekly-deep-dive');
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

function queuedTopicQueue() {
  return {
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
            url: 'https://developer.android.com/about/versions/17/features',
            detected_at: '2026-06-01',
            effective_date: '2026-06-01'
          }
        ]
      }
    ]
  };
}

// 실제 배선 순서(orchestrator-publish-decision.js)를 그대로 재현한다: 위클리 공개 산출물을
// 먼저 쓰고, 그 결과의 최종 기사 목록으로 심층을 돌린다.
async function writeWeeklyThenDeepDive(root) {
  const weekly = await writeWeeklyNewsletterArtifacts({ root, date: DATE, editor: editorFixture() });
  const afterWeekly = readWeeklyArtifacts(root);
  const report = runWeeklyDeepDive({ root, date: DATE, articles: weekly.articles });
  return { weekly, afterWeekly, report };
}

test('weekly deep-dive selection (queue empty vs queued topic) leaves public artifacts byte-identical and issue.json free of a deep_dive key', async () => {
  // root A: 큐 파일이 아예 없다 — loadDeepDiveTopicQueue가 빈 큐로 본다(queue_empty).
  const rootEmpty = tempRoot('deep-dive-isolation-empty-');
  // root B: queued 주제 1개가 있다 — selectDeepDiveTopic이 실제로 하나를 고른다(shadow_selected).
  const rootQueued = tempRoot('deep-dive-isolation-queued-');
  saveDeepDiveTopicQueue(rootQueued, queuedTopicQueue());

  const runEmpty = await writeWeeklyThenDeepDive(rootEmpty);
  const runQueued = await writeWeeklyThenDeepDive(rootQueued);

  // 발동 판정은 위클리 최종 기사 목록을 받는다(호출자가 그 목록을 실제로 넘겨받았다는 확인).
  assert.equal(runEmpty.weekly.articles.length, 1);

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

  // 계약: 심층은 이미 기록된 공개 산출물을 건드리지 않는다(실행 전후 byte 동일).
  assert.deepEqual(artifactsQueued, runQueued.afterWeekly);

  // 계약: issue.json에 deep_dive 키가 없다(어느 root에서든).
  const issueEmpty = JSON.parse(artifactsEmpty.issueJson);
  const issueQueued = JSON.parse(artifactsQueued.issueJson);
  assert.equal('deep_dive' in issueEmpty, false);
  assert.equal('deep_dive' in issueQueued, false);
});

// 불변식 3: 구현 오류는 콘텐츠 실패로 위장하지 않는다. 동시에 그 오류가 그 주의 공개 산출물을
// 없애서도 안 된다 — 예전 배선은 공개 산출물을 쓰기 전에 심층을 돌려서, 손상된 큐 하나로
// 위클리 3종이 통째로 기록되지 않았다.
test('a deep-dive implementation error keeps the weekly public artifacts and propagates instead of becoming a silent skip', async () => {
  const rootBaseline = tempRoot('deep-dive-isolation-baseline-');
  const rootCorrupt = tempRoot('deep-dive-isolation-corrupt-');
  const corruptQueuePath = path.join(rootCorrupt, ...DEEP_DIVE_QUEUE_REL_PATH.split('/'));
  fs.mkdirSync(path.dirname(corruptQueuePath), { recursive: true });
  // 01 workflow는 이 state 파일을 매주 `git pull --rebase --autostash`로 커밋한다 —
  // 충돌 마커가 JSON state 파일에 남는 현실적인 경로다.
  fs.writeFileSync(corruptQueuePath, '<<<<<<< HEAD\n{ "schemaVersion": 1, "topics": [] }\n', 'utf8');

  const baseline = await writeWeeklyThenDeepDive(rootBaseline);

  const weekly = await writeWeeklyNewsletterArtifacts({
    root: rootCorrupt, date: DATE, editor: editorFixture()
  });
  // 공개 3종은 심층이 돌기 전에 이미 기록되고, 변경 artifact 목록에도 등록된다.
  for (const filePath of Object.values(weeklyArtifactPaths(rootCorrupt))) {
    assert.ok(fs.existsSync(filePath));
  }
  assert.ok(weekly.files.includes(`articles/newsletters/${WEEKLY_KEY}/index.html`));
  assert.ok(weekly.files.includes(`articles/newsletters/${WEEKLY_KEY}/newsletter.md`));
  assert.ok(weekly.files.includes(`articles/newsletters/${WEEKLY_KEY}/issue.json`));

  // 손상된 큐는 skip이 아니라 throw다(조용히 지나가면 구현 결함이 관측되지 않는다).
  assert.throws(
    () => runWeeklyDeepDive({ root: rootCorrupt, date: DATE, articles: weekly.articles }),
    /deep-dive-topic-queue/
  );
  // best-effort error report는 남는다.
  assert.equal(readDeepDiveReport(rootCorrupt).status, 'error');

  // 그리고 공개 3종은 정상 실행과 byte 동일하게 남는다.
  assert.deepEqual(readWeeklyArtifacts(rootCorrupt), baseline.afterWeekly);
});
