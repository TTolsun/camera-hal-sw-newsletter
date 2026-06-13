const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { rawEnglishProseRuns } = require('../../quality/public-newsletter');

const root = path.join(__dirname, '..', '..', '..', '..');

function repoPath(...parts) {
  return path.join(root, ...parts);
}

function readTemplate(...parts) {
  return fs.readFileSync(repoPath(...parts), 'utf8');
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'localization-validator-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('PR template files exist', () => {
  assert.equal(fs.existsSync(repoPath('.github', 'PULL_REQUEST_TEMPLATE', 'newsletter.md')), true);
  assert.equal(fs.existsSync(repoPath('.github', 'PULL_REQUEST_TEMPLATE', 'code-docs.md')), true);
  assert.equal(fs.existsSync(repoPath('.github', 'pull_request_template.md')), true);
});

test('default PR template points contributors to split templates', () => {
  const text = readTemplate('.github', 'pull_request_template.md');

  assert.match(text, /PR 유형 선택/);
  assert.match(text, /newsletter\.md/);
  assert.match(text, /code-docs\.md/);
  assert.match(text, /PR body는 한글로 작성/);
  assert.match(text, /영어 식별자는 한국어 설명/);
});

test('newsletter PR template keeps publication checklist guardrails', () => {
  const text = readTemplate('.github', 'PULL_REQUEST_TEMPLATE', 'newsletter.md');

  assert.match(text, /^## 뉴스레터 발행 PR$/m);
  assert.match(text, /### 작성 원칙/);
  assert.match(text, /PR body는 한글로 작성/);
  assert.match(text, /영어 식별자는 한국어 설명/);
  assert.match(text, /articles\/newsletters\/YYYY-MM-DD\/newsletter\.md/);
  assert.match(text, /fact-check must_fix|must_fix/);
  assert.match(text, /source gap/i);
  assert.match(text, /임시 Markdown, notes\/checkpoint 문서, one-off script가 PR에 남아 있지 않다/);
  assert.match(text, /`npm run test`/);
  assert.match(text, /`npm run validate`/);
});

test('code docs PR template keeps code safety checklist guardrails', () => {
  const text = readTemplate('.github', 'PULL_REQUEST_TEMPLATE', 'code-docs.md');

  assert.match(text, /^## 코드 \/ 문서 \/ 리팩토링 PR$/m);
  assert.match(text, /### 작성 원칙/);
  assert.match(text, /PR body는 한글로 작성/);
  assert.match(text, /영어 식별자는 한국어 설명/);
  assert.match(text, /generated artifact를 불필요하게 수정하지 않았다/);
  assert.match(text, /quality gate, hard blocker, source binding.+약화하지 않았다/);
  assert.match(text, /qualityGatePolicy\.threshold/);
  assert.match(text, /qualityGatePolicy\.hardFailConditions/);
  assert.match(text, /publish-ready/);
  assert.match(text, /final_publish_ready/);
  assert.match(text, /artifact_final_publish_ready/);
  assert.match(text, /임시 Markdown, notes\/checkpoint 문서, one-off script가 PR에 남아 있지 않다/);
  assert.match(text, /새 문서나 스크립트는 정식 산출물 또는 유지보수 가능한 도구로 설명 가능하다/);
  assert.match(text, /`npm run test`/);
  assert.match(text, /`npm run validate`/);
});

test('localization validator scans split PR template directory', () => {
  const text = readTemplate('src', 'generator', 'publish', 'validate-localization.js');

  assert.match(text, /path\.join\('\.github', 'PULL_REQUEST_TEMPLATE'\)/);
});

test('localization validator scans prompt and latest public newsletter surfaces', () => {
  const text = readTemplate('src', 'generator', 'publish', 'validate-localization.js');

  assert.match(text, /promptHostFiles/);
  assert.match(text, /checkPromptHosts/);
  assert.match(text, /checkLatestPublicNewsletterArtifacts/);
  assert.match(text, /rawEnglishProseRuns/);
});

test('localization validator reports homepage headline display errors in readable Korean', () => {
  const root = tempRoot();
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date: '2026-05-23',
    title: '카메라 뉴스레터',
    summary: '카메라 뉴스 요약',
    tags: []
  }]);
  writeJson(path.join(root, 'src', 'core', 'data', 'news-sources.json'), {
    sources: []
  });
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), {
    schemaVersion: 1,
    current_headline: {
      title: 'Camera headline',
      summary: 'Camera summary'
    },
    headline_history: []
  });

  const result = spawnSync(process.execPath, [
    repoPath('src', 'generator', 'publish', 'validate-localization.js')
  ], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /current_headline\.title에 한국어 표시값이 없습니다/);
  assert.doesNotMatch(result.stderr, /\?\?\?쒓뎅|媛믪씠/);
});

test('localization validator allows canonical English newsletter brand titles', () => {
  const root = tempRoot();
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date: '2026-05-24',
    title: 'Camera HAL / SW Newsletter - 2026-05-24',
    summary: '카메라 뉴스 요약',
    tags: []
  }]);
  writeJson(path.join(root, 'src', 'core', 'data', 'news-sources.json'), {
    sources: []
  });

  const result = spawnSync(process.execPath, [
    repoPath('src', 'generator', 'publish', 'validate-localization.js')
  ], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
});

test('prompt host files do not keep long English prose instructions', () => {
  const promptHostFiles = [
    ['src', 'generator', 'publish', 'gemini-newsroom-newsletter.js'],
    ['src', 'generator', 'publish', 'build-newsroom-pr-body.js'],
    ['src', 'generator', 'render', 'newsletter-renderer.js']
  ];

  for (const parts of promptHostFiles) {
    const rel = parts.join('/');
    const text = readTemplate(...parts);
    assert.deepEqual(rawEnglishProseRuns(text), [], `${rel} contains long English prose`);
  }
});
