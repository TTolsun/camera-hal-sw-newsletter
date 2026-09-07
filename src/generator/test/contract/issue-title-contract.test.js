'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');
const {
  editor,
  normalizeSection
} = require('../../../shared/test/helpers/editor-builders');
const {
  canonicalIssueTitle,
  isPublishableIssueTitle
} = require('../../../shared/common/issue-title');

const DATE = '2026-05-08';

// 2026-09-07 발행 실패 재현: editor가 날짜는 넣었지만 한국어를 하나도 쓰지 않은
// 영어 title("AOSP Camera / Driver / SoC Platform Newsletter - 2026-09-07")을 내놓아
// validate:localization이 hard fail로 발행을 막았다. 날짜만 검사하던 정규화는 이 title을
// 그대로 통과시켰기 때문에, 계약 위반이 발행 직전까지 살아남았다.
test('한국어가 없는 영어 issue title은 canonical title로 되돌린다', () => {
  const draft = editor({ title: `AOSP Camera / Driver / SoC Platform Newsletter - ${DATE}` });

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result.title, canonicalIssueTitle(DATE));
  assert.equal(isPublishableIssueTitle(result.title, DATE), true);
});

test('한국어 표시값이 있는 issue title은 그대로 보존한다', () => {
  const title = `AOSP Camera / Driver / SoC Platform 뉴스레터 - ${DATE}`;
  const draft = editor({ title });

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result.title, title);
  assert.equal(isPublishableIssueTitle(result.title, DATE), true);
});

test('날짜가 빠진 issue title은 canonical title로 되돌린다', () => {
  const draft = editor({ title: 'AOSP Camera 뉴스레터' });

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result.title, canonicalIssueTitle(DATE));
});

test('canonical issue title은 한국어가 없어도 발행 가능 판정이다', () => {
  assert.equal(isPublishableIssueTitle(canonicalIssueTitle(DATE), DATE), true);
  assert.equal(isPublishableIssueTitle(`Camera HAL / SW Newsletter - 2026-01-01`, DATE), false);
  assert.equal(isPublishableIssueTitle('', DATE), false);
});
