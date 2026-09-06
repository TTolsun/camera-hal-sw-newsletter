# 뉴스룸 LLM Prompt 운영 Reference

이 문서는 Gemini/LLM prompt가 코드 어디에 있는지 빠르게 찾기 위한 운영 reference(참고 문서)입니다. 정본(source of truth)은 코드입니다. 이 문서는 prompt 원문을 옮겨 적지 않고, 각 prompt의 목적과 입출력 계약만 요약합니다. 줄 번호(line number)는 쉽게 어긋나므로(drift), 파일 경로와 함수명을 기준으로 찾으세요.

API key, runtime secret, prompt 전체 원문, generated artifact 내용은 이 문서에 넣지 않습니다. prompt를 바꿀 때 quality threshold(품질 기준), validator 계약, publication gate를 약화하면 안 됩니다.

## 기준 위치 링크

- [Stage 3 system prompt 정의](../../src/generator/publish/orchestrator-stage-prompts.js)
- [Stage 3 진입점(thin dispatcher)](../../src/generator/publish/gemini-newsroom-newsletter.js)
- [Stage 2 source discovery prompt host](../../src/discovery/gemini-source-discovery.js)
- [Editorial policy](../EDITORIAL_POLICY.md)
- [Newsletter template](../NEWSLETTER_TEMPLATE.md)
- [Newsletter policy config](../../src/shared/config/newsletter-policy.json)
- [Prompt contract tests](../../src/generator/test/contract/prompt-contract.test.js)

## Workflow 요약

### Newsletters 01 - Source Collection PR

이름: Gemini prompt 없음

목적: RAW 후보를 수집하고 review 가능한 `manual-candidates.json` 계열 artifact를 생성합니다.

위치: `.github/workflows/newsletters-01-source-collect-pr.yml`, `npm run collect`

Workflow/Stage: Stage 1 RAW collection

주요 입력: `src/shared/data/news-sources.json`, optional `collection-intent.json`, source registry 설정

출력/schema: `articles/content/collected-news/<date>/manual-candidates.json`, RAW candidate artifact

주요 guardrail: LLM credential이 필요 없고 Gemini prompt도 실행하지 않습니다. Stage 1 결과는 Stage 2/Stage 3의 입력일 뿐, 최종 발행물이 아닙니다.

### Newsletters 02 - Source Discovery PR

이름: Source discovery proposal prompt

목적: manual candidate와 source registry를 바탕으로 부족한 source coverage를 보강할 discovery intent를 제안합니다. Gemini output은 후보 진실값이 아니라 proposal입니다.

위치: `src/discovery/gemini-source-discovery.js`의 `buildProposalPrompt()`와 `buildProposalPayload()`

Workflow/Stage: `Newsletters 02 - Source Discovery PR`, `sourceDiscovery`

주요 입력: newsletter date, 최대 40개 manual candidate 요약, enabled source registry 요약

출력/schema: `proposalResponseSchema()`, `articles/content/newsroom/<date>/gemini-source-proposals.json`

주요 guardrail: newsletter article을 직접 쓰지 않습니다. 제안할 수 있는 source URL은 제공된 registry domain이나 linked evidence domain에 속한 것뿐입니다. 그중에서도 deterministic fetch, normalize, schema validation을 모두 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영됩니다.

## Newsletters 03 - Editor PR

### 공통 prompt context

이름: Final generation common context

목적: Stage 3의 reporter, editor, fact-check, repair, completion prompt에 공통 운영 정책과 작성 기준을 전달합니다.

위치: `src/generator/reporter/newsletter-prompts.js`의 `buildPromptContexts()` (호출·결합은 `src/generator/publish/gemini-newsroom-newsletter.js`)

Workflow/Stage: `Newsletters 03 - Editor PR`, Stage 3 전체

주요 입력: newsletter date, audience 설명, `docs/EDITORIAL_POLICY.md`, `docs/NEWSLETTER_TEMPLATE.md`, `docs/golden-examples/MANUAL_QUALITY_NEWSLETTER.md`

출력/schema: 별도 schema 없음. 각 LLM stage의 user prompt 일부로 결합됩니다.

주요 guardrail: 제공된 candidate JSON, source registry, editorial documents만 씁니다. web browsing은 하지 않습니다. source name과 source URL은 그대로 보존하고, 독자가 읽는 text(reader-facing text)는 한국어로 작성합니다.

### Background context

이름: Background context prompt

목적: selected article capsule을 바탕으로 editor가 사용할 optional technical background context를 생성합니다.

위치: `src/generator/publish/orchestrator-editor-validation.js`의 `buildBackgroundContextReport()`

Workflow/Stage: Stage 3 `background-context`

주요 입력: `commonContext`, selected article capsule context, deterministic static fallback background context

출력/schema: `backgroundContextSchema`, `articles/content/newsroom/<date>/background-context.json`

주요 guardrail: Web browsing을 하지 않습니다. Raw source table text, UI fragment, release table dump, source snippet을 background prose로 복사하지 않습니다. `background_basis`에는 external lookup이 아니라 supplied capsule metadata와 model knowledge 기반임을 설명해야 합니다.

### Editorial assessment & planning

이름: Editorial plan prompt (`editorialPlanSystemPrompt()` / `editorialPlanPrompt()`)

목적: selected article capsule마다 작성을 안내할 내부 editorial plan(coverage_decision, impact_level, target_description, editorial_angle, why_it_matters, reader_takeaway, misunderstanding_risks, source_limitations)을 생성합니다(#700). 발행 hard blocker(source-binding/evidence/freshness/hard-fail)는 deterministic validation layer가 그대로 담당하며, 이 단계는 그 안전 봉투 안에서 편집 판단만 더합니다.

위치: `src/generator/publish/orchestrator-editorial-plan-stage.js`의 `buildEditorialPlanReport()`, 프롬프트는 `src/generator/publish/orchestrator-stage-prompts.js`/`src/generator/reporter/newsletter-prompts.js`

Workflow/Stage: Stage 3 `editorial-plan attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON

출력/schema: `editorialPlanSchema`, `articles/content/newsroom/<date>/editorial-plan.json`

주요 guardrail:

- 항상 실행되는 필수 단계입니다(#700, toggle 없음). LLM 호출이 실패하거나 사용할 plan이 하나도 없으면 throw해서 editor 등 뒤 단계 비용을 들이기 전에 파이프라인을 멈춥니다(best-effort graceful-degradation 폐기 — 비용 우선).
- plan은 작성을 안내할 internal scaffolding입니다. `coverage_decision`/`impact_level` 같은 값은 public 본문에 라벨로 노출하지 않습니다.
- `direct_hal_impact`는 source가 직접 HAL/runtime 변경을 뒷받침할 때만 true입니다. source 근거 없는 Samsung/S.LSI/Exynos/양산/성능·화질 확대 판단을 금지합니다.
- 이미지 센서 제조사, SoC/platform vendor, ISP IP 제공자, 패치 작성자, 테스트 보드, 적용 디바이스를 혼동하지 않습니다.
- plan의 `coverage_decision`은 always-on coverage 재조정(deterministic reconciler)이 소비해 main-set 편성을 정합니다 — 단, 결정론 불변식(main-eligibility·cap·발행 floor·`publish_ready` 단조 하향) 안에서만 반영됩니다. editor에게 넘기는 plan에서는 `coverage_decision`/`impact_level`을 제거해 group-coverage 계약과 충돌하지 않게 합니다.
- `coverage_decision`이 정하는 것은 main-set 하나뿐이라 등급도 `main_article`과 `exclude` 둘입니다(#1000). 참고자료 섹션은 이 값을 읽지 않는 결정론 코드(`src/generator/render/reference-articles.js`)가 따로 만듭니다.

### Reporter

이름: Reporter prompt

목적: deterministic shortlist가 이미 고른 final article input을 재선정하지 않고, evidence field를 요약, tagging, refinement합니다.

위치: `src/generator/publish/gemini-newsroom-newsletter.js`의 reporter `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `reporterSystemPrompt()`)

Workflow/Stage: Stage 3 `reporter attempt <n>/<total>`

주요 입력: `commonContext`, locked article context, shortlisted article capsule JSON, compact selection context

출력/schema: `reporterSchema`, `articles/content/newsroom/<date>/reporter-candidates.json`

주요 guardrail: 최종 selection 결정을 다시 내리지 않습니다. capsule의 eligibility, risk, score, imageCandidates, evidence는 그대로 보존합니다. source text가 비어 있으면 있는 것처럼 가정하지 않으며, article 단위 `claims[]`는 만들지 않습니다.

### Editor draft

이름: Editor draft prompt

목적: final-selected article capsule을 사용해 한국어 technical newsletter draft를 생성합니다.

위치: `src/generator/publish/orchestrator-editor-stage.js`의 `runEditorStage()` 안 editor `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `editorSystemPrompt()`)

Workflow/Stage: Stage 3 `editor attempt <n>/<total>`

주요 입력: `commonContext`, locked article context, optional editor retry contract, primary selected article capsule JSON, background context JSON

출력/schema: `editorSchema`, `articles/content/newsroom/<date>/editor-draft.json`

주요 guardrail: `docs/EDITORIAL_POLICY.md`와 `docs/NEWSLETTER_TEMPLATE.md`를 따릅니다. 다음 candidate는 main article로 만들지 않습니다 — `final_selected=false`, watchlist/exclude, missing dated evidence(날짜 근거 없음), `source_gap_risk=true`, `briefing_only`, `reference_only`. image URL은 새로 만들지 않고, `selectedImage`에는 `imageCandidates.url` 중 하나 또는 빈 문자열(empty string)만 씁니다.

### Editor semantic repair

이름: Editor semantic repair prompt

목적: editor JSON이 schema는 만족했지만 semantic validation에 실패했을 때, 해당 validation error만 고쳐 complete editor JSON으로 복구합니다.

위치: `src/generator/publish/orchestrator-public-article-judge.js`의 `repairEditorSemanticWithLlm()`

Workflow/Stage: Stage 3 `<editorStage> semantic repair`

주요 입력: `commonContext`, locked article context, editor semantic validation error JSON, invalid editor draft JSON

출력/schema: `editorSchema`

주요 guardrail: 기사 추가, 제거, 재정렬, 교체를 하지 않습니다. Validation error가 직접 가리키는 field가 아니면 headline, category, source URL, image field, action item, reference를 바꾸지 않습니다. Source fact나 source material을 만들지 않습니다.

### Fact-check

이름: Fact-check prompt

목적: editor draft의 factuality, missing source, exaggerated language, missing date, editorial-policy violation을 검토합니다.

위치: `src/generator/publish/gemini-newsroom-newsletter.js`의 fact-checker `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `factCheckSystemPrompt()`)

Workflow/Stage: Stage 3 `fact-checker attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, background context JSON, editor draft JSON

출력/schema: `factCheckSchema`, `articles/content/newsroom/<date>/fact-check-report.json`

주요 guardrail: Style rewrite가 아니라 factual error, source problem, editorial-policy violation에 집중합니다. Source 없는 claim과 발행 차단 오류는 `must_fix[]`, dated evidence 또는 cross-check 부족은 `source_gaps[]`, 같은 source 안에서 보강 가능한 표현/구체성/actionability 문제는 `recommended_fixes[]`로 분류합니다.

### Targeted repair editor

이름: Editor repair patch prompt

목적: quality/fact-check failure가 있는 section을 repair plan에 따라 처리합니다. `repair-section` action만 있는 plan은 LLM에게 field-level patch(`{patches:[...]}`)를 받아 결정론적으로 적용하고(#482), `replace-section`/`replace-or-demote` 같은 structural action은 LLM 재생성 없이 결정론 강등(deterministic demote)으로 처리합니다(#632). 강등으로 비는 자리는 이후 completion 패스가 reserve candidate로 보충합니다.

위치: `src/generator/publish/orchestrator-repair-completion.js`의 `runRepairAndCompletionPasses()` (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `editorRepairPatchSystemPrompt()`)

Workflow/Stage: Stage 3 `editor repair attempt <n>/<total>`

주요 입력: `commonContext`, failed section patch target JSON(section_index, section_key, summary, `article_sections`, `public_article`), repair plan JSON, primary selected article capsule JSON, current fact-check JSON, quality deductions JSON. 이 repair patch prompt의 LLM 호출은 `repair-section` 전용 patch 경로에서만 일어나고, structural 경로는 이 prompt 호출 없이 진행됩니다(강등 뒤 public-article judge와 repair fact-check LLM 호출은 두 경로 공통 후처리에서 실행됩니다).

출력/schema: `editorRepairPatchSchema`(`{patches:[...]}`), `editor-repair-patches-attempt-<n>.json`. patch는 `applyRepairPatchesAndValidate()`가 결정론적으로 적용하며, article-preserving 계약을 위반하면 targeted repair가 실패합니다. `editor-repair-sections-attempt-<n>.json`은 두 경로 모두에서 locked/failed/regenerated section summary와 repair plan을 담는 요약 artifact로 계속 기록됩니다.

주요 guardrail: Patch-only 계약 — full editor 또는 full section JSON을 반환하지 않고 `{patches:[...]}`만 반환합니다. `op`는 `replace`만, `path`는 `/article_sections/` 또는 `/public_article/`로 시작하는 독자-facing 문구 경로만 허용합니다. source, source URL, evidence id, candidate identity, section 개수/순서는 수정 금지이며, 새 evidence id를 만들거나 source가 뒷받침하지 않는 사실을 patch value에 쓰지 않습니다.

### Repair fact-check

이름: Repair fact-check prompt

목적: repaired editor draft를 다시 fact-check하고 unresolved source gap 또는 editorial-policy violation을 확인합니다.

위치: `src/generator/publish/orchestrator-repair-completion.js`의 repair fact-checker `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `factCheckRepairSystemPrompt()`)

Workflow/Stage: Stage 3 `fact-checker repair attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, reserve article capsule pool JSON, repaired editor draft JSON

출력/schema: `factCheckSchema`, `fact-check-repair-attempt-<n>.json`

주요 guardrail: Missing release date, version/release, API/component, concrete behavior change, source gap, watch/reference page misuse를 `must_fix`로 유지합니다. Repo-local fallback image와 preserved external original 관계를 오해해 false positive로 막지 않도록 합니다.

### Completion editor

이름: Completion editor prompt

목적: quality gate가 article count 부족을 보고하고 eligible candidate가 남아 있을 때, 부족한 main article section만 추가 생성합니다.

위치: `src/generator/publish/orchestrator-repair-completion.js`의 completion editor `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `editorCompletionSystemPrompt()`)

Workflow/Stage: Stage 3 `editor completion attempt <n>/<total>`

주요 입력: `commonContext`, completion exclusion context, current editor section summaries, eligible primary/reserve article capsules, background context JSON, candidate rejection diagnostics, current quality deductions

출력/schema: `editorCompletionSchema`, `editor-completion-attempt-<n>.json`

주요 guardrail: Full newsletter rewrite를 하지 않습니다. Existing valid section의 URL, title, source name, source-date-title combination을 보존합니다. Eligible reporter candidate만 사용하고, 검증 가능한 fact가 없으면 underfilled 상태로 editor review에 남깁니다.

### Completion fact-check

이름: Completion fact-check prompt

목적: completed editor draft와 추가 section이 eligible candidate만 사용했는지, full draft가 article composition contract를 만족하는지 확인합니다.

위치: `src/generator/publish/orchestrator-repair-completion.js`의 completion fact-checker `callLlmJson()` 호출 (system prompt는 `src/generator/publish/orchestrator-stage-prompts.js`의 `factCheckCompletionSystemPrompt()`)

Workflow/Stage: Stage 3 `fact-checker completion attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, reserve article capsule pool JSON, background context JSON, completed editor draft JSON

출력/schema: `factCheckSchema`, `fact-check-completion-attempt-<n>.json`

주요 guardrail: Added section이 eligible reporter candidate만 사용했는지 확인합니다. C++/AI/tooling fallback의 Android native development framing과 measurable action item을 다시 검사합니다.

## 공통 prompt 조각

### Source extraction guardrails

이름: `sourceExtractionPromptGuardrails()`

목적: `source_extraction`, `source_quality`, seed evidence, linked evidence, keyword hint를 source-backed fact와 editorial hint로 분리하도록 강제합니다.

위치: `src/generator/reporter/newsletter-prompts.js`

Workflow/Stage: reporter, editor, fact-check, repair, completion 계열 prompt

주요 입력: 각 stage의 candidate capsule, source extraction, derived editorial hints, seed evidence context

출력/schema: 별도 schema 없음. 각 stage schema에 포함될 source-bound field를 제한합니다.

주요 guardrail: `source_quality`를 누락, 복구, override하지 않습니다. Blocked 또는 failed linked evidence를 factual support로 쓰지 않습니다. Seed URL을 Stage 3에서 다시 fetch, crawl, browse하지 않습니다. Keyword hint를 source-backed fact로 표시하지 않습니다.

### Article section contract

이름: `articleSectionContractPrompt()`

목적: editor, repair, completion output의 main article이 validation/editorial diagnostics용 `article_sections`와 HAL signal metadata를 갖추게 합니다.

위치: `src/generator/reporter/newsletter-prompts.js`

Workflow/Stage: editor, repair, completion, fact-check 계열 prompt

주요 입력: article capsule, background context, selected/reserve candidate metadata

출력/schema: `editorSchema` 또는 `editorCompletionSchema` 내부 article section fields

주요 guardrail: `verified_facts`, `background_context`, `hal_driver_impact`, `action_items`, `team_share_points`를 요구합니다. `do_not_claim`은 public article prose가 아니라 claim guardrail로만 사용합니다. Direct HAL/API/runtime change는 direct source evidence가 있을 때만 주장합니다.

### Public article contract

이름: `publicArticleContractPrompt()`

목적: reader-facing article prose를 diagnostics fields와 분리하고, public output이 newsletter article 형태를 갖추게 합니다.

위치: `src/generator/reporter/newsletter-prompts.js`

Workflow/Stage: editor, repair, completion, fact-check 계열 prompt

주요 입력: selected article capsule, article section diagnostics, source links

출력/schema: `editorSchema` 또는 `editorCompletionSchema` 내부 `public_article`

주요 guardrail:

- story v1 output은 top-level에 `public_contract_version="story-v1"`, `generation_contract_version=1`을, article 단위에 `public_article.story_contract_version=1`을 포함합니다.
- `public_article`에는 `headline`, `source_subtitle`, `lead`, `body_paragraphs`, `camera_hal_takeaway`, `reader_checkpoints`, `editorial_story`, `source_links`를 포함합니다.
- `decision_metadata`는 LLM이 쓰지 않습니다. deterministic builder가 만들거나 덮어씁니다(overwrite).
- `editorial_story.reader_scenario`는 가정형 현업 장면으로 쓰고, `what_happened`에는 source로 확인된 fact만 둡니다.
- `article_sections`와 `hal_signal_capsule`은 독자에게 보이는 prose(reader-facing prose)로 render하지 않습니다.
- public source link로는 local path, `.tmp` path, GitHub Actions artifact URL, editorial 전용(editorial-only) source role을 쓰지 않습니다.

### Camera HAL editorial voice

이름: `cameraHalEditorialVoicePrompt()`(full 가드레일), `cameraHalEditorialVoiceWithPlanPrompt()`(plan 전제 slim). 공통 서사 아크는 `cameraHalEditorialVoiceBaseLines()`로 공유합니다.

목적: 공개 기사가 schema-driven 범용 요약이 아니라 Camera HAL / lower camera stack 관점의 자연스러운 한국어 뉴스레터 prose가 되도록, 작성 단계에 에디토리얼 톤·서사 가이드를 제공합니다(#693, #670).

위치: `src/generator/reporter/newsletter-prompts.js`

Workflow/Stage: editor draft와 completion editor prompt에만 조립합니다(fact-check, repair, reporter prompt에는 넣지 않습니다). editor 단계는 editorial plan을 항상 받으므로 `cameraHalEditorialVoiceWithPlanPrompt()`(generic 가드레일 세 줄을 "plan을 따르라"로 슬림화)를 쓰고, plan을 받지 않는 completion 단계만 `cameraHalEditorialVoicePrompt()`(full generic 가드레일)를 씁니다(#700).

주요 입력: 별도 입력을 추가하지 않습니다. 기존 작성 단계 prompt에 톤·서사 가이드 문자열만 결합합니다.

출력/schema: 별도 schema 없음. `editorSchema`/`editorCompletionSchema`의 `public_article.body_paragraphs` 등 reader-facing prose 작성 방식을 안내합니다.

주요 guardrail:

- `body_paragraphs`는 (1) 원문에서 확인된 사실 → (2) 기술 정체·적용 대상·상태·Camera HAL과의 거리감 → (3) 직접 변경 / 참고 흐름 / 추적 리스크 takeaway 흐름으로 씁니다.
- `Impact`, `Layer`, `Scope`, `HAL Relevance` 같은 라벨 제목은 본문에 노출하지 않고 내부 판단 기준으로만 씁니다.
- 이미지 센서 제조사, SoC/platform vendor, ISP IP 제공자, 패치 작성자, 테스트 보드, 적용 디바이스를 혼동하지 않습니다.
- source 근거가 없으면 Samsung, S.LSI, Exynos, 양산, 성능/화질 개선으로 확대 해석하지 않습니다.
- 원문 제한 사항(review NACK, RAW-only, board/kernel/library version 한정, ISP bypass, release 전 상태)을 보존합니다.
- 검증 단계(fact-check)와 judge prompt에는 포함하지 않습니다. 톤 가이드가 검증 LLM의 `must_fix` 판정에 발행 차단 압력을 더하지 않게 합니다.
