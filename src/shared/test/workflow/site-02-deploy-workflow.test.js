'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(
  __dirname, '..', '..', '..', '..', '.github', 'workflows', 'site-02-deploy.yml'
);

test('Site 02 deploy splits build and deploy into separate jobs so rerun --failed is safe', () => {
  const yaml = fs.readFileSync(workflowPath, 'utf8');

  const buildIdx = yaml.indexOf('\n  build:');
  const deployIdx = yaml.indexOf('\n  deploy:');
  assert.ok(buildIdx !== -1, 'must declare a build job');
  assert.ok(deployIdx !== -1, 'must declare a deploy job');
  assert.ok(buildIdx < deployIdx, 'build job must be declared before the deploy job');

  // The deploy job waits on build.
  assert.match(yaml, /needs:\s*build/, 'deploy job must depend on build via needs: build');

  // The site is assembled and the artifact uploaded ONLY in build. Rerunning the
  // failed deploy job then reuses the existing artifact and never uploads a second
  // "github-pages" artifact (the Multiple-artifacts footgun of a single job).
  const assembleIdx = yaml.indexOf('assemble-site.js');
  const uploadIdx = yaml.indexOf('upload-pages-artifact');
  const deployPagesIdx = yaml.indexOf('deploy-pages');
  assert.ok(assembleIdx > buildIdx && assembleIdx < deployIdx, 'assemble-site must run in the build job only');
  assert.ok(uploadIdx > buildIdx && uploadIdx < deployIdx, 'upload-pages-artifact must run in the build job only');
  assert.ok(deployPagesIdx > deployIdx, 'deploy-pages must run in the deploy job');
  assert.equal(yaml.indexOf('assemble-site.js', assembleIdx + 1), -1, 'assemble-site must appear exactly once');
  assert.equal(yaml.indexOf('upload-pages-artifact', uploadIdx + 1), -1, 'upload-pages-artifact must appear exactly once');
});

test('Site 02 deploy preserves the single pages concurrency group, triggers, and permissions', () => {
  const yaml = fs.readFileSync(workflowPath, 'utf8');

  assert.match(yaml, /group: pages/);
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /^\s*workflow_dispatch:/m);
  assert.match(yaml, /pages: write/);
  assert.match(yaml, /id-token: write/);
  // The github-pages environment (with the deployed page URL) lives on the deploy job.
  assert.match(yaml, /name: github-pages/);
  assert.match(yaml, /url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
});
