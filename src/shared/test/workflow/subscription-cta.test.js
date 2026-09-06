const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  SUBSCRIBE_ARIA_LABEL,
  getValidSubscriptionUrl,
  safeConfigPath
} = require('../../../../articles/assets/js/subscription-cta');
const { runSubscriptionCta } = require('../helpers/subscription-cta-dom');

const root = path.join(__dirname, '..', '..', '..', '..');
const SUBSCRIBE_URL = 'https://subscribe.camera-sw-newsletter.com/join';
const ENABLED_CONFIG = {
  schemaVersion: 1,
  enabled: true,
  provider: 'beehiiv',
  mode: 'hosted_link',
  subscribeUrl: SUBSCRIBE_URL
};

function archiveHtml() {
  return fs.readFileSync(path.join(root, 'articles', 'archive.html'), 'utf8');
}

function committedSubscriptionConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, 'config', 'subscription.json'), 'utf8'));
}

function subscriptionSection(html) {
  const match = String(html).match(/<section\b(?=[^>]*\bdata-subscription-section\b)[^>]*>[\s\S]*?<\/section>/i);
  assert.ok(match, '구독 섹션이 있어야 한다');
  return match[0];
}

// 커밋된 기본값에서 이 기능이 페이지에 아무것도 더하지 않는다는 것이 이 이슈의 핵심 계약이다.
// `enabled` 를 함께 단언해서, 나중에 설정이 켜지면 이 테스트가 "무엇을 재고 있었는지" 모른 채
// 통과하지 않게 한다.
test('committed subscription config is disabled, so the archive CTA changes nothing on the page', async () => {
  const config = committedSubscriptionConfig();
  assert.equal(config.enabled, false);
  assert.equal(String(config.subscribeUrl || '').trim(), '');

  const result = await runSubscriptionCta(archiveHtml(), { config });

  assert.equal(result.applied, false);
  assert.equal(result.section.hidden, true);
  assert.equal(result.action.getAttribute('href'), null);
  assert.equal(result.action.getAttribute('aria-label'), null);
  assert.equal(result.note.hidden, false);
  assert.equal(result.link.hidden, true);
  assert.equal(result.link.getAttribute('href'), null);
  assert.deepEqual(result.errors, []);
});

test('archive CTA turns on only for an enabled hosted config with a real subscribe URL', async () => {
  const result = await runSubscriptionCta(archiveHtml(), { config: ENABLED_CONFIG });

  assert.equal(result.applied, true);
  assert.equal(result.section.hidden, false);
  assert.equal(result.action.getAttribute('href'), SUBSCRIBE_URL);
  assert.equal(result.action.getAttribute('aria-label'), SUBSCRIBE_ARIA_LABEL);
  // 푸터 진입점은 노트에서 링크로 바뀐다.
  assert.equal(result.note.hidden, true);
  assert.equal(result.link.hidden, false);
  assert.equal(result.link.getAttribute('href'), SUBSCRIBE_URL);
  // 설정은 페이지 깊이에 맞는 저장소 상대 경로로, 캐시 없이 읽는다.
  assert.equal(result.requested.length, 1);
  assert.equal(result.requested[0].url, 'config/subscription.json');
  assert.equal(result.requested[0].init.cache, 'no-store');
  assert.deepEqual(result.errors, []);
});

test('subscription CTA stays off for disabled, malformed, placeholder, and non-https configs', async () => {
  const offConfigs = [
    null,
    { ...ENABLED_CONFIG, enabled: false },
    { ...ENABLED_CONFIG, enabled: 'true' },
    { ...ENABLED_CONFIG, provider: 'mailchimp' },
    { ...ENABLED_CONFIG, mode: 'embedded_form' },
    { ...ENABLED_CONFIG, subscribeUrl: '' },
    { ...ENABLED_CONFIG, subscribeUrl: 'javascript:alert(1)' },
    { ...ENABLED_CONFIG, subscribeUrl: 'http://subscribe.camera-sw-newsletter.com/join' },
    { ...ENABLED_CONFIG, subscribeUrl: 'https://localhost:3000/join' },
    { ...ENABLED_CONFIG, subscribeUrl: 'https://192.168.1.5/join' },
    { ...ENABLED_CONFIG, subscribeUrl: 'https://example.com/join' },
    { ...ENABLED_CONFIG, subscribeUrl: 'https://placeholder.beehiiv.com/join' }
  ];

  for (const config of offConfigs) {
    assert.equal(getValidSubscriptionUrl(config), '', JSON.stringify(config));
    const result = await runSubscriptionCta(archiveHtml(), { config });
    assert.equal(result.applied, false, JSON.stringify(config));
    assert.equal(result.section.hidden, true, JSON.stringify(config));
    assert.equal(result.action.getAttribute('href'), null, JSON.stringify(config));
    assert.equal(result.link.hidden, true, JSON.stringify(config));
    assert.equal(result.note.hidden, false, JSON.stringify(config));
  }
});

test('missing or unreachable subscription config leaves the page untouched without an unhandled rejection', async () => {
  const missing = await runSubscriptionCta(archiveHtml(), { missing: true });
  assert.equal(missing.applied, false);
  assert.equal(missing.section.hidden, true);
  assert.deepEqual(missing.errors, []);

  const failed = await runSubscriptionCta(archiveHtml(), { fetchThrows: true });
  assert.equal(failed.applied, false);
  assert.equal(failed.section.hidden, true);
  assert.equal(failed.link.hidden, true);
  assert.equal(failed.errors.length, 1);
  assert.match(String(failed.errors[0].message), /subscription config unavailable/);
});

// 설정 경로는 마크업에서 오므로 값 자체가 입력이다. 배포본 밖을 가리키는 값은 fetch 조차 하지
// 않고 꺼진 상태로 남는다.
test('subscription config path accepts only repository-relative subscription.json paths', async () => {
  assert.equal(safeConfigPath(''), 'config/subscription.json');
  assert.equal(safeConfigPath(null), 'config/subscription.json');
  assert.equal(safeConfigPath('config/subscription.json'), 'config/subscription.json');
  assert.equal(safeConfigPath('../../config/subscription.json'), '../../config/subscription.json');
  for (const unsafe of [
    '/config/subscription.json',
    'https://evil.example.com/subscription.json',
    'javascript:alert(1)',
    'config/subscription.json?token=1',
    'config/other.json',
    '../../secrets.json'
  ]) {
    assert.equal(safeConfigPath(unsafe), '', unsafe);
  }

  const escaped = archiveHtml().replace(
    'data-subscription-config="config/subscription.json"',
    'data-subscription-config="/config/subscription.json"'
  );
  const result = await runSubscriptionCta(escaped, { config: ENABLED_CONFIG });
  assert.equal(result.applied, false);
  assert.deepEqual(result.requested, []);
  assert.equal(result.section.hidden, true);
});

test('archive page ships the subscription CTA markup without baking a dead link', () => {
  const html = archiveHtml();

  assert.match(html, /<script src="assets\/js\/subscription-cta\.js" defer><\/script>/);

  const section = subscriptionSection(html);
  assert.match(section, /<section\b[^>]*\bhidden\b/i);
  assert.match(section, /\bdata-subscription-config="config\/subscription\.json"/);
  assert.match(section, /<a\b[^>]*\bdata-subscription-action\b[^>]*>/i);
  // 꺼진 상태에서 href 를 구우면 그것이 곧 죽은 링크다.
  assert.doesNotMatch(section, /\bhref=/i);
  // 홈과 같은 이유로 구독자 email 을 저장소가 직접 받지 않는다.
  assert.doesNotMatch(section, /<form\b/i);
  assert.doesNotMatch(section, /<input\b/i);
  assert.doesNotMatch(section, /<button\b/i);

  // 푸터 진입점: 꺼진 상태에서 보이는 것은 "구독 (지원예정)" 노트 그대로다.
  assert.match(html, /<span class="footer-note" data-subscription-footer-note>구독 \(지원예정\)<\/span>/);
  assert.match(html, /<a class="footer-link" data-subscription-footer-action hidden>구독<\/a>/);
});

// hidden 은 브라우저 기본 스타일이라 `.footer-link` 계열에 display 가 선언되면 조용히 덮인다.
// `.subscribe-section[hidden]` 과 같은 이유로 명시 규칙을 잠근다.
test('stylesheet keeps the hidden footer subscription link out of the layout', () => {
  const css = fs.readFileSync(path.join(root, 'articles', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.footer-link\[hidden\],\s*\.footer-note\[hidden\]\s*\{\s*display: none;\s*\}/);
});
