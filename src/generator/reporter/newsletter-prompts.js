function linkedEvidencePromptGuardrails() {
  return [
    'Linked evidence diagnostics는 prompt payload에 포함되어 있지 않습니다. 제공된 article capsule 또는 source field에 명시되지 않은 Gerrit, IssueTracker, GitHub, mailing-list, CVE, linked-page 세부 내용은 추론하지 마세요.',
    'Editor draft text는 linked evidence가 아닙니다. draft에 나온 Gerrit, IssueTracker, GitHub, mailing-list, CVE, linked-page 언급은 source-backed fact가 아니라 검증해야 할 claim으로 다루세요.',
    'blocked, failed, skipped, unsupported linked evidence를 확인된 세부 사실처럼 쓰지 마세요.',
    'build_dependency_fix, test_only_change, documentation_only signal을 HAL runtime, stream, buffer, metadata, request/result, implementation, product behavior 변경으로 다루지 마세요.',
    '제공된 evidence가 stream, buffer, metadata, request, result, ImageCapture, VideoCapture, Surface, CameraPipe behavior를 명시하지 않으면 높은 HAL/runtime impact를 주장하지 마세요.'
  ].join('\n');
}

function sourceExtractionPromptGuardrails() {
  return [
    'Source extraction contract: source_extraction은 source가 확인한 structured fact로만 다루고, derived_editorial_hints는 editorial guidance로만 다루세요.',
    'Source quality contract: canonical source_quality는 제공된 값 그대로 사용하세요. Stage 3 generation 안에서 누락된 source quality field를 추론, 복구, override하지 마세요.',
    'main_article_source_allowed=false는 main article generation의 hard blocker입니다. selection input이 명시적으로 허용한 경우에만 blocked candidate를 watchlist/context로 언급하세요.',
    'prose reasoning으로 source_quality.main_article_source_blockers[] 또는 main_article_source_blockers[]를 override하지 마세요.',
    'blocked 또는 failed linked evidence를 factual support로 사용하지 마세요.',
    'Seed evidence contract: 제공된 seed_evidence.compact_evidence facts와 evidence ids만 사용하세요. Stage 3에서 seed URL을 다시 fetch, crawl, browse, 독립 검사하지 마세요.',
    'Keyword hints는 discovery hint일 뿐입니다. keyword_hints를 source-backed fact로 제시하지 마세요.',
    'seed-derived claim에 필요한 seed_evidence evidence_pack_ids 또는 primary_evidence_ids가 없으면 traceability를 만들지 말고 claim을 강등하세요.',
    'CameraX / AndroidX release notes에서는 source_extraction.release.sections[].items[].text가 source-confirmed release-note behavior evidence입니다. artifact table, dependency declaration, page navigation, generic update text로 대체하지 마세요.',
    'derived_editorial_hints를 article_sections.verified_facts에 복사하거나 HAL boundary, validation_targets, do_not_claim, warnings, relevance hint를 source fact처럼 제시하지 마세요.',
    'source URL 또는 전체 source page를 독립 분석하지 마세요. 제공된 article capsule, source_extraction JSON, derived_editorial_hints JSON, source fields만 사용하세요.',
    'source_extraction에 release date, release version, API/component, 구체적인 release-note bullet이 없으면 누락된 release evidence를 만들지 말고 해당 항목을 demote 또는 exclude하세요.',
    'CameraX main article은 해당 field가 제공될 때 release version, release date, 구체적인 release-note bullet, HAL boundary, validation checklist를 명시하세요.'
  ].join('\n');
}

function articleSectionContractPrompt() {
  return [
    'Jetpack Compose, Jetpack Navigation 3, adaptive UI, foldables/tablets, multi-window, CameraX 앱 화면 guidance 같은 Android platform-adjacent article은 background_context에서 platform/UI 배경과 camera preview/capture UX 검증 연결점을 설명하세요. source evidence가 없으면 direct HAL/API/runtime change로 쓰지 마세요.',
    'Article section contract: 새로 생성되는 editor, repair, completion output의 모든 main article은 article_sections를 포함해야 합니다.',
    'article_sections는 required keys인 verified_facts, background_context, hal_driver_impact, action_items, team_share_points를 반드시 포함해야 합니다.',
    'article_sections는 optional arrays인 known_limitations, watch_items, do_not_claim을 추가로 포함할 수 있습니다.',
    'known_limitations와 watch_items는 optional arrays입니다. do_not_claim은 guardrail array이며 verified_facts에 복사하면 안 됩니다.',
    'article_sections는 모든 main article의 canonical 구조입니다. section 최상위에 background, why_it_matters, camera_hal_perspective, team_summary 같은 평면 prose 필드를 출력하지 마세요. 해당 내용은 article_sections.background_context, article_sections.hal_driver_impact, article_sections.team_share_points로만 제공하세요.',
    'article_sections.verified_facts는 source-backed facts의 canonical 배열입니다. evidence 바인딩이 필요한 모든 사실(특히 confirmed_facts에만 둘 법한 더 구체적인 사실)을 verified_facts에도 반드시 포함하세요. HAL 해석이나 권고는 verified_facts에 넣지 마세요.',
    'article_sections.background_context는 AOSP Camera / Camera HAL / driver / SoC platform reader에게 필요한 맥락을 설명하는 string이어야 합니다.',
    'article_sections.hal_driver_impact는 제공된 source가 직접 뒷받침하지 않는 runtime/API behavior를 주장하지 않으면서 Camera HAL, driver, stream, buffer, metadata, native tooling, SoC platform 관점의 실무 영향을 해석하는 string이어야 합니다.',
    'article_sections.action_items는 test, log, metric, device class, API/component, stream combination, owner, PoC handoff 중 하나 이상을 명명하는 구체적 action 배열이어야 합니다.',
    'Action target scope:',
    '- direct_camera_hal/direct_aosp_camera/camera_driver_image_pipeline: source가 직접 뒷받침할 때만 request/result, metadata, stream, buffer, vendor tag, HAL contract를 사용할 수 있습니다.',
    '- android_camera_api/android_platform_camera_adjacent: CameraX/Camera2, preview/capture, permission, app compatibility, Surface 연결 수준으로 제한하세요.',
    '- android_multimedia_camera_output: Camera HAL 직접 변경으로 쓰지 말고 camera output path, preview, recording, camera-generated playback, gallery/media access, sharing, video communication, MediaCodec/Media3/MediaRecorder/Photo Picker/WebRTC/A/V sync 같은 downstream media-pipeline behavior 수준으로 제한하세요.',
    '- android_multimedia_camera_output article은 what changed, affected camera output path, why Camera HAL/Android camera engineers should care, direct/indirect/downstream impact를 모두 설명해야 합니다. public article에서는 direct/indirect/downstream impact를 enum이 아니라 자연스러운 한국어 설명 문장으로 쓰세요.',
    '- Media3/MediaCodec/Photo Picker 같은 official Android media source라도 generic player, streaming-only, music, DRM/player-only, OTT-only, audio-only, gallery UI-only 변경이면 reject/downgrade하고 Camera HAL 직접 조치로 쓰지 마세요.',
    '- cpp_ai_tooling_fallback: build/test/debug workflow, sample/prototype app, Camera API usage 수준으로 제한하세요. HAL runtime, stream, buffer, metadata 변경을 기본 action target으로 만들지 마세요.',
    '- reference_only/watchlist: 직접 조치 문장이 아니라 관찰/제한 문장으로만 작성하세요.',
    'article_sections.team_share_points는 팀 리뷰 때 공유할 핵심 takeaway string이어야 합니다.',
    'do_not_claim은 source-backed fact나 public article content로 render하지 말고 claim guardrail로만 사용하세요.',
    'HAL Signal contract: 모든 main article은 why_now, reader_owners, check_within_2_weeks, impact_axes, do_not_overstate key만 가진 hal_signal_capsule을 포함해야 합니다.',
    'hal_signal_capsule.reader_owners와 hal_signal_capsule.impact_axes는 arrays여야 합니다. 제공된 capsule metadata와 article evidence만 사용하고 누락된 source claim을 만들지 마세요.',
    'hal_signal_capsule.check_within_2_weeks는 generic review가 아니라 bucket scope에 맞는 구체 follow-up을 명명해야 합니다. direct HAL/driver evidence가 있는 경우에만 stream, buffer, metadata, request/result, vendor tag를 사용하세요. app/API/tooling article에서는 permission, CameraX/Camera2 usage, preview/capture behavior, build/test/debug workflow 수준으로 제한하세요.',
    'hal_signal_capsule.do_not_overstate는 generic guardrail 문구나 prompt boilerplate를 그대로 복사하지 말고, 해당 article의 source가 직접 뒷받침하지 않는 구체적 HAL/driver claim, API name, metadata key, stream/buffer behavior, vendor tag, CTS/VTS test 항목을 명명해 article-specific warning 배열로 작성하세요. 과장 위험이 없으면 빈 배열을 두세요.',
    'Input article capsule에 _overclaim_guardrail_hints 배열이 있으면 그것은 deterministic builder가 제공한 internal guardrail hint입니다. 출력 hal_signal_capsule.do_not_overstate에 그대로 paraphrase하거나 복사하지 말고, 해당 hint가 가리키는 위험 영역을 참고해 이 article 본문에 맞는 구체 경고를 새로 작성하세요.',
    '제공되어 있으면 additive HAL signal fields인 hal_impact_axes, reader_owners, actionability_level, effective_actionability_level, actionability_upgrade_reason, signal_quality_status, do_not_overstate, fallback_promotion_allowed, fallback_promotion_reason, fallback_guard_notes, soc_signal_type, soc_signal_source_allowed, camera_pipeline_link를 포함하세요.'
  ].join('\n');
}

function publicArticleContractPrompt() {
  return [
    'Public article contract: 모든 main article은 public_article을 포함해야 합니다.',
    'Story v1 output은 top-level public_contract_version="story-v1", generation_contract_version=1을 포함해야 하며 각 public_article은 story_contract_version=1을 포함해야 합니다.',
    'public_article fields: story_contract_version, headline, source_subtitle, lead, body_paragraphs, camera_hal_takeaway, reader_checkpoints, editorial_story, source_links.',
    'public_article.headline은 source title을 그대로 복사하지 말고, source_extraction/behavior_change/source_fact_bundle과 기사 본문을 바탕으로 Gemini가 새로 작성하세요. 단, headline과 lead/body는 source-confirmed 핵심 변경점을 누락하거나 generic CameraX/Android framing으로 대체하면 안 됩니다.',
    'editorial_story fields: reader_scenario, what_happened, why_it_matters, field_scenario, not_to_overclaim, editor_take.',
    'body_paragraphs는 기사 본문입니다. 모든 기사에 같은 작성 기준을 적용하고, fallback_public 또는 relevance_bucket 때문에 본문을 짧은 generic 문장이나 Camera HAL 관련성 설명으로 축약하지 마세요.',
    'body_paragraphs는 원문이 말한 발표, 변경, 배경, 지원 범위, 적용 예시, 제약, 향후 계획을 3-5개 자연스러운 문단으로 충실하게 설명하세요. source_fact_bundle.facts, source_extraction evidence_blocks, behavior_change, summary에 있는 구체 명사와 source-confirmed detail을 보존하세요.',
    '공개 기사에는 "현업 장면", "확인된 변화", "왜 봐야 하나", "디버깅/리뷰 시나리오", "편집자 판단", "과장 금지" 같은 라벨 문구를 쓰지 마세요. 공개 렌더링은 "Camera HAL/Driver 관점에서의 의미" 섹션만 따로 둡니다.',
    'reader_scenario는 source-confirmed incident가 아니라 독자가 마주칠 수 있는 가정형 현업 장면을 자연스러운 문장으로 쓰세요. "상황을 가정합니다"처럼 편집 메모처럼 쓰지 말고, 실제 발생 사실처럼 단정하지도 마세요.',
    'what_happened에는 source-confirmed fact만 쓰고, HAL 해석이나 권고는 why_it_matters, field_scenario, editor_take로 분리하세요. 다만 body_paragraphs에는 이 내용을 독자-facing 기사 문장으로 자연스럽게 합쳐 쓰세요.',
    'not_to_overclaim과 editor_take는 내부 구조화 필드입니다. public article prose에는 "편집자 판단", "과장 금지", "overclaim", "validation report" 같은 편집/검증 용어를 노출하지 말고 필요한 제한은 자연스러운 설명으로만 표현하세요.',
    'Gemini는 public article writer입니다. selected article capsule과 source facts를 바탕으로 public-facing impact wording과 source-bound engineering inference를 자연스러운 한국어 기사 문장으로 작성하세요.',
    'Public-facing impact wording과 claim-level classification은 public_article.camera_hal_takeaway, article_sections.hal_driver_impact, claims[].impact_level에 원문 근거 기반으로 작성하세요. source가 직접 말하지 않는 HAL/driver/runtime 영향은 없다고 제한하세요.',
    'public_article은 한국어 독자-facing technical newsletter prose로 작성하세요. validation report, checklist, enum, schema/debug field name을 노출하지 마세요.',
    'claim/schema contract와 public prose contract를 섞지 마세요. enum, diagnostic term, internal field name은 public_article 문장에 쓰지 마세요.',
    'source_links는 selected capsule의 primary 또는 seed evidence URL만 사용하고 새 URL을 만들지 마세요.',
    'camera_hal_takeaway는 별도 섹션에 들어갈 "Camera HAL/Driver 관점에서의 의미"입니다. 직접 HAL/Driver 변경이면 실제 확인 포인트를 쓰고, 직접 변경이 아니면 직접 영향은 없지만 앱/API/tooling/debug/repro 맥락에서 어떤 참고 의미가 있는지만 제한적으로 쓰세요.',
    'android_multimedia_camera_output article의 camera_hal_takeaway는 Camera HAL 직접 변경이 아니라 camera-generated output, preview/recording, gallery/media access, sharing, video communication, A/V sync 같은 downstream validation 의미로 제한해 쓰세요.',
    'reader_checkpoints는 최소 2개이며 내부 QA/checklist용 필드입니다. Markdown/HTML에 직접 렌더링되지 않으므로, public body나 "Camera HAL/Driver 관점에서의 의미" 섹션을 대체하지 마세요. 독자가 실제로 확인할 행동과 source 범위 제한을 자연어로 작성하되 body_paragraphs와 camera_hal_takeaway를 반복하는 bullet list로 만들지 마세요.',
    'API/component/date, stream/metadata, compatibility test scenario처럼 validator token을 조합한 문장을 쓰지 마세요.',
    'source가 HAL/driver 변경을 직접 말하지 않으면 vendor pipeline, stream, metadata, buffer 변경으로 확대하지 마세요.'
  ].join('\n');
}

function publicationBoundaryPrompt() {
  return [
    '기사 선택, source eligibility, main/supporting 승격 같은 발행 판단은 deterministic metadata와 validation layer가 담당합니다.',
    'Gemini는 decision_metadata를 생성하지 마세요. publication scope/action/overclaim_risk는 deterministic builder가 public output 직전에 생성하거나 overwrite합니다.',
    'Gemini는 deterministic publication judgment를 바꿀 수 없습니다: source eligibility, source_gap_risk, main/supporting 승격, source link, do_not_claim.'
  ].join('\n');
}

// #693/#670: 공개 기사가 schema-driven 범용 요약이 아니라 Camera HAL / lower camera stack 관점의
// 자연스러운 한국어 뉴스레터가 되도록 하는 에디토리얼 보이스. 작성(editor/completion) 단계에서만
// 조립하고 fact-check/judge에는 넣지 않는다 — 검증 LLM의 must_fix 요구는 그대로 두고, 톤·서사 가이드만
// 더한다(과도한 must_fix 회귀 방지). source-binding/claim/quality 계약은 별도 조각이 그대로 담당한다.
//
// #700: editorial plan은 필수 단계라 editor는 항상 plan을 받는다. 그래서 단계별로 voice를 둘로 나눈다.
// - cameraHalEditorialVoiceWithPlanPrompt(): editor용. plan이 기사별 가드레일(주체 혼동·과대해석·제한
//   보존)을 이미 정리했으므로 generic 가드레일 세 줄을 "plan을 따르라" 한 줄로 대체한다(중복 축소).
// - cameraHalEditorialVoicePrompt(): plan 없이 작성하는 completion용. full generic 가드레일을 유지한다.
// 서사 아크와 내부 라벨 비노출은 두 단계 공통 작성 형식이라 baseLines로 공유한다.
function cameraHalEditorialVoiceBaseLines() {
  const voice = '에디토리얼 보이스: 원문을 일반 IT 뉴스처럼 요약하지 말고, 원문에서 확인되는 변경을 Camera HAL / lower camera stack(Android native, Linux media, V4L2, driver, ISP/sensor, build/test/debug) 개발자 관점으로 재해석하세요. 이 재해석은 코드가 주입하는 것이 아니라 source evidence에 근거해 작성합니다.';
  const narrativeArc = 'body_paragraphs는 (1) 원문에서 실제로 일어난 일을 먼저 설명하고, (2) 그 기술의 정체·적용 대상·현재 상태와 Camera HAL과의 거리감(직접 변경인지, lower-stack 참고 흐름인지)을 자연스러운 문장으로 풀고, (3) 직접 변경 / 참고할 흐름 / 추적할 리스크 중 무엇인지 현실적인 takeaway로 정리하는 흐름으로 쓰세요. Impact, Layer, Scope, HAL Relevance 같은 라벨 제목은 본문에 노출하지 말고 중요도 판단 기준으로만 쓰세요.';
  return [voice, narrativeArc];
}

function cameraHalEditorialVoicePrompt() {
  const subjectConfusionGuard = '하드웨어·디바이스 기사에서는 이미지 센서 제조사, SoC/platform vendor, ISP IP 제공자, 패치 작성자, 테스트에 쓰인 보드, 실제 적용 디바이스를 혼동하지 마세요. 예: ISP IP를 이미지 센서로, 특정 보드에서의 테스트를 양산 적용으로 단정하지 마세요.';
  const overclaimGuard = 'source가 명시하지 않으면 Samsung, S.LSI, Exynos, 특정 상용 제품, 양산 적용, 직접적인 성능 개선, 카메라 화질 개선으로 확대 해석하지 마세요. Linux/V4L2/media/sensor 기사는 Android Camera HAL API 변경처럼 쓰지 말고 sensor bring-up, mode table, exposure/gain/frame timing, MIPI CSI topology, media graph, HAL metadata와 lower driver control 사이의 mapping, upstream review 리스크 관점으로 설명하세요.';
  const sourceLimitationGuard = '원문이 밝힌 제한 사항(review NACK, RAW-only/limited mode, 특정 board/kernel/library version 한정, ISP bypass, release 전 상태 등)은 생략하지 말고 본문에 자연스럽게 반영하세요.';
  return [...cameraHalEditorialVoiceBaseLines(), subjectConfusionGuard, overclaimGuard, sourceLimitationGuard].join('\n');
}

function cameraHalEditorialVoiceWithPlanPrompt() {
  return [
    ...cameraHalEditorialVoiceBaseLines(),
    '제공된 internal editorial plan이 각 기사의 target_description, editorial_angle, why_it_matters, reader_takeaway, misunderstanding_risks, source_limitations를 이미 정리했습니다. 그 plan을 따라 자연스러운 prose로 작성하고, plan이 명시한 misunderstanding_risks(센서 제조사/SoC vendor/ISP IP/패치 작성자/보드/디바이스 혼동, 과대해석 등)와 source_limitations(review·RAW-only·버전 한정·release 전 상태 등)를 본문에서 빠뜨리지 마세요. plan은 작성 framing 참고용이며, 어떤 기사를 main article로 낼지·기사 개수·기사 식별은 바꾸지 마세요(selection이 결정).'
  ].join('\n');
}

// #700: LLM editorial assessment & planning 단계의 지시. selected article capsule마다 내부
// editorial plan(coverage/impact/추론/limitations)을 생성한다. 이 plan은 작성을 안내하는 internal
// scaffolding이며 public article에 라벨로 render하지 않는다. 발행 hard blocker(source-binding/evidence/
// freshness/hard-fail)는 결정론 코드가 그대로 담당하므로 plan은 그 안전 봉투 안에서 편집 판단만 한다.
function editorialPlanPrompt() {
  return [
    'Editorial plan contract: 제공된 selected article capsule마다 editorial_plans[] item을 하나씩 생성하세요. 이것은 public article prose가 아니라 작성을 안내할 내부 editorial plan입니다.',
    'title, url, source_candidate_hash는 capsule에서 정확히 echo하세요(매칭용 식별자). 새 값을 만들지 마세요.',
    'coverage_decision은 main_article, short_mention, reference_only, exclude 중 하나입니다. impact_level은 Direct Impact, Design Reference, Trend Watch, Exclude 중 하나입니다. 이 값은 내부 추론 결과이며 public 본문에 라벨로 노출하지 않습니다.',
    '판단은 다음 추론 차원으로 하되 코드가 정한 고정 카테고리로 취급하지 마세요: 직접 Android Camera HAL 영향 / Android framework·API 관련 / Linux media·V4L2·kernel lower-stack 참고 / sensor·ISP driver 참고 / native C++·toolchain·CI 관련 / 산업·제품 trend / 약한 관련성.',
    'direct_hal_impact는 source가 직접 HAL/runtime 변경을 뒷받침할 때만 true이고 기본은 false입니다. source 근거가 없으면 Samsung, S.LSI, Exynos, 상용 제품, 양산, 성능·화질 개선으로 확대 판단하지 마세요.',
    'target_description은 이 소식의 실제 대상 기술(driver, sensor, ISP, API, framework, tool)을 한 문장으로, editorial_angle은 Camera HAL / lower camera stack 독자 관점의 편집 각도를, why_it_matters와 reader_takeaway는 왜 중요하고 무엇을 해야 하는지를 한국어로 채우세요.',
    '이미지 센서 제조사, SoC/platform vendor, ISP IP 제공자, 패치 작성자, 테스트 보드, 적용 디바이스를 혼동하지 마세요. misunderstanding_risks에 독자가 오해할 수 있는 지점을, source_limitations에 원문이 밝힌 제한(review NACK, RAW-only/limited mode, 특정 board/kernel/version 한정, ISP bypass, release 전 상태 등)을 적으세요.',
    'main/supporting 승격, source eligibility, source link 같은 발행 안전 판단의 최종 강제는 deterministic validation layer가 담당합니다. plan은 그 범위 안에서 편집 판단만 제공하세요. schema와 일치하는 JSON만 반환하세요.'
  ].join('\n');
}

function publicArticleJudgePrompt() {
  return [
    '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 public article semantic judge입니다.',
    '역할은 article을 다시 쓰는 것이 아니라, 제공된 JSON이 독자에게 발행 가능한 의미 품질을 갖췄는지 판정하는 것입니다.',
    '단어 매칭이나 특정 keyword 출현 여부로 판정하지 마세요. 한국어 표현, 동의어, 자연스러운 기술 문장을 의미 기준으로 평가하세요.',
    '각 section에 대해 public_article_pass, reader_checkpoints_pass, source_boundary_pass, public_prose_pass를 boolean으로 반환하세요.',
    'reader_checkpoints_pass는 Camera HAL / Driver / Android Camera / Camera API / native tooling 독자가 실제로 확인, 측정, 비교, 점검, 추적할 수 있는 항목이면 PASS입니다.',
    'reader_checkpoints가 source가 말하지 않는 HAL/driver/runtime 변경을 사실처럼 단정하거나, 너무 일반적인 모니터링/공유 수준이면 FAIL입니다.',
    'source_boundary_pass는 raw source 재검증이 아니라, 제공된 reporter_evidence, article_sections, hal_signal_capsule, claims, do_not_overstate 범위 안에서 과장 없이 해석했는지 판정하는 항목입니다.',
    '제공된 evidence boundary 안에서만 해석하면 PASS입니다. 직접 근거 없는 HAL/driver/vendor pipeline 영향을 주장하면 FAIL입니다.',
    'public_prose_pass는 public_article에 workflow/debug/schema/validator/publish gate 같은 내부 운영 언어가 없고 독자-facing 한국어 technical prose이면 PASS입니다.',
    '문제가 있으면 issues[]에 field, severity(P1/P2/P3), reason, suggested_fix를 짧게 작성하세요. 문제가 없으면 issues는 빈 배열입니다.',
    'JSON만 반환하세요. article text를 재작성하지 마세요.'
  ].join('\n');
}

function articleClaimContractPrompt() {
  return [
    'Claim binding contract: 모든 main article은 claims[]를 포함해야 합니다.',
    '각 claims[] item은 claim_id, text, claim_type, evidence_ids, source_urls, impact_level, overclaim_risk를 포함해야 합니다.',
    'claim_type은 fact, inference, recommendation, risk_note, limitation 중 하나여야 합니다.',
    'claim impact_level은 direct_hal_contract, camera_framework_behavior, app_api_or_framework_adjacent, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_thermal, soc_resource_contention, native_tooling_workflow, no_hal_runtime_impact, unknown 중 하나여야 합니다.',
    'claims[].impact_level은 candidate metadata enum을 복사하지 말고 source facts, behavior_change, source_extraction, article_sections.hal_driver_impact를 보고 직접 판단하세요.',
    'source-backed article_sections.verified_facts[]의 각 항목에는 대응되는 claim_type=fact claim이 최소 1개 있어야 합니다. (confirmed_facts / evidence_summary는 claim 바인딩 대상이 아니므로 evidence가 필요한 사실은 반드시 verified_facts에도 포함하세요.)',
    'Fact claims는 제공된 seed_evidence.primary_evidence_ids, seed_evidence.linked_evidence_ids, candidate evidence_ids, source_extraction facts의 item-level evidence ids를 cite해야 합니다. evidence_pack_ids만으로 fact support를 만들지 마세요.',
    'claims[].evidence_ids는 같은 article capsule의 allowed_claim_evidence[].evidence_id 값만 정확히 복사하세요. evidence id를 만들거나 변형하지 마세요.',
    'claims[].source_urls는 선택한 allowed_claim_evidence[].source_urls에서만 가져오세요.',
    'behavior_change: ... 같은 설명문, confirmed_facts[0], article_sections.verified_facts[0] 같은 JSON field path, URL 문자열 자체를 evidence_id로 쓰지 마세요.',
    'evidence URL에 fragment가 있으면 source_urls에서 release/version/section URL fragment를 보존하세요. 특히 CameraX release-note anchor를 보존해야 합니다.',
    'do_not_claim 또는 do_not_overstate guardrails와 모순되지 않게 쓰세요. Direct HAL/API/runtime 표현은 direct source evidence가 필요합니다.'
  ].join('\n');
}

function claimRepairEvidencePrompt() {
  return [
    'Repair 중에는 이전 invalid output의 evidence_ids/source_urls를 신뢰하거나 재사용하지 말고 현재 prompt의 allowed_claim_evidence[]에서 전부 다시 선택하세요. source_urls가 누락된 경우 현재 article capsule의 allowed_claim_evidence[].source_urls에서 선택하세요. 이전 invalid output의 evidence_ids/source_urls를 허용 목록처럼 취급하지 마세요.',
    'uncovered factual fields를 덮기 위해 새 fact claim, evidence id, source URL을 만들지 마세요. 제공된 candidate evidence로 coverage 또는 source/evidence binding을 충족할 수 없으면 section을 demote 또는 replace하세요.',
    'do_not_claim violation은 evidence_ids 또는 source_urls를 바꾸지 말고 unsupported assertion을 제거하거나 risk_note/limitation으로 다시 쓰세요.'
  ].join('\n');
}

// #482: repair-section fix는 free-form rewrite가 아니라 patch-only로 제한한다.
// 모델이 어떤 기사가 존재하는지(section 개수/순서/identity/source binding)는
// 바꿀 수 없고, 독자-facing 문구만 교체한다. 반환은 {patches:[...]}만 허용한다.
function editorRepairPatchPrompt() {
  return [
    'Patch-only repair contract: full editor 또는 full section JSON을 반환하지 마세요. {patches:[...]} 객체만 반환하세요.',
    '각 patch는 section_index, op, path, value를 가집니다. section_key는 제공되면 section_index와 같은 section을 가리키도록 echo하세요.',
    'op는 "replace"만 허용됩니다. path는 반드시 "/article_sections/" 또는 "/public_article/"로 시작해야 합니다.',
    'section_index는 이 prompt가 제공한 failed-section 목록의 index와 정확히 일치해야 하며, 목록에 없는 section은 patch하지 마세요.',
    '수정 가능한 경로(독자-facing 문구)만 patch하세요: /article_sections/verified_facts/{i}, /article_sections/background_context, /article_sections/hal_driver_impact, /article_sections/action_items/{i}, /article_sections/team_share_points, /article_sections/known_limitations/{i}, /article_sections/do_not_claim/{i}, /public_article/headline, /public_article/source_subtitle, /public_article/lead, /public_article/body_paragraphs/{i}, /public_article/camera_hal_takeaway, /public_article/reader_checkpoints/{i}, /public_article/editorial_story/{field}.',
    'verified_facts/action_items/known_limitations/do_not_claim/body_paragraphs/reader_checkpoints는 string 배열이므로, path는 element index까지 지정하고(/.../0) value는 교체할 string 하나입니다. /text 같은 하위 경로를 붙이지 마세요.',
    'editorial_story의 하위 string field는 /public_article/editorial_story/editor_take 처럼 지정하세요. top-level editorial_story로 지정하지 마세요.',
    '수정 금지(이런 path는 거부되어 repair가 diagnostics-only로 실패합니다): /sources, /public_article/source_links, source URL, source_candidate_hash, candidate_id, article_identity_key, coverage_type, published_date, evidence id, section 개수/순서.',
    '새 evidence id 또는 source URL을 만들지 말고, source가 직접 뒷받침하지 않는 release/HAL/runtime 사실을 patch value에 새로 쓰지 마세요. 보강할 source evidence가 없으면 해당 patch를 생략하세요.'
  ].join('\n');
}

function factCheckSeverityPrompt() {
  return [
    'Fact-check 결과 매핑: 발행하면 안 되는 factual/source 오류는 must_fix[]에 넣으세요. 출처 커버리지, 날짜 근거, cross-check가 부족한 항목은 source_gaps[]에도 넣고 source_gap_count는 source_gaps.length와 일치시키세요.',
    '같은 source 안에서 표현, 구체성, actionability를 보강하면 되는 항목만 recommended_fixes[]에 넣으세요. must_fix[]에는 가능한 한 location, problem, suggestion, source_url을 채우세요.',
    'source_gaps[]와 recommended_fixes[]에는 headline 또는 source URL을 포함해 repair plan이 해당 section을 찾을 수 있게 하세요.'
  ].join('\n');
}

function cameraDeveloperToolingFactCheckPrompt() {
  return [
    'C/C++, Android Studio, VS(Visual Studio) Code, Claude, Codex, Roo Code, OpenCode 같은 language, IDE, AI Agent, tooling news는 Camera 개발자가 실제로 사용하는 development workflow coverage로 허용될 수 있습니다.',
    '이런 tooling article을 primary Camera runtime stack article이 아니라는 이유만으로 must_fix[] 또는 source_gaps[]에 넣지 마세요. 다만 허용하려면 source, selected capsule metadata, source_extraction 중 하나가 camera driver, Camera HAL/native code, Android camera app, build/test/debug/performance workflow 연결을 뒷받침해야 합니다. derived editorial hints는 framing 보조로만 사용하고, 단독 publishability 근거로 사용하지 마세요.',
    '연결이 article text 또는 derived editorial hints에만 있고 source/capsule metadata/source_extraction이 뒷받침하지 않으면 recommended_fixes[]가 아니라 must_fix[] 또는 source_gaps[]로 분류하세요.',
    '표현 보강만 필요하면 recommended_fixes[]에 넣으세요. Camera 개발자 workflow 연결이 source, selected capsule metadata, source_extraction에 전혀 없거나 Android HAL toolchain migration처럼 source가 뒷받침하지 않는 주장을 하면 must_fix[]에 넣고, supporting source/cross-check 부족이면 source_gaps[]에도 넣으세요.'
  ].join('\n');
}

function articleQualityVerdictPrompt() {
  return [
    'article_quality[]: 각 main section마다 하나씩, 그 기사가 발행할 만한 품질인지 판정하세요. section_index(0-based), headline, publishable(boolean), reason을 채우세요.',
    '품질 기준은 "Camera HAL 관련 주제인가"가 아니라 "Camera HAL SW 엔지니어에게 실제로 도움이 되는 기사인가"입니다. 주제가 C++, AI/LLM, Linux, 빌드/디버그/성능 도구여도 HAL SW 엔지니어 업무에 도움이 되면 publishable=true로 판정하세요. 반대로 Camera HAL 주제라도 구체성·깊이·실행가능성이 없어 엔지니어에게 쓸모가 없으면 publishable=false로 판정하세요.',
    'publishable=false면 reason에 "왜 HAL SW 엔지니어에게 도움이 안 되는지"를 구체적으로 적으세요(예: 버전/날짜/API/동작 변화 같은 구체 정보 없음, 일반론뿐, 후속 행동이 불명확). publishable=true면 reason에 그 기사가 엔지니어에게 주는 실질적 가치를 한 줄로 적으세요.',
    '이 판정은 must_fix/source_gaps(사실·출처 검증)와 독립적입니다. 사실은 맞지만 품질이 부족하면 must_fix가 아니라 article_quality의 publishable=false로 표현하세요.'
  ].join('\n');
}

function dateFramingGuardrail() {
  return [
    '시간 표현 정확성: "최근", "방금", "이번 주", "recently", "newly released" 같은 상대적 최신성 표현은 candidate의 published_date가 newsletter 날짜 기준 약 2주 이내일 때만 사용하세요.',
    'released_date가 수 주~수 개월 전이면 상대 표현 대신 실제 시점을 명시하세요(예: "3월 출시된", "N주 전 공개된"). catch-up(지난 소식) 기사뿐 아니라 모든 main article에 동일하게 적용합니다.',
    'published_date를 모르면 출시 시점을 단정하지 말고 시점 표현 자체를 생략하세요. 오래된 릴리스를 "최근/recently"로 표현하면 fact-check must_fix 대상입니다.'
  ].join('\n');
}

// reporter/editor/fact-check 등 LLM stage가 공유하는 공통 context와 reporter 전용 context를
// editorial 문서 입력으로부터 조립한다. 순수 문자열 빌더(#655 god-file 분할, 동작 불변).
function buildPromptContexts({ date, editorialPolicy, newsletterTemplate, goldenExample }) {
  const commonContext = [
    `Newsletter date: ${date}`,
    'Audience: AOSP Camera / Camera HAL / Camera Driver / SoC Platform / C++ engineer',
    '수집된 candidate JSON, src/shared/data/news-sources.json, docs/NEWS_SOURCES.md, 아래 editorial documents만 사용하세요. web browsing은 하지 마세요.',
    'source names와 source URLs는 그대로 유지하세요. 확인된 사실과 해석을 분리하세요.',
    '최종 newsletter text는 한국어로 작성하세요. 공식 title, source name, product name, URL, code identifier, JSON key, enum 값은 원문을 유지할 수 있습니다.',
    '',
    'docs/EDITORIAL_POLICY.md:',
    editorialPolicy,
    '',
    'docs/NEWSLETTER_TEMPLATE.md:',
    newsletterTemplate,
    '',
    'docs/golden-examples/MANUAL_QUALITY_NEWSLETTER.md:',
    goldenExample,
    '',
    'golden example은 style과 structure reference로만 사용하세요. 현재 candidate JSON에 없는 facts, dates, versions, API/component names, behavior changes, sources, action items는 복사하지 마세요.'
  ].join('\n');
  const reporterContext = [
    `Newsletter date: ${date}`,
    'Audience: AOSP Camera / Camera HAL / Camera Driver / SoC Platform / C++ engineer',
    '수집된 article capsule JSON과 deterministic selection context만 사용하세요. web browsing은 하지 마세요.',
    'Reporter stage는 deterministic 후보의 source-backed evidence fields만 보강합니다.',
    'source names, source URLs, title, candidate_id는 echo-only matching key로 그대로 유지하세요.',
    '한국어 evidence note를 작성할 수 있지만, public newsletter prose나 최종 기사 문장은 작성하지 마세요.',
    '',
    'docs/EDITORIAL_POLICY.md:',
    editorialPolicy
  ].join('\n');
  return { commonContext, reporterContext };
}

module.exports = {
  buildPromptContexts,
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails,
  articleSectionContractPrompt,
  publicArticleContractPrompt,
  publicationBoundaryPrompt,
  cameraHalEditorialVoicePrompt,
  cameraHalEditorialVoiceWithPlanPrompt,
  editorialPlanPrompt,
  publicArticleJudgePrompt,
  articleClaimContractPrompt,
  claimRepairEvidencePrompt,
  editorRepairPatchPrompt,
  factCheckSeverityPrompt,
  cameraDeveloperToolingFactCheckPrompt,
  articleQualityVerdictPrompt,
  dateFramingGuardrail
};
