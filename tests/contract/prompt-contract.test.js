const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  articleClaimContractPrompt,
  articleSectionContractPrompt,
  claimRepairEvidencePrompt,
  publicArticleJudgeBlockingIssues,
  publicArticleJudgePrompt,
  publicArticleContractPrompt,
  publicationBoundaryPrompt,
  sourceExtractionPromptGuardrails
} = require('../../scripts/gemini-newsroom-newsletter');
const {
  reporterSchema,
  publicArticleJudgeSchema
} = require('../../scripts/newsroom/render/newsletter-schema');

function promptHostSource() {
  const host = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const prompts = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'newsletter-prompts.js'),
    'utf8'
  );
  return `${host}\n${prompts}`;
}

function assertStagePromptUsesFactCheckHelpers(source, stageAnchor) {
  const start = source.indexOf(stageAnchor);
  assert.notEqual(start, -1, `Missing stage anchor: ${stageAnchor}`);
  const end = source.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
  assert.notEqual(end, -1, `Missing schema anchor after: ${stageAnchor}`);
  const stagePrompt = source.slice(start, end);

  assert.match(stagePrompt, /factCheckSeverityPrompt\(\),/);
  assert.match(stagePrompt, /cameraDeveloperToolingFactCheckPrompt\(\),/);
}

function schemaStats(schema, depth = 0, stats = { bytes: 0, properties: 0, required: 0, maxDepth: 0 }) {
  if (!schema || typeof schema !== 'object') return stats;
  stats.maxDepth = Math.max(stats.maxDepth, depth);
  if (schema.properties) {
    stats.properties += Object.keys(schema.properties).length;
    for (const value of Object.values(schema.properties)) {
      schemaStats(value, depth + 1, stats);
    }
  }
  if (Array.isArray(schema.required)) stats.required += schema.required.length;
  if (schema.items) schemaStats(schema.items, depth + 1, stats);
  return stats;
}

test('article section contract prompt fixes the five normalized keys and guardrails', () => {
  const prompt = articleSectionContractPrompt();

  for (const key of [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]) {
    assert.match(prompt, new RegExp(key));
  }
  assert.match(prompt, /article_sections를 포함해야 합니다/);
  assert.match(prompt, /required keys/);
  assert.match(prompt, /known_limitations/);
  assert.match(prompt, /watch_items/);
  assert.match(prompt, /do_not_claim/);
  assert.match(prompt, /optional arrays/);
  assert.match(prompt, /guardrail array/);
  assert.match(prompt, /article_sections는 모든 main article의 canonical 구조입니다/);
  assert.match(prompt, /section 최상위에 background, why_it_matters, camera_hal_perspective, team_summary 같은 평면 prose 필드를 출력하지 마세요/);
  assert.match(prompt, /article_sections\.background_context, article_sections\.hal_driver_impact, article_sections\.team_share_points로만 제공하세요/);
  assert.match(prompt, /source-backed facts/);
  assert.match(prompt, /Jetpack Compose/);
  assert.match(prompt, /CameraX 앱 화면 guidance/);
  assert.match(prompt, /direct HAL\/API\/runtime change로 쓰지 마세요/);
  assert.match(prompt, /HAL 해석/);
  assert.match(prompt, /runtime\/API behavior/);
  assert.match(prompt, /구체적 action/);
  assert.match(prompt, /Action target scope:/);
  assert.match(prompt, /direct_camera_hal\/direct_aosp_camera\/camera_driver_image_pipeline: source가 직접 뒷받침할 때만 request\/result, metadata, stream, buffer, vendor tag, HAL contract/);
  assert.match(prompt, /android_camera_api\/android_platform_camera_adjacent: CameraX\/Camera2, preview\/capture, permission, app compatibility, Surface 연결/);
  assert.match(prompt, /android_multimedia_camera_output: Camera HAL 직접 변경으로 쓰지 말고 camera output path, preview, recording, camera-generated playback/);
  assert.match(prompt, /MediaCodec\/Media3\/MediaRecorder\/Photo Picker\/WebRTC\/A\/V sync/);
  assert.match(prompt, /what changed, affected camera output path, why Camera HAL\/Android camera engineers should care, direct\/indirect\/downstream impact/);
  assert.match(prompt, /public article에서는 direct\/indirect\/downstream impact를 enum이 아니라 자연스러운 한국어 설명 문장/);
  assert.match(prompt, /generic player, streaming-only, music, DRM\/player-only, OTT-only, audio-only/);
  assert.match(prompt, /cpp_ai_tooling_fallback: build\/test\/debug workflow, sample\/prototype app, Camera API usage/);
  assert.match(prompt, /HAL runtime, stream, buffer, metadata 변경을 기본 action target으로 만들지 마세요/);
  assert.match(prompt, /reference_only\/watchlist: 직접 조치 문장이 아니라 관찰\/제한 문장/);
  assert.match(prompt, /bucket scope에 맞는 구체 follow-up/);
  assert.match(prompt, /direct HAL\/driver evidence가 있는 경우에만 stream, buffer, metadata, request\/result, vendor tag/);
  assert.match(prompt, /app\/API\/tooling article에서는 permission, CameraX\/Camera2 usage, preview\/capture behavior, build\/test\/debug workflow/);
  assert.doesNotMatch(prompt, /owner\/test\/log\/metric\/API\/stream\/buffer\/metadata follow-up/);
  assert.match(prompt, /verified_facts에 복사하면 안 됩니다/);
  assert.match(prompt, /do_not_claim은 source-backed fact나 public article content로 render하지 말고/);
});

test('public article contract prompt keeps public output separate from diagnostics', () => {
  const prompt = publicArticleContractPrompt();

  for (const marker of [
    'public_article',
    'source_fact_bundle',
    'public_contract_version="story-v1"',
    'generation_contract_version=1',
    'story_contract_version=1',
    'headline',
    'source_subtitle',
    'lead',
    'body_paragraphs',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'editorial_story',
    'reader_scenario',
    'what_happened',
    'field_scenario',
    'not_to_overclaim',
    'editor_take',
    'source_links',
    'source-bound engineering inference',
    'selected article capsule',
    'source facts',
    'public-facing impact wording',
    'claim-level classification',
    'article_sections.hal_driver_impact',
    'public_article.camera_hal_takeaway',
    'claims[].impact_level'
  ]) {
    assert.match(prompt, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(prompt, /독자-facing/);
  assert.match(prompt, /가정형 현업 장면/);
  assert.match(prompt, /source-confirmed fact/);
  assert.match(prompt, /모든 기사에 같은 작성 기준/);
  assert.match(prompt, /fallback_public 또는 relevance_bucket 때문에 본문을 짧은 generic 문장/);
  assert.match(prompt, /3-5개 자연스러운 문단/);
  assert.match(prompt, /발표, 변경, 배경, 지원 범위, 적용 예시, 제약, 향후 계획/);
  assert.match(prompt, /Public-facing impact wording과 claim-level classification은 public_article\.camera_hal_takeaway, article_sections\.hal_driver_impact, claims\[\]\.impact_level/);
  assert.match(prompt, /source가 직접 말하지 않는 HAL\/driver\/runtime 영향은 없다고 제한/);
  assert.match(prompt, /Camera HAL\/Driver 관점에서의 의미/);
  assert.match(prompt, /android_multimedia_camera_output article의 camera_hal_takeaway는 Camera HAL 직접 변경이 아니라 camera-generated output/);
  assert.match(prompt, /validation report, checklist, enum, schema\/debug field name/);
  assert.match(prompt, /claim\/schema contract와 public prose contract를 섞지 마세요/);
  assert.match(prompt, /primary 또는 seed evidence URL/);
  assert.match(prompt, /reader_checkpoints는 최소 2개/);
  assert.match(prompt, /내부 QA\/checklist용 필드/);
  assert.match(prompt, /Markdown\/HTML에 직접 렌더링되지 않으므로/);
  assert.match(prompt, /public body나 "Camera HAL\/Driver 관점에서의 의미" 섹션을 대체하지 마세요/);
  assert.match(prompt, /독자가 실제로 확인할 행동/);
  assert.match(prompt, /source 범위 제한/);
  assert.match(prompt, /API\/component\/date/);
  assert.match(prompt, /stream\/metadata/);
  assert.match(prompt, /compatibility test scenario/);
  assert.match(prompt, /vendor pipeline, stream, metadata, buffer/);
  assert.doesNotMatch(prompt, /즉시 조치할 항목은 없습니다\. 참고 동향으로만 공유합니다\./);
});

test('publication boundary prompt isolates deterministic publication judgment', () => {
  const prompt = publicationBoundaryPrompt();

  assert.match(prompt, /deterministic publication judgment/);
  assert.match(prompt, /source eligibility/);
  assert.match(prompt, /source_gap_risk/);
  assert.match(prompt, /main\/supporting 승격/);
  assert.match(prompt, /source link/);
  assert.match(prompt, /do_not_claim/);
  assert.match(prompt, /Gemini는 decision_metadata를 생성하지 마세요/);
});

test('claim repair evidence prompt carries repair-only guidance', () => {
  const prompt = claimRepairEvidencePrompt();

  assert.match(prompt, /allowed_claim_evidence/);
  assert.match(prompt, /이전 invalid output/);
  assert.match(prompt, /새 fact claim/);
});

test('initial editor prompt excludes repair-only claim guidance', () => {
  assert.doesNotMatch(articleClaimContractPrompt(), /Repair|이전 invalid output|재사용/);

  const source = promptHostSource();
  const editorAnchor = '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI editor입니다.';
  const start = source.indexOf(editorAnchor);
  assert.notEqual(start, -1, `Missing editor stage anchor`);
  const end = source.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
  assert.notEqual(end, -1, `Missing schema anchor after editor stage`);
  const editorStageSource = source.slice(start, end);

  assert.doesNotMatch(editorStageSource, /claimRepairEvidencePrompt\(\),/);
  assert.match(source, /claimRepairEvidencePrompt\(\),/);
});

test('public article judge prompt is semantic and does not require keyword vocabulary', () => {
  const prompt = publicArticleJudgePrompt();

  assert.match(prompt, /semantic judge/);
  assert.match(prompt, /article을 다시 쓰는 것이 아니라/);
  assert.match(prompt, /단어 매칭이나 특정 keyword 출현 여부로 판정하지 마세요/);
  assert.match(prompt, /한국어 표현, 동의어, 자연스러운 기술 문장/);
  assert.match(prompt, /reader_checkpoints_pass/);
  assert.match(prompt, /source_boundary_pass/);
  assert.match(prompt, /raw source 재검증이 아니라/);
  assert.match(prompt, /provided evidence boundary|제공된 evidence boundary/);
  assert.match(prompt, /public_prose_pass/);
  assert.match(prompt, /JSON만 반환하세요/);
  assert.doesNotMatch(prompt, /ACTION_VERB_PATTERN|NON_GENERIC_ACTION_TARGET_PATTERN|regex/i);
});

test('public article judge verdicts must cover each section index exactly once', () => {
  const passingVerdict = {
    headline: 'Camera article',
    public_article_pass: true,
    reader_checkpoints_pass: true,
    source_boundary_pass: true,
    public_prose_pass: true,
    issues: []
  };
  const issues = publicArticleJudgeBlockingIssues({
    overall_pass: true,
    section_count_expected: 2,
    section_count_actual: 2,
    sections: [
      { ...passingVerdict, section_index: 1 },
      { ...passingVerdict, section_index: 1 }
    ]
  });

  assert.equal(issues.some(issue => issue.field === 'sections.section_index'), true);
  assert.match(issues.map(issue => issue.reason).join('\n'), /duplicate section_index: 1/);
  assert.match(issues.map(issue => issue.reason).join('\n'), /missing section_index: 2/);
});

test('public article judge schema stays compact for Flash Lite verdicts', () => {
  const stats = schemaStats(publicArticleJudgeSchema);
  stats.bytes = Buffer.byteLength(JSON.stringify(publicArticleJudgeSchema));

  assert.ok(stats.bytes < 1400, `publicArticleJudgeSchema bytes=${stats.bytes}`);
  assert.ok(stats.properties <= 20, `publicArticleJudgeSchema properties=${stats.properties}`);
  assert.ok(stats.required <= 18, `publicArticleJudgeSchema required=${stats.required}`);
  assert.ok(stats.maxDepth <= 5, `publicArticleJudgeSchema maxDepth=${stats.maxDepth}`);
  assert.ok(publicArticleJudgeSchema.properties.sections.items.required.includes('reader_checkpoints_pass'));
});


test('source extraction prompt guardrails keep source facts separate from editorial hints', () => {
  const prompt = sourceExtractionPromptGuardrails();

  assert.match(prompt, /source_extraction/);
  assert.match(prompt, /derived_editorial_hints/);
  assert.match(prompt, /source가 확인한 structured fact/);
  assert.match(prompt, /editorial guidance/);
  assert.match(prompt, /source_extraction\.release\.sections\[\]\.items\[\]\.text/);
  assert.match(prompt, /artifact table/);
  assert.match(prompt, /source URL 또는 전체 source page를 독립 분석하지 마세요/);
  assert.match(prompt, /release version/);
  assert.match(prompt, /validation checklist/);
});

test('LLM editor, repair, completion, and fact-check prompts include article section contract', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/articleSectionContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 5);
});

test('LLM editor, repair, completion, and fact-check prompts include public article contract', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/publicArticleContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 6);
});

test('LLM reporter, editor, repair, completion, and fact-check prompts include source extraction guardrails', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/sourceExtractionPromptGuardrails\(\),/g) || []).length;

  assert.ok(usageCount >= 7);
});

test('LLM reporter prompt stays evidence-only and avoids editor/public bloat', () => {
  const source = promptHostSource();
  const start = source.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI reporter입니다.');
  assert.notEqual(start, -1);
  const end = source.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
  assert.notEqual(end, -1);
  const reporterPrompt = source.slice(start, end);
  const reporterCall = source.slice(start, source.indexOf('reporterSchema', end));

  assert.match(reporterPrompt, /sourceExtractionPromptGuardrails\(\),/);
  assert.match(reporterPrompt, /evidence-backed candidate facts/);
  assert.match(reporterPrompt, /candidate_id, title, source, url은 matching을 위한 echo-only field/);
  assert.match(reporterPrompt, /score, selection flag, imageCandidates, source_quality는 출력하지 마세요/);
  assert.doesNotMatch(reporterPrompt, /public-facing impact wording/);
  assert.doesNotMatch(reporterPrompt, /numeric score/);
  assert.doesNotMatch(reporterPrompt, /camera_hal_relevance_score: 0-5/);
  assert.doesNotMatch(reporterPrompt, /image URL을 만들거나/);
  assert.doesNotMatch(reporterPrompt, /selected는 reporter-stage judgment/);
  assert.match(reporterCall, /\$\{reporterContext\}/);
  assert.doesNotMatch(reporterCall, /\$\{commonContext\}/);
});

test('reporter schema remains slim for Gemini structured output', () => {
  const candidateSchema = reporterSchema.properties.candidates.items;
  const stats = schemaStats(reporterSchema);
  stats.bytes = Buffer.byteLength(JSON.stringify(reporterSchema));

  assert.ok(stats.bytes < 1700, `reporterSchema bytes=${stats.bytes}`);
  assert.ok(stats.properties <= 18, `reporterSchema properties=${stats.properties}`);
  assert.ok(stats.required <= 14, `reporterSchema required=${stats.required}`);
  assert.ok(stats.maxDepth <= 4, `reporterSchema maxDepth=${stats.maxDepth}`);
  assert.ok(candidateSchema.required.includes('candidate_id'));
  for (const removed of [
    'summary',
    'source_quality',
    'source_quality_status',
    'camera_hal_relevance_score',
    'imageCandidates',
    'selected',
    'final_selected'
  ]) {
    assert.equal(Object.hasOwn(candidateSchema.properties, removed), false, removed);
  }
});

test('LLM fact-check prompts map findings to schema fields and allow camera developer tooling coverage', () => {
  const source = promptHostSource();

  assert.doesNotMatch(source, /flag하세요/);
  assertStagePromptUsesFactCheckHelpers(source, '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI fact checker입니다.');
  assertStagePromptUsesFactCheckHelpers(source, '당신은 repaired AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.');
  assertStagePromptUsesFactCheckHelpers(source, '당신은 completed AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.');
  assert.match(source, /must_fix\[\]/);
  assert.match(source, /source_gaps\[\]/);
  assert.match(source, /recommended_fixes\[\]/);
  assert.match(source, /selected capsule metadata/);
  assert.match(source, /source_extraction/);
  assert.match(source, /derived editorial hints는 framing 보조로만 사용/);
  assert.match(source, /단독 publishability 근거로 사용하지 마세요/);
  assert.match(source, /article text 또는 derived editorial hints에만 있고/);
  assert.match(source, /source\/capsule metadata\/source_extraction이 뒷받침하지 않으면/);
  assert.match(source, /Android Studio/);
  assert.match(source, /VS\(Visual Studio\) Code/);
  assert.match(source, /Claude/);
  assert.match(source, /Codex/);
  assert.match(source, /Roo Code/);
  assert.match(source, /OpenCode/);
  assert.doesNotMatch(source, /Rood Code/);
});

test('public article prompt does not force internal triage fallback prose', () => {
  const source = promptHostSource();

  assert.doesNotMatch(source, /즉시 조치할 항목은 없습니다\. 참고 동향으로만 공유합니다\./);
  assert.match(source, /validation report, checklist, enum, schema\/debug field name을 노출하지 마세요/);
  assert.match(source, /claim\/schema contract와 public prose contract를 섞지 마세요/);
  assert.match(source, /reader_checkpoints는 최소 2개/);
  assert.match(source, /reader_checkpoints는 최소 2개이며 내부 QA\/checklist용 필드입니다/);
  assert.match(source, /Markdown\/HTML에 직접 렌더링되지 않으므로/);
  assert.match(source, /body_paragraphs와 camera_hal_takeaway를 반복하는 bullet list로 만들지 마세요/);
  assert.match(source, /validator token을 조합한 문장을 쓰지 마세요/);
});
