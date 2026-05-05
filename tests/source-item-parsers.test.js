const assert = require('node:assert/strict');
const test = require('node:test');

const { parseSourceSpecificItems } = require('../scripts/lib/source-item-parsers');
const { readTextFixture } = require('./helpers/fixture-loader');

function source(overrides = {}) {
  return {
    id: 'android-developers-latest-updates',
    name: 'Android Developers Latest Updates',
    url: 'https://developer.android.com/latest-updates',
    sourceUrl: 'https://developer.android.com/latest-updates',
    ...overrides
  };
}

function assertParsedItemContract(item) {
  assert.ok(item.title);
  assert.ok(item.url);
  assert.ok(item.publishedAt);
  assert.equal(item.sourceKind, 'release_note_item');
  assert.ok(item.version_or_release);
  assert.ok(item.api_or_component);
  assert.ok(item.behavior_change);
}

test('Android Latest Updates parser extracts dated Camera library rows', () => {
  const html = readTextFixture('source-html/android-latest-updates-camera.html');

  const items = parseSourceSpecificItems(html, source());

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0-beta01');
  assert.match(items[0].api_or_component, /CameraX|androidx\.camera|Android developer update/);
});

test('CameraX release notes parser keeps only dated release child entries', () => {
  const html = readTextFixture('source-html/camerax-release-notes.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera'
  }));

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].publishedAt, 'May 1, 2026');
  assert.match(items[0].version_or_release, /CameraX 1\.5\.0-beta01/);
  assert.match(items[0].behavior_change, /Fixed Camera2 interop behavior/);
});

test('AOSP camera documentation links stay on watchlist fallback path', () => {
  const html = readTextFixture('source-html/aosp-camera-documentation.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'aosp-camera-documentation',
    name: 'AOSP Camera Documentation',
    url: 'https://source.android.com/docs/core/camera',
    sourceUrl: 'https://source.android.com/docs/core/camera'
  }));

  assert.deepEqual(items, []);
});

test('official security and toolchain release-note child entries preserve concrete evidence', () => {
  const securityItems = parseSourceSpecificItems(readTextFixture('source-html/android-security-bulletin.html'), source({
    id: 'android-security-bulletin',
    name: 'Android Security Bulletin',
    url: 'https://source.android.com/docs/security/bulletin',
    sourceUrl: 'https://source.android.com/docs/security/bulletin'
  }));
  const llvmItems = parseSourceSpecificItems(readTextFixture('source-html/llvm-release-notes.html'), source({
    id: 'llvm-release-notes',
    name: 'LLVM Release Notes',
    url: 'https://releases.llvm.org/',
    sourceUrl: 'https://releases.llvm.org/'
  }));

  assert.equal(securityItems.length, 1);
  assertParsedItemContract(securityItems[0]);
  assert.equal(securityItems[0].publishedAt, '2026-05-01');
  assert.match(securityItems[0].api_or_component, /Android Security Bulletin/);
  assert.equal(llvmItems.length, 1);
  assertParsedItemContract(llvmItems[0]);
  assert.match(llvmItems[0].version_or_release, /LLVM 21\.1\.0/);
  assert.match(llvmItems[0].api_or_component, /LLVM|Clang/);
});

test('Claude Code changelog parser extracts version and date blocks', () => {
  const html = readTextFixture('source-html/claude-code-changelog-dated.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'claude-code-changelog',
    name: 'Claude Code Changelog',
    url: 'https://code.claude.com/docs/en/changelog',
    sourceUrl: 'https://code.claude.com/docs/en/changelog'
  }));

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].publishedAt, 'May 1, 2026');
  assert.equal(items[0].version_or_release, '1.0.94');
  assert.match(items[0].api_or_component, /Claude Code|AI coding agent/);
});

test('non-SMR parsers do not promote month-year mentions to dated evidence', () => {
  const html = readTextFixture('source-html/claude-code-changelog-undated.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'claude-code-changelog',
    name: 'Claude Code Changelog',
    url: 'https://code.claude.com/docs/en/changelog',
    sourceUrl: 'https://code.claude.com/docs/en/changelog'
  }));

  assert.equal(items.length, 0);
});

test('Samsung Mobile Security parser extracts monthly SMR sections', () => {
  const html = readTextFixture('source-html/samsung-mobile-security.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'samsung-mobile-security-updates',
    name: 'Samsung Mobile Security Updates',
    url: 'https://security.samsungmobile.com/securityUpdate.smsb',
    sourceUrl: 'https://security.samsungmobile.com/securityUpdate.smsb'
  }));

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].publishedAt, '2026-05-01');
  assert.match(items[0].version_or_release, /SMR|2026-05/);
  assert.match(items[0].api_or_component, /Samsung Mobile Security|Android Security Bulletin|Android framework/);
});
