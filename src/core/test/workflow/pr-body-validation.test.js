'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../../../generator/publish/build-newsroom-pr-body');
const {
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  detectBodyKind,
  extractSections,
  extractStatusSection,
  resolveBodyKind,
  validatePrBodyFile,
  validatePrBodyText
} = require('../../../generator/publish/validate-pr-body');
const {
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
} = require('../../../generator/publish/resolve-reviewable-artifacts');
const {
  tempRoot: fsTempRoot,
  writeText
} = require('../helpers/fs');
const {
  writeEditorialReviewableArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeMinimalEvidencePackSummary,
  writeMinimalPublishArtifacts,
  writePublicNewsletterArtifacts
} = require('../helpers/workflow-fixtures');

function newsletterTemplateBody(overrides = {}) {
  const validationTestCommand = overrides.testCommand || 'npm run test';
  const validationValidateCommand = overrides.validateCommand || 'npm run validate';
  return `## 뉴스레터 발행 PR

### 작성 원칙

- [ ] PR body는 한글로 작성했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] \`final_publish_ready\` 같은 영어 식별자는 한국어 설명을 함께 적었다.

### Public artifact

- [ ] \`articles/newsletters/2026-05-08/newsletter.md\`를 작성했다.
- [ ] \`articles/newsletters/2026-05-08/index.html\`을 작성했다.
- [ ] \`articles/data/newsletters.json\`을 업데이트했다.
- [ ] HTML에서 Archive 링크가 동작한다.
- [ ] HTML에서 Markdown 원본 링크가 동작한다.

### Editorial quality

- [ ] 주요 기사 구성이 \`src/core/config/newsletter-policy.json\`을 따른다.
- [ ] 3줄 브리핑은 정확히 3줄이다.
- [ ] 각 주요 기사에 \`확인한 사실\`이 있다.
- [ ] 각 주요 기사에 \`배경지식\`이 있다.
- [ ] 각 주요 기사에 \`Camera HAL 관점\`이 있다.
- [ ] 각 주요 기사에 \`실행 항목\`이 있다.
- [ ] 각 주요 기사에 \`팀 공유 포인트\`가 있다.
- [ ] 추정은 추정이라고 표시했다.
- [ ] \`TODO\`가 남아 있지 않다.

### Source / fact-check

- [ ] 각 주요 기사에 \`Sources\` 또는 \`출처\`가 있다.
- [ ] 마지막에 \`References\` 또는 \`참고자료\`가 있다.
- [ ] 출처가 본문 주장과 직접 연결된다.
- [ ] source gap이 없다.
- [ ] fact-check must_fix가 없다.
- [ ] watch/reference page가 dated evidence 없이 main article로 승격되지 않았다.
- [ ] AI/C++ 기사가 포함된 경우 Camera HAL workflow와 연결된다.

### Validation

- [ ] \`${validationTestCommand}\`
- [ ] \`${validationValidateCommand}\`
- [ ] 필요한 targeted test를 실행했다.
`;
}

function codeDocsTemplateBody(overrides = {}) {
  const validationTestCommand = overrides.testCommand || 'npm run test';
  const validationValidateCommand = overrides.validateCommand || 'npm run validate';
  return `## 코드 / 문서 / 리팩토링 PR

### 작성 원칙

- [ ] PR body는 한글로 작성했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] \`final_publish_ready\`, \`artifact_final_publish_ready\` 같은 영어 식별자는 한국어 설명을 함께 적었다.

### Scope

- [ ] PR 하나에 한 관심사만 담았다.
- [ ] 뉴스레터 generated artifact를 불필요하게 수정하지 않았다.
- [ ] public newsletter content 변경이 있으면 이유를 설명했다.
- [ ] unrelated cleanup을 섞지 않았다.

### Code safety

- [ ] quality gate, hard blocker, source binding, image fallback 정책을 약화하지 않았다.
- [ ] \`qualityGatePolicy.threshold\` 변경이 있으면 PR 본문에 이유와 검증 결과를 명시했다.
- [ ] \`qualityGatePolicy.hardFailConditions\` 변경이 있으면 condition별 regression test와 문서 갱신을 포함했다.
- [ ] \`publish-ready\` 판단에 영향을 주는 변경이 있으면 \`final_publish_ready\` / \`artifact_final_publish_ready\` 검증을 포함했다.
- [ ] workflow 동작 변경이 있으면 테스트를 추가했다.
- [ ] compatibility wrapper/shim을 명시적 이유 없이 제거하지 않았다.
- [ ] generated artifact path를 바꿨다면 workflow, docs, tests를 함께 갱신했다.

### Docs

- [ ] 문서는 가능한 한 한국어로 설명했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] README / AGENTS / docs 간 설명이 충돌하지 않는다.
- [ ] archive 문서를 current guidance처럼 보이게 만들지 않았다.

### Validation

- [ ] \`${validationTestCommand}\`
- [ ] \`${validationValidateCommand}\`
- [ ] 관련 targeted test를 실행했다.
`;
}

function withMinimalEvidencePackSections(body) {
  const sections = [
    '## Evidence Pack 요약',
    '',
    '- Raw candidates: 1',
    '- Eligible candidates: 1',
    '- Selected main articles: 1',
    '- Reserve candidates: 0',
    '- Excluded candidates: 0',
    '- Primary camera stack count: 1',
    '- Supporting bucket count: 0',
    '- Fallback window used: false',
    '- Fallback window consulted: false',
    '- Fallback window reason: none',
    '- Fallback promoted candidates: 0',
    '- Fallback bucket used: false',
    '',
    '## Claim / HAL Impact 요약',
    '',
    '- Claim validation status: pass',
    '- Claim coverage: bound_claims=1; total_claims=1',
    '- Claim validation availability: available=1; unavailable=0',
    '- Overclaim risk: low',
    '- HAL impact axes: camera_pipeline',
    '- Articles with HAL impact axes: 1',
    '- Articles without HAL impact axes: 0',
    '',
    '| Article | HAL axes | Claim validation | Overclaim risk |',
    '| --- | --- | --- | --- |',
    '| CameraX release | camera_pipeline | status=available; bound=1; total=1 | low |',
    '',
    '## 선택된 Main Article 근거',
    '',
    '| # | Title | Source | URL | Source tier | Source role | URL quality | Bucket | Freshness | Reason |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 1 | CameraX release | Android Developers | https://example.com/source | official | primary | article_url | android_platform_camera_adjacent | current | Camera source evidence |',
    '',
    '## 제외 후보 근거',
    '',
    '- none',
    '',
    '## Needs-fix / Review-only 진단',
    '',
    '- Quality hard failures: source-integrity',
    '- Fact-check must-fix: needs source binding',
    '- Repair failures: none',
    '- Candidate shortage hints: none',
    '- Source gap warnings: none',
    '- Missing artifacts: none',
    '- Invalid artifacts: none',
    '',
    '## 사람 검토 체크리스트',
    '',
    '- [ ] Selected main article source URL opens and matches the dated evidence.',
    '- [ ] HAL impact axes are concrete and not generic AI-only.',
    '- [ ] Fact-check must-fix items are resolved before publish-ready labeling.',
    ''
  ].join('\n');
  return body.replace('\n## 후보 기사 추적', `\n${sections}\n## 후보 기사 추적`);
}

test('validate-pr-body handles non-string input without throwing', () => {
  for (const input of [null, undefined, 42]) {
    const result = validatePrBodyText(input);
    assert.equal(result.ok, false, String(input));
    assert.equal(result.bodyKind, 'unknown');
    assert.match(result.errors.join('\n'), /유형을 판정할 수 없습니다/);
  }

  assert.equal(extractSections(null).size, 0);
  assert.equal(extractSections(undefined).size, 0);
  assert.equal(extractSections(42).size, 0);
  assert.equal(extractStatusSection(null), '');
  assert.equal(extractStatusSection(42), '');
});

test('validate-pr-body detects body kind before applying type-specific contracts', () => {
  assert.equal(detectBodyKind(newsletterTemplateBody()), 'newsletter-template');
  assert.equal(detectBodyKind(codeDocsTemplateBody()), 'code-docs-template');
  assert.deepEqual(resolveBodyKind(newsletterTemplateBody(), 'newsletter'), {
    bodyKind: 'newsletter-template',
    requestedType: 'newsletter',
    detectedKind: 'newsletter-template',
    detectedKinds: ['newsletter-template']
  });
  assert.equal(resolveBodyKind(codeDocsTemplateBody(), 'newsletter').bodyKind, 'type-mismatch');
  assert.equal(resolveBodyKind(newsletterTemplateBody(), 'foo').bodyKind, 'invalid-type');
});

test('validate-pr-body accepts generated and template newsletter bodies through newsletter type', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const generatedBody = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });
  const generatedResult = validatePrBodyText(generatedBody, { type: 'newsletter', date });
  assert.equal(generatedResult.ok, true, JSON.stringify(generatedResult, null, 2));
  assert.equal(generatedResult.bodyKind, 'generated-newsletter');

  const templateResult = validatePrBodyText(newsletterTemplateBody(), { type: 'newsletter' });
  assert.equal(templateResult.ok, true, JSON.stringify(templateResult, null, 2));
  assert.equal(templateResult.bodyKind, 'newsletter-template');
});

test('validate-pr-body rejects body type mismatches and ambiguous bodies', () => {
  const newsletterAsCodeDocs = validatePrBodyText(newsletterTemplateBody(), { type: 'code-docs' });
  assert.equal(newsletterAsCodeDocs.ok, false);
  assert.equal(newsletterAsCodeDocs.bodyKind, 'type-mismatch');
  assert.match(newsletterAsCodeDocs.errors.join('\n'), /type 불일치/);

  const codeDocsAsNewsletter = validatePrBodyText(codeDocsTemplateBody(), { type: 'newsletter' });
  assert.equal(codeDocsAsNewsletter.ok, false);
  assert.equal(codeDocsAsNewsletter.bodyKind, 'type-mismatch');
  assert.match(codeDocsAsNewsletter.errors.join('\n'), /type 불일치/);

  const ambiguous = validatePrBodyText(`${newsletterTemplateBody()}\n${codeDocsTemplateBody()}`, { type: 'auto' });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.bodyKind, 'ambiguous');
  assert.match(ambiguous.errors.join('\n'), /유형이 모호합니다/);
});

test('validate-pr-body rejects selector-only, unknown, and invalid type bodies', () => {
  const rootSelector = validatePrBodyText('## PR 유형 선택\n\n- Newsletter publication PR', { type: 'auto' });
  assert.equal(rootSelector.ok, false);
  assert.equal(rootSelector.bodyKind, 'root-selector');
  assert.match(rootSelector.errors.join('\n'), /선택 안내 template/);

  const unknown = validatePrBodyText('## 변경 요약\n\n- 한글 PR body만 작성했습니다.', { type: 'auto' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.bodyKind, 'unknown');
  assert.match(unknown.errors.join('\n'), /유형을 판정할 수 없습니다/);

  const invalidType = validatePrBodyText(codeDocsTemplateBody(), { type: 'invalid' });
  assert.equal(invalidType.ok, false);
  assert.equal(invalidType.bodyKind, 'invalid-type');
  assert.match(invalidType.errors.join('\n'), /허용값: auto, newsletter, code-docs/);
});

test('validate-pr-body accepts npm.cmd validation commands in template bodies', () => {
  const result = validatePrBodyText(codeDocsTemplateBody({
    testCommand: 'npm.cmd run test',
    validateCommand: 'npm.cmd run validate'
  }), { type: 'code-docs' });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.bodyKind, 'code-docs-template');
});

test('validate-pr-body rejects template bodies with missing validation commands', () => {
  const body = codeDocsTemplateBody().replace(/- \[ \] `npm run validate`\n/, '');
  const result = validatePrBodyText(body, { type: 'code-docs' });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /npm run validate/);

  const commandOutsideValidation = codeDocsTemplateBody()
    .replace('### Scope', '### Scope\n\n- [ ] `npm.cmd run validate`를 Scope 섹션에 적었다.')
    .replace(/- \[ \] `npm run validate`\n/, '');
  const sectionScoped = validatePrBodyText(commandOutsideValidation, { type: 'code-docs' });
  assert.equal(sectionScoped.ok, false);
  assert.match(sectionScoped.errors.join('\n'), /Validation 섹션/);
});

test('validate-pr-body requires publish status consistency flag to use generated newsletter bodies', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  const templatePath = path.join(root, '.tmp', 'newsletter-template-pr-body.md');
  writeText(templatePath, newsletterTemplateBody());
  const templateWithoutFlag = validatePrBodyFile(templatePath, {
    root,
    date,
    type: 'newsletter'
  });
  assert.equal(templateWithoutFlag.ok, true, JSON.stringify(templateWithoutFlag, null, 2));
  assert.equal(templateWithoutFlag.bodyKind, 'newsletter-template');

  const templateWithFlag = validatePrBodyFile(templatePath, {
    root,
    date,
    type: 'newsletter',
    requirePublishStatusConsistency: true
  });
  assert.equal(templateWithFlag.ok, false);
  assert.equal(templateWithFlag.bodyKind, 'newsletter-template');
  assert.match(templateWithFlag.errors.join('\n'), /generated-newsletter/);

  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });
  const generatedPath = path.join(root, '.tmp', 'newsroom-pr-body.md');
  writeText(generatedPath, buildNewsroomPrBody({ root, date, validateOutcome: 'success' }));
  const generatedResult = validatePrBodyFile(generatedPath, {
    root,
    date,
    type: 'newsletter',
    requirePublishStatusConsistency: true,
    requireHomepageHeadlineDesignReview: false
  });
  assert.equal(generatedResult.ok, false);
  assert.equal(generatedResult.bodyKind, 'generated-newsletter');
  assert.match(generatedResult.errors.join('\n'), /consistency_errors|Artifact consistency errors/);
});

test('validate-pr-body root wrapper CLI handles type-aware template validation', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const bodyPath = path.join(root, 'code-docs-pr-body.md');
  writeText(bodyPath, codeDocsTemplateBody({
    testCommand: 'npm.cmd run test',
    validateCommand: 'npm.cmd run validate'
  }));

  const valid = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'validate-pr-body.js'),
    bodyPath,
    '--type',
    'code-docs'
  ], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /Validated PR body/);

  const invalid = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'validate-pr-body.js'),
    bodyPath,
    '--type',
    'foo'
  ], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /허용값: auto, newsletter, code-docs/);
});

test('validate-pr-body treats editorial decision summary as optional but complete when present', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const withoutSummary = body.replace(/^## 편집자 기사 판단 요약[\s\S]*?(?=^## 생성 상태$)/m, '');
  const missingVerdict = body.replace(/^## 편집자 결론[\s\S]*?(?=^## 판단 라벨 의미$)/m, '');
  const missingLegend = body.replace(/^## 판단 라벨 의미[\s\S]*?(?=^## 생성 상태$)/m, '');
  const badLabel = body.replace('메인(Main)', '최고기사(Best)');
  const missingPipelineColumn = body.replace(' | Pipeline 상태 |', ' | ');

  assert.equal(validatePrBodyText(withoutSummary, { date }).ok, true);

  const missingVerdictResult = validatePrBodyText(missingVerdict, { date });
  assert.equal(missingVerdictResult.ok, false);
  assert.match(missingVerdictResult.errors.join('\n'), /편집자 결론/);

  const missingLegendResult = validatePrBodyText(missingLegend, { date });
  assert.equal(missingLegendResult.ok, false);
  assert.match(missingLegendResult.errors.join('\n'), /판단 라벨 의미/);

  const badLabelResult = validatePrBodyText(badLabel, { date });
  assert.equal(badLabelResult.ok, false);
  assert.match(badLabelResult.errors.join('\n'), /unknown decision label/);

  const missingPipelineResult = validatePrBodyText(missingPipelineColumn, { date });
  assert.equal(missingPipelineResult.ok, false);
  assert.match(missingPipelineResult.errors.join('\n'), /Pipeline 상태/);
});

test('validate-pr-body checks Evidence Pack fallback diagnostic rows', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = withMinimalEvidencePackSections(
    buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() })
  );
  const brokenBody = body.replace('- Fallback promoted candidates: 0\n', '');
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack summary is missing "Fallback promoted candidates" row/);
});

test('validate-pr-body checks Evidence Pack table columns when section is present', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = withMinimalEvidencePackSections(
    buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() })
  );
  const brokenBody = body.replace(
    '| # | Title | Source | URL | Source tier | Source role | URL quality | Bucket | Freshness | Reason |',
    '| # | Title | Source | Source tier | Source role | URL quality | Bucket | Freshness | Reason |'
  );
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack selected article table is missing required columns: URL/);
});

test('validate-pr-body checks Evidence Pack claim and HAL impact summary columns', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = withMinimalEvidencePackSections(
    buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() })
  );
  const brokenBody = body.replace(
    '| Article | HAL axes | Claim validation | Overclaim risk |',
    '| Article | HAL axes | Claim validation |'
  );
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack claim\/HAL table is missing required columns: Overclaim risk/);
});

test('validate-pr-body checks Evidence Pack diagnostics for needs-fix bodies', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date, {
    failure_diagnostics: {
      quality_hard_failures: ['source-integrity'],
      fact_check_must_fix: ['needs source binding'],
      repair_failures: [],
      candidate_shortage_hints: [],
      source_gap_warnings: [],
      missing_artifacts: [],
      invalid_artifacts: []
    }
  });

  const body = withMinimalEvidencePackSections(
    buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() })
  );
  const brokenBody = body
    .replace('- Quality hard failures: source-integrity', '- Quality hard failures: none')
    .replace('- Fact-check must-fix: needs source binding', '- Fact-check must-fix: none');
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack diagnostics must include at least one actionable diagnostic/);
});

test('validate-pr-body keeps compatibility when Evidence Pack section is absent', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.doesNotMatch(body, /^## Evidence Pack 요약$/m);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('validate-pr-body fails when consistency errors are present', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /consistency_errors/);
});

test('validate-pr-body allows review PR when final publish is false without consistency errors', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const filePath = path.join(root, '.tmp', 'newsroom-pr-body.md');
  writeText(filePath, body);

  const result = validatePrBodyFile(filePath, {
    root,
    date,
    validateOutcome: 'failure',
    requireHomepageHeadlineDesignReview: false
  });

  assert.equal(result.ok, true);
});

test('validate-pr-body requires actual homepage headline design review evidence for file validation', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const originalEnv = {
    figma: process.env.HOMEPAGE_HEADLINE_FIGMA_URL,
    desktop: process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE,
    mobile: process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE,
    deviation: process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION
  };
  delete process.env.HOMEPAGE_HEADLINE_FIGMA_URL;
  delete process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE;
  delete process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE;
  delete process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION;
  try {
    const filePath = path.join(root, '.tmp', 'newsroom-pr-body.md');
    writeText(filePath, buildNewsroomPrBody({ root, date, validateOutcome: 'failure' }));
    const missing = validatePrBodyFile(filePath, { root, date, validateOutcome: 'failure' });

    assert.equal(missing.ok, false);
    assert.match(missing.errors.join('\n'), /Homepage Headline Design Review/);

    process.env.HOMEPAGE_HEADLINE_FIGMA_URL = 'https://www.figma.com/design/EWJMa8vjfZLjdn9a7s3Kzs';
    process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE = 'covered';
    process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE = 'reviewed';
    process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION = 'none';
    writeText(filePath, buildNewsroomPrBody({ root, date, validateOutcome: 'failure' }));
    const reviewed = validatePrBodyFile(filePath, { root, date, validateOutcome: 'failure' });

    assert.equal(reviewed.ok, true, reviewed.errors.join('\n'));
  } finally {
    if (originalEnv.figma === undefined) delete process.env.HOMEPAGE_HEADLINE_FIGMA_URL;
    else process.env.HOMEPAGE_HEADLINE_FIGMA_URL = originalEnv.figma;
    if (originalEnv.desktop === undefined) delete process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE;
    else process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE = originalEnv.desktop;
    if (originalEnv.mobile === undefined) delete process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE;
    else process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE = originalEnv.mobile;
    if (originalEnv.deviation === undefined) delete process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION;
    else process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION = originalEnv.deviation;
  }
});

test('validate-pr-body accepts diagnostics-only wording and rejects misleading publish-ready wording', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    status: {
      status: 'NEEDS_FIX',
      failure_kind: 'editorial_reviewable',
      failure_stage: 'editor repair attempt 1/2',
      failure_reason: 'section_count_drift',
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      publish_gate_passed: false,
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      public_newsletter_ready: true,
      review_publication_ready: true,
      homepage_visible_after_merge: true
    },
    generationStatus: {
      status: 'NEEDS_FIX',
      failure_kind: 'editorial_reviewable',
      failure_stage: 'editor repair attempt 1/2',
      failure_reason: 'section_count_drift',
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      public_newsletter_ready: true,
      review_publication_ready: true,
      homepage_visible_after_merge: true
    },
    repairFailure: {
      code: 'section_count_drift',
      message: 'section_count_drift: targeted repair shrank 3 sections to 2.'
    },
    quality: {
      status: 'NEEDS_FIX',
      score: 79
    }
  });
  const changedArtifacts = REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
    .map(file => `articles/content/newsroom/${date}/${file}`);
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts
  });

  assert.match(body, /diagnostics_only: true/);
  assert.match(body, /public_newsletter_ready: false/);
  assert.match(body, /homepage_visible_after_merge: false/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /section_count_drift/);
  const validation = validatePrBodyText(body, { date });
  assert.equal(validation.ok, true, validation.errors.join('\n'));

  const bodyWithNegativeHardFailure = `${body}\n- Quality hard failures: Main article has actionability_level=none and cannot be publish-ready.\n`;
  const negativeHardFailureValidation = validatePrBodyText(bodyWithNegativeHardFailure, { date });
  assert.equal(
    negativeHardFailureValidation.ok,
    true,
    negativeHardFailureValidation.errors.join('\n')
  );

  const allowedNegative = body.replace(
    'This PR is not publish-ready.',
    'publish-ready label must not be applied.'
  );
  const allowedNegativeValidation = validatePrBodyText(allowedNegative, { date });
  assert.equal(allowedNegativeValidation.ok, true, allowedNegativeValidation.errors.join('\n'));

  for (const misleading of [
    'This PR is publish-ready.',
    'Ready to publish.',
    'Final publish ready: true.',
    'public newsletter generated successfully.'
  ]) {
    const result = validatePrBodyText(body.replace('This PR is not publish-ready.', misleading), { date });
    assert.equal(result.ok, false, misleading);
    assert.match(result.errors.join('\n'), /misleading publish-ready wording/);
  }
});

test('validate-pr-body ignores policy definitions when detecting concrete publication state', () => {
  const reviewRoot = fsTempRoot('newsroom-pr-body-');
  const reviewDate = '2026-05-09';
  writeEditorialReviewableArtifacts(reviewRoot, reviewDate);
  writePublicNewsletterArtifacts(reviewRoot, reviewDate);
  const reviewBody = buildNewsroomPrBody({
    root: reviewRoot,
    date: reviewDate,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${reviewDate}/${file}`)
      .concat([
        `articles/newsletters/${reviewDate}/newsletter.md`,
        `articles/newsletters/${reviewDate}/index.html`,
        'articles/data/newsletters.json'
      ])
  });

  assert.match(reviewBody, /diagnostics_only: false/);
  assert.match(reviewBody, /review_publication_ready: true/);
  const reviewValidation = validatePrBodyText(reviewBody, { date: reviewDate });
  assert.equal(reviewValidation.ok, true, reviewValidation.errors.join('\n'));

  const diagnosticsRoot = fsTempRoot('newsroom-pr-body-');
  const diagnosticsDate = '2026-05-08';
  writeFailedRepairReviewableArtifacts(diagnosticsRoot, diagnosticsDate);
  const diagnosticsBody = buildNewsroomPrBody({
    root: diagnosticsRoot,
    date: diagnosticsDate,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${diagnosticsDate}/${file}`)
  });

  assert.match(diagnosticsBody, /review_publication_ready: false/);
  assert.match(diagnosticsBody, /diagnostics_only: true/);
  const diagnosticsValidation = validatePrBodyText(diagnosticsBody, { date: diagnosticsDate });
  assert.equal(diagnosticsValidation.ok, true, diagnosticsValidation.errors.join('\n'));
});

function traceStatus(overrides = {}) {
  return {
    status: 'NEEDS_FIX',
    fact_check_status: 'NEEDS_FIX',
    must_fix_count: 1,
    source_gap_count: 1,
    quality_status: 'NEEDS_FIX',
    quality_score: 72,
    quality_threshold: qualityGatePolicy.threshold,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0,
    validate_outcome: 'failure',
    consistency_errors: [],
    ...overrides
  };
}
