'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { EXTRA_SERVED_FILES } = require('../../../generator/publish/assemble-site');

const workflowPath = path.join(
  __dirname, '..', '..', '..', '..', '.github', 'workflows', 'site-02-deploy.yml'
);

// push.paths 항목만 뽑아낸다. 저장소에 YAML 파서 의존성이 없으므로 이 파일의 기존 방식대로
// 원문 문자열을 읽는다. `paths:` 다음의 `- "..."` 줄이 끊기는 지점에서 멈춘다.
function pushPathFilters(yaml) {
  const lines = yaml.split(/\r?\n/);
  const startIndex = lines.findIndex(line => /^ {4}paths:$/.test(line));
  assert.notEqual(startIndex, -1, 'push trigger must declare a paths filter');

  const filters = [];
  for (const line of lines.slice(startIndex + 1)) {
    const entry = /^ {6}- "(.+)"$/.exec(line);
    if (!entry) break;
    filters.push(entry[1]);
  }
  return filters;
}

// 직접 경로로 적혀 있거나, `**` glob의 접두사에 걸리면 커버된 것으로 본다.
function isCoveredByPathFilters(relPath, filters) {
  const target = relPath.split(path.sep).join('/');
  return filters.some(filter => {
    if (filter === target) return true;
    const globIndex = filter.indexOf('**');
    return globIndex !== -1 && target.startsWith(filter.slice(0, globIndex));
  });
}

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
  // 조립기 스크립트 경로는 push.paths에도 적혀 있으므로(#888), 실행 지점을 세려면 파일명이
  // 아니라 `node <경로>` 호출 자체를 봐야 한다.
  const assembleCommand = 'node src/generator/publish/assemble-site.js';
  const assembleIdx = yaml.indexOf(assembleCommand);
  const uploadIdx = yaml.indexOf('upload-pages-artifact');
  const deployPagesIdx = yaml.indexOf('deploy-pages');
  assert.ok(assembleIdx > buildIdx && assembleIdx < deployIdx, 'assemble-site must run in the build job only');
  assert.ok(uploadIdx > buildIdx && uploadIdx < deployIdx, 'upload-pages-artifact must run in the build job only');
  assert.ok(deployPagesIdx > deployIdx, 'deploy-pages must run in the deploy job');
  assert.equal(yaml.indexOf(assembleCommand, assembleIdx + 1), -1, 'assemble-site must be invoked exactly once');
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

// #888 — 조립기가 _site로 복사하는 파일 목록과 배포를 깨우는 push.paths 목록이 따로 관리돼
// 어긋나 있었다(config/subscription.json만 바꾼 머지는 배포를 못 깨웠다). 두 목록을 여기서 잇는다.
test('Site 02 deploy triggers on every served file the assembler copies', () => {
  const yaml = fs.readFileSync(workflowPath, 'utf8');
  const filters = pushPathFilters(yaml);

  assert.ok(filters.includes('index.html'), 'root index.html must stay in the trigger list');
  assert.ok(filters.includes('articles/**'), 'articles/** must stay in the trigger list');

  assert.ok(EXTRA_SERVED_FILES.length > 0, 'the assembler must declare its extra served files');
  for (const relPath of EXTRA_SERVED_FILES) {
    assert.ok(
      isCoveredByPathFilters(relPath, filters),
      `assemble-site.js copies "${relPath}" into _site, so push.paths must trigger on it. Current push.paths: ${filters.join(', ')}`
    );
  }

  // 조립기 스크립트 자체도 서빙 결과를 결정하는 입력이다. 빠지면 EXTRA_SERVED_FILES를 늘리는
  // 변경(복사 동작만 바꾸는 변경 포함)이 다시 배포를 깨우지 못한다.
  assert.ok(
    isCoveredByPathFilters('src/generator/publish/assemble-site.js', filters),
    `the assembler script decides what gets served, so push.paths must trigger on it. Current push.paths: ${filters.join(', ')}`
  );
});
