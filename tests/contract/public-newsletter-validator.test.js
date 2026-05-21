const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validatePublicNewsletterArtifacts
} = require('../../scripts/newsroom/validate/public-newsletter');

function markdown(overrides = {}) {
  const checkpoints = overrides.checkpoints || [
    ['Run Camera ITS preview latency checks on one representative device.', 'Compare stream metadata on the CameraX path.'],
    ['Review sensor mode selection regressions in the libcamera path.', 'Check frame timing and format negotiation tests.'],
    ['즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.']
  ];
  return `# Camera HAL SW Newsletter - 2026-05-18

Weekly summary.

## 1. 이번 주 3줄 브리핑

- one
- two
- three

${[1, 2, 3].map((number, index) => `## ${number + 1}. Article ${number}

Lead ${number}.

Body paragraph ${number}A explains the source-backed change.

Body paragraph ${number}B explains the Camera HAL boundary.

**Camera HAL / Driver 관점**

Takeaway ${number}.

### 확인할 점

${checkpoints[index].map(item => `- ${item}`).join('\n')}

**Sources**

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
    markdown: markdown().replace('Lead 1.', 'Lead 1. HAL Signal Capsule why_now 확인된 변경점: raw fact.'),
    html: html('<p>Review-only quality gate output</p>')
  });

  assert.ok(errors.some(error => /HAL Signal Capsule/.test(error)));
  assert.ok(errors.some(error => /why_now/.test(error)));
  assert.ok(errors.some(error => /Review-only/.test(error)));
  assert.ok(errors.some(error => /quality gate/.test(error)));
  assert.ok(errors.some(error => /raw verified facts/.test(error)));
});

test('public newsletter validator allows explicit Fallback Edition disclosure only for fallback_public', () => {
  const fallbackMarkdown = markdown().replace(
    'Weekly summary.',
    'Fallback Edition: C++ / Tooling Watch. This fallback issue is clearly labeled.'
  );
  const fallbackHtml = html('<div class="publication-notice"><p>Fallback Edition: C++ / Tooling Watch</p></div>');

  const normalErrors = validatePublicNewsletterArtifacts({
    markdown: fallbackMarkdown,
    html: fallbackHtml
  });
  const fallbackErrors = validatePublicNewsletterArtifacts({
    markdown: fallbackMarkdown,
    html: fallbackHtml,
    publicationMode: 'fallback_public',
    fallbackOnly: true
  });

  assert.ok(normalErrors.some(error => /Fallback/.test(error)));
  assert.deepEqual(fallbackErrors, []);
});

test('public newsletter validator rejects editor review and HAL capsule field leftovers', () => {
  const errors = validatePublicNewsletterArtifacts({
    markdown: markdown().replace('Lead 1.', 'Lead 1. Editor review reader_owners check_within_2_weeks normal publishable coverage.'),
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
