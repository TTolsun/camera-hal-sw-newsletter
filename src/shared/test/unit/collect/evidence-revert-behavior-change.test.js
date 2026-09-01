'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { evidenceMetadata } = require('../../../cli/collect-news-candidates');

// #976: 근거 충분성을 판정하는 BEHAVIOR_CHANGE_PATTERN에 revert 어휘가 없어서 판정이 뒤집혀
// 있었다. revert 릴리스 본문은 실제 동작 변경을 서술하는데도 매치 0건이라 근거 미달로 떨어지고,
// 아무 사실도 말하지 않는 수집기 템플릿 문장("Released v... (...)")은 `Released` 한 단어 때문에
// 게이트를 통과했다. revert는 커널·libcamera 도메인에서 흔한 변경 형태라 이 갭은 이 뉴스레터의
// 핵심 소스군에 반복해서 걸린다.
//
// 어휘 확장은 공유 게이트를 건드리는 일이라 #805(`pipeline handler`·`tegra` 단독 토큰 기각)의
// 선례대로 누수를 실측했다. 커밋된 후보 4689건 중 revert 어휘가 나타나는 문맥은 이 imx296
// 되돌림 하나뿐이었고(비카메라 0건), 패턴 확장으로 새로 매치되는 후보 0건·main_eligible이
// 뒤집히는 후보 0건이었다.

// 2026-08-24호 라이브 실측 본문(Raspberry Pi downstream libcamera v0.7.2+rpt20260817).
const REVERT_RELEASE_BODY = 'Revert "ipa: rpi: imx296: Enable embedded data" This reverts commit b7fa47f. ' +
  'Right now embedded data with the imx296 cannot be negotiated with the CFE.';

const RELEASE_SOURCE = {
  id: 'raspberrypi-libcamera-releases',
  name: 'Raspberry Pi libcamera Releases',
  category: 'linux-camera',
  sourceRole: 'official_release_source'
};

test('#976 revert 릴리스 본문은 동작 변경 근거로 인정되고 main_eligible을 유지한다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    behavior_change: REVERT_RELEASE_BODY
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    '',
    40,
    false
  );

  assert.equal(metadata.behavior_change, REVERT_RELEASE_BODY);
  assert.equal(metadata.has_behavior_change, true);
  assert.equal(metadata.has_published_date, true);
  assert.equal(metadata.has_version_or_release, true);
  assert.equal(metadata.has_api_or_component, true);
  assert.equal(metadata.evidence_score, 8);
  assert.equal(metadata.source_gap_risk, false);
  assert.equal(metadata.main_eligible, true);
});

test('#976 게이트는 낮아지지 않았다: 날짜·버전·컴포넌트가 빠진 후보는 여전히 탈락한다', () => {
  // revert 어휘 하나만으로는 통과하지 못한다. release_note_item은 네 근거를 모두 요구한다.
  const missingEvidence = [
    {
      label: '날짜 없음',
      raw: { sourceKind: 'release_note_item', behavior_change: REVERT_RELEASE_BODY },
      title: 'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
      // 버전·컴포넌트·동작 변경으로 6점이지만 release_note_item은 네 근거를 모두 요구하므로
      // 점수만으로는 통과하지 못한다.
      expectedScore: 6
    },
    {
      label: '버전·컴포넌트 없음',
      raw: { sourceKind: 'release_note_item', publishedAt: '2026-08-17', behavior_change: REVERT_RELEASE_BODY },
      title: 'Releases',
      expectedScore: 4
    }
  ];

  for (const { label, raw, title, expectedScore } of missingEvidence) {
    const metadata = evidenceMetadata(raw, RELEASE_SOURCE, title, '', 40, false);
    assert.equal(metadata.has_behavior_change, true, `${label}: 동작 변경 근거 자체는 인정된다`);
    assert.equal(metadata.evidence_score, expectedScore, `${label}: evidence_score`);
    assert.equal(metadata.source_gap_risk, true, `${label}: source_gap_risk가 유지돼야 한다`);
    assert.equal(metadata.main_eligible, false, `${label}: main_eligible이 false여야 한다`);
  }
});
