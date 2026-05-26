const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const NewsletterArchive = require('../../assets/js/newsletter-archive');

function extractHomepageScript() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>\s*([\s\S]*?)\s*<\/script>/gi)]
    .map(match => match[1]);
  const homepageScript = scripts.find(script =>
    /\basync function loadSubscription\b/.test(script) &&
    /\bloadSubscription\(\);\s*$/.test(script)
  );
  assert.ok(homepageScript, 'index.html should include the homepage subscription script');
  return homepageScript.replace(
    /\bloadHomepageHeadline\(\);\s*\n\s*loadNewsletters\(\);\s*\n\s*loadSubscription\(\);\s*$/,
    'globalThis.__headlineReady = loadHomepageHeadline();\n    globalThis.__homepageReady = loadNewsletters();\n    globalThis.__subscriptionReady = loadSubscription();'
  );
}

function createElement(overrides = {}) {
  const listeners = {};
  const classNames = new Set();
  const attributes = {};
  return {
    innerHTML: '',
    hidden: false,
    listeners,
    classList: {
      add(value) {
        classNames.add(value);
      },
      remove(value) {
        classNames.delete(value);
      },
      contains(value) {
        return classNames.has(value);
      }
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    getAttribute(name) {
      return attributes[name];
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
      this[name] = String(value);
    },
    removeAttribute(name) {
      delete attributes[name];
      delete this[name];
    },
    ...overrides
  };
}

async function renderHomepage(subscriptionState, options = {}) {
  const script = extractHomepageScript();
  const errors = [];
  const section = createElement({ hidden: true });
  const action = createElement();
  const elements = {
    headline: createElement(),
    'headline-card': createElement(),
    'latest-card': createElement(),
    'archive-list': createElement()
  };

  const context = {
    window: { NewsletterArchive },
    URL,
    document: {
      getElementById(id) {
        return elements[id];
      },
      querySelector(selector) {
        if (selector === '[data-subscription-section]') return section;
        if (selector === '[data-subscription-action]') return action;
        return null;
      }
    },
    fetch: async (url, fetchOptions) => {
      assert.equal(fetchOptions.cache, 'no-store');
      if (url === 'data/homepage-headline.json') {
        return { ok: false, status: 404 };
      }
      if (url === 'data/newsletters.json') {
        return {
          ok: true,
          json: async () => []
        };
      }
      assert.equal(url, 'config/subscription.json');
      if (options.subscriptionFetchThrows) {
        throw new Error('subscription config unavailable');
      }
      if (subscriptionState === 'missing') {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        json: async () => subscriptionState
      };
    },
    console: {
      error(error) {
        errors.push(error);
      }
    }
  };

  vm.runInNewContext(script, context, { filename: 'index.html' });
  await context.__headlineReady;
  await context.__homepageReady;
  await context.__subscriptionReady;

  return { section, action, errors };
}

function subscriptionSectionHtml() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = html.match(/<section\b(?=[^>]*\bdata-subscription-section\b)[^>]*>[\s\S]*?<\/section>/i);
  assert.ok(match, 'index.html should include a subscription section');
  return match[0];
}

test('homepage renders subscription CTA only for valid enabled hosted config', async () => {
  const subscribeUrl = 'https://subscribe.camera-sw-newsletter.com/join';
  const { section, action, errors } = await renderHomepage({
    schemaVersion: 1,
    enabled: true,
    provider: 'beehiiv',
    mode: 'hosted_link',
    subscribeUrl
  });

  assert.equal(section.hidden, false);
  assert.equal(action.href, subscribeUrl);
  assert.equal(action['aria-label'], 'Subscribe to Camera SW Newsletter');
  assert.equal(action.target, undefined);
  assert.equal(action.rel, undefined);
  assert.equal(errors.length, 0);
});

test('homepage keeps subscription hidden for missing, disabled, or invalid config', async () => {
  for (const subscriptionState of [
    'missing',
    {
      schemaVersion: 1,
      enabled: false,
      provider: 'beehiiv',
      mode: 'hosted_link',
      subscribeUrl: ''
    },
    {
      schemaVersion: 1,
      enabled: true,
      provider: 'beehiiv',
      mode: 'hosted_link',
      subscribeUrl: 'javascript:alert(1)'
    }
  ]) {
    const { section, action, errors } = await renderHomepage(subscriptionState);

    assert.equal(section.hidden, true);
    assert.equal(action.href, undefined);
    assert.equal(action.target, undefined);
    assert.equal(action.rel, undefined);
    assert.equal(errors.length, 0);
  }
});

test('homepage subscription fetch failure hides section without an unhandled rejection', async () => {
  const { section, action, errors } = await renderHomepage(null, {
    subscriptionFetchThrows: true
  });

  assert.equal(section.hidden, true);
  assert.equal(action.href, undefined);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0].message), /subscription config unavailable/);
});

test('homepage subscription section is hidden by default and has no fake form controls', () => {
  const section = subscriptionSectionHtml();

  assert.match(section, /<section\b[^>]*\bhidden\b/i);
  assert.match(section, /<a\b[^>]*class="[^"]*\bbutton\b[^"]*\bsubscribe-link\b[^"]*"[^>]*\bdata-subscription-action\b[^>]*>/i);
  assert.doesNotMatch(section, /<form\b/i);
  assert.doesNotMatch(section, /<input\b/i);
  assert.doesNotMatch(section, /<button\b/i);
  assert.doesNotMatch(section, /\brole=/i);
});
