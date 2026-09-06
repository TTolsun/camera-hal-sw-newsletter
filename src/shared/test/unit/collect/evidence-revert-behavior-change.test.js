'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { evidenceMetadata } = require('../../../cli/collect-news-candidates');
const {
  resolveRaspberryPiLibcameraReleaseItems
} = require('../../../collect/raspberrypi-libcamera-releases');

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

test('#976 release_note_item의 네 근거 요구는 그대로다: 하나라도 빠지면 탈락한다', () => {
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

test('#976 점수 임계값도 그대로다: 네 근거가 다 있어도 score가 낮으면 탈락한다', () => {
  // 근거 요구와 점수 임계값은 별개의 레버다. 앞 테스트는 네 근거 요구만 잠그므로, score >= 30이
  // 느슨해지는 변경은 그쪽에 걸리지 않는다. 어휘를 넓히는 이 PR이 점수 쪽을 건드리지 않았음을
  // 여기서 따로 잠근다.
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    behavior_change: REVERT_RELEASE_BODY
  };
  const title = 'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817';

  const belowThreshold = evidenceMetadata(raw, RELEASE_SOURCE, title, '', 29, false);
  assert.equal(belowThreshold.evidence_score, 8, '네 근거가 다 있어 evidence_score는 만점이다');
  assert.equal(belowThreshold.source_gap_risk, false, '근거 쪽 위험은 없다');
  assert.equal(belowThreshold.main_eligible, false, 'score 29는 임계값 30에 못 미쳐 탈락한다');

  const atThreshold = evidenceMetadata(raw, RELEASE_SOURCE, title, '', 30, false);
  assert.equal(atThreshold.main_eligible, true, 'score 30은 임계값을 만족한다');
});

// #976 남은 절반: 아무 사실도 말하지 않는 수집기 템플릿 문장이 `release` 한 단어로 근거 게이트를
// 통과하던 문제다. 어휘를 좁히는 대신, 수집기가 `collector_template_sentence`로 "이 문장은 출처
// 본문이 아니라 수집기가 만든 템플릿"이라고 표식을 남기고 판정이 그 표식을 본다.
const TEMPLATE_SENTENCE = 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).';

// 본문 없는 릴리스는 summary도 같은 템플릿 문장이라, behavior_change만 비워서는 고쳐지지 않는다.
// 표식이 두 경로를 함께 막아야 한다.
test('#976 수집기 템플릿 문장만 가진 후보는 동작 변경 근거로 인정되지 않는다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v0.7.2+rpt20260817',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: TEMPLATE_SENTENCE,
    collector_template_sentence: TEMPLATE_SENTENCE
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    TEMPLATE_SENTENCE,
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, false);
  assert.equal(metadata.has_published_date, true);
  assert.equal(metadata.has_version_or_release, true);
  assert.equal(metadata.has_api_or_component, true);
  assert.equal(metadata.evidence_score, 6);
  assert.equal(metadata.source_gap_risk, true);
  assert.equal(metadata.main_eligible, false);
});

// GitHub 릴리스 이름은 자유 텍스트라 마침표가 들어갈 수 있다. 그러면 템플릿 문장이 두 문장으로
// 갈리고, summary에서 문장을 뽑는 칸에는 앞 조각만 온다. 표식을 문장 전체로만 비교하면 그 조각이
// 표식을 빠져나가 `fixes` 같은 어휘로 근거 없이 통과한다.
test('#976 릴리스 이름의 마침표로 템플릿이 갈려도 표식을 빠져나가지 못한다', () => {
  const tag = 'v0.8.0 - Big fixes. And more';
  const templateSentence = `Released ${tag} (Raspberry Pi downstream libcamera).`;
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: tag,
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: templateSentence,
    collector_template_sentence: templateSentence
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    `Raspberry Pi libcamera Releases - ${tag}`,
    templateSentence,
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, false, '갈린 조각도 템플릿 문장이다');
  assert.equal(metadata.main_eligible, false);
});

test('#976 표식이 있어도 출처 본문이 있으면 그 본문이 근거가 되어 main_eligible을 유지한다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v0.7.2+rpt20260817',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: TEMPLATE_SENTENCE,
    collector_template_sentence: TEMPLATE_SENTENCE
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    REVERT_RELEASE_BODY,
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, true);
  assert.equal(metadata.evidence_score, 8);
  assert.equal(metadata.source_gap_risk, false);
  assert.equal(metadata.main_eligible, true);
  // 보고되는 behavior_change 값은 그대로다. 이 PR은 판정만 바꾸고 본문을 이 필드에 싣지 않는다.
  assert.equal(metadata.behavior_change, TEMPLATE_SENTENCE);
});

test('#976 표식이 없는 후보의 판정은 그대로다: release 어휘를 좁히지 않았다', () => {
  // release 어휘는 정당하고 다른 소스가 쓴다. 표식 없는 같은 문장은 종전대로 통과한다.
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v0.7.2+rpt20260817',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: TEMPLATE_SENTENCE
  };
  const metadata = evidenceMetadata(raw, RELEASE_SOURCE, 'Some release note item', TEMPLATE_SENTENCE, 40, false);

  assert.equal(metadata.has_behavior_change, true);
  assert.equal(metadata.main_eligible, true);
});

// 수집기와 판정을 각각 따로 잠그면 표식 필드 이름이 어긋나도 양쪽 테스트가 다 통과한다. 실제 수집기
// 출력을 그대로 판정에 먹여 두 모듈이 같은 표식을 주고받는지 확인한다.
test('#976 수집기 출력을 그대로 먹였을 때 본문 유무가 자격을 가른다', () => {
  const atom = body => [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    '<updated>2026-08-17T10:00:00Z</updated>',
    '<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817"/>',
    '<title>v0.7.2+rpt20260817</title>',
    `<content type="html">${body}</content>`,
    '</entry>',
    '</feed>'
  ].join('');
  const collectorSource = { ...RELEASE_SOURCE, url: 'https://github.com/raspberrypi/libcamera/releases' };
  const evaluate = body => {
    const [item] = resolveRaspberryPiLibcameraReleaseItems(atom(body), collectorSource);
    return evidenceMetadata(item, collectorSource, item.title, item.summary, 40, false);
  };

  const withBody = evaluate('&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot; This reverts commit b7fa47f.&lt;/p&gt;');
  assert.equal(withBody.has_behavior_change, true, '릴리스 본문은 근거로 인정된다');
  assert.equal(withBody.main_eligible, true);

  const withoutBody = evaluate('No content.');
  assert.equal(withoutBody.has_behavior_change, false, '템플릿 문장뿐이면 근거가 없다');
  assert.equal(withoutBody.main_eligible, false);
});
