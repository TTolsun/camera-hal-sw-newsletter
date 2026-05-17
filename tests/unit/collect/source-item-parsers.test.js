const assert = require('node:assert/strict');
const test = require('node:test');

const { parseSourceSpecificItems } = require('../../../scripts/lib/source-item-parsers');
const { readTextFixture } = require('../../helpers/fixture-loader');

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
  assert.equal(items[0].publishedAt, 'March 25, 2026');
  assert.equal(items[0].version_or_release, 'CameraX 1.6.0');
  assert.equal(items[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0');
  assert.match(items[0].api_or_component, /CameraX|androidx\.camera|Android developer update/);
});

test('Android Latest Updates parser extracts CameraX table rows without generic page promotion', () => {
  const html = readTextFixture('source-html/android-latest-updates-camerax-table.html');

  const items = parseSourceSpecificItems(html, source());

  assert.equal(items.length, 2);
  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.parentUrl, 'https://developer.android.com/latest-updates');
    assert.equal(item.parentTitle, 'Android Developers Latest Updates');
    assert.equal(item.relevanceBucketHint, 'android_platform_camera_adjacent');
    assert.match(item.api_or_component, /CameraX|androidx\.camera/);
    assert.match(item.title, /^CameraX 1\.5\.0-beta01 - /);
    assert.match(item.url, /^https:\/\/developer\.android\.com\/jetpack\/androidx\/releases\/camera#/);
  }
  assert.ok(items.some(item => item.title === 'CameraX 1.5.0-beta01 - Camera Maven Group versions'));
  assert.ok(items.some(item => item.title === 'CameraX 1.5.0-beta01 - androidx.camera:camera-core'));
  assert.equal(items.some(item => /Android Studio/i.test(item.title)), false);
  assert.equal(items.some(item => item.title === 'View the Camera Library'), false);
});

test('Android Latest Updates parser extracts CameraX card links with nearby date evidence', () => {
  const html = readTextFixture('source-html/android-latest-updates-camerax-cards.html');

  const items = parseSourceSpecificItems(html, source());

  assert.equal(items.length, 2);
  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.publishedAt, '2026-05-01');
    assert.equal(item.parentUrl, 'https://developer.android.com/latest-updates');
    assert.equal(item.parentTitle, 'Android Developers Latest Updates');
    assert.equal(item.relevanceBucketHint, 'android_platform_camera_adjacent');
    assert.match(item.version_or_release, /CameraX 1\.5\.0-beta01/);
    assert.match(item.title, /^CameraX 1\.5\.0-beta01 - androidx\.camera:/);
    assert.match(item.url, /^https:\/\/developer\.android\.com\/jetpack\/androidx\/releases\/camera#/);
  }
  assert.ok(items.some(item => item.url === 'https://developer.android.com/jetpack/androidx/releases/camera#camera-video-1.5.0-beta01'));
  assert.ok(items.some(item => item.url === 'https://developer.android.com/jetpack/androidx/releases/camera#camera-lifecycle-1.5.0-beta01'));
  assert.equal(items.some(item => /Android Studio/i.test(item.title)), false);
});

test('AOSP Site updates parser extracts month-level camera child rows only', () => {
  const html = readTextFixture('source-html/aosp-site-updates-camera.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'aosp-site-updates',
    name: 'AOSP Site Updates',
    url: 'https://source.android.com/docs/whatsnew/site-updates',
    sourceUrl: 'https://source.android.com/docs/whatsnew/site-updates',
    section: 'Android / AOSP / Camera'
  }));

  assert.equal(items.length, 3);
  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.publishedAt, '2026-04-01');
    assert.equal(item.datePrecision, 'month');
    assert.equal(item.parentUrl, 'https://source.android.com/docs/whatsnew/site-updates');
    assert.equal(item.parentTitle, 'AOSP Site Updates');
    assert.equal(item.sourceMonth, 'April 2026');
    assert.match(item.version_or_release, /AOSP Site Updates - April 2026/);
  }
  assert.deepEqual(items.map(item => item.title), [
    'Camera ITS',
    'Camera images automation',
    'CDD camera orientation'
  ]);
});

test('AOSP Site updates parser extracts paragraph and anchor camera child rows only', () => {
  const html = readTextFixture('source-html/aosp-site-updates-paragraph-camera.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'aosp-site-updates',
    name: 'AOSP Site Updates',
    url: 'https://source.android.com/docs/whatsnew/site-updates',
    sourceUrl: 'https://source.android.com/docs/whatsnew/site-updates',
    section: 'Android / AOSP / Camera'
  }));

  assert.equal(items.length, 6);
  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.publishedAt, '2026-04-01');
    assert.equal(item.datePrecision, 'month');
    assert.equal(item.sourceMonth, 'April 2026');
    assert.equal(item.version_or_release, 'AOSP Site Updates - April 2026');
  }
  const titles = items.map(item => item.title);
  assert.deepEqual(titles, [
    'Camera ITS',
    'Test camera images',
    'Camera Provider',
    'CDD camera orientation',
    'Camera images automation',
    'Automotive Camera Service'
  ]);
  assert.equal(titles.some(title => /Weaver HAL|Audio HAL|KeyMint HAL/i.test(title)), false);
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

test('CameraX release notes parser normalizes Version headings and CameraX API evidence', () => {
  const html = readTextFixture('source-html/camerax-release-notes-1.6.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera'
  }));

  assert.equal(items.length, 2);
  const patch = items.find(item => item.version_or_release === 'CameraX 1.6.1');
  const minor = items.find(item => item.version_or_release === 'CameraX 1.6.0');
  assert.ok(patch);
  assert.ok(minor);
  assertParsedItemContract(patch);
  assert.equal(patch.publishedAt, 'May 6, 2026');
  assert.match(patch.title, /CameraX Release Notes - CameraX 1\.6\.1/);
  assert.equal(patch.api_or_component, 'CameraX / androidx.camera');
  assert.match(patch.behavior_change, /Fixed ListenableFuture compile error/);
  assert.doesNotMatch(patch.behavior_change, /Maven Group|camera-core\s+1\.6\.1/);

  const extraction = patch.source_extraction;
  assert.equal(extraction.adapter_id, 'android-developers-jetpack-release');
  assert.equal(extraction.release.version, 'CameraX 1.6.1');
  assert.equal(extraction.release.component, 'CameraX / androidx.camera');
  assert.ok(Array.isArray(extraction.release.sections));
  assert.ok(extraction.release.sections.every(section => Array.isArray(section.items)));
  assert.ok(extraction.release.sections.some(section =>
    section.category === 'bug_fixes' &&
    section.items.some(item => item.text.includes('Fixed ListenableFuture compile error'))
  ));
  assert.equal(extraction.minor_line_context.version, 'CameraX 1.6.0');
  assert.ok(extraction.minor_line_context.sections.some(section =>
    section.items.some(item => item.text.includes('Added CameraPipe SessionConfig support'))
  ));
  assert.equal(Object.prototype.hasOwnProperty.call(extraction, 'hal_boundary'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(extraction, 'validation_targets'), false);
  assert.equal(patch.derived_editorial_hints.hal_boundary, 'framework_adjacent_not_direct_hal_contract');
  assert.ok(patch.derived_editorial_hints.validation_targets.some(item => /CameraPipe|SessionConfig|VideoCapture|ImageAnalysis/.test(item)));
  assert.ok(patch.derived_editorial_hints.do_not_claim.some(item => /direct Camera HAL API/.test(item)));
});

test('CameraX release notes parser respects target version anchor', () => {
  const html = readTextFixture('source-html/camerax-release-notes-1.6.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  }));

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].version_or_release, 'CameraX 1.6.1');
  assert.equal(items[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
});

test('CameraX release notes parser handles live h2 family and h3 release structure', () => {
  const html = readTextFixture('source-html/camerax-release-notes-live-structure.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  }));

  assert.equal(items.length, 1);
  const patch = items[0];
  assertParsedItemContract(patch);
  assert.equal(patch.version_or_release, 'CameraX 1.6.1');
  assert.equal(patch.url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  assert.match(patch.publishedAt, /^May 0?6, 2026$/);
  assert.match(patch.behavior_change, /Cannot access class ListenableFuture/);
  assert.doesNotMatch(patch.behavior_change, /Maven Group|camera-core\s+1\.6\.1|This library was last updated/);
  assert.equal(patch.source_extraction.extraction_quality.has_concrete_behavior_change, true);
  assert.equal(patch.source_extraction.extraction_quality.main_article_allowed, true);
  assert.equal(patch.source_extraction.extraction_quality.raw_table_used_as_body, false);
  assert.ok(patch.source_extraction.release.sections.some(section =>
    section.items.some(item => /Cannot access class ListenableFuture/.test(item.text))
  ));
});

test('CameraX release notes parser does not promote stale Viewfinder table rows from live structure', () => {
  const html = readTextFixture('source-html/camerax-release-notes-live-structure.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera'
  }));

  assert.equal(items.some(item => item.version_or_release === 'CameraX 1.4.0-alpha07'), false);
  assert.equal(items.some(item => item.publishedAt === 'May 06, 2026' && /Viewfinder/i.test(item.title)), false);
  assert.ok(items.some(item => item.version_or_release === 'CameraX 1.6.1'));
});

test('CameraX release notes parser does not promote artifact tables without concrete release bullets', () => {
  const html = readTextFixture('source-html/camerax-release-notes-artifact-table-only.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-maven-group-versions',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-maven-group-versions'
  }));

  assert.deepEqual(items, []);
});

test('libcamera release announcement parser extracts v0.7.1 dated camera pipeline evidence', () => {
  const html = readTextFixture('source-html/libcamera-release-v0.7.1.html');

  const items = parseSourceSpecificItems(html, source({
    id: 'libcamera-release-announcements',
    name: 'libcamera Release Announcements',
    url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
    sourceUrl: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html'
  }));

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].publishedAt, '2026-04-28');
  assert.equal(items[0].version_or_release, 'libcamera v0.7.1');
  assert.equal(items[0].relevanceBucketHint, 'camera_driver_image_pipeline');
  assert.equal(items[0].api_or_component, 'libcamera / V4L2 camera pipeline');
  assert.match(items[0].behavior_change, /SoftISP/);
  assert.match(items[0].behavior_change, /pipeline handler/);
  assert.match(items[0].behavior_change, /sensor mode configuration/);
});

test('libcamera release announcement parser accepts debayer spelling variants with normalized output', () => {
  for (const spelling of ['debaying', 'de-bayering', 'debayering', 'Debayer', 'SoftISP', 'software_isp']) {
    const html = `
      <html>
        <head><title>[libcamera-devel] libcamera v0.7.1 released</title></head>
        <body>
          <pre>
Date: Tue Apr 28 20:27:00 CEST 2026
Subject: [libcamera-devel] libcamera v0.7.1 released

libcamera v0.7.1 has been released.
This release updates ${spelling} behavior and image pipeline handling.
The Mali-C55 pipeline handler now has full support for camera support.
The sensor mode configuration path was updated for camera validation.
          </pre>
        </body>
      </html>
    `;

    const items = parseSourceSpecificItems(html, source({
      id: 'libcamera-release-announcements',
      name: 'libcamera Release Announcements',
      url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
      sourceUrl: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html'
    }));

    assert.equal(items.length, 1, spelling);
    assertParsedItemContract(items[0]);
    assert.match(items[0].behavior_change, /SoftISP debayering and image pipeline throughput/, spelling);
    assert.doesNotMatch(items[0].behavior_change, /debaying|de-bayering/, spelling);
    assert.doesNotMatch(items[0].behavior_change, /software_isp|Debayer\b/, spelling);
  }
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
