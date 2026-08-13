'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// #886 — 워크플로 03의 이미지 계보 감사 스텝은 실패해도 그 주 뉴스레터 PR이 남도록 강등됐다.
// 강등만 하면 머지 전에 publish 차단 조건을 강제하는 지점이 하나도 남지 않으므로, PR에 함께
// 커밋되는 image-audit-report.json을 validate:images가 읽어 같은 조건을 차단한다.
// 여기서는 그 강제 지점을 실제 프로세스 종료 코드로 고정한다(스코핑 포함).

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const validateImagesPath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-external-images.js');
const date = '2026-08-10';

function writeFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

// 이미지가 하나도 없는 최소 발행물을 만든다. 그래야 종료 코드가 오직 감사 리포트 판정에서만 나온다.
function buildFixtureRoot({ auditReport, strictTarget }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-audit-gate-'));
  writeFile(
    path.join(root, 'articles', 'data', 'newsletters.json'),
    JSON.stringify([{
      date,
      html: `newsletters/${date}/index.html`,
      md: `newsletters/${date}/newsletter.md`
    }])
  );
  writeFile(path.join(root, 'articles', 'newsletters', date, 'index.html'), '<html><body></body></html>');
  writeFile(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), '# Camera HAL / SW Newsletter\n');
  if (auditReport) {
    writeFile(
      path.join(root, 'articles', 'content', 'newsroom', date, 'image-audit-report.json'),
      JSON.stringify(auditReport)
    );
  }
  // strict target 스코프는 .tmp/newsletter-date.txt(현재 발행 대상)로 준다. fixture 디렉터리는
  // git 저장소가 아니므로 changed-file 경로는 빈 목록이 되고, 이 파일만이 유일한 입력이다.
  if (strictTarget) writeFile(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  return root;
}

function runValidateImages(root) {
  return spawnSync(process.execPath, [validateImagesPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_BASE_REF: '' }
  });
}

function auditReport({ mode, publishBlockingIssueCount }) {
  return {
    schemaVersion: 1,
    date,
    mode,
    summary: { publish_blocking_issue_count: publishBlockingIssueCount },
    errors: publishBlockingIssueCount > 0
      ? [{ type: 'selected_image_render_mismatch', index: 1, headline: 'Camera HAL stream configuration' }]
      : []
  };
}

function withFixture(options, assertions) {
  const root = buildFixtureRoot(options);
  try {
    assertions(runValidateImages(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('validate:images blocks a publish-target newsletter whose committed image audit still reports publish-blocking issues', () => {
  withFixture(
    { auditReport: auditReport({ mode: 'publish-target', publishBlockingIssueCount: 2 }), strictTarget: true },
    result => {
      assert.equal(
        result.status,
        1,
        `validate:images must fail on a publish-blocking image audit report. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /image lineage audit reports 2 publish-blocking issue\(s\)/);
      assert.match(result.stderr, /articles\/content\/newsroom\/2026-08-10\/image-audit-report\.json/);
    }
  );
});

test('validate:images ignores a publish-blocking image audit report for a newsletter that is not the strict target', () => {
  withFixture(
    { auditReport: auditReport({ mode: 'publish-target', publishBlockingIssueCount: 2 }), strictTarget: false },
    result => {
      assert.equal(
        result.status,
        0,
        `a historical newsletter must not block an unrelated pull request. stderr=${result.stderr}`
      );
    }
  );
});

test('validate:images blocks a review-or-draft image audit report that still carries publish-blocking issues', () => {
  // 감사 스텝이 무장되는 조건은 public_newsletter_ready(공개 파일 존재·인덱스 등재·변경)라는 구조
  // 조건이라, mode를 정하는 publishTarget(issue, status)와 갈린다. 커밋된 2026-05-11·05-22·05-27이
  // 그 부류다 — status NEEDS_FIX(mode review-or-draft)인데 공개 파일이 인덱스에 올라 발행됐다.
  // 그 주에 계보가 깨지면 워크플로의 --fail-on-publish-blocking은 여전히 발동하므로(그쪽은 mode를
  // 보지 않는다), 머지 경로 대체 게이트도 같은 식이어야 한다. 여기서 통과시키면 #886은 대체 없는
  // 게이트 제거가 된다.
  withFixture(
    { auditReport: auditReport({ mode: 'review-or-draft', publishBlockingIssueCount: 1 }), strictTarget: true },
    result => {
      assert.equal(
        result.status,
        1,
        `a review-or-draft audit report with publish-blocking issues must block the merge. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /image lineage audit reports 1 publish-blocking issue\(s\)/);
    }
  );
});

test('validate:images ignores a review-or-draft image audit report for a newsletter that is not the strict target', () => {
  // 커밋된 2026-05-28 리포트가 이 모양이다(count=1, mode=review-or-draft). 잔존 카운트가 무관한
  // PR을 막지 않는 것은 strict target 스코프가 담당한다. validation-targets는 image-audit-report
  // 경로 자체를 strict target 산정에서 제외하므로, 리포트만 바뀌어도 그 날짜가 대상이 되지 않는다.
  withFixture(
    { auditReport: auditReport({ mode: 'review-or-draft', publishBlockingIssueCount: 1 }), strictTarget: false },
    result => {
      assert.equal(
        result.status,
        0,
        `a historical review-or-draft report must not block an unrelated pull request. stderr=${result.stderr}`
      );
    }
  );
});

test('validate:images stays green when the image audit report has not been written yet', () => {
  // 워크플로 03에서 validate:images는 감사 스텝보다 먼저 돈다. 리포트 존재를 요구하면 정상적인
  // 첫 실행이 매번 붉어진다.
  withFixture(
    { auditReport: null, strictTarget: true },
    result => {
      assert.equal(
        result.status,
        0,
        `a missing audit report must not fail the first run. stderr=${result.stderr}`
      );
    }
  );
});
