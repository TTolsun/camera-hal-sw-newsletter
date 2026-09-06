'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  salvagePublishableSubset
} = require('../../quality/newsletter-quality');
const { scrubStaleClaims } = require('../../quality/stale-claims');
const {
  scopedCandidate,
  section
} = require('../../../shared/test/helpers/quality-builders');

const DATE = '2026-06-03';

function publishable(index, reason = 'Useful to a Camera HAL SW engineer.') {
  return { section_index: index, publishable: true, reason };
}

function buildInputs(sections, candidates, factCheckOverrides = {}) {
  const editor = { briefing: ['one', 'two', 'three'], sections };
  const reporter = { candidates };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: sections.map((_, index) => publishable(index)),
    ...factCheckOverrides
  };
  return { editor, reporter, factCheck };
}

test('salvage drops a failed article and publishes the clean subset', () => {
  const clean = section({ headline: 'CameraX 1.7.0-alpha01 SessionConfig API', url: 'https://example.com/clean' });
  const broken = section({ headline: 'Broken source article', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'a clean single-article subset should be salvageable');
  assert.equal(salvage.kept_section_count, 1);
  assert.equal(salvage.dropped_section_count, 1);
  assert.equal(salvage.qualityReport.status, 'PASS');
  assert.equal(salvage.editor.sections.length, 1);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
});

test('salvage drops an article the fact-checker marked not publishable', () => {
  const clean = section({ headline: 'CameraX clean article', url: 'https://example.com/clean' });
  const stale = section({ headline: 'Stale catch-up article', url: 'https://example.com/stale' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, stale],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('https://example.com/stale', 'direct_aosp_camera')],
    { article_quality: [publishable(0), { section_index: 1, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage);
  assert.equal(salvage.editor.sections.length, 1);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
  assert.equal(salvage.qualityReport.status, 'PASS');
});

test('salvage prunes must_fix that references only the dropped section', () => {
  const clean = section({ headline: 'CameraX clean article', url: 'https://example.com/clean' });
  const broken = section({ headline: 'Broken source article', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')],
    { status: 'NEEDS_FIX', must_fix: [{ location: 'sections[1].public_article.lead', problem: 'unsupported claim' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'dropping the section the must_fix points to should clear the blocker');
  assert.equal(salvage.factCheck.must_fix.length, 0);
  assert.equal(salvage.factCheck.status, 'PASS');
});

test('salvage prunes a source_gap that names a dropped section by a variant headline', () => {
  const clean = section({ headline: 'CameraX 1.7.0-alpha01 SessionConfig API', url: 'https://example.com/clean' });
  const broken = section({ headline: '[지난 소식] CameraX 1.6.0 정식 출시 (10주 전 릴리스)', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')],
    // The gap names the dropped section with a slightly different headline than editor.sections[1].
    { source_gaps: ['Reporter eligibility violation; section="CameraX 1.6.0 정식 출시"'], source_gap_count: 1 }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'a gap on the dropped section must not block the clean subset');
  assert.equal(salvage.factCheck.source_gaps.length, 0);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
  assert.equal(salvage.qualityReport.status, 'PASS');
});

test('salvage returns null when no clean subset meets the minimum article count', () => {
  const brokenA = section({ headline: 'Broken A', url: 'invalid-url-a-no-scheme' });
  const brokenB = section({ headline: 'Broken B', url: 'invalid-url-b-no-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [brokenA, brokenB],
    [scopedCandidate('invalid-url-a-no-scheme', 'direct_aosp_camera'), scopedCandidate('invalid-url-b-no-scheme', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.equal(salvage, null);
});

// #628: editor repair가 약한 섹션 하나에서 실패(stable identity drift 등)해도, repair 이전의
// 유효 draft에서 그 섹션만 demote하고 강한 카메라 메인은 발행되어야 한다. 실제 사례 형태:
// CameraX 1.6.1(direct_aosp_camera) + atomisp 드라이버 패치(soc_platform_signal)는 통과,
// 주변부 productivity 글(android)만 비발행. orchestrator의 repair
// catch가 이 salvagePublishableSubset을 호출하므로 그 메커니즘이 이 형태를 처리해야 한다.
test('#628: repair-failure 형태 — 강한 카메라 메인 2개는 발행, 약한 섹션만 demote', () => {
  const strongA = section({ headline: 'CameraX SessionConfig API', url: 'https://example.com/camerax' });
  const strongB = section({ headline: 'Camera driver memory-leak fix', url: 'https://example.com/driver' });
  const weak = section({ headline: 'Camera-adjacent productivity note', url: 'https://example.com/adjacent' });
  const { editor, reporter, factCheck } = buildInputs(
    [strongA, strongB, weak],
    [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera'),
      scopedCandidate('https://example.com/driver', 'soc_platform_signal'),
      scopedCandidate('https://example.com/adjacent', 'android')
    ],
    { article_quality: [publishable(0), publishable(1), { section_index: 2, publishable: false, reason: 'Camera-adjacent productivity note; no concrete HAL value.' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, '약한 섹션 하나가 실패해도 강한 카메라 메인 2개는 살아남아야 한다');
  assert.equal(salvage.kept_section_count, 2);
  assert.equal(salvage.dropped_section_count, 1);
  assert.equal(salvage.qualityReport.status, 'PASS');
  assert.deepEqual(salvage.editor.sections.map(item => item.headline), [strongA.headline, strongB.headline]);
});

test('salvage returns null when the full lineup already passes (nothing to drop)', () => {
  const cleanA = section({ headline: 'CameraX clean A', url: 'https://example.com/a' });
  const cleanB = section({ headline: 'CameraX clean B', url: 'https://example.com/b' });
  const { editor, reporter, factCheck } = buildInputs(
    [cleanA, cleanB],
    [scopedCandidate('https://example.com/a', 'direct_aosp_camera'), scopedCandidate('https://example.com/b', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'PASS');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.equal(salvage, null);
});

// #869: salvage가 기사를 떨어뜨려도 이슈 레벨 텍스트(summary/briefing/action_items)는
// 그대로 남아, 발행본이 이미 사라진 기사를 계속 가리킨다. 호출자 쪽 스크럽은 salvage보다
// 앞서 돌아 이 drop을 못 보므로 salvage 안쪽에서 다시 스크럽해야 한다.
const DROPPED_ARTICLE_HEADLINE = 'Legacy imx576 sensor driver rework lands in staging';

function salvageInputsWithIssueLevelText({ summary, briefing, action_items }) {
  const keptA = section({ headline: 'CameraX SessionConfig API', url: 'https://example.com/camerax' });
  const keptB = section({ headline: 'Camera driver memory-leak fix', url: 'https://example.com/driver' });
  const dropped = section({ headline: DROPPED_ARTICLE_HEADLINE, url: 'https://example.com/imx576' });
  const editor = {
    summary,
    briefing,
    action_items,
    sections: [keptA, keptB, dropped]
  };
  const reporter = {
    candidates: [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera', { final_selected: true, title: keptA.headline }),
      scopedCandidate('https://example.com/driver', 'camera_driver_image_pipeline', { final_selected: true, title: keptB.headline }),
      scopedCandidate('https://example.com/imx576', 'direct_aosp_camera', { final_selected: true, title: DROPPED_ARTICLE_HEADLINE })
    ]
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: [
      publishable(0),
      publishable(1),
      { section_index: 2, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }
    ]
  };
  return { editor, reporter, factCheck };
}

test('#869: salvage가 떨어뜨린 기사 언급을 이슈 레벨 텍스트에서 지운다', () => {
  const { editor, reporter, factCheck } = salvageInputsWithIssueLevelText({
    summary: '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다. imx576 센서 드라이버 재작업도 함께 살펴본다.',
    briefing: [
      '스트림 조합 회귀를 확인한다.',
      '버퍼 누수 재현 경로를 확인한다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ],
    action_items: [
      'imx576 센서 드라이버 담당자를 지정해 2주 내 검증 항목을 재확인한다.',
      '스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.'
    ]
  });

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, '깨끗한 기사 2건은 발행 가능해야 한다');
  assert.equal(salvage.dropped_section_count, 1);
  assert.equal(salvage.qualityReport.status, 'PASS');

  const publishedText = [
    salvage.editor.summary,
    ...salvage.editor.briefing,
    ...salvage.editor.action_items
  ].join(' ');
  assert.ok(
    !publishedText.includes('imx576'),
    `떨어뜨린 기사 언급이 이슈 레벨 텍스트에 남았다: ${publishedText}`
  );

  // 무엇을 왜 지웠는지는 salvage가 돌려주는 stale-claim report에 남아야 한다.
  const removedFields = salvage.staleClaimReport.stale_claim_items_removed.map(item => item.field);
  assert.deepEqual([...new Set(removedFields)].sort(), ['action_items', 'briefing', 'summary']);
  assert.deepEqual(
    salvage.staleClaimReport.removed_sections.map(item => item.headline),
    [DROPPED_ARTICLE_HEADLINE]
  );
  assert.equal(salvage.staleClaimReport.status, 'PASS');
});

test('#869: 이슈 레벨 텍스트가 떨어뜨린 기사를 가리키지 않으면 한 글자도 바뀌지 않는다', () => {
  const summary = '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다.';
  const briefing = [
    '스트림 조합 회귀를 확인한다.',
    '버퍼 누수 재현 경로를 확인한다.',
    '메타데이터 일관성 로그를 확인한다.'
  ];
  const actionItems = ['스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.'];
  const { editor, reporter, factCheck } = salvageInputsWithIssueLevelText({
    summary,
    briefing,
    action_items: actionItems
  });

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage);
  assert.equal(salvage.editor.summary, summary);
  assert.deepEqual(salvage.editor.briefing, briefing);
  assert.deepEqual(salvage.editor.action_items, actionItems);
  assert.deepEqual(salvage.staleClaimReport.stale_claim_items_removed, []);
  // 입력 editor는 그대로다.
  assert.equal(editor.summary, summary);
  assert.deepEqual(editor.briefing, briefing);
  assert.deepEqual(editor.action_items, actionItems);
  assert.equal(editor.sections.length, 3);
});

// salvage 안에서 subset 게이트가 어떤 이유로 막혔는지 읽는다. salvage는 null만 돌려주므로
// 사유를 단정하지 않으면 다른 blocker가 대신 막아도 테스트가 통과한다.
function salvageWithBlockerReasons(date, editor, reporter, factCheck, report, options = {}) {
  const lines = [];
  const original = console.log;
  console.log = message => lines.push(String(message));
  try {
    const salvage = salvagePublishableSubset(date, editor, reporter, factCheck, report, {
      ...options,
      salvageDebug: true
    });
    const regate = lines.find(line => line.includes('subset re-gate NEEDS_FIX'));
    return { salvage, blockers: regate ? regate.split('blockers=')[1] : null };
  } finally {
    console.log = original;
  }
}

// 재스크럽이 지울 수 없는 잔재를 만든다. references는 문장 단위로 지워지지 않고 살아남은
// 기사의 source 목록에서 통째로 다시 만들어진다. 살아남은 기사의 source title이 떨어진
// 기사의 api_or_component 문구를 그대로 품고 있으면, 스크럽이 끝난 뒤에도 그 문구가 발행
// 텍스트에 남는다. 그 상태에서 fail-closed 가드가 여전히 서는지 확인한다.
const SHARED_RESIDUE = 'libcamera pipeline handler';

function salvageInputsWithUnscrubbableResidue() {
  const keptA = section({
    headline: 'CameraX SessionConfig API',
    sources: [{ title: `${SHARED_RESIDUE} v0.7 release notes`, url: 'https://example.com/camerax' }]
  });
  const keptB = section({ headline: 'Camera driver memory-leak fix', url: 'https://example.com/driver' });
  const dropped = section({ headline: DROPPED_ARTICLE_HEADLINE, url: 'https://example.com/imx576' });
  // 떨어질 기사가 살아남은 기사의 source title과 같은 문구를 다룬다.
  dropped.api_or_component = SHARED_RESIDUE;
  const editor = {
    summary: '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다.',
    briefing: [
      '스트림 조합 회귀를 확인한다.',
      '버퍼 누수 재현 경로를 확인한다.',
      '메타데이터 일관성 로그를 확인한다.'
    ],
    action_items: ['스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.'],
    references: [
      { title: `${SHARED_RESIDUE} v0.7 release notes`, url: 'https://example.com/camerax' },
      { title: 'Driver source', url: 'https://example.com/driver' }
    ],
    sections: [keptA, keptB, dropped]
  };
  const reporter = {
    candidates: [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera', { final_selected: true, title: '후보 0' }),
      scopedCandidate('https://example.com/driver', 'camera_driver_image_pipeline', { final_selected: true, title: '후보 1' }),
      scopedCandidate('https://example.com/imx576', 'direct_aosp_camera', { final_selected: true, title: DROPPED_ARTICLE_HEADLINE })
    ]
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: [
      publishable(0),
      publishable(1),
      { section_index: 2, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }
    ]
  };
  return { editor, reporter, factCheck };
}

test('#869: 재스크럽이 언급을 지우지 못하면 salvage는 null로 fail-closed한다', () => {
  const { editor, reporter, factCheck } = salvageInputsWithUnscrubbableResidue();

  // 재스크럽을 직접 돌려, 잔재가 정말 남고 그 사유가 removed-section-claim-remains인지 본다.
  const subsetScrub = scrubStaleClaims(
    { ...editor, sections: editor.sections.slice(0, 2) },
    { date: DATE, removedSections: [editor.sections[2]], reporter }
  );
  assert.ok(
    subsetScrub.editor.references.some(item => String(item.title).includes(SHARED_RESIDUE)),
    '이 시나리오는 스크럽이 지우지 못하는 잔재를 전제로 한다'
  );
  assert.deepEqual(
    subsetScrub.report.hard_failures.map(item => item.reason),
    ['removed-section-claim-remains']
  );
  assert.equal(subsetScrub.report.status, 'NEEDS_FIX');

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const { salvage, blockers } = salvageWithBlockerReasons(DATE, editor, reporter, factCheck, report);
  assert.equal(salvage, null);
  // 막은 것이 재스크럽의 hard failure 하나뿐이어야 한다. 다른 blocker가 섞이면 이 테스트는
  // 의도한 경로가 깨져도 계속 통과한다.
  assert.equal(blockers, 'Stale claim report has 1 hard failure(s).');
});

// #869 회귀: 대체 briefing 문장 개수를 최종 기사 수에 묶으면, 기사 1건만 남는 얇은 주에는
// briefing 3칸 중 1칸만 채워지고 나머지를 메우려 지운 문장을 되돌리게 된다. 그 잔재가
// removed-section-claim-remains를 깨워, 원래 발행되던 주간호가 통째로 막힌다.
test('#869: 기사 1건만 남고 briefing 3칸이 모두 떨어진 기사를 가리켜도 발행된다', () => {
  const kept = section({ headline: 'CameraX SessionConfig API', url: 'https://example.com/camerax' });
  const dropped = section({ headline: DROPPED_ARTICLE_HEADLINE, url: 'https://example.com/imx576' });
  const editor = {
    summary: 'imx576 센서 드라이버 재작업을 중심으로 정리했다.',
    briefing: [
      'imx576 센서 드라이버 회귀를 확인한다.',
      'imx576 센서 드라이버 누수 경로를 확인한다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ],
    action_items: ['imx576 센서 드라이버 담당자를 지정해 2주 내 검증 항목을 재확인한다.'],
    sections: [kept, dropped]
  };
  const reporter = {
    candidates: [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera', { final_selected: true, title: kept.headline }),
      scopedCandidate('https://example.com/imx576', 'direct_aosp_camera', { final_selected: true, title: DROPPED_ARTICLE_HEADLINE })
    ]
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: [
      publishable(0),
      { section_index: 1, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }
    ]
  };

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const { salvage, blockers } = salvageWithBlockerReasons(DATE, editor, reporter, factCheck, report);
  assert.ok(salvage, `깨끗한 기사 1건은 계속 발행되어야 한다 (blockers=${blockers})`);
  assert.equal(salvage.kept_section_count, 1);
  assert.equal(salvage.editor.briefing.length, 3);
  const publishedText = [salvage.editor.summary, ...salvage.editor.briefing, ...salvage.editor.action_items].join(' ');
  assert.ok(!publishedText.includes('imx576'), `떨어뜨린 기사 언급이 남았다: ${publishedText}`);
  assert.deepEqual(salvage.staleClaimReport.restored_to_keep_minimum, []);
});

// #869 회귀: 재스크럽이 채워 넣는 대체 briefing 문장이 kept 기사의 headline을 그대로 인용하면,
// 그 headline이 후보 title과 같은 주에 briefing raw-copy 검사가 그 문장을 잡아 subset 게이트가
// NEEDS_FIX가 되고 salvage가 null이 된다. 원래 발행되던 주간호가 통째로 막히는 형태다.
test('#869: 대체 briefing 문장이 kept headline을 인용해 raw-copy 게이트를 깨우지 않는다', () => {
  const KEPT_A = 'CameraX SessionConfig API surfaces stream combination limits';
  const KEPT_B = 'Camera driver memory leak fix lands for the ISP buffer queue';
  const keptA = section({ headline: KEPT_A, url: 'https://example.com/camerax' });
  const keptB = section({ headline: KEPT_B, url: 'https://example.com/driver' });
  const dropped = section({ headline: DROPPED_ARTICLE_HEADLINE, url: 'https://example.com/imx576' });
  const editor = {
    summary: '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다.',
    briefing: [
      '스트림 조합 회귀를 확인한다.',
      '버퍼 누수 재현 경로를 확인한다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ],
    action_items: ['스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.'],
    sections: [keptA, keptB, dropped]
  };
  // kept 기사의 headline이 후보 title과 같다. 흔한 형태다.
  const reporter = {
    candidates: [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera', { final_selected: true, title: KEPT_A }),
      scopedCandidate('https://example.com/driver', 'camera_driver_image_pipeline', { final_selected: true, title: KEPT_B }),
      scopedCandidate('https://example.com/imx576', 'direct_aosp_camera', { final_selected: true, title: DROPPED_ARTICLE_HEADLINE })
    ]
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: [
      publishable(0),
      publishable(1),
      { section_index: 2, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }
    ]
  };

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  const { salvage, blockers } = salvageWithBlockerReasons(DATE, editor, reporter, factCheck, report);
  assert.ok(salvage, `깨끗한 기사 2건은 계속 발행되어야 한다 (blockers=${blockers})`);
  assert.equal(salvage.qualityReport.status, 'PASS');
  assert.equal(salvage.editor.briefing.length, 3);
  const briefingText = salvage.editor.briefing.join(' ');
  assert.ok(!briefingText.includes('imx576'), `떨어뜨린 기사 언급이 남았다: ${briefingText}`);
  assert.ok(!briefingText.includes(KEPT_A), `대체 문장이 출처 제목을 그대로 인용했다: ${briefingText}`);
});

// production 경로는 항상 caller 쪽 스크럽 report를 previous로 넘긴다(orchestrator-finalize).
// previous가 없는 경로만 검증하면 mergeStaleClaimReports의 union 분기가 통째로 미검증이다.
function preSalvageReport(overrides = {}) {
  return {
    schema_version: 1,
    date: DATE,
    status: 'PASS',
    removed_sections: [{ index: 1, headline: 'Pre-salvage dropped article', source_urls: [], source_titles: [] }],
    dropped_selected_groups: [],
    restored_to_keep_minimum: [{
      field: 'briefing',
      text: '앞 스크럽이 최소 개수를 지키려고 되돌린 문장이다.',
      stale_claims: ['imx908'],
      unsupported_release_claims: [],
      action: 'restored-to-keep-minimum'
    }],
    final_section_sources: [],
    stale_claim_items_removed: [{
      field: 'summary',
      text: '앞 스크럽이 지운 문장이다.',
      stale_claims: ['imx908'],
      unsupported_release_claims: [],
      action: 'removed-sentence'
    }],
    unsupported_release_claims_removed: [],
    unused_references_removed: [{ title: 'Pre-salvage reference', url: 'https://example.com/imx908' }],
    retained_release_claims: [],
    hard_failures: [],
    ...overrides
  };
}

test('#869: salvage 앞 스크럽의 hard failure는 재스크럽 report가 덮어쓰지 못한다', () => {
  // 재스크럽만 보면 PASS인 입력이다. 앞 스크럽이 남긴 hard failure가 살아 있어야 게이트가 막힌다.
  const { editor, reporter, factCheck } = salvageInputsWithIssueLevelText({
    summary: '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다. imx576 센서 드라이버 재작업도 함께 살펴본다.',
    briefing: [
      '스트림 조합 회귀를 확인한다.',
      '버퍼 누수 재현 경로를 확인한다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ],
    action_items: ['스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.']
  });
  const previous = preSalvageReport({
    status: 'NEEDS_FIX',
    hard_failures: [{ reason: 'removed-section-claim-remains', claims: ['imx908'] }]
  });

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, { staleClaimReport: previous });
  const { salvage, blockers } = salvageWithBlockerReasons(DATE, editor, reporter, factCheck, report, {
    staleClaimReport: previous
  });
  assert.equal(salvage, null);
  assert.equal(blockers, 'Stale claim report has 1 hard failure(s).');
});

test('#869: 병합된 report는 누적 기록만 이어 붙이고 restored는 최종 상태를 쓴다', () => {
  const { editor, reporter, factCheck } = salvageInputsWithIssueLevelText({
    summary: '이번 호는 스트림 조합 회귀와 버퍼 누수 수정을 중심으로 정리했다. imx576 센서 드라이버 재작업도 함께 살펴본다.',
    briefing: [
      '스트림 조합 회귀를 확인한다.',
      '버퍼 누수 재현 경로를 확인한다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ],
    action_items: ['스트림 조합 담당자를 지정해 2주 내 검증 항목을 재확인한다.']
  });
  const previous = preSalvageReport();

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, { staleClaimReport: previous });
  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {
    staleClaimReport: previous
  });
  assert.ok(salvage);
  const merged = salvage.staleClaimReport;

  // 누적 기록: 앞 스크럽이 무엇을 지웠는지가 재스크럽 report에 덮이면 안 된다.
  assert.deepEqual(
    merged.removed_sections.map(item => item.headline),
    ['Pre-salvage dropped article', DROPPED_ARTICLE_HEADLINE]
  );
  assert.deepEqual(
    merged.stale_claim_items_removed.map(item => item.text),
    [
      '앞 스크럽이 지운 문장이다.',
      'imx576 센서 드라이버 재작업도 함께 살펴본다.',
      'imx576 센서 드라이버 재작업의 스테이징 반영 여부를 확인한다.'
    ]
  );
  assert.deepEqual(
    merged.unused_references_removed.map(item => item.url),
    ['https://example.com/imx908']
  );

  // 최종 상태: 재스크럽은 아무것도 되돌리지 않았으므로 되돌린 문장은 없다. 이어 붙이면
  // 앞 스크럽이 되돌린 문장이 남아 있다고 보고하게 된다.
  assert.deepEqual(merged.restored_to_keep_minimum, []);
  assert.equal(merged.status, 'PASS');
});
