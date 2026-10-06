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

test('weeks with a Qualcomm CAMSS driver article match both the Driver and SoC Platform filters', () => {
  // W29 OPE 드라이버, W32 MIPI C-PHY 는 SoC 카메라 서브시스템 드라이버 기사다. (#1250)
  for (const weeklyKey of ['2026-W29', '2026-W32']) {
    assert.ok(weeklyKeysFor('driver').includes(weeklyKey), `${weeklyKey} must match the Driver filter`);
    assert.ok(weeklyKeysFor('soc-platform').includes(weeklyKey), `${weeklyKey} must match the SoC Platform filter`);
  }
  // 외부 센서 드라이버 기사만 있는 주는 SoC Platform 에 들어가지 않는다.
  assert.ok(!weeklyKeysFor('soc-platform').includes('2026-W33'));
});

test('compiler tooling articles are filed under C++ and not under AI', () => {
  // W28 의 dw2102 버퍼 오버플로 수정은 LLVM/Clang 환경 문제라 is_ai_related=false 다.
  assert.ok(weeklyKeysFor('cpp').includes('2026-W28'));
  assert.ok(!weeklyKeysFor('ai').includes('2026-W28'));
});

test('watchlist C++ toolchain articles reach the C++ filter', () => {
  // W19 C++26 assert(), W20 GCC 16, W21 GCC 16.1·Glaze 7.2 는 watchlist bucket 이다. (#1250)
  for (const weeklyKey of ['2026-W19', '2026-W20', '2026-W21']) {
    assert.ok(weeklyKeysFor('cpp').includes(weeklyKey), `${weeklyKey} must match the C++ filter`);
  }
});

test('weeks that really carry AI tooling articles stay in the AI filter', () => {
  const ai = weeklyKeysFor('ai');

  for (const weeklyKey of ['2026-W39', '2026-W40']) {
    assert.ok(ai.includes(weeklyKey), `${weeklyKey} has AI tooling articles`);
  }
});
