const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  violationsForFile
} = require('../../../scripts/check-domain-model-boundary');

test('domain model boundary guard blocks raw provider shapes outside the LLM adapter boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-boundary-'));
  const forbiddenPath = path.join(root, 'scripts', 'newsroom', 'render');
  fs.mkdirSync(forbiddenPath, { recursive: true });
  fs.writeFileSync(
    path.join(forbiddenPath, 'leak.js'),
    'const leaked = providerResponse;\nconst alsoLeaked = choices[0].message.content;\n',
    'utf8'
  );

  const violations = violationsForFile(root, 'scripts/newsroom/render/leak.js');

  assert.equal(violations.length, 2);
  assert.ok(violations.some(item => item.includes('providerResponse')));
  assert.ok(violations.some(item => item.includes('choices[0].message.content')));

  fs.rmSync(root, { recursive: true, force: true });
});
