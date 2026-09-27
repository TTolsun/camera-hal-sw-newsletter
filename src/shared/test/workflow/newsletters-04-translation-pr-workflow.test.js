'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.resolve(__dirname, '../../../../.github/workflows/newsletters-04-translation-pr.yml'), 'utf8');

test('translation runs after Korean main publication and cannot trigger itself', () => {
  assert.match(workflow, /push:\s+branches: \[main\]/);
  const paths = workflow.match(/paths:\n([\s\S]*?)  workflow_dispatch:/)[1];
  assert.deepEqual([...paths.matchAll(/- '([^']+)'/g)].map(match => match[1]), [
    'articles/newsletters/**/index.html', 'articles/newsletters/**/issue.json'
  ]);
  assert.match(workflow, /group: translation\s+cancel-in-progress: false/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /node-version: 20/);
});

test('translation retains full gates and PR-only publishing with scoped paths and secret fallback', () => {
  assert.match(workflow, /npm run test && npm run validate/);
  assert.match(workflow, /peter-evans\/create-pull-request@v6/);
  assert.match(workflow, /base: main/);
  assert.match(workflow, /secrets\.NEWSROOM_PR_TOKEN \|\| github\.token/);
  assert.match(workflow, /GEMINI_API_KEY: \$\{\{ secrets\.GEMINI_API_KEY \}\}/);
  assert.doesNotMatch(workflow, /vars\.|git push|auto.merge|pull_request_target/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.translate_model/);
  assert.match(workflow, /add-paths:[\s\S]*translation-cost-report.md/);
  assert.match(workflow, /if: always\(\)[\s\S]*actions\/upload-artifact@v4/);
});

test('open PR hash dedup happens before translation and main is rechecked before PR creation', () => {
  assert.ok(workflow.indexOf('overlay.source_hash === process.env.SOURCE_HASH') < workflow.indexOf('name: Translate and render'));
  assert.match(workflow, /state: 'open', base: 'main'/);
  assert.match(workflow, /process.env.FORCE === 'true'/);
  assert.ok(workflow.indexOf('hash !== process.env.SOURCE_HASH') < workflow.indexOf('name: Create translation PR'));
  assert.match(workflow, /head !== ref.object.sha/);
});

test('open PR dedup executes without another model call and force/source changes remain eligible', async () => {
  const step = workflow.split('name: Reuse an open translation PR for the same source')[1].split('      - name: Translate and render')[0];
  const script = step.split('          script: |\n')[1].split('\n').map(line => line.replace(/^            /, '')).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('core', 'github', 'context', 'process', script);
  for (const [force, hash, open, expected] of [
    ['false', 'same', true, 'true'], ['true', 'same', true, 'false'],
    ['false', 'changed', true, 'false'], ['false', 'same', false, 'false']
  ]) {
    const outputs = {};
    let reads = 0;
    const github = { rest: {
      pulls: { list: async () => ({ data: open ? [{ head: { sha: 'head' }, html_url: 'https://example.com/pr' }] : [] }) },
      repos: { getContent: async () => { reads++; return { data: { content: Buffer.from(JSON.stringify({ source_hash: hash })).toString('base64') } }; } }
    } };
    await execute({ setOutput: (key, value) => { outputs[key] = value; }, info: () => {} }, github,
      { repo: { owner: 'owner', repo: 'repo' } }, { env: { FORCE: force, WEEKLY_KEY: '2026-W39', SOURCE_HASH: 'same' } });
    assert.equal(outputs.skip, expected);
    assert.equal(reads, force === 'true' || !open ? 0 : 1);
  }
});
