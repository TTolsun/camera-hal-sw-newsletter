const assert = require('node:assert/strict');
const test = require('node:test');

const {
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../../quality/stale-claims');

function source(url, title) {
  return { url, title };
}

function section(overrides = {}) {
  return {
    category: 'Android Camera',
    headline: 'CameraX 1.5 release note',
    what_changed: 'CameraX 1.5.0 changed Android Camera compatibility behavior.',
    evidence_summary: 'Version: CameraX 1.5.0; API/component: CameraX.',
    action_items: ['Run Camera ITS before publishing.', 'Compare capture latency.'],
    article_sections: {
      verified_facts: ['CameraX 1.5.0 changed Android Camera compatibility behavior.'],
      background_context: 'CameraX affects camera2 compatibility validation.',
      hal_driver_impact: 'Validate request/result metadata and stream behavior.',
      action_items: ['Run Camera ITS before publishing.', 'Compare capture latency.'],
      team_share_points: 'Use CameraX as a compatibility signal.'
    },
    sources: [source('https://example.com/camerax', 'CameraX release note')],
    ...overrides
  };
}

test('stale scrub removes Android 17 Beta 4 claims after the section is removed', () => {
  const removedAndroid = section({
    headline: 'Android 17 Beta 4 reaches platform stability',
    version_or_release: 'Android 17 Beta 4',
    api_or_component: 'Android platform release',
    behavior_change: 'near-final compatibility environment',
    sources: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  });
  const finalSection = section({
    headline: 'CameraX 1.5 release note',
    sources: [source('https://example.com/camerax', 'CameraX release note')]
  });
  const editor = {
    date: '2026-05-05',
    summary: 'Android 17 Beta 4 is the main compatibility signal. CameraX remains selected.',
    briefing: [
      'Android 17 Beta 4 gives HAL teams a near-final platform target.',
      'CameraX 1.5 keeps compatibility validation concrete.',
      'Use final section sources only.'
    ],
    action_items: [
      'Check Android 17 Beta 4 behavior against Camera ITS.',
      'Run CameraX request/result regression tests.'
    ],
    sections: [finalSection],
    references: [
      source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4'),
      source('https://example.com/camerax', 'CameraX release note')
    ]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-05-05',
    removedSections: [removedAndroid]
  });

  const globalText = [
    scrubbed.summary,
    scrubbed.briefing,
    scrubbed.action_items,
    scrubbed.references
  ].flat().join(' ');
  assert.doesNotMatch(globalText, /Android 17 Beta 4/i);
  assert.equal(scrubbed.briefing.length, 3);
  assert.deepEqual(scrubbed.references, [source('https://example.com/camerax', 'CameraX release note')]);
  assert.equal(report.status, 'PASS');
  assert.equal(report.stale_claim_items_removed.length > 0, true);
  assert.equal(report.unused_references_removed.length, 1);
});

// W33(2026-08-10) 재현. imx576 패치 시리즈가 선정됐지만 editor가 한 번도 렌더하지 않았고,
// 그래서 removedSections(= 렌더된 적 있는 섹션에서 파생)에 들어가지 않아 스크럽이 못 봤다.
// 결과: summary/briefing/action_items에 'Sony IMX576'이 남아 fact-checker가 must_fix 3건을
// 냈고 호 전체가 diagnostics-only로 떨어졌다. 나머지 기사 4건은 발행 가능한 상태였다.
test('scrub removes claims from a selected group the editor never rendered', () => {
  const ar0234 = section({
    headline: 'Linux 커널에 onsemi AR0234 글로벌 셔터 CMOS 이미지 센서 드라이버 패치(v2) 제출',
    article_group_key: 'lore-series:ar0234',
    sources: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 driver v2')]
  });
  const imx908 = section({
    headline: 'Sony IMX908 8.39MP CMOS 센서를 위한 디바이스 트리 바인딩 패치(v2) 공개',
    article_group_key: 'lore-series:imx908',
    sources: [source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: '이번 주에는 Sony IMX576, onsemi AR0234, Sony IMX908 등 신규 이미지 센서 드라이버 패치가 제안되었습니다.',
    briefing: [
      'Sony IMX576(v3) 및 onsemi AR0234(v2) 글로벌 셔터 센서 드라이버 패치가 제출되었습니다.',
      'Sony IMX908 디바이스 트리 바인딩 패치 v2가 공개되었습니다.',
      'AR0234 드라이버는 최대 120fps 출력을 지원합니다.'
    ],
    action_items: [
      'Sony IMX576 및 onsemi AR0234 센서 도입 검토 시 제안된 드라이버 패치를 로컬 커널에 적용해 검증한다.',
      'Sony IMX908 바인딩 규격을 하드웨어 핀맵과 대조해 정합성을 확인한다.'
    ],
    sections: [ar0234, imx908],
    references: [
      source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 driver v2'),
      source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')
    ]
  };
  const reporter = {
    candidates: [
      {
        title: '[PATCH v3 0/3] media: i2c: Add imx576 camera sensor driver',
        url: 'https://lore.kernel.org/linux-media/20260806120216.24145-1-himanshu.bhavani@siliconsignals.io',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'AR0234 driver v2',
        url: 'https://lore.kernel.org/linux-media/ar0234-v2',
        article_group_key: 'lore-series:ar0234',
        final_selected: true
      },
      {
        title: 'IMX908 bindings v2',
        url: 'https://lore.kernel.org/linux-media/imx908-v2',
        article_group_key: 'lore-series:imx908',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [
    scrubbed.summary,
    scrubbed.briefing,
    scrubbed.action_items
  ].flat().join(' ');
  assert.doesNotMatch(globalText, /IMX576/i);
  // 렌더된 기사 이야기는 살아 있어야 한다. 통째로 비우는 것은 해결이 아니다.
  assert.match(globalText, /AR0234/i);
  assert.match(globalText, /IMX908/i);
  assert.equal(scrubbed.briefing.length, 3);
  // 이 변경의 목적은 발행 재개다. 텍스트만 지우고 보고서가 하드 실패로 남으면
  // W33과 같은 diagnostics-only가 그대로 재발한다.
  assert.deepEqual(report.hard_failures, []);
  assert.equal(report.status, 'PASS');
  assert.equal(report.stale_claim_items_removed.length > 0, true);
  // 어느 그룹 때문에 지웠는지 남아야 역추적된다.
  assert.deepEqual(
    report.dropped_selected_groups.map(group => group.article_group_key),
    ['lore-series:imx576']
  );
});

// 차집합이 실제로 작동하는지 본다. 공유 어휘를 모델명 형태로 두어야 의미가 있다 —
// 'sony'·'v4l2'는 모델명 형태가 아니라 애초에 키가 되지 못하므로, 그런 낱말로는
// 차집합을 제거해도 테스트가 통과해 버린다(공허한 테스트).
test('scrub keeps a model identifier that a surviving article also uses', () => {
  const rendered = section({
    headline: 'Qualcomm CAMSS 드라이버가 IMX577 센서를 지원한다',
    article_group_key: 'lore-series:camss',
    sources: [source('https://lore.kernel.org/linux-media/camss-v7', 'CAMSS v7')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'IMX577 지원이 CAMSS 드라이버에 들어왔습니다.',
    briefing: [
      'IMX577 센서 지원이 CAMSS v7 패치에 포함되었습니다.',
      'CSI-2 레인 구성을 확인할 시점입니다.',
      'RAW10 포맷 경로를 점검합니다.'
    ],
    action_items: ['IMX577 경로를 대표 기기에서 확인한다.'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/camss-v7', 'CAMSS v7')]
  };
  const reporter = {
    candidates: [
      {
        // 빠진 후보도 IMX577을 말한다. 살아남은 기사가 쓰는 낱말이므로 지우면 안 된다.
        title: 'Add imx576 and imx577 notes with CSI-2 RAW10 support',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'CAMSS v7',
        url: 'https://lore.kernel.org/linux-media/camss-v7',
        article_group_key: 'lore-series:camss',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  // globalText에 IMX577이 있는지만 보면 안 된다 — 폴백 summary와 대체 briefing이
  // section.headline을 다시 쓰기 때문에, 원문이 파괴돼도 그 단언은 통과한다.
  // 원문 문장이 그대로 살아 있는지를 본다.
  assert.equal(scrubbed.summary, 'IMX577 지원이 CAMSS 드라이버에 들어왔습니다.');
  assert.ok(scrubbed.briefing.includes('IMX577 센서 지원이 CAMSS v7 패치에 포함되었습니다.'));
  // 형식·인터페이스 어휘는 모델명 형태가 아니므로 삭제 키가 되지 못한다.
  assert.ok(scrubbed.briefing.includes('CSI-2 레인 구성을 확인할 시점입니다.'));
  assert.ok(scrubbed.briefing.includes('RAW10 포맷 경로를 점검합니다.'));
  assert.equal(report.stale_claim_items_removed.length, 0);
});

// V4L2 미디어버스 포맷도 RAW10과 같은 부류다. 목록이 아니라 접두사 규칙으로 막는지 본다.
test('scrub keeps V4L2 mediabus format vocabulary out of the deletion keys', () => {
  const rendered = section({
    headline: 'AR0234 드라이버가 병합되었다',
    article_group_key: 'lore-series:ar0234',
    sources: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'SBGGR10 포맷 경로가 정리되었습니다.',
    briefing: ['SBGGR10 경로 정리', 'SRGGB12 지원 확인', 'AR0234 병합'],
    action_items: ['SBGGR10 경로를 점검한다.'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  };
  const reporter = {
    candidates: [
      {
        title: 'Add imx576 sensor with SBGGR10 and SRGGB12 support',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'AR0234 v2',
        url: 'https://lore.kernel.org/linux-media/ar0234-v2',
        article_group_key: 'lore-series:ar0234',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  assert.equal(scrubbed.summary, 'SBGGR10 포맷 경로가 정리되었습니다.');
  assert.ok(scrubbed.briefing.includes('SRGGB12 지원 확인'));
});

// 정본 짝짓기(source_candidate_hash·모든 source URL)가 죽으면 patchwork 계열 그룹이
// dropped로 오분류돼 참인 문장이 조용히 상투구로 바뀐다. QA가 실측 재현한 회귀다.
test('scrub matches a rendered group through the canonical candidate index', () => {
  const rendered = section({
    headline: 'Qualcomm CAMSS 리뷰 시리즈',
    source_candidate_hash: 'hash-camss-v7',
    sources: [source('https://patchwork.kernel.org/series/999/', 'CAMSS series')]
  });
  delete rendered.article_group_key;
  const editor = {
    date: '2026-08-10',
    summary: 'IMX800 지원이 CAMSS 시리즈에 포함되었습니다.',
    briefing: ['IMX800 경로가 열렸습니다.', '두 번째 항목', '세 번째 항목'],
    action_items: ['IMX800 경로를 확인한다.'],
    sections: [rendered],
    references: [source('https://patchwork.kernel.org/series/999/', 'CAMSS series')]
  };
  const reporter = {
    candidates: [{
      title: 'CAMSS review series with IMX800 support',
      url: 'https://patchwork.kernel.org/series/999/',
      source_candidate_hash: 'hash-camss-v7',
      seriesId: 999,
      article_group_key: 'patchwork-series:999',
      final_selected: true
    }]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  assert.deepEqual(report.dropped_selected_groups, []);
  assert.equal(scrubbed.summary, 'IMX800 지원이 CAMSS 시리즈에 포함되었습니다.');
  assert.ok(scrubbed.briefing.includes('IMX800 경로가 열렸습니다.'));
});

// primary_selected만 붙은 그룹도 선정 집합이다. 2플래그로 되돌리면 이 테스트가 실패한다.
test('scrub treats a primary_selected-only group as selected', () => {
  const rendered = section({
    headline: 'AR0234 드라이버',
    article_group_key: 'lore-series:ar0234',
    sources: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'IMX576 이야기와 AR0234 이야기가 함께 실렸습니다.',
    briefing: ['IMX576 항목', 'AR0234 항목', '세 번째 항목'],
    action_items: ['AR0234 확인'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  };
  const reporter = {
    candidates: [
      {
        title: 'Add imx576 sensor driver',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        primary_selected: true
      },
      {
        title: 'AR0234 v2',
        url: 'https://lore.kernel.org/linux-media/ar0234-v2',
        article_group_key: 'lore-series:ar0234',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [scrubbed.summary, scrubbed.briefing].flat().join(' ');
  assert.doesNotMatch(globalText, /IMX576/i);
});

// 붙여 쓴 언급을 놓치면 이 변경이 잡으려던 잔재가 그대로 남는다.
test('scrub catches a dropped model identifier written as a compound word', () => {
  const rendered = section({
    headline: 'AR0234 글로벌 셔터 드라이버',
    article_group_key: 'lore-series:ar0234',
    sources: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'IMX576-based 센서 모듈과 AR0234 드라이버가 함께 논의되었습니다.',
    briefing: [
      'IMX576-based 모듈 평가가 진행 중입니다.',
      'AR0234 드라이버가 제출되었습니다.',
      '글로벌 셔터 경로를 점검합니다.'
    ],
    action_items: ['AR0234 경로를 확인한다.'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  };
  const reporter = {
    candidates: [
      {
        title: 'media: i2c: Add imx576 camera sensor driver',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'AR0234 v2',
        url: 'https://lore.kernel.org/linux-media/ar0234-v2',
        article_group_key: 'lore-series:ar0234',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [scrubbed.summary, scrubbed.briefing, scrubbed.action_items].flat().join(' ');
  assert.doesNotMatch(globalText, /IMX576/i);
  assert.match(globalText, /AR0234/i);
});

// 접두사 오탐 방지. 낱말 단위 대조를 부분 문자열로 되돌리면 이 테스트가 실패해야 한다.
test('scrub does not treat a dropped identifier as a prefix of a surviving one', () => {
  const rendered = section({
    headline: 'IMX5766 센서 드라이버가 병합되었다',
    article_group_key: 'lore-series:imx5766',
    sources: [source('https://lore.kernel.org/linux-media/imx5766', 'IMX5766')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'IMX5766 드라이버가 병합되었습니다.',
    briefing: ['IMX5766 경로가 열렸습니다.', '두 번째 항목', '세 번째 항목'],
    action_items: ['IMX5766 경로를 확인한다.'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/imx5766', 'IMX5766')]
  };
  const reporter = {
    candidates: [
      {
        title: 'Add imx576 sensor driver',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'IMX5766',
        url: 'https://lore.kernel.org/linux-media/imx5766',
        article_group_key: 'lore-series:imx5766',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [scrubbed.summary, scrubbed.briefing, scrubbed.action_items].flat().join(' ');
  assert.match(globalText, /IMX5766/i);
  assert.equal(scrubbed.briefing.length, 3);
});

// 얇은 주 보호. briefing을 3개로 못 채우면 finalize의 briefing 개수 계약이 예외를 던져
// 산출물조차 남지 않는다. 잔재를 남겨 발행이 막히는 편이 낫다 — 그쪽은 진단이 남는다.
test('scrub keeps the briefing count contract when replacements cannot fill it', () => {
  const rendered = section({
    headline: 'AR0234 글로벌 셔터 드라이버',
    article_group_key: 'lore-series:ar0234',
    sources: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'IMX576 이야기입니다.',
    briefing: ['IMX576 항목 하나', 'IMX576 항목 둘', 'IMX576 항목 셋'],
    action_items: ['IMX576 확인'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/ar0234-v2', 'AR0234 v2')]
  };
  const reporter = {
    candidates: [
      {
        title: 'Add imx576 sensor driver',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
        final_selected: true
      },
      {
        title: 'AR0234 v2',
        url: 'https://lore.kernel.org/linux-media/ar0234-v2',
        article_group_key: 'lore-series:ar0234',
        final_selected: true
      }
    ]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  assert.equal(scrubbed.briefing.length, 3);
  assert.equal(report.restored_to_keep_minimum.length > 0, true);
  // 되돌린 항목을 "지웠다"고 보고하면 안 된다.
  assert.equal(
    report.stale_claim_items_removed.some(item => item.action === 'restored-to-keep-minimum'),
    false
  );
});

// 섹션이 article_group_key를 안 들고 있어도 살아남은 기사가 "빠진 것"으로 세어지면 안 된다.
// 한쪽 키만 보면 렌더된 기사의 문장까지 지워진다.
test('scrub matches rendered groups even when sections carry no explicit group key', () => {
  const rendered = section({
    headline: 'Sony IMX908 디바이스 트리 바인딩 패치(v2) 공개',
    sources: [source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')]
  });
  delete rendered.article_group_key;
  const editor = {
    date: '2026-08-10',
    summary: 'Sony IMX908 바인딩 패치와 HM1092 동반 노트가 공개되었습니다.',
    briefing: [
      'Sony IMX908 바인딩 패치 v2가 공개되었습니다.',
      'RAW10/RAW12 포맷 지원이 명시되었습니다.',
      'MIPI CSI-2 레인 구성을 확인할 시점입니다.'
    ],
    action_items: ['Sony IMX908 바인딩을 하드웨어 핀맵과 대조한다.'],
    sections: [rendered],
    references: [source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')]
  };
  const reporter = {
    candidates: [{
      // 후보 제목에만 있는 모델명(HM1092)을 넣는다. 섹션↔후보 짝짓기가 깨지면 이 후보가
      // "빠진 것"으로 분류되고 hm1092가 삭제 키가 되어 아래 단언이 실패한다.
      title: 'IMX908 bindings v2 with HM1092 companion notes',
      url: 'https://lore.kernel.org/linux-media/imx908-v2',
      final_selected: true
    }]
  };

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [scrubbed.summary, scrubbed.briefing, scrubbed.action_items].flat().join(' ');
  assert.match(globalText, /IMX908/i);
  assert.match(globalText, /HM1092/i);
  assert.equal(scrubbed.briefing.length, 3);
});

test('release claim with final section source evidence is retained', () => {
  const finalSection = section({
    headline: 'Android 17 Beta 4 reaches platform stability',
    version_or_release: 'Android 17 Beta 4',
    evidence_summary: 'Version: Android 17 Beta 4; official Android Developers Blog source.',
    sources: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  });
  const editor = {
    date: '2026-05-05',
    summary: 'Android 17 Beta 4 remains a sourced compatibility item.',
    briefing: [
      'Android 17 Beta 4 remains selected because the final section cites it.',
      'Camera teams should compare metadata regressions.',
      'Keep references aligned to final sections.'
    ],
    action_items: ['Review Android 17 Beta 4 source evidence.'],
    sections: [finalSection],
    references: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-05-05',
    removedSections: []
  });

  assert.match(scrubbed.summary, /Android 17 Beta 4/);
  assert.match(scrubbed.briefing.join(' '), /Android 17 Beta 4/);
  assert.equal(report.stale_claim_items_removed.length, 0);
  assert.equal(report.unsupported_release_claims_removed.length, 0);
  assert.equal(report.retained_release_claims.some(item => item.claim === 'Android 17 Beta 4'), true);
});

test('resolved stale fact-check items are pruned after scrub removes the claim', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'briefing',
      problem: 'Android 17 Beta 4 is unsupported after demotion.',
      suggestion: 'Remove it.',
      source_url: ''
    }],
    recommended_fixes: ['Remove Android 17 Beta 4 from action items.'],
    source_gaps: ['Android 17 Beta 4 lacks final source evidence.'],
    source_gap_count: 1,
    final_comment: ''
  };
  const staleReport = {
    stale_claim_items_removed: [{
      stale_claims: ['Android 17 Beta 4'],
      unsupported_release_claims: []
    }],
    unsupported_release_claims_removed: []
  };
  const pruned = pruneResolvedStaleFactCheckItems(factCheck, staleReport);
  assert.equal(pruned.status, 'PASS');
  assert.deepEqual(pruned.must_fix, []);
  assert.deepEqual(pruned.recommended_fixes, []);
  assert.deepEqual(pruned.source_gaps, []);
  assert.equal(pruned.source_gap_count, 0);
});

test('removed-section claim reused by a surviving section source is not a stale orphan', () => {
  const playlistUrl = 'https://youtube.com/playlist?list=ABC';
  const playlistTitle = 'Supercharge your media pipeline at Google I/O';
  const survivingSection = {
    headline: 'Adaptive camera preview with CameraX and Media3',
    category: 'direct_aosp_camera',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX',
    behavior_change: 'media pipeline integration',
    confirmed_facts: ['CameraX 1.6.1 integrates Media3.'],
    article_sections: { verified_facts: ['CameraX 1.6.1 integrates Media3.'], background_context: 'x', hal_driver_impact: 'x', action_items: ['Check streams.'], team_share_points: 'x' },
    sources: [source(playlistUrl, playlistTitle)]
  };
  const editor = {
    date: '2026-06-03',
    summary: 'Adaptive camera preview with CameraX and Media3.',
    briefing: ['CameraX 1.6.1 integrates Media3.', 'Adaptive preview improves.', 'Check capture streams.'],
    action_items: ['Validate capture streams within 2 weeks.'],
    sections: [survivingSection],
    references: [source(playlistUrl, playlistTitle)]
  };
  // The same playlist source was on a removed earlier section, so it lands in removedClaimKeys,
  // but the surviving section legitimately re-uses it -> must NOT be a hard failure.
  const result = scrubStaleClaims(editor, { date: '2026-06-03', reporter: { candidates: [] }, removedSections: [survivingSection] });
  assert.equal(result.report.hard_failures.length, 0);
});
