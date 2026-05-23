# 뉴스룸 LLM Prompt 운영 Reference

이 문서는 Gemini/LLM prompt 위치를 빠르게 찾기 위한 운영 reference입니다. `source of truth`는 코드이며, 이 문서는 prompt 원문을 복사하지 않고 목적과 입출력 계약만 요약합니다. Line number는 쉽게 drift되므로 파일 경로와 함수명을 기준으로 확인하세요.

API key, runtime secret, 전체 prompt 원문, generated artifact 내용은 이 문서에 포함하지 않습니다. Prompt 변경은 quality threshold, validator 계약, publication gate를 약화하지 않아야 합니다.

## 기준 위치 링크

- [Stage 3 prompt host](../../scripts/newsroom/cli/gemini-newsroom-newsletter.js)
- [Stage 2 source discovery prompt host](../../scripts/newsroom/collect/gemini-source-discovery.js)
- [Editorial policy](../editorial-policy.md)
- [Newsletter template](../newsletter-template.md)
- [Newsletter policy config](../../config/newsletter-policy.json)
- [Prompt contract tests](../../tests/contract/prompt-contract.test.js)

## Workflow 요약

### Newsroom 01 - Manual Source Collection PR

이름: Gemini prompt 없음

목적: RAW 후보를 수집하고 review 가능한 `manual-candidates.json` 계열 artifact를 생성합니다.

위치: `.github/workflows/01-newsroom-manual-source-collect-pr.yml`, `npm run collect`

Workflow/Stage: Stage 1 RAW collection

주요 입력: `data/news-sources.json`, optional `collection-intent.json`, source registry 설정

출력/schema: `content/collected-news/<date>/manual-candidates.json`, RAW candidate artifact

주요 guardrail: LLM credential을 요구하지 않으며 Gemini prompt를 실행하지 않습니다. Stage 1 결과는 Stage 2/Stage 3의 입력일 뿐 최종 발행물이 아닙니다.

### Newsroom 02 - Gemini Source Discovery PR

이름: Source discovery proposal prompt

목적: manual candidate와 source registry를 바탕으로 부족한 source coverage를 보강할 discovery intent를 제안합니다. Gemini output은 후보 진실값이 아니라 proposal입니다.

위치: `scripts/newsroom/collect/gemini-source-discovery.js`의 `buildProposalPrompt()`와 `buildProposalPayload()`

Workflow/Stage: `Newsroom 02 - Gemini Source Discovery PR`, `sourceDiscovery`

주요 입력: newsletter date, 최대 40개 manual candidate 요약, enabled source registry 요약

출력/schema: `proposalResponseSchema()`, `content/newsroom/<date>/gemini-source-proposals.json`

주요 guardrail: newsletter article을 작성하지 않습니다. 제공된 registry domain 또는 linked evidence domain의 source URL만 제안합니다. Deterministic fetch, normalize, schema validation을 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영됩니다.

## Newsroom 03 - Gemini Final Newsletter PR

### 공통 prompt context

이름: Final generation common context

목적: Stage 3의 reporter, editor, fact-check, repair, completion prompt에 공통 운영 정책과 작성 기준을 전달합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 `commonContext`

Workflow/Stage: `Newsroom 03 - Gemini Final Newsletter PR`, Stage 3 전체

주요 입력: newsletter date, audience 설명, `docs/editorial-policy.md`, `docs/newsletter-template.md`, `docs/golden-examples/manual-quality-newsletter.md`

출력/schema: 별도 schema 없음. 각 LLM stage의 user prompt 일부로 결합됩니다.

주요 guardrail: 제공된 candidate JSON, source registry, editorial documents만 사용합니다. Web browsing을 하지 않고, source name과 source URL을 보존하며, reader-facing text는 한국어로 작성합니다.

### Background context

이름: Background context prompt

목적: selected article capsule을 바탕으로 editor가 사용할 optional technical background context를 생성합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 `buildBackgroundContextReport()`

Workflow/Stage: Stage 3 `background-context`

주요 입력: `commonContext`, selected article capsule context, deterministic static fallback background context

출력/schema: `backgroundContextSchema`, `content/newsroom/<date>/background-context.json`

주요 guardrail: Web browsing을 하지 않습니다. Raw source table text, UI fragment, release table dump, source snippet을 background prose로 복사하지 않습니다. `background_basis`에는 external lookup이 아니라 supplied capsule metadata와 model knowledge 기반임을 설명해야 합니다.

### Reporter

이름: Reporter prompt

목적: deterministic shortlist가 이미 고른 final article input을 재선정하지 않고, evidence field를 요약, tagging, refinement합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 reporter `callLlmJson()` 호출

Workflow/Stage: Stage 3 `reporter attempt <n>/<total>`

주요 입력: `commonContext`, locked article context, shortlisted article capsule JSON, compact selection context

출력/schema: `reporterSchema`, `content/newsroom/<date>/reporter-candidates.json`

주요 guardrail: 최종 selection decision을 다시 하지 않습니다. Capsule의 eligibility, risk, score, imageCandidates, evidence를 보존합니다. Source text가 생략돼 있는데 있는 것처럼 가정하지 않고, article-level `claims[]`는 만들지 않습니다.

### Editor draft

이름: Editor draft prompt

목적: final-selected article capsule을 사용해 한국어 technical newsletter draft를 생성합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 editor `callLlmJson()` 호출

Workflow/Stage: Stage 3 `editor attempt <n>/<total>`

주요 입력: `commonContext`, locked article context, optional editor retry contract, primary selected article capsule JSON, background context JSON

출력/schema: `editorSchema`, `content/newsroom/<date>/editor-draft.json`

주요 guardrail: `docs/editorial-policy.md`와 `docs/newsletter-template.md`를 따릅니다. `final_selected=false`, watchlist/exclude, missing dated evidence, `source_gap_risk=true`, `briefing_only`, `reference_only` candidate를 main article로 만들지 않습니다. Image URL을 만들지 않고 `imageCandidates.url` 중 하나 또는 empty string만 `selectedImage`로 사용합니다.

### Editor semantic repair

이름: Editor semantic repair prompt

목적: editor JSON이 schema는 만족했지만 semantic validation에 실패했을 때, 해당 validation error만 고쳐 complete editor JSON으로 복구합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 `repairEditorSemanticWithLlm()`

Workflow/Stage: Stage 3 `<editorStage> semantic repair`

주요 입력: `commonContext`, locked article context, editor semantic validation error JSON, invalid editor draft JSON

출력/schema: `editorSchema`

주요 guardrail: 기사 추가, 제거, 재정렬, 교체를 하지 않습니다. Validation error가 직접 가리키는 field가 아니면 headline, category, source URL, image field, action item, reference를 바꾸지 않습니다. Source fact나 source material을 만들지 않습니다.

### Fact-check

이름: Fact-check prompt

목적: editor draft의 factuality, missing source, exaggerated language, missing date, editorial-policy violation을 검토합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 fact-checker `callLlmJson()` 호출

Workflow/Stage: Stage 3 `fact-checker attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, background context JSON, editor draft JSON

출력/schema: `factCheckSchema`, `content/newsroom/<date>/fact-check-report.json`

주요 guardrail: Style rewrite가 아니라 factual error, source problem, editorial-policy violation에 집중합니다. Source 없는 claim과 발행 차단 오류는 `must_fix[]`, dated evidence 또는 cross-check 부족은 `source_gaps[]`, 같은 source 안에서 보강 가능한 표현/구체성/actionability 문제는 `recommended_fixes[]`로 분류합니다.

### Targeted repair editor

이름: Targeted repair editor prompt

목적: quality/fact-check failure가 있는 section만 repair, replace, demote하기 위한 replacement section JSON을 생성합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 repair editor `callLlmJson()` 호출

Workflow/Stage: Stage 3 `editor repair attempt <n>/<total>`

주요 입력: `commonContext`, locked article context, repair plan JSON, locked/passing section summary, failed section summary, selected/reserve article capsule JSON, background context JSON, candidate rejection diagnostics, current fact-check JSON, quality deductions

출력/schema: `editorCompletionSchema`, `editor-repair-sections-attempt-<n>.json`

주요 guardrail: Full newsletter draft를 반환하지 않고 regenerated section JSON만 반환합니다. Locked/passing section은 변경하지 않습니다. Source gap을 publishable fact처럼 재사용하지 않고, coverage나 source binding을 충족할 수 없으면 demote 또는 replace합니다.

### Repair fact-check

이름: Repair fact-check prompt

목적: repaired editor draft를 다시 fact-check하고 unresolved source gap 또는 editorial-policy violation을 확인합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 repair fact-checker `callLlmJson()` 호출

Workflow/Stage: Stage 3 `fact-checker repair attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, reserve article capsule pool JSON, repaired editor draft JSON

출력/schema: `factCheckSchema`, `fact-check-repair-attempt-<n>.json`

주요 guardrail: Missing release date, version/release, API/component, concrete behavior change, source gap, watch/reference page misuse를 `must_fix`로 유지합니다. Repo-local fallback image와 preserved external original 관계를 오해해 false positive로 막지 않도록 합니다.

### Completion editor

이름: Completion editor prompt

목적: quality gate가 article count 부족을 보고하고 eligible candidate가 남아 있을 때, 부족한 main article section만 추가 생성합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 completion editor `callLlmJson()` 호출

Workflow/Stage: Stage 3 `editor completion attempt <n>/<total>`

주요 입력: `commonContext`, completion exclusion context, current editor section summaries, eligible primary/reserve article capsules, background context JSON, candidate rejection diagnostics, current quality deductions

출력/schema: `editorCompletionSchema`, `editor-completion-attempt-<n>.json`

주요 guardrail: Full newsletter rewrite를 하지 않습니다. Existing valid section의 URL, title, source name, source-date-title combination을 보존합니다. Eligible reporter candidate만 사용하고, 검증 가능한 fact가 없으면 underfilled 상태로 editor review에 남깁니다.

### Completion fact-check

이름: Completion fact-check prompt

목적: completed editor draft와 추가 section이 eligible candidate만 사용했는지, full draft가 article composition contract를 만족하는지 확인합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`의 completion fact-checker `callLlmJson()` 호출

Workflow/Stage: Stage 3 `fact-checker completion attempt <n>/<total>`

주요 입력: `commonContext`, selected article capsule JSON, reserve article capsule pool JSON, background context JSON, completed editor draft JSON

출력/schema: `factCheckSchema`, `fact-check-completion-attempt-<n>.json`

주요 guardrail: Added section이 eligible reporter candidate만 사용했는지 확인합니다. C++/AI/tooling fallback의 Android native development framing과 measurable action item을 다시 검사합니다.

## 공통 prompt 조각

### Source extraction guardrails

이름: `sourceExtractionPromptGuardrails()`

목적: `source_extraction`, `source_quality`, seed evidence, linked evidence, keyword hint를 source-backed fact와 editorial hint로 분리하도록 강제합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

Workflow/Stage: reporter, editor, fact-check, repair, completion 계열 prompt

주요 입력: 각 stage의 candidate capsule, source extraction, derived editorial hints, seed evidence context

출력/schema: 별도 schema 없음. 각 stage schema에 포함될 source-bound field를 제한합니다.

주요 guardrail: `source_quality`를 누락, 복구, override하지 않습니다. Blocked 또는 failed linked evidence를 factual support로 쓰지 않습니다. Seed URL을 Stage 3에서 다시 fetch, crawl, browse하지 않습니다. Keyword hint를 source-backed fact로 표시하지 않습니다.

### Article section contract

이름: `articleSectionContractPrompt()`

목적: editor, repair, completion output의 main article이 validation/editorial diagnostics용 `article_sections`와 HAL signal metadata를 갖추게 합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

Workflow/Stage: editor, repair, completion, fact-check 계열 prompt

주요 입력: article capsule, background context, selected/reserve candidate metadata

출력/schema: `editorSchema` 또는 `editorCompletionSchema` 내부 article section fields

주요 guardrail: `verified_facts`, `background_context`, `hal_driver_impact`, `action_items`, `team_share_points`를 요구합니다. `do_not_claim`은 public article prose가 아니라 claim guardrail로만 사용합니다. Direct HAL/API/runtime change는 direct source evidence가 있을 때만 주장합니다.

### Public article contract

이름: `publicArticleContractPrompt()`

목적: reader-facing article prose를 diagnostics fields와 분리하고, public output이 newsletter article 형태를 갖추게 합니다.

위치: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

Workflow/Stage: editor, repair, completion, fact-check 계열 prompt

주요 입력: selected article capsule, article section diagnostics, source links

출력/schema: `editorSchema` 또는 `editorCompletionSchema` 내부 `public_article`

주요 guardrail: story v1 output은 top-level `public_contract_version="story-v1"`, `generation_contract_version=1`와 article-level `public_article.story_contract_version=1`을 포함합니다. `public_article`에는 `headline`, `source_subtitle`, `lead`, `body_paragraphs`, `camera_hal_takeaway`, `reader_checkpoints`, `editorial_story`, `source_links`를 포함하고, `decision_metadata`는 LLM이 쓰지 않으며 deterministic builder가 생성하거나 overwrite합니다. `editorial_story.reader_scenario`는 가정형 현업 장면으로 쓰고, `what_happened`에는 source-confirmed fact만 둡니다. `article_sections`와 `hal_signal_capsule`은 reader-facing prose로 render하지 않습니다. Local path, `.tmp` path, GitHub Actions artifact URL, editorial-only source role을 public source link로 쓰지 않습니다.
