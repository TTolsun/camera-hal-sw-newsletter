const assert = require('node:assert/strict');
const test = require('node:test');

// #965: source_fact_bundle이 source_extraction.workflow를 읽지 않아 workflow 근거만 가진 후보의
// fact_count가 항상 0이었다. 같은 근거를 읽는 claim-source-binding.js의 sourceExtractionItems는
// release / minor_line_context / workflow 세 그룹을 모두 읽는다(#944). 두 소비자가 같은 컨테이너를
// 보아야 LLM이 본 근거와 검증기가 보는 근거가 일치한다.

const {
  buildArticleSourceFactBundle
} = require('../../../reporter/source-fact-bundle');

// dated-article-index-resolver.js의 workflowEvidence가 실제로 내는 모양이다.
// sections[].items[]는 heading 없는 문단 하나씩이고, 항목은 text 필드만 가진다.
const WORKFLOW_ONLY_CANDIDATE = Object.freeze({
  url: 'https://claude.com/blog/ai-ci-cd-on-call',
  title: 'How we run continuous integration on call',
  summary: '팀이 지속적 통합 실패 분류를 자동화한 과정을 설명한다.',
  behavior_change: 'Every continuous integration failure now gets a named owner within five minutes.',
  source_extraction: {
    workflow: {
      sections: [
        {
          heading: '',
          items: [{ text: 'The logs, trace output and metrics land in an artifact bundle that the on-call engineer opens first.' }]
        },
        {
          heading: '',
          items: [{ text: 'Not only has this helped with our social lives, it has given every incident a reproducible starting point.' }]
        }
      ]
    }
  }
});

// release / minor_line_context만 가진 후보다. 이 후보의 출력은 workflow 지원을 추가해도
// 한 글자도 바뀌면 안 된다(회귀 방지).
const RELEASE_ONLY_CANDIDATE = Object.freeze({
  url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03',
  title: 'CameraX Version 1.7.0-alpha03',
  summary: 'CameraX 1.7.0-alpha03 릴리스 노트다.',
  behavior_change: 'ImageCapture now reports a dedicated error code when the flash unit is unavailable.',
  source_extraction: {
    release: {
      sections: [
        {
          heading: 'Bug Fixes',
          items: [
            { text: 'Fixed a crash when binding VideoCapture while the camera was already released.' },
            { text: 'Fixed incorrect rotation metadata on devices reporting a 270 degree sensor orientation.' }
          ]
        }
      ]
    },
    minor_line_context: {
      sections: [
        {
          heading: 'Minor line',
          items: [{ source_text: 'The 1.6 minor line receives the same rotation metadata fix.' }]
        }
      ]
    }
  },
  compact_evidence: {
    primary_facts: ['camera-core 1.7.0-alpha03 published on 2026-08-20.'],
    linked_context: ['camera-video 1.7.0-alpha03 shares the same release train.']
  },
  evidence: ['Release notes list four fixed issues.']
});

test('workflow 근거만 있는 후보도 source_fact_bundle에 근거를 싣는다', () => {
  const bundle = buildArticleSourceFactBundle(WORKFLOW_ONLY_CANDIDATE, [WORKFLOW_ONLY_CANDIDATE]);

  assert.ok(bundle.fact_count > 0, 'workflow 근거만 있어도 fact_count가 0이면 안 된다');
  assert.deepEqual(
    bundle.facts.map(fact => fact.kind),
    ['behavior_change', 'source_extraction', 'source_extraction']
  );
  assert.deepEqual(
    bundle.facts.filter(fact => fact.kind === 'source_extraction').map(fact => fact.text),
    [
      'The logs, trace output and metrics land in an artifact bundle that the on-call engineer opens first.',
      'Not only has this helped with our social lives, it has given every incident a reproducible starting point.'
    ]
  );
});

test('release / minor_line_context만 있는 후보의 출력은 그대로다', () => {
  const bundle = buildArticleSourceFactBundle(RELEASE_ONLY_CANDIDATE, [RELEASE_ONLY_CANDIDATE]);

  assert.deepEqual(bundle, {
    source_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03',
    canonical_url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    source_title: 'CameraX Version 1.7.0-alpha03',
    fact_count: 7,
    facts: [
      {
        kind: 'behavior_change',
        role: 'primary',
        text: 'ImageCapture now reports a dedicated error code when the flash unit is unavailable.'
      },
      {
        kind: 'source_extraction',
        role: 'primary',
        text: 'Fixed a crash when binding VideoCapture while the camera was already released.'
      },
      {
        kind: 'source_extraction',
        role: 'primary',
        text: 'Fixed incorrect rotation metadata on devices reporting a 270 degree sensor orientation.'
      },
      {
        kind: 'source_extraction',
        role: 'primary',
        text: 'The 1.6 minor line receives the same rotation metadata fix.'
      },
      {
        kind: 'primary_fact',
        role: 'primary',
        text: 'camera-core 1.7.0-alpha03 published on 2026-08-20.'
      },
      {
        kind: 'linked_context',
        role: 'primary',
        text: 'camera-video 1.7.0-alpha03 shares the same release train.'
      },
      {
        kind: 'evidence',
        role: 'primary',
        text: 'Release notes list four fixed issues.'
      }
    ],
    supporting_source_urls: []
  });
});

// workflow 항목을 release 항목보다 앞에 두면 release 후보의 기존 근거 순서가 밀린다. 그래서
// workflow는 근거 그룹 목록 끝에 붙인다 — claim-source-binding.js의 그룹 순서
// (release, minor_line_context, workflow)와도 같다. 커밋된 merged-candidates.json 1813건 실측에서
// workflow와 release/minor_line_context를 동시에 가진 후보는 0건이라 실데이터로는 이 순서를
// 확인할 수 없다. 그래서 합성 입력으로 잠근다.
test('release와 workflow를 함께 가진 후보에서 release 근거가 workflow보다 앞선다', () => {
  const releaseItems = Array.from({ length: 10 }, (_, index) => ({
    text: `Release note line ${index + 1} describing a camera pipeline fix.`
  }));
  const candidate = {
    url: 'https://example.test/mixed-extraction',
    title: 'Mixed extraction candidate',
    behavior_change: 'The capture session now retries once before surfacing a configuration failure.',
    source_extraction: {
      release: { sections: [{ heading: 'Fixes', items: releaseItems }] },
      workflow: {
        sections: [
          { heading: '', items: [{ text: 'Workflow paragraph one about the debugging loop.' }] },
          { heading: '', items: [{ text: 'Workflow paragraph two about the artifact bundle.' }] }
        ]
      }
    },
    compact_evidence: { primary_facts: ['Compact primary fact that may not fit.'] },
    evidence: ['Trailing evidence line that may not fit.']
  };

  const bundle = buildArticleSourceFactBundle(candidate, [candidate]);
  const texts = bundle.facts.map(fact => fact.text);

  assert.ok(bundle.facts.length <= 12, 'MAX_FACTS 상한 12를 넘으면 안 된다');
  for (const item of releaseItems) {
    assert.ok(texts.includes(item.text), `release 근거가 밀려나면 안 된다: ${item.text}`);
  }
  const lastReleaseIndex = texts.indexOf(releaseItems[releaseItems.length - 1].text);
  const firstWorkflowIndex = texts.indexOf('Workflow paragraph one about the debugging loop.');
  assert.ok(firstWorkflowIndex > lastReleaseIndex, 'workflow 근거는 release 근거 뒤에 와야 한다');
});
