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
//
// 리포트가 아예 없는 경우도 같은 게이트가 봐야 한다. 감사 스텝은 continue-on-error라서 리포트를
// 쓰기 전에 죽으면(예: editor-draft.json JSON.parse 실패 - buildNewsletterImageAuditReport가
// writeJson 이전에 throw) 리포트가 PR에 커밋되지 않는다. 카운트만 읽는 게이트는 그때 조용히
// 통과하므로 "감사가 아예 돌지 않은 주"가 기계적 차단 없이 머지된다.

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const validateImagesPath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-external-images.js');
const date = '2026-08-10';

function writeFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
}

// 발행물을 origin/main 위의 커밋으로 올린다. 머지 경로(site-01-validate)에서 그 주 PR이 공개
// 산출물을 이미 커밋한 상태를 재현한다. 워크플로 03의 첫 실행은 반대로 공개 산출물이 작업
// 트리에만 있어 diff에 잡히지 않으므로, 이 커밋 여부가 두 상황을 가르는 구조 조건이다.
function commitPublicArtifacts(root) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'newsroom@example.com']);
  git(root, ['config', 'user.name', 'Newsroom Test']);
  git(root, ['add', 'articles/data/newsletters.json']);
  git(root, ['commit', '-q', '-m', 'baseline index']);
  git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', `publish newsletter ${date}`]);
}

// 이미지가 하나도 없는 최소 발행물을 만든다. 그래야 종료 코드가 오직 감사 리포트 판정에서만 나온다.
function buildFixtureRoot({ auditReport, strictTarget, publicArtifactsCommitted }) {
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
    // 문자열이면 그대로 쓴다 — 깨진 JSON(파싱 불가) 리포트를 만들 때 쓴다.
    writeFile(
      path.join(root, 'articles', 'content', 'newsroom', date, 'image-audit-report.json'),
      typeof auditReport === 'string' ? auditReport : JSON.stringify(auditReport)
    );
  }
  // strict target 스코프는 .tmp/newsletter-date.txt(현재 발행 대상)로 준다. 커밋하지 않은
  // fixture는 git 저장소가 아니므로 changed-file 경로는 빈 목록이 되고, 이 파일만이 유일한 입력이다.
  if (strictTarget) writeFile(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (publicArtifactsCommitted) commitPublicArtifacts(root);
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

test('validate:images fails on an unparsable image audit report', () => {
  // 깨진 JSON은 readJson의 catch가 이번 변경 전부터 fail로 막고 있었다. 여기서는 그 기존
  // fail-closed 경로를 회귀 핀으로 고정한다 — 이번에 새로 막은 것(비숫자 카운트 거부)을
  // 잠그는 테스트는 아래 두 개다.
  withFixture(
    { auditReport: 'this is not json {', strictTarget: true },
    result => {
      assert.equal(
        result.status,
        1,
        `an unparsable audit report must fail the gate. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /Could not parse/);
      assert.match(result.stderr, /image-audit-report\.json/);
    }
  );
});

test('validate:images fails when publish_blocking_issue_count is negative', () => {
  // 감사 모듈의 차단 조건은 `> 0`이다. 음수를 그냥 숫자로 받으면 여기서는 막고 워크플로에서는
  // 통과하는 리포트가 생겨 두 강제 지점의 판정이 갈린다.
  withFixture(
    {
      auditReport: {
        schemaVersion: 1,
        date,
        mode: 'publish-target',
        summary: { publish_blocking_issue_count: -3 },
        errors: []
      },
      strictTarget: true
    },
    result => {
      assert.equal(
        result.status,
        1,
        `a negative publish_blocking_issue_count must fail the gate. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /must be a non-negative integer/);
    }
  );
});

test('validate:images fails when publish_blocking_issue_count is not a number', () => {
  // `Number(...) || 0`식 강제는 비숫자 카운트('two' 같은 문자열, null, 누락)를 전부 0으로
  // 만들어 차단해야 할 발행을 통과시켰다("2" 같은 숫자 문자열은 옛 코드도 차단했다).
  // 숫자가 아니면 손상으로 취급해 실패시킨다.
  withFixture(
    {
      auditReport: {
        schemaVersion: 1,
        date,
        mode: 'publish-target',
        summary: { publish_blocking_issue_count: 'two' },
        errors: []
      },
      strictTarget: true
    },
    result => {
      assert.equal(
        result.status,
        1,
        `a non-numeric publish_blocking_issue_count must fail the gate. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /publish_blocking_issue_count must be a non-negative integer/);
    }
  );
});

test('validate:images fails when the audit report has no summary at all', () => {
  withFixture(
    { auditReport: { schemaVersion: 1, date, mode: 'publish-target' }, strictTarget: true },
    result => {
      assert.equal(
        result.status,
        1,
        `an audit report without a summary must fail the gate. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /publish_blocking_issue_count must be a non-negative integer/);
    }
  );
});

test('validate:images stays green when the image audit report has not been written yet and the public newsletter is not committed', () => {
  // 계약 변경(리포트 부재를 무조건 통과시키던 이전 버전에서 좁힘): 부재 판정을 "공개 산출물이
  // 커밋에 존재할 때"로 스코핑한다. 워크플로 03에서 validate:images는 감사 스텝보다 먼저 돌고,
  // 그때 공개 산출물은 아직 작업 트리에만 있어 커밋 diff에 잡히지 않는다. 그래서 정상적인 첫
  // 실행은 여기서 계속 초록으로 남는다. 이 경계가 무너지면 매주 뉴스레터 PR이 통째로 막힌다.
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

test('validate:images blocks a committed public newsletter that carries no image audit report', () => {
  // fail-open을 닫는 지점이다. 감사 스텝은 continue-on-error이고 리포트 쓰기는 리포트 조립
  // 이후에 일어나므로, 조립 중 throw하면 리포트가 없는 채로 PR이 만들어진다. 카운트만 읽는
  // 게이트는 그때 통과하므로 감사가 아예 돌지 않은 주가 기계적 차단 없이 머지된다.
  withFixture(
    { auditReport: null, publicArtifactsCommitted: true },
    result => {
      assert.equal(
        result.status,
        1,
        `a committed public newsletter without an audit report must block the merge. stdout=${result.stdout} stderr=${result.stderr}`
      );
      assert.match(result.stderr, /image lineage audit report is missing/);
      assert.match(result.stderr, /articles\/content\/newsroom\/2026-08-10\/image-audit-report\.json/);
    }
  );
});

test('validate:images accepts a committed public newsletter whose image audit report reports no publish-blocking issue', () => {
  // 매주 정상 발행 경로다. 리포트 존재 요구가 이 경로를 막지 않는다는 것을 고정한다.
  withFixture(
    {
      auditReport: auditReport({ mode: 'publish-target', publishBlockingIssueCount: 0 }),
      publicArtifactsCommitted: true
    },
    result => {
      assert.equal(
        result.status,
        0,
        `the normal weekly publish path must stay green. stdout=${result.stdout} stderr=${result.stderr}`
      );
    }
  );
});
