'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { weeklyTopicTags } = require('../../render/newsletter-renderer');
const { filterEntries, TOPICS } = require('../../../../articles/assets/js/newsletter-archive');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const weeklyIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));

function issueSections(weeklyKey) {
  const issuePath = path.join(ROOT, 'articles', 'newsletters', weeklyKey, 'issue.json');
  return JSON.parse(fs.readFileSync(issuePath, 'utf8')).sections;
}

function weeklyKeysFor(topicKey) {
  return filterEntries(weeklyIndex, { topic: topicKey }).map(entry => entry.weeklyKey);
}

test('every committed weekly index entry carries exactly the topics its articles earn', () => {
  for (const entry of weeklyIndex) {
    assert.deepEqual(
      [...entry.tags].sort(),
      [...weeklyTopicTags(issueSections(entry.weeklyKey))].sort(),
      `${entry.weeklyKey} index tags must match the topics derived from its issue.json articles`
    );
  }
});

test('the archive filter offers a C++ topic that the weekly index can match', () => {
  assert.ok(TOPICS.some(topic => topic.key === 'cpp' && topic.tag === 'C++'));
});

test('weeks without a direct Android camera article are left out of the Camera HAL filter', () => {
  const cameraHal = weeklyKeysFor('camera-hal');

  // W32·W30·W33·W38 은 Linux 센서 드라이버·libcamera 기사뿐이다. (#1250)
  for (const weeklyKey of ['2026-W30', '2026-W32', '2026-W33', '2026-W38']) {
    assert.ok(!cameraHal.includes(weeklyKey), `${weeklyKey} must not match the Camera HAL filter`);
    assert.ok(!weeklyKeysFor('android').includes(weeklyKey), `${weeklyKey} must not match the Android filter`);
  }
  // direct_aosp_camera 기사가 있는 주는 계속 남는다.
  for (const weeklyKey of ['2026-W34', '2026-W41']) {
    assert.ok(cameraHal.includes(weeklyKey), `${weeklyKey} has a direct Camera HAL article`);
  }
});

test('the SoC Platform filter finds the week with the Renesas RZ/V2H article', () => {
  assert.ok(weeklyKeysFor('soc-platform').includes('2026-W40'));
});

test('compiler tooling articles are filed under C++ and not under AI', () => {
  // W28 의 dw2102 버퍼 오버플로 수정은 LLVM/Clang 환경 문제라 is_ai_related=false 다.
  assert.ok(weeklyKeysFor('cpp').includes('2026-W28'));
  assert.ok(!weeklyKeysFor('ai').includes('2026-W28'));
});

test('weeks that really carry AI tooling articles stay in the AI filter', () => {
  const ai = weeklyKeysFor('ai');

  for (const weeklyKey of ['2026-W39', '2026-W40']) {
    assert.ok(ai.includes(weeklyKey), `${weeklyKey} has AI tooling articles`);
  }
});
