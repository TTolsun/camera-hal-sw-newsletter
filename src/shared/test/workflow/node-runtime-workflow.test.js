const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('workflow Node selection agrees with the supported package runtime', () => {
  const major = read('.nvmrc').trim();
  assert.equal(major, '24');
  assert.equal(JSON.parse(read('package.json')).engines.node, '>=' + major);
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].engines.node, '>=' + major);
  const dir = '.github/workflows';
  let setups = 0;
  for (const name of fs.readdirSync(path.join(root, dir)).filter(name => /\.ya?ml$/.test(name))) {
    const workflow = read(dir + '/' + name);
    assert.doesNotMatch(workflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE20/);
    for (const step of workflow.split(/\n(?=      - )/)) {
      if (!step.includes('uses: actions/setup-node@')) continue;
      setups++;
      assert.match(step, /node-version-file: \.nvmrc/, name);
      assert.doesNotMatch(step, /node-version:/, name);
      assert.match(step, /package-manager-cache: false/, name);
    }
  }
  assert.ok(setups >= 9, 'all runtime consumers, including translation, are checked');
});
