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

// A renderer-valid main-article section keyed by a distinct source URL.
function section(id, url, score = 1) {
  return {
    category: 'Android Camera',
    headline: `CameraX ${id}`,
    what_changed: `CameraX ${id} 변경 사항입니다.`,
    evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
    background: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
    camera_hal_perspective: 'Camera HAL 팀은 stream, buffer, metadata 영향을 확인합니다.',
    team_summary: 'Camera 팀이 검토해야 합니다.',
    confirmed_facts: [`${id} 릴리스 노트가 존재합니다.`, '날짜가 있습니다.'],
    specificity_checks: [`version=${id}`],
    source_verification_notes: ['공식 URL'],
    camera_hal_checks: ['stream 확인', 'metadata 확인'],
    action_items: ['ITS smoke', '호환성 확인'],
    score,
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

function draft(sections, summary = '요약') {
  return { date: '2026-06-04', title: 'Daily', summary, briefing: ['하나', '둘', '셋'], sections, action_items: ['a'], references: [] };
}

function readIssue(root, weeklyKey) {
  return JSON.parse(fs.readFileSync(path.join(root, 'newsletters', weeklyKey, 'issue.json'), 'utf8'));
}

test('a single publish-ready run writes the weekly page, issue.json, and a weekly index entry', () => {
  const root = tempRoot();
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0';
  const result = writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.7.0', url)]), tags: ['Camera HAL'] });

  assert.equal(result.weeklyKey, '2026-W23');
  assert.ok(result.files.includes('newsletters/2026-W23/index.html'));
  assert.ok(result.files.includes('newsletters/2026-W23/newsletter.md'));
  assert.ok(result.files.includes('newsletters/2026-W23/issue.json'));
  assert.ok(result.files.includes('data/newsletters-weekly.json'));
  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
});

test('multiple runs in the same ISO week accumulate distinct articles into one weekly issue', () => {
  const root = tempRoot();
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-01', editor: draft([section('1.6.0', 'https://example.com/a')]), tags: [] });
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.7.0', 'https://example.com/b')]), tags: [] });

  const issue = readIssue(root, '2026-W23');
  assert.equal(issue.sections.length, 2);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.equal(index.length, 1);
  assert.equal(index[0].weeklyKey, '2026-W23');
  assert.equal(index[0].article_count, 2);
});

test('a duplicate article in the same week is not added twice', () => {
  const root = tempRoot();
  const url = 'https://example.com/same';
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-01', editor: draft([section('1.6.0', url)]), tags: [] });
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('1.6.0-again', url)]), tags: [] });

  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
});

test('a run in a new ISO week creates a separate weekly issue', () => {
  const root = tempRoot();
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('w23', 'https://example.com/a')]), tags: [] });
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-11', editor: draft([section('w24', 'https://example.com/b')]), tags: [] });

  assert.equal(readIssue(root, '2026-W23').sections.length, 1);
  assert.equal(readIssue(root, '2026-W24').sections.length, 1);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters-weekly.json'), 'utf8'));
  assert.deepEqual(index.map(i => i.weeklyKey), ['2026-W24', '2026-W23']);
});

test('a single run cannot add more than the daily intake limit of new articles', () => {
  const root = tempRoot();
  const sections = [1, 2, 3, 4, 5].map(n => section(`v${n}`, `https://example.com/${n}`, n));
  writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft(sections), tags: [] });
  // dailyNewArticleLimit default is 3
  assert.equal(readIssue(root, '2026-W23').sections.length, 3);
});
