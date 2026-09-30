'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { evidenceMetadata, normalizeCandidate } = require('../../../cli/collect-news-candidates');
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
  // 보고 값은 raw 가 준 것 그대로다. 판정이 표식을 보고 summary 로 넘어가더라도 이 칸을
  // 고쳐 쓰지는 않는다. (수집기가 무엇을 이 칸에 싣는지는 별개 층이고, 아래 수집기 테스트가 잰다.)
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

// #976 회피 경로: 표식과 게이트가 읽는 값이 서로 다른 정규화를 거치던 문제다. 표식은 수집기 pick()이
// decodeHtml을 한 번 걸어 만든 문장이고, 게이트가 읽는 summary는 normalizeCandidate가 decode()
// (decodeHtml + 태그 구간 제거)를 다시 걸고 500자로 자른 값이다. 그래서 릴리스 이름에 꺾쇠가 있거나
// 이름이 길면 게이트가 읽는 문장이 표식과 달라지고, 잘리거나 변형된 조각이 `Released` 한 낱말로
// 게이트를 통과했다. 이 회피는 normalizeCandidate를 거쳐야 재현되므로 evidenceMetadata 단독이 아니라
// 수집기 → normalizeCandidate 전 경로를 먹인다.
//
// GitHub 릴리스 이름은 자유 텍스트이고 `<...>`도 합법이다. 지금 라이브가 안전한 것은 Raspberry Pi가
// 우연히 `v0.x.y+rptYYYYMMDD` 형태만 쓰기 때문이지 구조가 막아서가 아니다.
const NORMALIZATION_BYPASS_TAGS = [
  // 게이트의 decode()가 태그 구간으로 보고 지운다.
  ['꺾쇠', 'v1.0 &lt;experimental&gt;'],
  // atom에서 이중 escape로 들어와 decode 한 겹이 더 벗겨진다.
  ['이중 escape', 'v1.0 &amp;lt;beta&amp;gt;'],
  // normalizeCandidate의 500자 상한이 문장 뒤를 자른다.
  ['500자 초과', `v1.0 ${'x'.repeat(500)}`]
];

// 이름이 어떻게 변형되든 본문이 없으면(`No content.`) 근거는 0이다.
for (const [label, titleXml] of NORMALIZATION_BYPASS_TAGS) {
  test(`#976 ${label} 릴리스 이름이 표식 정규화를 빠져나가지 못한다`, () => {
    const atom = [
      '<feed xmlns="http://www.w3.org/2005/Atom">',
      '<entry>',
      '<updated>2026-08-17T10:00:00Z</updated>',
      '<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/x"/>',
      `<title>${titleXml}</title>`,
      '<content type="html">No content.</content>',
      '</entry>',
      '</feed>'
    ].join('');
    const collectorSource = {
      ...RELEASE_SOURCE,
      url: 'https://github.com/raspberrypi/libcamera/releases',
      sourceUrl: 'https://github.com/raspberrypi/libcamera/releases',
      section: 'Kernel / Media',
      keywords: ['libcamera']
    };
    const [item] = resolveRaspberryPiLibcameraReleaseItems(atom, collectorSource);
    const normalized = normalizeCandidate(item);

    assert.equal(normalized.has_behavior_change, false, '본문이 없으면 동작 변경 근거가 없다');
    assert.equal(normalized.main_eligible, false);
  });
}

// #1076: #976이 막은 것은 수집기 템플릿 "문장"뿐이고, title 폴백 경로는 그대로 열려 있었다.
// summary가 비면 `firstBehavior(summary || title)`가 title을 근거로 쓰는데, 그 title은 수집기가
// `${source.name} - ${tag}` 형태로 조립한 값이다. 그래서 소스 이름에 든 낱말이 어휘 패턴에 걸려
// 아무 사실도 말하지 않는 후보에 근거를 준다. 등록부 73개 소스 중 19개 이름이 그 패턴에 걸린다
// (`Releases`·`Security`·`Updates`·`Compatibility`·`API`…).
test('#1076 소스 이름 접두부만 든 title은 동작 변경 근거가 되지 못한다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v1.0.0',
    api_or_component: 'libcamera / V4L2 camera pipeline'
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    // 소스 이름의 `Releases`가 BEHAVIOR_CHANGE_PATTERN의 `release(?:d|s)?`에 걸린다.
    `${RELEASE_SOURCE.name} - v1.0.0`,
    '',
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, false, '수집기가 붙인 소스 이름은 근거가 아니다');
  assert.equal(metadata.has_published_date, true);
  assert.equal(metadata.has_version_or_release, true);
  assert.equal(metadata.has_api_or_component, true);
  assert.equal(metadata.evidence_score, 6);
  assert.equal(metadata.source_gap_risk, true);
  assert.equal(metadata.main_eligible, false);
});

// 이슈 재현: 릴리스 본문이 꺾쇠 리터럴 한 덩어리면 수집기는 본문이 있다고 보고 summary를 만들지만,
// normalizeCandidate의 decode()가 그것을 태그 구간으로 보고 지워 summary가 빈 문자열이 된다.
// 그러면 판정이 title로 폴백해 소스 이름이 근거를 대신 댄다.
test('#1076 decode로 summary가 비어도 소스 이름이 근거를 대신 대지 않는다', () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry>',
    '<updated>2026-08-17T10:00:00Z</updated>',
    '<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/v1.0.0"/>',
    '<title>v1.0.0</title>',
    // 본문 전체가 꺾쇠 리터럴 한 덩어리다(라이브에서는 `<naush@raspberrypi.com>` 한 줄인 경우).
    '<content type="html">&amp;lt;fix&amp;gt;</content>',
    '</entry>',
    '</feed>'
  ].join('');
  const collectorSource = {
    ...RELEASE_SOURCE,
    url: 'https://github.com/raspberrypi/libcamera/releases',
    sourceUrl: 'https://github.com/raspberrypi/libcamera/releases',
    section: 'Kernel / Media',
    keywords: ['libcamera']
  };
  const [item] = resolveRaspberryPiLibcameraReleaseItems(atom, collectorSource);
  const normalized = normalizeCandidate(item);

  assert.equal(normalized.has_behavior_change, false, '아무 사실도 말하지 않는 후보다');
  assert.equal(normalized.main_eligible, false);
});

// 떼는 것은 수집기가 붙인 접두부뿐이다. 제목의 나머지가 실제 변경을 서술하면 폴백은 그대로 산다.
test('#1076 접두부만 떼고 제목의 나머지는 근거로 그대로 남는다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v1.0.0',
    api_or_component: 'libcamera / V4L2 camera pipeline'
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    `${RELEASE_SOURCE.name} - v1.0.0 adds Mali-C55 pipeline handler support`,
    '',
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, true, '제목 나머지가 서술하는 변경은 근거다');
  assert.equal(metadata.evidence_score, 8);
  assert.equal(metadata.main_eligible, true);
});

// 수집기 접두부가 없는 소스의 title 폴백은 손대지 않았다.
test('#1076 수집기 접두부가 없는 title의 폴백은 그대로다', () => {
  const raw = {
    sourceKind: 'release_note_item',
    publishedAt: '2026-08-17',
    version_or_release: 'v1.0.0',
    api_or_component: 'libcamera / V4L2 camera pipeline'
  };
  const metadata = evidenceMetadata(
    raw,
    RELEASE_SOURCE,
    'libcamera v1.0.0 fixes sensor mode configuration',
    '',
    40,
    false
  );

  assert.equal(metadata.has_behavior_change, true);
  assert.equal(metadata.evidence_score, 8);
  assert.equal(metadata.main_eligible, true);
});

// #976 마지막 결정 항목: 표식이 생겼으므로 behavior_change 에도 본문을 싣는다. article-capsules 가
// 이 필드를 what_changed 후보로 읽어 capsule 근거로 넘기기 때문이다. 본문이 없으면 이 필드는
// 여전히 템플릿 문장이고, 표식이 그것을 동작변경 근거에서 걸러 낸다 — 순서 제약이 그대로다.
test('#976 수집기는 본문이 있으면 behavior_change 에도 본문을 싣는다', () => {
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
  const templateSentence = 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).';

  const [withBody] = resolveRaspberryPiLibcameraReleaseItems(
    atom('&lt;p&gt;Revert &quot;ipa: rpi: imx296: Enable embedded data&quot; This reverts commit b7fa47f.&lt;/p&gt;'),
    collectorSource
  );
  assert.match(withBody.behavior_change, /imx296/, '본문이 있으면 behavior_change 는 본문이다');
  assert.equal(withBody.collector_template_sentence, templateSentence, '표식은 템플릿 문장 그대로다');

  const [withoutBody] = resolveRaspberryPiLibcameraReleaseItems(atom('No content.'), collectorSource);
  assert.equal(withoutBody.behavior_change, templateSentence, '본문이 없으면 종전처럼 템플릿이다');
  // 그 템플릿이 자격을 주지 않는다는 것은 바로 위 '본문 유무가 자격을 가른다' 테스트가 잰다.
});

// #976: behavior_change 와 summary 는 같은 문장이 흘러오는 두 칸이라 같은 정규화를 거쳐야 한다.
// 수집기가 본문을 behavior_change 에도 싣게 되면서, 마크업 한 덩어리인 본문이 summary 쪽에서는
// 지워지고 raw 필드 쪽에서는 남는 비대칭이 그대로 회피 경로가 됐다. `<fix>` 는 정규화 후 아무
// 말도 남지 않는데 `fix` 한 낱말로 게이트를 통과했다.
test('#976 마크업만 든 behavior_change 는 정규화 뒤 근거가 되지 못한다', () => {
  const base = {
    source: {
      ...RELEASE_SOURCE,
      url: 'https://github.com/raspberrypi/libcamera/releases',
      sourceUrl: 'https://github.com/raspberrypi/libcamera/releases',
      section: 'Camera Driver / V4L2',
      keywords: ['libcamera', 'camera']
    },
    title: 'Raspberry Pi libcamera Releases - v1.0.0',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v1.0.0',
    publishedAt: '2026-08-17T10:00:00Z',
    sourceKind: 'release_note_item',
    version_or_release: 'v1.0.0',
    api_or_component: 'libcamera / V4L2 camera pipeline'
  };

  const markupOnly = normalizeCandidate({ ...base, summary: '<fix>', behavior_change: '<fix>' });
  assert.equal(markupOnly.has_behavior_change, false, '마크업만 남은 문장은 사실을 말하지 않는다');

  // 대조: 같은 자리에 실제 문장이 오면 근거가 된다. 이 확인이 없으면 위 단언은 정규화가 모든
  // behavior_change 를 지워도 통과한다.
  const realSentence = normalizeCandidate({
    ...base,
    summary: 'Fixed the imx296 embedded data negotiation with the CFE.',
    behavior_change: 'Fixed the imx296 embedded data negotiation with the CFE.'
  });
  assert.equal(realSentence.has_behavior_change, true, '실제 문장은 그대로 근거가 된다');
});

// 길이 상한도 두 칸이 같아야 한다. 상한이 갈리면 긴 본문에서 표식·게이트가 서로 다른 조각을
// 보게 되고, 그것이 PR #1075가 두 번 뚫린 그 뿌리다.
test('#976 긴 본문도 summary 와 behavior_change 가 같은 지점에서 잘린다', () => {
  const longBody = `Fixed the imx296 embedded data negotiation with the CFE. ${'x'.repeat(600)}`;
  const normalized = normalizeCandidate({
    source: {
      ...RELEASE_SOURCE,
      url: 'https://github.com/raspberrypi/libcamera/releases',
      sourceUrl: 'https://github.com/raspberrypi/libcamera/releases',
      section: 'Camera Driver / V4L2',
      keywords: ['libcamera', 'camera']
    },
    title: 'Raspberry Pi libcamera Releases - v1.0.0',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v1.0.0',
    publishedAt: '2026-08-17T10:00:00Z',
    sourceKind: 'release_note_item',
    version_or_release: 'v1.0.0',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    summary: longBody,
    behavior_change: longBody
  });

  // 전제: 입력이 상한을 실제로 넘어야 이 비교가 상한을 재는 것이 된다.
  assert.ok(longBody.length > 500, 'fixture must exceed the cut');
  assert.equal(normalized.summary.length, 500);
  assert.equal(normalized.behavior_change.length, 500);
  assert.equal(normalized.behavior_change, normalized.summary, '두 칸은 같은 조각이어야 한다');
});
