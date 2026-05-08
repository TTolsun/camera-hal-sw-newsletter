const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function repoPath(...parts) {
  return path.join(root, ...parts);
}

function readTemplate(...parts) {
  return fs.readFileSync(repoPath(...parts), 'utf8');
}

test('PR template files exist', () => {
  assert.equal(fs.existsSync(repoPath('.github', 'PULL_REQUEST_TEMPLATE', 'newsletter.md')), true);
  assert.equal(fs.existsSync(repoPath('.github', 'PULL_REQUEST_TEMPLATE', 'code-docs.md')), true);
  assert.equal(fs.existsSync(repoPath('.github', 'pull_request_template.md')), true);
});

test('newsletter PR template keeps publication checklist guardrails', () => {
  const text = readTemplate('.github', 'PULL_REQUEST_TEMPLATE', 'newsletter.md');

  assert.match(text, /newsletters\/YYYY-MM-DD\/newsletter\.md/);
  assert.match(text, /fact-check must_fix|must_fix/);
  assert.match(text, /source gap/i);
  assert.match(text, /`npm run test`/);
  assert.match(text, /`npm run validate`/);
});

test('code docs PR template keeps code safety checklist guardrails', () => {
  const text = readTemplate('.github', 'PULL_REQUEST_TEMPLATE', 'code-docs.md');

  assert.match(text, /generated artifact를 불필요하게 수정하지 않았다/);
  assert.match(text, /quality gate, hard blocker, source binding.+약화하지 않았다/);
  assert.match(text, /`npm run test`/);
  assert.match(text, /`npm run validate`/);
});
