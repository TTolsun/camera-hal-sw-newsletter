const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validatePublicNewsletterArtifacts
} = require('../../scripts/newsroom/validate/public-newsletter');

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
