'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('newsletters orchestrator calls 01 02 03 via workflow_call', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const coordinator = fs.readFileSync(path.join(workflowDir, 'newsletters-00-orchestrator.yml'), 'utf8');

  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-01-source-collect-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-02-source-discovery-pr\.yml/);
  assert.match(coordinator, /uses:\s*\.\/\.github\/workflows\/newsletters-03-editor-pr\.yml/);

  assert.doesNotMatch(coordinator, /npm run collect/);
  assert.doesNotMatch(coordinator, /npm run generate/);
  assert.doesNotMatch(coordinator, /npm run test/);

  assert.match(coordinator, /needs:\s*\[collect,\s*discover\]/);

  // Source discovery is optional enrichment: its failure must not block generate.
  // generate keeps sequencing after discover but runs whenever collect succeeded.
  assert.match(coordinator, /if:\s*\$\{\{\s*always\(\)\s*&&\s*needs\.collect\.result\s*==\s*'success'\s*\}\}/);

  assert.match(coordinator, /^\s*schedule:/m);
  assert.match(coordinator, /cron: "0 0 \* \* 1"/);

  assert.match(coordinator, /secrets:\s*inherit/);
});

// #1167: 이미 발행된 호로 다시 돌면 01·02가 그 호의 입력 산출물을 main에 직접 덮어썼다.
// 판정은 오케스트레이터 맨 앞 job 하나가 하고, 막히면 collect부터 돌지 않는다.
test('an already published issue stops the orchestrator before collect (#1167)', () => {
  const workflowDir = path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows');
  const coordinator = fs.readFileSync(path.join(workflowDir, 'newsletters-00-orchestrator.yml'), 'utf8');

  const guardStart = coordinator.indexOf('\n  published-guard:');
  const collectStart = coordinator.indexOf('\n  collect:');
  assert.notEqual(guardStart, -1, 'published-guard job must exist');
  assert.ok(guardStart < collectStart, 'published-guard must come before collect');
  const guardJob = coordinator.slice(guardStart, collectStart);
  const collectJob = coordinator.slice(collectStart, coordinator.indexOf('\n  discover:'));

  // 판정은 #1160과 같은 코드로 한다.
  assert.match(guardJob, /node src\/generator\/publish\/check-already-published-issue\.js/);
  // collect가 받는 날짜와 같은 식이어야 같은 호를 본다.
  assert.match(guardJob, /NEWSLETTER_DATE: \$\{\{ github\.event\.inputs\.newsletter_date \|\| '' \}\}/);
  assert.match(collectJob, /newsletter_date: \$\{\{ github\.event\.inputs\.newsletter_date \|\| '' \}\}/);
  // 의도적 재발행 스위치는 가드도 통과시킨다.
  assert.match(guardJob, /NEWSLETTER_ALLOW_REPUBLISH: \$\{\{ github\.event\.inputs\.allow_republish == 'true' && 'true' \|\| 'false' \}\}/);
  // 발행 여부는 main의 커밋으로 판정한다.
  assert.match(guardJob, /ref: main/);
  // 판정 이유를 실행 요약에 남긴다. tee 뒤에서도 CLI의 exit 1이 살아 있어야 job이 실패한다.
  assert.match(guardJob, /set -euo pipefail/);
  assert.match(guardJob, /tee -a "\$GITHUB_STEP_SUMMARY"/);

  // 가드 job이 실패하면(막힘 또는 측정 불가) collect는 기본 조건 success()에 걸려 돌지 않는다.
  // discover는 collect를, generate는 collect 성공을 요구하므로 함께 멈춘다.
  assert.match(collectJob, /needs: published-guard/);
  assert.doesNotMatch(collectJob, /\n    if:/, 'collect must keep the default success() condition');
});
