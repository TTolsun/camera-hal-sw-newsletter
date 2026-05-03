const assert = require('node:assert/strict');
const test = require('node:test');

const { parseSourceSpecificItems } = require('../scripts/lib/source-item-parsers');

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
  const html = `
    <section>
      <h2>May 1, 2026</h2>
      <a href="/jetpack/androidx/releases/camera#1.5.0-beta01">CameraX 1.5.0-beta01</a>
      <p>Added CameraX compatibility updates for Android camera apps.</p>
    </section>
  `;

  const items = parseSourceSpecificItems(html, source());

  assert.equal(items.length, 1);
  assertParsedItemContract(items[0]);
  assert.equal(items[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.5.0-beta01');
  assert.match(items[0].api_or_component, /CameraX|androidx\.camera|Android developer update/);
});

test('Claude Code changelog parser extracts version and date blocks', () => {
  const html = `
    <article>
      <h2 id="v1-0-94">1.0.94 - May 1, 2026</h2>
      <ul>
        <li>Added hooks for AI workflows.</li>
        <li>Fixed terminal resume behavior.</li>
      </ul>
    </article>
  `;

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
  const html = `
    <article>
      <h2 id="v1-0-95">1.0.95</h2>
      <p>Added planning notes for workflows discussed in May 2026.</p>
    </article>
  `;

  const items = parseSourceSpecificItems(html, source({
    id: 'claude-code-changelog',
    name: 'Claude Code Changelog',
    url: 'https://code.claude.com/docs/en/changelog',
    sourceUrl: 'https://code.claude.com/docs/en/changelog'
  }));

  assert.equal(items.length, 0);
});

test('Samsung Mobile Security parser extracts monthly SMR sections', () => {
  const html = `
    <main>
      <h2 id="smr-may-2026">SMR-MAY-2026</h2>
      <p>Samsung Mobile Security Bulletin May 2026.</p>
      <p>Security CVE fixes affect Android framework components.</p>
    </main>
  `;

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
