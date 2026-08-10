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

  const { editor: scrubbed } = scrubStaleClaims(editor, {
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
});

// 오탐 방지. 빠진 그룹과 렌더된 그룹이 어휘를 공유해도(둘 다 Sony 센서, 둘 다 V4L2)
// 공유 토큰으로 렌더된 기사 문장을 지우면 안 된다.
test('scrub keeps vocabulary shared between a dropped group and rendered ones', () => {
  const imx908 = section({
    headline: 'Sony IMX908 센서 V4L2 디바이스 트리 바인딩 패치',
    article_group_key: 'lore-series:imx908',
    sources: [source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')]
  });
  const editor = {
    date: '2026-08-10',
    summary: 'Sony 센서용 V4L2 드라이버 패치가 이번 주 미디어 서브시스템에 제안되었습니다.',
    briefing: [
      'Sony IMX908 V4L2 바인딩 패치가 공개되었습니다.',
      'V4L2 서브디바이스 계약을 검토할 시점입니다.',
      'Sony 센서 라인업 변화를 추적합니다.'
    ],
    action_items: ['Sony IMX908 바인딩을 핀맵과 대조한다.'],
    sections: [imx908],
    references: [source('https://lore.kernel.org/linux-media/imx908-v2', 'IMX908 bindings v2')]
  };
  const reporter = {
    candidates: [
      {
        title: '[PATCH v3 0/3] media: i2c: Add Sony imx576 V4L2 camera sensor driver',
        url: 'https://lore.kernel.org/linux-media/imx576-v3',
        article_group_key: 'lore-series:imx576',
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

  const { editor: scrubbed } = scrubStaleClaims(editor, {
    date: '2026-08-10',
    removedSections: [],
    reporter
  });

  const globalText = [scrubbed.summary, scrubbed.briefing, scrubbed.action_items].flat().join(' ');
  assert.doesNotMatch(globalText, /IMX576/i);
  assert.match(globalText, /Sony/i);
  assert.match(globalText, /V4L2/i);
  assert.match(globalText, /IMX908/i);
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
    summary: 'Sony IMX908 바인딩 패치가 공개되었습니다.',
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
      title: 'IMX908 bindings v2',
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
