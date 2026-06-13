const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readJsonIfExists } = require('../../../../core/common/json');

test('readJsonIfExists returns exists=false for nonexistent file', () => {
  const result = readJsonIfExists(path.join(os.tmpdir(), `no-such-file-${Date.now()}.json`));
  assert.deepEqual(result, { exists: false, value: null, error: null });
});

test('readJsonIfExists returns parsed value for valid JSON file', () => {
  const filePath = path.join(os.tmpdir(), `json-test-valid-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ hello: 'world' }), 'utf8');
  try {
    const result = readJsonIfExists(filePath);
    assert.equal(result.exists, true);
    assert.deepEqual(result.value, { hello: 'world' });
    assert.equal(result.error, null);
  } finally {
    fs.unlinkSync(filePath);
  }
});

test('readJsonIfExists returns error for invalid JSON file', () => {
  const filePath = path.join(os.tmpdir(), `json-test-invalid-${Date.now()}.json`);
  fs.writeFileSync(filePath, 'not valid json {{{', 'utf8');
  try {
    const result = readJsonIfExists(filePath);
    assert.equal(result.exists, true);
    assert.equal(result.value, null);
    assert.ok(result.error instanceof Error);
  } finally {
    fs.unlinkSync(filePath);
  }
});
