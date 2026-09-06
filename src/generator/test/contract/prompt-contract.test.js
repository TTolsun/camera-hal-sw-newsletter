const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  articleClaimContractPrompt,
  articleSectionContractPrompt,
  claimRepairEvidencePrompt,
  publicArticleJudgePrompt,
  publicArticleContractPrompt,
  publicationBoundaryPrompt,
  cameraHalEditorialVoicePrompt,
  cameraHalEditorialVoiceWithPlanPrompt,
  sourceExtractionPromptGuardrails
} = require('../../reporter/newsletter-prompts');
const {
  publicArticleJudgeBlockingIssues
} = require('../../publish/orchestrator-judge-helpers');
const {
  reporterSchema,
  publicArticleJudgeSchema
} = require('../../render/newsletter-schema');

function promptHostSource() {
  const host = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const prompts = fs.readFileSync(
    path.join(__dirname, '..', '..', 'reporter', 'newsletter-prompts.js'),
    'utf8'
  );
  // 단계별 시스템 프롬프트는 orchestrator-stage-prompts.js의 빌더로 분리되어 있다(#655).
  const stagePrompts = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'orchestrator-stage-prompts.js'),
    'utf8'
  );
  return `${host}\n${prompts}\n${stagePrompts}`;
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
  assert.match(prompt, /android_camera_api\/android: CameraX\/Camera2, preview\/capture, permission, app compatibility, Surface 연결/);
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
  assert.match(prompt, /source가 뒷받침하는 범위 안에서만 HAL\/driver\/runtime 영향을 서술하고, source가 말하지 않는 영향을 지어내거나 확대하지 마세요/);
  assert.match(prompt, /Camera HAL\/Driver 관점에서의 의미/);
  // camera_hal_takeaway는 디스클레이머로 시작하지 말고 구체 점검 항목을 먼저 제시해야 한다(de-hedge).
  assert.match(prompt, /"직접적인 HAL 변경은 없으나" 같은 디스클레이머로 문장을 시작하지 말고/);
  assert.match(prompt, /관련 metadata key, request\/result 필드, CTS\/VTS\/ITS 항목, V4L2\/uAPI 구조체, 버퍼\/포맷, 라이브러리 버전·재빌드 영향/);
  // 단, overclaim 안전장치(source 미근거 영향 지어내기 금지)는 유지되어야 한다.
  assert.match(prompt, /source_extraction\/behavior_change가 뒷받침하지 않는 HAL\/driver\/runtime 영향은 지어내지 말고/);
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

test('camera HAL editorial voice prompt carries the #693 narrative arc and overclaim guards', () => {
  const prompt = cameraHalEditorialVoicePrompt();

  assert.match(prompt, /에디토리얼 보이스/);
  assert.match(prompt, /일반 IT 뉴스처럼 요약하지 말고/);
  assert.match(prompt, /lower camera stack/);
  assert.match(prompt, /원문에서 실제로 일어난 일을 먼저 설명/);
  assert.match(prompt, /Camera HAL과의 거리감/);
  assert.match(prompt, /직접 변경 \/ 참고할 흐름 \/ 추적할 리스크/);
  assert.match(prompt, /Impact, Layer, Scope, HAL Relevance 같은 라벨 제목은 본문에 노출하지 말고/);
  assert.match(prompt, /이미지 센서 제조사, SoC\/platform vendor, ISP IP 제공자, 패치 작성자, 테스트에 쓰인 보드, 실제 적용 디바이스를 혼동하지 마세요/);
  assert.match(prompt, /Samsung, S\.LSI, Exynos, 특정 상용 제품, 양산 적용, 직접적인 성능 개선, 카메라 화질 개선으로 확대 해석하지 마세요/);
  assert.match(prompt, /sensor bring-up, mode table, exposure\/gain\/frame timing, MIPI CSI topology, media graph/);
  assert.match(prompt, /review NACK, RAW-only\/limited mode/);
});

test('editorial voice prompt is writer-only: editor and completion compose it, fact-check and reporter do not', () => {
  // 호출부(인자 유무 무관)만 세려고 stage-prompts 파일만 본다. 정의는 newsletter-prompts.js에 있어
  // 여기엔 import(괄호 없음)와 두 호출(editor: 인자 있음, completion: 인자 없음)만 있다.
  const stagePrompts = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'orchestrator-stage-prompts.js'),
    'utf8'
  );
  // editor는 plan 전제 slim(WithPlan), completion은 full을 쓴다 → 두 voice 함수 합쳐 정확히 2회.
  const usageCount = (stagePrompts.match(/cameraHalEditorialVoice(WithPlan)?Prompt\(/g) || []).length;
  assert.equal(usageCount, 2, `editorial voice should be composed exactly in editor + completion, got ${usageCount}`);

  const editorStart = stagePrompts.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI editor입니다.');
  const editorEnd = stagePrompts.indexOf('schema와 일치하는 JSON만 반환하세요.', editorStart);
  // editor는 plan을 항상 받으므로 plan 전제 voice(WithPlan)를 쓴다.
  assert.match(stagePrompts.slice(editorStart, editorEnd), /cameraHalEditorialVoiceWithPlanPrompt\(/);

  const completionStart = stagePrompts.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI completion editor입니다.');
  const completionEnd = stagePrompts.indexOf('schema와 일치하는 JSON만 반환하세요.', completionStart);
  // completion은 plan을 받지 않으므로 full voice를 쓴다.
  assert.match(stagePrompts.slice(completionStart, completionEnd), /cameraHalEditorialVoicePrompt\(/);

  // 검증 LLM(fact-checker)·patch-only repair에는 톤 조각을 넣지 않는다 — must_fix 요구는 불변.
  const factCheckStart = stagePrompts.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI fact checker입니다.');
  const factCheckEnd = stagePrompts.indexOf('schema와 일치하는 JSON만 반환하세요.', factCheckStart);
  assert.doesNotMatch(stagePrompts.slice(factCheckStart, factCheckEnd), /cameraHalEditorialVoice(WithPlan)?Prompt\(/);

  const repairStart = stagePrompts.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI repair editor입니다.');
  const repairEnd = stagePrompts.indexOf('schema와 일치하는 {patches:[...]} JSON만 반환하세요.', repairStart);
  assert.doesNotMatch(stagePrompts.slice(repairStart, repairEnd), /cameraHalEditorialVoice(WithPlan)?Prompt\(/);
});

test('editorial voice prompt slims generic guardrails when an editorial plan is present (#700)', () => {
  const full = cameraHalEditorialVoicePrompt();
  const slim = cameraHalEditorialVoiceWithPlanPrompt();

  // 서사 아크와 내부 라벨 비노출은 두 버전 모두 항상 유지된다.
  for (const prompt of [full, slim]) {
    assert.match(prompt, /원문에서 실제로 일어난 일을 먼저 설명/);
    assert.match(prompt, /Impact, Layer, Scope, HAL Relevance 같은 라벨 제목은 본문에 노출하지 말고/);
  }
  // plan이 있으면 generic 가드레일 verbose 줄을 빼고 "plan을 따르라"로 대체한다(중복 축소).
  assert.match(full, /Samsung, S\.LSI, Exynos, 특정 상용 제품, 양산 적용, 직접적인 성능 개선, 카메라 화질 개선으로 확대 해석하지 마세요/);
  assert.doesNotMatch(slim, /Samsung, S\.LSI, Exynos, 특정 상용 제품, 양산 적용, 직접적인 성능 개선, 카메라 화질 개선으로 확대 해석하지 마세요/);
  assert.match(slim, /제공된 internal editorial plan이 각 기사의/);
  assert.match(slim, /어떤 기사를 main article로 낼지·기사 개수·기사 식별은 바꾸지 마세요/);
  // plan이 대체해도 안전 개념(혼동·제한)은 slim에도 짧게 남아 안전망을 유지한다.
  assert.match(slim, /misunderstanding_risks/);
  assert.match(slim, /source_limitations/);
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
  // #725 desk-review 4축: 위반은 P3 advisory issue로만 표현(절대 hard-block 아님).
  assert.match(prompt, /desk_target_explanation/);
  assert.match(prompt, /desk_layer_distinction/);
  assert.match(prompt, /desk_source_limitations/);
  assert.match(prompt, /desk_subject_attribution/);
  assert.match(prompt, /P3/);
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
  // reporter 시스템 프롬프트는 orchestrator-stage-prompts.js의 빌더에 있고,
  // 호출부(user context arg)는 god-file에 남는다(#655).
  const stagePrompts = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'orchestrator-stage-prompts.js'),
    'utf8'
  );
  const start = stagePrompts.indexOf('당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI reporter입니다.');
  assert.notEqual(start, -1);
  const end = stagePrompts.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
  assert.notEqual(end, -1);
  const reporterPrompt = stagePrompts.slice(start, end);

  assert.match(reporterPrompt, /sourceExtractionPromptGuardrails\(\),/);
  assert.match(reporterPrompt, /evidence-backed candidate facts/);
  assert.match(reporterPrompt, /candidate_id, title, source, url은 matching을 위한 echo-only field/);
  assert.match(reporterPrompt, /score, selection flag, imageCandidates, source_quality는 출력하지 마세요/);
  assert.doesNotMatch(reporterPrompt, /public-facing impact wording/);
  assert.doesNotMatch(reporterPrompt, /numeric score/);
  assert.doesNotMatch(reporterPrompt, /camera_hal_relevance_score: 0-5/);
  assert.doesNotMatch(reporterPrompt, /image URL을 만들거나/);
  assert.doesNotMatch(reporterPrompt, /selected는 reporter-stage judgment/);

  const host = fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const callStart = host.indexOf('reporterSystemPrompt(');
  assert.notEqual(callStart, -1);
  const reporterCall = host.slice(callStart, host.indexOf('reporterSchema', callStart));
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

test('every fact-check stage carries the fake-must-fix scope guardrail', () => {
  const source = promptHostSource();
  const factCheckStageAnchors = [
    '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI fact checker입니다.',
    '당신은 repaired AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.',
    '당신은 completed AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.'
  ];
  for (const anchor of factCheckStageAnchors) {
    const start = source.indexOf(anchor);
    assert.notEqual(start, -1, `Missing fact-check stage anchor: ${anchor}`);
    const end = source.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
    assert.notEqual(end, -1, `Missing schema anchor after: ${anchor}`);
    const stagePrompt = source.slice(start, end);
    assert.match(
      stagePrompt,
      /editor schema에 정의된 유효한 필드의 존재 자체를 deprecated\/legacy로 판정하거나 must_fix로 올리지 마세요\./,
      `fake-must-fix guardrail missing in fact-check stage: ${anchor}`
    );
    assert.match(
      stagePrompt,
      /must_fix\[\]는 source가 직접 반증하는 factual 오류, 누락\/위조된 출처, 명시된 editorial-policy 위반 전용입니다\./,
      `must_fix scope clause missing in fact-check stage: ${anchor}`
    );
  }
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
