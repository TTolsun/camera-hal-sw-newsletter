'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { writeWeeklyNewsletterArtifacts } = require('../../../scripts/newsroom/render/weekly-newsletter-output');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-output-'));
}

function publishReadyDraft() {
  return {
    date: '2026-06-04',
    title: 'Camera HAL / SW Newsletter - 2026-06-04',
    summary: '주간 출력 테스트용 요약입니다.',
    briefing: ['하나입니다.', '둘입니다.', '셋입니다.'],
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX SessionConfig stable API',
        what_changed: 'CameraX가 SessionConfig stable API를 추가했습니다.',
        evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
        background: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
        camera_hal_perspective: 'Camera HAL 팀은 stream, buffer, metadata 영향을 확인합니다.',
        team_summary: 'Camera 팀이 호환성 영향을 검토해야 합니다.',
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
            '공개 해석 범위는 CameraX 호환성, Camera ITS smoke test로 제한합니다.'
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

test('writeWeeklyNewsletterArtifacts writes the weekly directory page and upserts the weekly index', () => {
  const root = tempRoot();
  const result = writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: publishReadyDraft(), tags: ['Camera HAL'] });

  assert.equal(result.weeklyKey, '2026-W23');
  assert.deepEqual(result.files, [
    'newsletters/2026-W23/index.html',
    'newsletters/2026-W23/newsletter.md',
    'data/newsletters-weekly.json'
  ]);
  assert.ok(fs.existsSync(path.join(root, 'newsletters', '2026-W23', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'newsletters', '2026-W23', 'newsletter.md')));

  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.equal(index.length, 1);
  assert.deepEqual(index[0], {
    weeklyKey: '2026-W23',
    weekStartDate: '2026-06-01',
    weekEndDate: '2026-06-07',
    date: '2026-06-01',
    title: 'Camera HAL Weekly 2026-W23',
    summary: '주간 출력 테스트용 요약입니다.',
    html: 'newsletters/2026-W23/index.html',
    md: 'newsletters/2026-W23/newsletter.md',
    tags: ['Camera HAL']
  });
});

test('writeWeeklyNewsletterArtifacts replaces an existing entry for the same weekly key, newest week first', () => {
  const root = tempRoot();
  // seed an older week + a stale same-week entry
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'newsletters-weekly.json'), JSON.stringify([
    { weeklyKey: '2026-W23', title: 'stale', html: 'newsletters/2026-W23/index.html' },
    { weeklyKey: '2026-W20', title: 'older', html: 'newsletters/2026-W20/index.html' }
  ]), 'utf8');

  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: publishReadyDraft(), tags: [] });

  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.deepEqual(index.map(item => item.weeklyKey), ['2026-W23', '2026-W20']);
  assert.equal(index[0].title, 'Camera HAL Weekly 2026-W23');
  assert.equal(index.filter(item => item.weeklyKey === '2026-W23').length, 1);
});
