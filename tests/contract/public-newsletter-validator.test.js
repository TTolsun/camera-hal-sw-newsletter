const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validatePublicNewsletterArtifacts
} = require('../../scripts/newsroom/validate/public-newsletter');
const {
  publicArticlePathIssues
} = require('../../scripts/newsroom/cli/validate-public-newsletter');

function markdown(overrides = {}) {
  const checkpoints = overrides.checkpoints || [
    ['대표 기기 1대에서 Camera ITS preview latency를 확인합니다.', 'CameraX path의 stream metadata 차이를 비교합니다.'],
    ['libcamera path의 sensor mode selection 회귀 가능성을 확인합니다.', 'frame timing과 format negotiation test 필요 여부를 점검합니다.'],
    ['Android native owner가 Clang build log와 camera module 경고를 확인합니다.', 'HAL/driver 변경 근거는 없음으로 제한해 release note 범위만 추적합니다.']
  ];
  return `# Camera HAL SW Newsletter - 2026-05-18

이번 호는 Camera HAL 독자가 확인할 만한 공개 출처 동향을 요약합니다.

## 1. 이번 주 3줄 브리핑

- one
- two
- three

${[1, 2, 3].map((number, index) => `## ${number + 1}. Article ${number}

Lead ${number}는 공개 출처 기반 동향을 한국어로 요약합니다.

본문 ${number}A는 source-backed change를 Camera HAL 독자 관점에서 설명합니다.

본문 ${number}B는 직접 HAL 변경으로 과장하지 않아야 하는 boundary를 설명합니다.

**Camera HAL / Driver 관점**

Takeaway ${number}.

### 확인할 점

${checkpoints[index].map(item => `- ${item}`).join('\n')}

**출처**

- [Source ${number}](https://example.com/source-${number})
`).join('\n---\n\n')}

## 참고자료

- [Reference](https://example.com/reference)
`;
}

function html(body = '<p>Public reader-facing article.</p>') {
  return `<!doctype html><html><body><main>${body}</main></body></html>`;
}

function storyPublicArticle(headline = 'CameraX preview 호환성 확인') {
  return {
    story_contract_version: 1,
    headline,
    source_subtitle: 'Android Developers · CameraX',
    lead: 'CameraX preview 변경은 app/framework 계층의 호환성 검증 신호로 다룹니다.',
    body_paragraphs: [
      'Android Developers가 CameraX preview 동작과 관련된 변경점을 공개했습니다.',
      'Camera HAL 독자는 HAL 직접 변경이 아니라 preview/capture regression 범위 지정에 참고합니다.'
    ],
    camera_hal_takeaway: '검증 범위는 app/framework 관찰 항목으로 제한합니다.',
    reader_checkpoints: [
      'CameraX preview path에서 Camera ITS smoke test를 실행합니다.',
      'preview latency와 stream metadata 차이를 비교합니다.'
    ],
    editorial_story: {
      reader_scenario: '앱/framework 변경이 preview/capture 검증 범위에 들어오는지 triage하는 상황을 가정합니다.',
      what_happened: 'Android Developers가 CameraX 변경점을 공개했습니다.',
      why_it_matters: 'Camera HAL 독자는 preview/capture regression 범위 지정에 참고할 수 있습니다.',
      field_scenario: 'Camera ITS와 preview latency log를 비교합니다.',
      not_to_overclaim: 'HAL runtime 변경으로 확대하지 않습니다.',
      editor_take: 'source 범위 안에서만 실무 확인 항목으로 다룹니다.'
    },
    decision_metadata: {
      impact: 'Medium',
      scope: ['Framework'],
      action: ['Watch', 'Test'],
      overclaim_risk: 'Medium'
    },
    source_links: [{
      title: 'CameraX Release Notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      source_role: 'primary'
    }]
  };
}

function storyIssue(overrides = {}) {
  const headline = overrides.headline || 'CameraX preview 호환성 확인';
  return {
    date: '2026-05-18',
    public_contract_version: 'story-v1',
    generation_contract_version: 1,
    sections: [{
      category: 'Android Platform / CameraX',
      headline,
      what_changed: 'CameraX preview behavior changed in a dated release note.',
      camera_hal_perspective: 'CameraX preview path를 Camera ITS와 stream metadata로 확인합니다.',
      action_items: [
        'Camera ITS smoke test를 실행합니다.',
        'preview latency와 stream metadata 차이를 비교합니다.'
      ],
      hal_impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
      actionability_level: 'measurable_test',
      sources: [{
        title: 'CameraX Release Notes',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera'
      }],
      public_article: storyPublicArticle(headline)
    }],
    ...overrides
  };
}

function legacyIssue() {
  return {
    date: '2026-05-17',
    sections: [{
      category: 'Legacy',
      headline: 'Legacy Camera article',
      what_changed: 'Legacy article stays on the old public article contract.',
      camera_hal_perspective: 'Camera HAL readers keep the legacy rendering path.',
      action_items: [
        'Run Camera ITS smoke test for Legacy Source preview stream metadata.',
        'Compare Legacy Source preview latency and frame-drop logs.'
      ],
      sources: [{
        title: 'Legacy Source',
        url: 'https://example.com/legacy-source'
      }],
      public_article: {
        headline: 'Legacy Camera article',
        lead: 'Legacy article stays on the old public article contract.',
        body_paragraphs: [
          'Legacy body paragraph one explains source-backed context.',
          'Legacy body paragraph two keeps the HAL interpretation bounded.'
        ],
        camera_hal_takeaway: 'Legacy rendering remains compatible.',
        reader_checkpoints: [
          'Run Camera ITS smoke test for Legacy Source preview stream metadata.',
          'Compare Legacy Source preview latency and frame-drop logs.'
        ],
        source_links: [{
          title: 'Legacy Source',
          url: 'https://example.com/legacy-source',
          source_role: 'primary'
        }]
      }
    }]
  };
}

test('public newsletter validator accepts reader-facing articles', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown(),
    html: html()
  });

  assert.deepEqual(errors, []);
});

test('public newsletter validator rejects visible internal terms and raw fact checklists', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace('Lead 1는 공개 출처 기반 동향을 한국어로 요약합니다.', 'Lead 1는 HAL Signal Capsule why_now 확인된 변경점: raw fact.'),
    html: html('<p>Review-only quality gate output</p>')
  });

  assert.ok(errors.some(error => /HAL Signal Capsule/.test(error)));
  assert.ok(errors.some(error => /why_now/.test(error)));
  assert.ok(errors.some(error => /Review-only/.test(error)));
  assert.ok(errors.some(error => /quality gate/.test(error)));
  assert.ok(errors.some(error => /raw verified facts/.test(error)));
});

test('public newsletter validator rejects Korean internal workflow notice terms', () => {
  const internalNotice = [
    '> 편집자 검토 후 공개 가능한 검토 발행본입니다.',
    '> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.'
  ].join('\n');
  const safeNotice = [
    '> 검토 발행본입니다.',
    '> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.'
  ].join('\n');

  const internalErrors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace('## 1. 이번 주 3줄 브리핑', `${internalNotice}\n\n## 1. 이번 주 3줄 브리핑`),
    html: html('<div class="publication-notice"><p>편집자 검토 후 공개 가능한 검토 발행본입니다.</p><p>이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.</p></div>')
  });
  const safeErrors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace('## 1. 이번 주 3줄 브리핑', `${safeNotice}\n\n## 1. 이번 주 3줄 브리핑`),
    html: html('<div class="publication-notice"><p>검토 발행본입니다.</p><p>각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.</p></div>')
  });

  assert.ok(internalErrors.some(error => /자동 정상 발행 기준/.test(error)));
  assert.ok(internalErrors.some(error => /편집자 확인 후 merge/.test(error)));
  assert.deepEqual(safeErrors, []);
});

test('public newsletter validator rejects legacy fallback wording and allows Tooling Watch disclosure', () => {
  const legacyFallbackMarkdown = markdown().replace(
    '이번 호는 Camera HAL 독자가 확인할 만한 공개 출처 동향을 요약합니다.',
    'Fallback Edition: C++ / Tooling Watch. This fallback issue is clearly labeled.'
  );
  const legacyFallbackHtml = html('<div class="publication-notice"><p>Fallback Edition: C++ / Tooling Watch</p></div>');
  const toolingMarkdown = markdown().replace(
    '이번 호는 Camera HAL 독자가 확인할 만한 공개 출처 동향을 요약합니다.',
    'Tooling Watch Edition: C++ / Tooling Watch. This tooling-watch issue is clearly labeled.'
  );
  const toolingHtml = html('<div class="publication-notice"><p>Tooling Watch Edition: C++ / Tooling Watch</p></div>');

  const legacyErrors = validatePublicNewsletterArtifacts({
    markdown: legacyFallbackMarkdown,
    html: legacyFallbackHtml,
    publicationMode: 'fallback_public',
    fallbackOnly: true
  });
  const toolingErrors = validatePublicNewsletterArtifacts({
    markdown: toolingMarkdown,
    html: toolingHtml,
    publicationMode: 'fallback_public',
    fallbackOnly: true
  });

  assert.ok(legacyErrors.some(error => /Fallback/.test(error)));
  assert.deepEqual(toolingErrors, []);
});

test('public newsletter validator rejects editor review and HAL capsule field leftovers', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace('Lead 1는 공개 출처 기반 동향을 한국어로 요약합니다.', 'Lead 1는 Editor review reader_owners check_within_2_weeks normal publishable coverage.'),
    html: html('<p>editor review reader_owners check_within_2_weeks</p>')
  });

  assert.ok(errors.some(error => /editor review/i.test(error)));
  assert.ok(errors.some(error => /reader_owners/.test(error)));
  assert.ok(errors.some(error => /check_within_2_weeks/.test(error)));
  assert.ok(errors.some(error => /normal publishable coverage/.test(error)));
});

test('public newsletter validator rejects story v1 raw key leakage', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace(
      'Lead 1는 공개 출처 기반 동향을 한국어로 요약합니다.',
      'Lead 1는 story_contract_version decision_metadata editorial_story reader_scenario source_subtitle source_links를 노출합니다.'
    ),
    html: html('<p>what_happened not_to_overclaim editor_take</p>')
  });

  assert.ok(errors.some(error => /story_contract_version/.test(error)));
  assert.ok(errors.some(error => /decision_metadata/.test(error)));
  assert.ok(errors.some(error => /source_subtitle/.test(error)));
  assert.ok(errors.some(error => /not_to_overclaim/.test(error)));
});

test('public newsletter validator accepts compact story v1 public prose section', () => {
  const storyMarkdown = markdown().replace(
    'Lead 1는 공개 출처 기반 동향을 한국어로 요약합니다.',
    [
      'Lead 1는 공개 출처 기반 동향을 한국어로 요약합니다.',
      '',
      'Android Developers가 CameraX 변경점을 공개했고, Camera HAL 독자는 이를 preview/capture regression 범위 지정에 참고할 수 있습니다.',
      '',
      'CameraX preview 회귀를 triage할 때 Camera ITS와 preview latency log를 비교합니다.',
      '',
      '### Camera HAL / Driver 관점에서 확인할 점',
      '',
      '검증 범위는 app/framework 관찰 항목으로 제한합니다.',
      '',
      '- CameraX preview path에서 Camera ITS smoke test를 실행합니다.',
      '- preview latency와 stream metadata 차이를 비교합니다.'
    ].join('\n')
  );
  const errors = validatePublicNewsletterArtifacts({
    markdown: storyMarkdown,
    html: html('<p>Android Developers가 CameraX 변경점을 공개했습니다.</p><h3>Camera HAL / Driver 관점에서 확인할 점</h3>')
  });

  assert.deepEqual(errors, []);
});

test('public article path validation uses nearest issue context for array and wrapper artifacts', () => {
  assert.deepEqual(publicArticlePathIssues(storyIssue(), 'single-story-issue'), []);
  assert.deepEqual(publicArticlePathIssues([legacyIssue(), storyIssue()], 'issue-array'), []);
  assert.deepEqual(publicArticlePathIssues({ newsletters: [legacyIssue(), storyIssue()] }, 'issue-wrapper'), []);
});

test('public article path validation rejects unsupported future story contract versions in wrappers', () => {
  const issue = storyIssue({
    public_contract_version: 'story-v2'
  });
  const errors = publicArticlePathIssues({ newsletters: [issue] }, 'issue-wrapper');

  assert.ok(errors.some(error => /unsupported_public_contract_version/.test(error)));
});

test('public article path validation rejects unsupported future section story versions in wrappers', () => {
  const issue = storyIssue();
  issue.sections[0].public_article.story_contract_version = 2;
  const errors = publicArticlePathIssues({ newsletters: [issue] }, 'issue-wrapper');

  assert.ok(errors.some(error => /unsupported_story_contract_version/.test(error)));
});

test('public article path validation rejects story fields without story markers', () => {
  const issue = legacyIssue();
  issue.sections[0].public_article = storyPublicArticle('Story fields without markers');
  delete issue.sections[0].public_article.story_contract_version;
  const errors = publicArticlePathIssues({ newsletters: [issue] }, 'issue-wrapper');

  assert.ok(errors.some(error => /story_contract_version_mismatch/.test(error)));
});

test('public newsletter validator rejects non-public markdown source links', () => {
  const withNonPublicLinks = markdown()
    .replace('- [Source 1](https://example.com/source-1)', '- [Internal](content/newsroom/2026-05-18/editor-draft.json)')
    .replace('- [Reference](https://example.com/reference)', '- [Action](https://github.com/TTolsun/camera-hal-sw-newsletter/actions/runs/123)');
  const errors = validatePublicNewsletterArtifacts({
    markdown: withNonPublicLinks,
    html: html()
  });

  assert.ok(errors.some(error => /internal_artifact_url/.test(error)));
  assert.ok(errors.some(error => /github_actions_artifact_url/.test(error)));
});

test('public newsletter validator rejects source snapshot state in public JSON', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown(),
    html: html(),
    json: JSON.stringify({
      processed_source_event_ids: ['source-event-1'],
      previous_values: { normalized_content_hash: 'old' },
      source: 'data/source-snapshots/aosp-camera-docs.json'
    }),
    jsonLabel: 'data/newsletters.json'
  });

  assert.ok(errors.some(error => /processed_source_event_ids/.test(error)));
  assert.ok(errors.some(error => /previous_values/.test(error)));
  assert.ok(errors.some(error => /data\/source-snapshots/.test(error)));
});

test('public newsletter validator checks rendered markdown article 1', () => {
  const articleOneMarkdown = markdown({
    checkpoints: [
      ['즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.', 'CameraX preview latency를 대표 기기에서 확인합니다.'],
      ['libcamera path의 sensor mode selection 회귀 가능성을 확인합니다.', 'frame timing과 format negotiation test 필요 여부를 점검합니다.'],
      ['Android native owner가 Clang build log와 camera module 경고를 확인합니다.', 'HAL/driver 변경 근거는 없음으로 제한해 release note 범위만 추적합니다.']
    ]
  })
    .replace('## 1. 이번 주 3줄 브리핑', '## 이번 주 3줄 브리핑')
    .replace('## 2. Article 1', '## 1. Article 1')
    .replace('## 3. Article 2', '## 2. Article 2')
    .replace('## 4. Article 3', '## 3. Article 3');
  const errors = validatePublicNewsletterArtifacts({
    markdown: articleOneMarkdown,
    html: html()
  });

  assert.ok(errors.some(error => /article 1 has generic fallback checkpoint/.test(error)));
});

test('public newsletter validator separates contextual validator wording from internal reports', () => {
  const allowed = validatePublicNewsletterArtifacts({
    markdown: markdown().replace(
      '본문 1A는 source-backed change를 Camera HAL 독자 관점에서 설명합니다.',
      '본문 1A는 API validator가 입력 포맷을 검사하는 개발 도구 문맥을 설명합니다.'
    ),
    html: html('<p>API validator가 입력 포맷을 검사합니다.</p>')
  });
  const blocked = validatePublicNewsletterArtifacts({
    markdown: markdown().replace(
      '본문 1A는 source-backed change를 Camera HAL 독자 관점에서 설명합니다.',
      '본문 1A는 internal validator report output을 public 기사에 노출합니다.'
    ),
    html: html('<script type="application/json">{"note":"source_gap_risk"}</script>')
  });

  assert.deepEqual(allowed, []);
  assert.ok(blocked.some(error => /internal validator report|validator\+internal_marker/.test(error)));
  assert.ok(blocked.some(error => /source_gap_risk/.test(error)));
});

test('public newsletter validator scopes contextual allow phrases per sentence or window', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace(
      '본문 1A는 source-backed change를 Camera HAL 독자 관점에서 설명합니다.',
      '본문 1A는 API validator가 입력 포맷을 검사하는 개발 도구 문맥을 설명합니다. 다음 문장은 internal validator report output을 노출합니다.'
    ),
    html: html()
  });

  assert.ok(errors.some(error => /internal validator report|validator\+internal_marker/.test(error)));
});

test('public newsletter validator rejects generic fallback checkpoint even when not repeated', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown({
      checkpoints: [
        ['대표 기기 1대에서 Camera ITS preview latency를 확인합니다.', 'CameraX path의 stream metadata 차이를 비교합니다.'],
        ['즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.', 'Camera2 compatibility test scenario를 확인합니다.'],
        ['Android native owner가 Clang build log와 camera module 경고를 확인합니다.', 'HAL/driver 변경 근거는 없음으로 제한해 release note 범위만 추적합니다.']
      ]
    }),
    html: html()
  });

  assert.ok(errors.some(error => /generic fallback checkpoint/.test(error)));
});

test('public newsletter validator rejects validator-token placeholder prose', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown({
      checkpoints: [
        [
          'Google AI Studio 관련 API/component/date가 현재 device matrix와 맞는지 확인합니다.',
          'Google AI Studio compatibility test scenario 또는 stream/metadata 확인 항목만 추적합니다.'
        ],
        ['다양한 화면 크기에서 CameraX preview의 aspect ratio와 rotation 동작을 확인합니다.', 'HAL API 변경 소식은 아니므로 request/result나 vendor tag 변경으로 해석하지 않습니다.'],
        ['AI Studio prototype의 Camera API 권한 선언을 확인합니다.', '이 소스만으로 HAL/driver 변경이나 vendor camera pipeline 영향을 주장하지 않습니다.']
      ]
    }),
    html: html()
  });

  assert.ok(errors.some(error => /validator-token prose|API\/component\/date|stream\/metadata/.test(error)));
});

test('public newsletter validator allows natural technical prose with concrete targets', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown({
      checkpoints: [
        [
          'CameraX version과 published date가 release note에 명시되어 있는지 확인합니다.',
          'test log와 latency metric을 비교해 preview regression 여부를 확인합니다.'
        ],
        ['CameraX preview가 회전 후 aspect ratio를 유지하는지 확인합니다.', 'HAL API 변경 소식은 아니므로 request/result나 vendor tag 변경으로 해석하지 않습니다.'],
        ['AI Studio prototype의 Camera API 권한 선언을 확인합니다.', '이 소스만으로 HAL/driver 변경이나 vendor camera pipeline 영향을 주장하지 않습니다.']
      ]
    }),
    html: html()
  });

  assert.deepEqual(errors, []);
});

test('public newsletter validator fails numbered article without reader checkpoints', () => {
  const broken = markdown().replace(
    [
      '### 확인할 점',
      '',
      '- 대표 기기 1대에서 Camera ITS preview latency를 확인합니다.',
      '- CameraX path의 stream metadata 차이를 비교합니다.',
      ''
    ].join('\n'),
    ''
  );

  const errors = validatePublicNewsletterArtifacts({
    markdown: broken,
    html: html()
  });

  assert.ok(errors.some(error => /missing reader checkpoints/.test(error)));
});

test('public newsletter validator rejects long English prose in article paragraphs', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace(
      '본문 1A는 source-backed change를 Camera HAL 독자 관점에서 설명합니다.',
      'Jetpack Compose is the definitive engine for this transition, offering core tools like latest navigation layouts and CameraX preview behavior across any window size.'
    ),
    html: html()
  });

  assert.ok(errors.some(error => /long English prose run/.test(error)));
});

test('public newsletter validator rejects generic and repeated checkpoints', () => {
  const repeated = [
    ['Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.'],
    ['Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.'],
    ['Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.']
  ];
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown({ checkpoints: repeated }),
    html: html()
  });

  assert.ok(errors.some(error => /editorial QA checkpoint/.test(error)));
  assert.ok(errors.some(error => /identical across all articles/.test(error)));
});
