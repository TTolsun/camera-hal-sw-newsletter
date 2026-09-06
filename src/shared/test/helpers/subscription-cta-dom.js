'use strict';

// 구독 CTA 스크립트(`articles/assets/js/subscription-cta.js`)를 **실제 페이지 마크업**으로
// 돌리는 최소 DOM 스텁. jsdom 이 없어서 hook 네 개만 스텁으로 세우는데, 초기 상태(hidden 여부,
// 설정 경로)는 반드시 커밋된 HTML/렌더 산출물의 여는 태그에서 읽는다 — 손으로 쓴 스텁을 쓰면
// 마크업이 드리프트해도 테스트가 계속 통과한다.
//
// 아카이브(`articles/archive.html`)와 이슈 페이지(newsletter-renderer 출력)가 같은 한 벌을
// 쓴다. 두 표면은 설정 경로의 깊이만 다르다.

const assert = require('node:assert/strict');

const { applySubscriptionCta } = require('../../../../articles/assets/js/subscription-cta');

const HOOKS = {
  section: { tagName: 'section', attribute: 'data-subscription-section' },
  action: { tagName: 'a', attribute: 'data-subscription-action' },
  note: { tagName: 'span', attribute: 'data-subscription-footer-note' },
  link: { tagName: 'a', attribute: 'data-subscription-footer-action' }
};

function openingTag(html, tagName, attribute) {
  const pattern = new RegExp(`<${tagName}\\b(?=[^>]*\\b${attribute}\\b)[^>]*>`, 'i');
  return String(html).match(pattern)?.[0] || '';
}

// 여는 태그의 속성을 이름 -> 값으로 읽는다. 값이 없는 속성(`hidden`, `data-subscription-action`)은
// 빈 문자열이 되고, 값에 공백이 있어도 따옴표 안이라 한 번에 소비된다.
function parseAttributes(tag) {
  const inner = String(tag).replace(/^<[a-z0-9]+/i, '').replace(/\/?>$/, '');
  const attributes = {};
  for (const match of inner.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?/g)) {
    attributes[match[1].toLowerCase()] = match[2] === undefined ? '' : match[2];
  }
  return attributes;
}

function createElement(tag) {
  const attributes = parseAttributes(tag);
  return {
    tag,
    attributes,
    hidden: Object.prototype.hasOwnProperty.call(attributes, 'hidden'),
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    }
  };
}

function createSubscriptionDom(html) {
  const elements = {};
  for (const [name, hook] of Object.entries(HOOKS)) {
    const tag = openingTag(html, hook.tagName, hook.attribute);
    assert.ok(tag, `마크업에 ${hook.attribute} hook 이 있어야 한다`);
    elements[name] = createElement(tag);
  }

  const document = {
    querySelector(selector) {
      const name = Object.keys(HOOKS).find(key => selector === `[${HOOKS[key].attribute}]`);
      return name ? elements[name] : null;
    }
  };

  return { document, ...elements };
}

// options: { config } 는 fetch 가 돌려줄 JSON, { missing: true } 는 404,
// { fetchThrows: true } 는 네트워크 실패.
async function runSubscriptionCta(html, options = {}) {
  const dom = createSubscriptionDom(html);
  const requested = [];
  const errors = [];
  const originalConsoleError = console.error;
  console.error = error => errors.push(error);

  let applied = false;
  try {
    applied = await applySubscriptionCta(dom.document, async (url, init) => {
      requested.push({ url, init });
      if (options.fetchThrows) throw new Error('subscription config unavailable');
      if (options.missing) return { ok: false, status: 404 };
      return { ok: true, json: async () => options.config };
    });
  } finally {
    console.error = originalConsoleError;
  }

  return { ...dom, applied, requested, errors };
}

module.exports = {
  HOOKS,
  openingTag,
  parseAttributes,
  createSubscriptionDom,
  runSubscriptionCta
};
