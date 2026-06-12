'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { retentionCommitAllowlist } = require('../../../reporter/review-artifact-inventory');
const { writeWeeklyNewsletterArtifacts } = require('../../../render/weekly-newsletter-output');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-allowlist-'));
}

function draft() {
  return {
    date: '2026-06-04', title: 'Daily', summary: 's', briefing: ['a', 'b', 'c'],
    sections: [{
      category: 'Android Camera', headline: 'CameraX', what_changed: 'x', evidence_summary: 'e',
      confirmed_facts: ['f1', 'f2'], specificity_checks: ['v=1'], source_verification_notes: ['o'],
      camera_hal_checks: ['c1', 'c2'], action_items: ['a1', 'a2'],
      article_sections: { verified_facts: ['f1'], background_context: 'b', hal_driver_impact: 'p', action_items: ['a1'], team_share_points: 't' },
      public_article: { headline: 'CameraX', lead: 'lead', body_paragraphs: ['p1', 'p2'], camera_hal_takeaway: 'k', reader_checkpoints: ['c1', 'c2'],
        source_links: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0', source_role: 'primary' }] },
      sources: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
    }],
    action_items: ['a1'], references: [{ title: 'Android', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }]
  };
}

test('retentionCommitAllowlist includes the weekly artifacts when they are present', async () => {
  const root = tempRoot();
  await writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft(), tags: ['Camera HAL'] });
  const allow = retentionCommitAllowlist({ root, date: '2026-06-04', runContext: { publicOutputExpected: true } });
  assert.ok(allow.includes('newsletters/2026-W23/index.html'), allow.join('\n'));
  assert.ok(allow.includes('newsletters/2026-W23/newsletter.md'));
  assert.ok(allow.includes('newsletters/2026-W23/issue.json'));
  assert.ok(allow.includes('data/newsletters-weekly.json'));
});

test('retentionCommitAllowlist omits the weekly artifacts when they are absent', async () => {
  const root = tempRoot();
  const allow = retentionCommitAllowlist({ root, date: '2026-06-04', runContext: { publicOutputExpected: true } });
  assert.ok(!allow.some(p => p.startsWith('newsletters/2026-W23/')), allow.join('\n'));
  assert.ok(!allow.includes('data/newsletters-weekly.json'));
});
