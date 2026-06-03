# Camera HAL SW 뉴스레터 Newsroom workflow

이 문서는 AOSP Camera / Camera Driver / SoC Platform 뉴스레터를 낮은 수작업 비용으로 매일 생성하기 위한 역할 기반 workflow를 설명합니다.

## 품질 게이트

newsroom pipeline은 `content/newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 생성합니다. 발행 준비 상태가 되려면 deterministic score가 `config/newsletter-policy.json`의 `qualityGatePolicy.threshold` 이상이어야 합니다. 이 threshold 완화는 LLM 비용과 false negative를 줄이기 위한 운영 튜닝이며, 품질 검증 우회가 아닙니다. source gap, fact-check `must_fix`, 발행에 치명적인 deduction이 있으면 숫자 점수가 threshold 이상이어도 publish-ready로 보지 않습니다.

draft가 gate를 통과하지 못하면 generator는 `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼 재시도합니다. 기본값은 `1`입니다. 이미 article quality check를 통과한 section은 보존하고, quality retry 한 번에서 repair 또는 replace할 section 수는 `NEWSROOM_MAX_SECTION_REPAIRS=1`로 제한합니다. `retry-history.json`과 `retry-history.md`에는 locked article, failed section, repair policy, skipped repair section을 남깁니다. Gemini API retry max delay 기본값은 `GEMINI_RETRY_MAX_DELAY_MS=300000`이며, 300000ms는 5분입니다.

quality gate는 AOSP Camera / Camera Driver / SoC Platform relevance, evidence specificity, engineering depth, actionability, source integrity, article composition을 확인합니다. source 없음, source gap, duplicate main article, invalid/broken source URL, underfilled article count, expanded scope 연결이 없는 generic AI/main article은 hard fail로 유지되며 점수가 충분해도 Hard blocker result: NEEDS_FIX 또는 `publish_ready=false`를 강제합니다. actionability, 약한 설명, local fallback image처럼 단독 발행 차단보다는 개선 권고에 가까운 항목은 soft deduction으로 점수와 report에 남깁니다. 이 경우에도 Quality score가 configured threshold 미만이면 통과하지 않습니다. `quality-report.json`의 `article_results`는 article별 `PASS` / `DEMOTE` / `FAIL`, hard fail reason, soft deduction, repair action을 표시합니다. retry 후에도 점수가 낮거나 blocker가 남아 있으면 weekly workflow는 review PR을 만들 수 있고 `needs-fix`로 표시합니다. review 가능한 PR 생성 성공은 발행 가능 품질 통과와 분리되며, `publish-ready` 라벨과 PR body의 `final_publish_ready=true`가 있을 때만 발행 가능한 이슈로 취급합니다.

workflow의 `create-newsroom-pr` job은 후보 수집, LLM 생성, 검증, review PR 생성을 담당합니다. review 가능한 `content/newsroom/YYYY-MM-DD/` artifact와 PR body가 만들어지면 fact-check 또는 quality가 실패해도 job은 성공할 수 있습니다. 반대로 fatal generation error로 review artifact가 없으면 job은 실패합니다. publish/deploy gate는 `final_publish_ready=true`, fact-check `PASS`, quality `PASS`, policy minimum article count, publish 가능한 `composition_mode`, source integrity, stale claim 없음이 모두 만족될 때만 통과합니다.

PR label은 상태를 분리해서 보여 줍니다. `needs-fix`는 편집장 수리 또는 검토가 필요한 PR, `fallback-composition`은 direct camera/driver 후보가 부족해 SoC/platform/tooling fallback을 사용했지만 `publish-ready`가 아닌 PR에만 붙는 diagnostics label, `thin-week`는 자동 발행 대상이 아닌 얇은 주간 review path, `publish-ready`는 최종 발행 gate를 통과한 PR에만 사용합니다. summary cache는 restore와 save를 분리하고 save를 `if: always()`로 실행해 실패 run 이후 retry 비용을 줄입니다.

## 목표

목표는 단순히 날짜별 newsletter 파일을 자동 생성하는 것이 아닙니다. 최신 소식을 수집하고, Camera HAL 엔지니어 관점으로 해석하고, 검증 가능한 초안을 PR로 남기는 것입니다. 사용자는 최종 편집장으로 PR을 승인하거나 수정 요청합니다.

```text
source registry
  -> candidate collector
  -> deterministic shortlist and final article selection
  -> LLM reporter (default: Gemini)
  -> LLM editor (default: Gemini)
  -> LLM fact checker (default: Gemini)
  -> static artifact writer
  -> npm run validate:post-generation
  -> newsletter/YYYY-MM-DD PR
```

## LLM provider 운영

기본 provider는 `gemini`이며 scheduled run은 `runtime-config.js`의 `DEFAULT_RUNTIME_CONFIG`에 정의된 provider/model/fallback model을 사용합니다. scheduled run은 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` repo variable을 읽지 않습니다.

`workflow_dispatch` 수동 실행에서만 `llm_provider`, `llm_model`, `llm_fallback_models` input이 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` runtime env로 전달됩니다. Stage 1 source collection은 LLM을 호출하지 않으므로 `llm_provider` selector가 없습니다. Stage 2 source discovery는 `llm_provider`와 `llm_model`을 제공하며, Stage 3 final generation은 `llm_provider`, `llm_model`, `llm_fallback_models`를 모두 제공합니다. 이슈 초안에 나온 `llm_api_provider`는 예시 이름이며, 현재 공개 workflow 계약은 `llm_provider`입니다.

`LLM_PROVIDER=gemini`은 `GEMINI_API_KEY`만 요구합니다. `LLM_PROVIDER=openapi`는 reserved provider enum으로 전용 구현 PR 전에는 `provider_not_implemented`로 fail-fast합니다. token은 GitHub Secrets에서만 읽고 log, artifact, PR body에 출력하지 않습니다.

## Role 1. Candidate Collector

- `data/news-sources.json`의 enabled source를 읽습니다.
- JSON registry가 없을 때만 `docs/news-sources.md`의 `- Name: URL` 형식을 fallback으로 사용합니다.
- RSS 또는 HTML page에서 후보를 수집하고 `content/collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
- media/community/candidate-only source는 최종 기사로 올리기 전에 공식 출처 교차 확인이 필요합니다.

## Role 2. LLM Reporter

LLM 실행 전에 `scripts/newsroom/generate/newsroom-selection.js`가 `content/collected-news/YYYY-MM-DD/candidates.json`을 읽고 source-gap/watch/reference 후보를 제거합니다. 기존 `scripts/lib/newsroom-selection.js` 경로는 호환 shim으로 유지합니다. URL과 near-duplicate title을 dedupe하고, eligible candidate를 점수화한 뒤 `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`을 작성합니다. LLM prompt에는 full candidate 대신 `content/newsroom/YYYY-MM-DD/article-capsules.json`의 compact capsule을 전달합니다.

shortlist는 기본 8-12개 수준, hard cap 12개 후보로 제한됩니다. local selector는 LLM reporter/editor prompt가 실행되기 전에 deterministic scoring으로 후보를 줄이고 `config/newsletter-policy.json`이 정한 final main article input을 선택합니다. scoring은 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, `soc_platform_signal`, `cpp_ai_tooling_fallback`, `generic_tech_watchlist` bucket과 구체 evidence, 최신성, 실무 actionability, source reliability를 함께 봅니다. source gap, 날짜 근거 없음, dated evidence 없는 watch page, 구체 API/component 근거 없음은 main article에서 제외되거나 강하게 감점됩니다. SoC/CPU/GPU/NPU/ISP/power/thermal/performance 기사는 configured supporting main bucket일 때만 main article 보강에 사용할 수 있습니다. `generic_tech_watchlist`는 main article보다 briefing/watchlist로 유지합니다. eligible non-duplicate final input이 configured article count range를 만족하지 못하면 생성은 조기에 실패하고 `content/newsroom/YYYY-MM-DD/recovery-prompt.md`를 남깁니다.

- 수집 후보 중 AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, Android platform camera-adjacent, SoC platform, C++, LLVM/Clang/GCC, AI workflow와 관련된 항목을 점수화합니다.
- source name, source URL, candidateOnly, requiresCrossCheck, imageCandidates를 유지합니다.
- 출력: `content/newsroom/YYYY-MM-DD/reporter-candidates.json`.
- `article-capsules.json`은 title, url, source, published_date, topic_type, component, what_changed, why_hal_engineer_cares, evidence, risk, score 중심의 compact prompt 입력입니다. reporter stage에는 top shortlist capsule 8-12개, editor/fact-check/repair/completion stage에는 final-selected 또는 필요한 completion capsule만 전달합니다.

LLM reporter는 전체 collected candidate가 아니라 deterministic shortlist만 받습니다. 요약, tag, evidence field를 보강하되 local `selected=true` final article decision을 보존해야 합니다.

## Role 3. LLM Editor

- 한국어 newsletter 초안을 작성합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources를 포함합니다.
- 이미지 URL을 새로 만들지 않고 collector가 제공한 `imageCandidates`에서만 선택합니다.
- 출력: `content/newsroom/YYYY-MM-DD/editor-draft.json`, `content/newsroom/YYYY-MM-DD/editor-draft.md`.

editor는 deterministic final article input과 locked/retry context만 받습니다. retry가 필요하면 통과한 section은 lock하고, repair prompt는 실패한 section만 재생성하도록 요청합니다. source gap 또는 ineligible source는 rewrite하지 않고 demote 또는 replace 대상으로 처리합니다. weak HAL relevance와 duplicate는 replace, missing actionability와 required/evidence 부족은 same-source section repair 대상으로 분리합니다. retry artifact는 `locked_sections`, `failed_sections`, `regenerated_sections`, `repair_plan`, `skipped_repair_plan`, rejected retry output을 기록합니다.

## Role 4. LLM Fact Checker

- 출처 누락, 과장 표현, 사실과 해석 혼동, Action Item 누락, Camera HAL 관점 약화를 확인합니다.
- `NEEDS_FIX`와 `must_fix`가 있으면 workflow의 최종 gate가 실패해야 합니다.
- 출력: `content/newsroom/YYYY-MM-DD/fact-check-report.json`, `content/newsroom/YYYY-MM-DD/fact-check-report.md`.

## Role 5. Artifact Writer

- `newsletters/YYYY-MM-DD/newsletter.md`를 생성합니다.
- `newsletters/YYYY-MM-DD/index.html`을 생성합니다.
- `data/newsletters.json`을 갱신합니다.
- `content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`, `00-review-guide.md`, `release-qa-report.md`, `artifact-manifest.json`을 생성합니다.
- `00-review-guide.md`는 아래 순서로 review artifact를 묶습니다.
  1. 편집장 브리프
  2. Seed 근거 요약
  3. 최종 기사 / 공개 출력
  4. 사실성 / 품질 / HAL 게이트
  5. 후보 선정 진단
  6. 필요 시 확인
  7. 디버그 근거
  8. 미분류 산출물
- `artifact-manifest.json`은 `schema_version=3`이며 legacy consumer 호환을 위해 `files[].path`, `files[].size`, `files[].sha256`에는 실제 존재하는 파일만 둡니다. review 순서, missing expected artifact, `review_blocking`, `review_attention_required` 같은 advisory metadata는 `review_artifacts[]`에 둡니다.
- `review_blocking`과 `review_attention_required`는 리뷰어 안내용 metadata입니다. 이 값은 deterministic publish gate, quality gate, source gate, public artifact readiness 판단을 변경하지 않습니다.
- `artifact-manifest.json` 파일은 hash churn 방지를 위해 manifest `files[]` hashing 대상에서 제외합니다. `00-review-guide.md`와 `release-qa-report.md`는 존재하면 `files[]`에 포함될 수 있지만 derived artifact라서 `missingRequired` 판단에는 사용하지 않습니다.
- Manifest surface는 두 가지입니다.
  - `content/newsroom/YYYY-MM-DD/artifact-manifest.json`: date-scoped review package manifest입니다. `files[]`와 `review_artifacts[]`는 review inventory 기준으로 생성합니다.
  - snapshot root `artifact-manifest.json`: workflow snapshot manifest입니다. `.tmp/**`, cache, debug file 같은 snapshot file을 추가로 포함할 수 있으며 같은 `schema_version=3`와 review metadata field를 사용합니다.

## Role 6. Validator

`npm run validate`가 repository-wide safety gate입니다. Stage 3 final workflow의 post-generation gate는 `npm run validate:post-generation`을 사용합니다. 이 chain은 `validate:quality`를 다시 실행하지 않고, final Markdown/HTML public artifact를 `validate:llm-publication-quality`의 LLM API judge로 확인합니다.

- `npm run validate:config`: `data/news-sources.json` 구조, 필수 field, source ID, URL, category-to-section mapping, source entry의 중복 `section` 금지, canonical JSON formatting을 확인합니다.
- `npm run validate:site`: metadata, 파일 존재, TODO leak, duplicate date, required sections, source/reference, HTML class hook, anchor balance를 확인합니다.
  current/changed/generated validation target에 해당하는 artifact에서 fact-check `must_fix`가 남으면 hard fail입니다. 같은 `must_fix`가 historical artifact outside strict target에서만 발견되면 소급 hard fail 대신 warning-only로 기록하지만, publish-ready로 간주하지 않습니다.
- `npm run validate:images`: article image URL과 local fallback file 존재를 확인합니다.
  외부 이미지가 404, timeout, invalid content-type 등으로 실패해도 local fallback이 존재하고 최종 `selectedImage`가 fallback 경로로 정리되면 warning only입니다. 원본 URL은 `originalImage` 또는 `resolvedImage.originalUrl`에 보존하며, fallback 파일 누락이나 깨진 외부 URL이 publish 산출물에 남은 경우에만 fail합니다.
- `npm run validate:quality`: deterministic quality report를 재계산하고 configured article count range 위반, Primary Camera Stack 필수 조건 미달, forbidden main bucket 포함, main section 간 source URL 중복, source 누락, Camera HAL perspective 누락, action item 부족, source-gap mapped candidate, dated evidence 없는 selected candidate를 차단합니다. AI/C++ 기사는 configured supporting main bucket일 때만 보강 기사로 허용됩니다.
- `npm run validate:post-generation`: Stage 3 final workflow에서 public newsletter files가 준비된 뒤 실행하는 post-generation gate입니다. `validate:quality`는 포함하지 않고, `validate:llm-publication-quality`가 LLM API로 실제 렌더링된 public artifact를 검사합니다.
- `npm run validate:localization`: 유지 문서와 표시용 JSON 값이 한국어 규칙을 지키는지 확인합니다.

## 편집자 승인 발행 정책

- `publish-ready`는 AI 자동 발행 가능 상태이며 `has_ai_publish_ready=true`일 때만 사용합니다.
- `review_publication_ready=true`는 `public_newsletter_ready=true`인 검증된 public issue가 있고, `final_publish_ready=false`라서 편집장 검토 후 merge로만 공개할 수 있음을 뜻합니다. 이 값은 raw file existence가 아니라 `resolve-reviewable-artifacts`의 public newsletter readiness 결과에서만 파생합니다.
- `diagnostics_only=true`는 `review_pr_ready=true && public_newsletter_ready=false`인 진단 전용 PR입니다. merge해도 Newsletter 홈페이지에 표시되지 않으며 public files 누락 이유가 PR body에 남아야 합니다.
- `homepage_visible_after_merge=true`는 `data/newsletters.json`의 date/html/md entry가 `newsletters/YYYY-MM-DD/index.html` 및 `newsletter.md`와 일치하는 public issue에만 설정합니다. workflow output의 최종 판단은 `resolve-reviewable-artifacts`가 public files와 index entry를 다시 검증한 결과입니다.
- `needs-fix`는 편집장 검토 또는 수정이 필요한 상태입니다. 자동 발행 기준을 통과하지 못한 editor review PR에는 broad signal인 `review-only`를 붙이고, public files가 준비된 review publication PR에는 `review-only-publication`, public files가 없는 진단 PR에는 `diagnostics-only`를 함께 붙입니다. 두 세부 label은 동시에 붙지 않아야 합니다.
- `final_publish_ready=false`는 자동 발행 기준 미충족을 뜻하지만, `review_publication_ready=true`인 PR의 공개 가능성을 혼자 차단하지 않습니다.
- `Validate Site and Images` (`.github/workflows/validate-site.yml`)는 structural validation을 blocking으로 유지하고 quality/fact-check 문제를 non-blocking annotation으로 보고합니다.

## URL Summary Cache

Reporter summary record는 `cache/news-summary/by-url/{sha256(normalized_url)}.json`과 `cache/news-summary/by-content/{content_hash}.json`에 cache됩니다. cache file은 의도적으로 untracked이며 CI에서는 `actions/cache`로 복원합니다.

cache hit은 같은 normalized URL을 먼저 확인하고, URL이 달라도 `content_hash`가 같으면 by-content record를 재사용합니다. `content_hash`는 title, summary, version/release, API/component, behavior evidence 중심으로 계산하며 URL, published date, source metadata는 제외합니다. published date나 source label만 바뀐 경우에는 summary를 다시 만들지 않고 freshness와 metadata는 현재 candidate에서 다시 판단합니다. article evidence가 바뀌면 `content-hash-mismatch`로 miss 처리합니다.

generator는 `content/newsroom/YYYY-MM-DD/summary-cache-report.json`, `summary-cache-report.md`, `.tmp/summary-cache-report.json`에 cache hit/miss와 miss reason을 남깁니다. 이 report는 비용 분석용 debug artifact이며, generated cache file 자체는 `cache/news-summary/` 아래에 남아 PR diff에 포함되지 않습니다.

## Cost Report

비용 artifact는 provider-neutral한 LLM 비용 리포트입니다. Gemini provider에서는 Gemini usage metadata와 local pricing table로 estimated cost를 계산하고, internal provider는 pricing table이 없으면 `estimated_cost_usd=null`과 pricing warning을 남깁니다.

Gemini 호출이 성공적으로 응답을 반환하면 generator는 response usage metadata를 stage/model/attempt 단위로 기록합니다. 비용 리포트는 `.tmp/newsroom-cost-report.json`과 `content/newsroom/YYYY-MM-DD/cost-report.md`에 남으며, prompt tokens, output tokens, thinking tokens, cached tokens, total tokens, estimated cost를 포함합니다.

Gemini request에는 stage별 thinking budget과 temperature를 적용합니다. thinking budget 기본값은 reporter `0`, editor/completion `1024`, repair `0`, fact-check `1024`, judge `1024`, scoring `0`입니다. editor/fact-check/judge의 thinking budget 활성화로 일일 약 12K thinking 토큰이 추가되며, Gemini 2.5 가격 기준 수 센트 수준입니다. fact-check 정확도와 publication-ready 판정 신뢰도 향상으로 정당화됩니다. 비용이 예상을 초과하면 `GEMINI_THINKING_BUDGET_JUDGE=0` 같은 env override로 코드 변경 없이 즉시 조정할 수 있습니다.

temperature 기본값은 stage별로 다릅니다. reporter `0.30`, editor `0.55`, fact-check `0.20`, repair `0.25`, judge `0.20`, source discovery `0.45`, 기타(default) `0.35`입니다. `GEMINI_TEMPERATURE_*` 환경변수로 각 stage를 독립적으로 조정할 수 있습니다(범위 0 이상 2 이하).

`GEMINI_THINKING_BUDGET_*` 및 `GEMINI_TEMPERATURE_*` 환경변수로 조정할 수 있고, cost report의 call row에는 실제 response의 `thinking_tokens`와 함께 `thinking_budget_requested`, `thinking_budget_applied`가 남습니다.

`NEWSROOM_WARN_COST_USD`와 `NEWSROOM_MAX_COST_USD`는 비용 관찰용 기준값입니다. 현재 운영 기준으로 두 값을 넘어도 workflow를 실패시키지 않고 warning만 출력합니다. 이 리포트는 비용 발생 위치를 파악하기 위한 artifact이며, 품질 점수나 publish readiness 판단을 변경하지 않습니다.

Stage별 기본 모델은 reporter/fact-checker가 `gemini-2.5-flash`, editor/repair가 `gemini-3.5-flash`, public article judge가 `gemini-2.5-flash-lite`이고 기본 fallback은 `gemini-2.5-flash-lite`입니다. Gemini Pro 계열 모델명은 모든 public model override 경로에서 validation error로 차단합니다. 비용 리포트는 call-level `pro_model` audit marker를 유지하지만 정상 run에서는 항상 `false`여야 하며, report-level 정책은 `Pro policy: disabled`로 고정됩니다.

Stage별 model routing은 아래 순서를 따릅니다. `LLM_MODEL` 또는 `GEMINI_MODEL`이 명시되면 모든 stage primary model을 override합니다. 그렇지 않으면 `NEWSROOM_REPORTER_MODEL`, `NEWSROOM_EDITOR_MODEL`, `NEWSROOM_FACTCHECK_MODEL`, `NEWSROOM_REPAIR_MODEL`, `NEWSROOM_JUDGE_MODEL`이 해당 stage만 override하고, 비어 있는 stage는 code default를 사용합니다. `LLM_FALLBACK_MODELS` 또는 `GEMINI_FALLBACK_MODELS`는 모든 stage primary 뒤에 붙는 fallback chain입니다.

| 설정 | reporter | editor | factcheck | repair | judge |
| --- | --- | --- | --- | --- | --- |
| env 없음 | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash-lite` |
| `NEWSROOM_EDITOR_MODEL=gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash-lite` |
| `LLM_FALLBACK_MODELS=gemini-2.5-flash-lite` | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback |

fact-checker는 새 글을 쓰는 stage가 아니라 source gap, unsupported claim, dated evidence 누락, forbidden bucket, 과장된 HAL impact 같은 structured violation을 탐지하는 stage입니다. source binding과 hard blocker의 최종 방어선은 deterministic validator이므로 fact-checker 기본값은 `gemini-2.5-flash`로 유지하고, 문장 작성과 보완 품질이 더 중요한 editor/repair에 `gemini-3.5-flash`를 사용합니다.

## Final Cost Reduction Operating Model

현재 운영 모델은 비용을 낮추기 위해 품질 기준을 낮추지 않습니다. 비용 절감은 네 가지 장치로 이루어집니다.

- deterministic scoring이 LLM 호출 전에 Camera HAL / Android Camera 후보를 먼저 줄입니다.
- `article-capsules.json`이 full context 대신 compact capsule만 Gemini에 전달합니다.
- quality retry는 전체 뉴스레터 재생성이 아니라 실패 section repair 또는 replace로 제한합니다.
- scheduled run과 manual run은 Flash/Flash-Lite 및 stage별 code default를 기본으로 사용합니다. Stage 3 수동 실행에서 `llm_model`을 비워 두면 code default stage model이 사용되며, Gemini Pro 계열 모델명은 runtime validation에서 차단됩니다.

운영자가 비용 원인을 확인할 때는 아래 순서로 artifact를 봅니다.

| 확인 대상 | 위치 | 판단 기준 |
| --- | --- | --- |
| cost report(비용 리포트) | `.tmp/newsroom-cost-report.json`, `content/newsroom/YYYY-MM-DD/cost-report.md` | stage/model/attempt별 estimated cost, `thinking_tokens`, `cached_tokens`, `pro_model=false` 유지 여부를 확인합니다. |
| selection report(기사 선정 리포트) | `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`, `article-capsules.json`, PR 본문 selection diagnostics | 후보가 8-12개 수준으로 제한됐는지, generic AI/C++가 HAL 후보를 밀어내지 않았는지 확인합니다. |
| quality report(품질 리포트) | `content/newsroom/YYYY-MM-DD/quality-report.json`, `quality-report.md` | hard fail과 soft deduction을 분리해 보고, `article_results`의 `PASS` / `DEMOTE` / `FAIL`과 repair action을 확인합니다. |
| generation status artifact(생성 상태 결과 파일) | `.tmp/newsletter-generation-status.json` | `publish_ready`, `quality_status`, `final_selected_article_count_for_gate`, failure reason을 확인합니다. |
| summary cache report(요약 cache 리포트) | `.tmp/summary-cache-report.json`, `content/newsroom/YYYY-MM-DD/summary-cache-report.md` | cache hit/miss와 miss reason을 보고 반복 요약 비용을 확인합니다. |

## Safe Scheduled Defaults

현재 scheduled run의 provider/model 기본값은 GitHub Variables가 아니라 `DEFAULT_RUNTIME_CONFIG`에서 결정됩니다. 기본 provider는 `LLM_PROVIDER=gemini`이고, stage별 code default는 reporter/fact-checker `gemini-2.5-flash`, editor/repair `gemini-3.5-flash`, public article judge `gemini-2.5-flash-lite`, fallback `gemini-2.5-flash-lite`입니다. Workflow YAML은 Pro 계열 fallback 모델을 자동 추가하지 않으며, runtime config는 Gemini Pro 계열 모델명을 모든 public model override 경로에서 차단합니다.

scheduled run(예약 자동 실행)의 안전 기본값은 아래와 같습니다. provider/model은 code default이고, 나머지는 workflow와 runtime config의 기본값을 사용합니다.

```text
LOOKBACK_DAYS=90  # 워크플로 명시값. runtime 기본값은 10 (#487)이며 scheduled run은 catch-up 풀(#483)을 위해 90을 유지
LLM_PROVIDER=gemini
LLM_MODEL unset
GEMINI_MODEL unset
NEWSROOM_REPORTER_MODEL=gemini-2.5-flash
NEWSROOM_EDITOR_MODEL=gemini-3.5-flash
NEWSROOM_FACTCHECK_MODEL=gemini-2.5-flash
NEWSROOM_REPAIR_MODEL=gemini-3.5-flash
NEWSROOM_JUDGE_MODEL=gemini-2.5-flash-lite
LLM_FALLBACK_MODELS=gemini-2.5-flash-lite
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
GEMINI_THINKING_BUDGET_REPORTER=0
GEMINI_THINKING_BUDGET_EDITOR=1024
GEMINI_THINKING_BUDGET_REPAIR=0
GEMINI_THINKING_BUDGET_FACTCHECK=1024
GEMINI_THINKING_BUDGET_JUDGE=1024
GEMINI_THINKING_BUDGET_SCORING=0
GEMINI_TEMPERATURE_DEFAULT=0.35
GEMINI_TEMPERATURE_SOURCE_DISCOVERY=0.45
GEMINI_TEMPERATURE_REPORTER=0.30
GEMINI_TEMPERATURE_EDITOR=0.55
GEMINI_TEMPERATURE_FACTCHECK=0.20
GEMINI_TEMPERATURE_REPAIR=0.25
GEMINI_TEMPERATURE_JUDGE=0.20
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.15
NEWSROOM_MAX_COST_USD=0.25
```

manual high-quality run(수동 고품질 실행)의 기본 입력은 `llm_model=""`입니다. 이때 workflow는 `LLM_MODEL`을 전달하지 않으므로 code default stage model을 사용합니다. 수동 실행에서도 `llm_model`, `llm_fallback_models`, stage별 model variable에 Gemini Pro 계열 모델명을 넣으면 `doctor:config` 단계에서 실패합니다.

## Seed Evidence Workflow Priority

Seed evidence workflow migration은 newsroom pipeline 안에서 P0-equivalent 작업으로 취급합니다. 우선순위는 `seed evidence workflow migration > legacy compatibility cleanup`이지만, `source/evidence/security/publish safety > seed evidence workflow migration`이 더 높은 절대 기준입니다.

Legacy-pattern test failure는 다음 조건을 모두 만족할 때만 blocker에서 분리할 수 있습니다.

- Targeted seed evidence tests와 `npm.cmd run validate`가 통과합니다.
- 실패가 source integrity, URL safety, quality gate, selector gate, publish gate와 무관합니다.
- PR body에 affected test, failure reason, classification, follow-up이 기록됩니다.

다음 실패는 legacy 여부와 관계없이 blocker입니다.

- source-less article promotion
- `source_gap_risk` hard blocker bypass
- quality threshold, selector gate, publish gate relaxation
- private/internal URL fetch 또는 redirect-to-private fetch
- blocked/failed evidence가 article fact로 사용됨
- Gemini proposal이 deterministic validation 없이 candidate truth가 됨
- Stage 3 seed crawling/fetch 재수행
- manual editorial field override
- broken evidence id mapping

PR마다 failure classification은 `A. New workflow blocker`, `B. Source / evidence / security blocker`, `C. Legacy-pattern compatibility failure`, `D. Snapshot/report formatting drift`, `E. Follow-up cleanup candidate` 중 하나로 기록합니다. `A/B`는 항상 blocker이고, `C/D/E`만 위 조건을 만족할 때 후속 처리로 분리할 수 있습니다.

## Recovery Artifacts

`content/newsroom/YYYY-MM-DD/recovery-prompt.md`는 deterministic selection, LLM JSON parsing, fact-check, quality, validation이 retry 후에도 실패할 때 작성됩니다. shortlist, selected input, failed section, quality deduction, fact-check finding, exact rerun command를 포함합니다.

이 파일은 **`debug_heavy`** 등급으로 Git에 커밋하지 않습니다. 실패 run의 recovery-prompt는 GitHub Actions artifact `newsroom-final-debug-<run_id>`에서 다운로드하거나, 해당 날짜의 `artifact-manifest.json` → `retained_heavy_artifacts`에서 path/sha256으로 조회하세요.

## GitHub Actions 운영

### 일일 RAW 후보 PR

`Newsletters 01 - Source Collection PR` (`.github/workflows/01-newsletters-source-collect-pr.yml`) workflow는 매일 09:00 KST에 실행됩니다.

```text
KST daily 09:00 = UTC daily 00:00
branch: newsroom-raw/YYYY-MM-DD
```

workflow는 `main`에 직접 push하지 않고 RAW candidate 검토용 PR을 만듭니다.

### 3-stage RAW workflow

현재 schedule entrypoint는 Stage 1 RAW workflow입니다. Final newsletter generation은 승인된 candidate artifact를 입력으로 받는 수동 workflow로만 실행합니다.

- `Newsletters 01 - Source Collection PR` (`.github/workflows/01-newsletters-source-collect-pr.yml`): `collect`만 실행하고 `manual-candidates.json`, compatibility `candidates.json`, `raw-candidate-manifest.json`을 생성합니다. Gemini/API secret을 사용하지 않습니다.
- `Newsletters 02 - Source Discovery PR` (`.github/workflows/02-newsletters-source-discovery-pr.yml`): source discovery 전용 workflow이므로 `NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=true`로 고정 실행하며 별도 toggle input은 없습니다. LLM credential preflight 뒤 Gemini proposal을 `gemini-source-proposals.json`에 저장하고, deterministic fetch/normalize/schema validation을 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영합니다. (`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=false`인 credential-free disabled pass-through는 여전히 code-level로 지원되지만 이 workflow에서는 노출하지 않습니다.) workflow 02는 아래 파일들을 `merged-candidate-manifest.json`의 strict-check 필드에 기록하며, `validateMergedManifestSchema`가 `llm_used=true` 또는 `merge_mode='gemini_source_discovery'` 조건에서 파일 존재를 필수 검증하므로 모두 Git에 커밋(`review_required_compact` 등급)해야 합니다:
  - `gemini-usage-report.json` (`usage_report` 필드)
  - `gemini-source-proposals.json` (Gemini 제안 원문)
  - `gemini-source-proposal-validation-report.json` (`proposal_validation_report` 필드)
  - `source-clusters.json` (`source_clusters` 필드)
  - `evidence-validation-report.json` (`evidence_validation_report` 필드)
  - `extracted-source-facts.json` (소스 사실 추출 결과)
- `Newsletters 03 - Editor PR` (`.github/workflows/03-newsletters-editor-pr.yml`): `NEWSROOM_CANDIDATE_INPUT_MODE=artifact`로 approved candidate artifact만 읽고 `collect`를 재실행하지 않습니다.

Stage 2/3 manual run의 `newsletter_date`는 optional입니다. 비워두면 workflow 실행 시점의 KST 날짜(`YYYY-MM-DD`)로 resolve되며, resolved date는 workflow log에 출력됩니다.

Stage 1/3 smoke가 통과하기 전에는 새 Stage 1 schedule을 활성화하지 않습니다. cutover PR에서 기존 all-in-one schedule을 제거한 뒤 새 Stage 1 RAW workflow schedule을 활성화합니다.

### Secret

Repository Settings > Secrets and variables > Actions:

```text
GEMINI_API_KEY
```

선택 변수:

```text
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
GEMINI_THINKING_BUDGET_REPORTER=0
GEMINI_THINKING_BUDGET_EDITOR=512
GEMINI_THINKING_BUDGET_REPAIR=0
GEMINI_THINKING_BUDGET_FACTCHECK=0
GEMINI_THINKING_BUDGET_SCORING=0
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.15
NEWSROOM_MAX_COST_USD=0.25
```

### 수동 Final Generation 실행

GitHub Actions에서 `Newsletters 03 - Editor PR` (`.github/workflows/03-newsletters-editor-pr.yml`)을 선택하고 `Run workflow`를 누릅니다. `newsletter_date`는 optional이며, 비워두면 workflow 실행 시점의 KST 날짜(`YYYY-MM-DD`)로 resolve됩니다. 특정 날짜를 재생성하려면 `newsletter_date`만 입력하면 되고, candidate artifact path는 더 이상 input으로 받지 않습니다. Stage 3는 `merged-candidates.json` → `manual-candidates.json` → legacy `candidates.json` 순서로 승인된 artifact를 자동 선택합니다. `llm_provider`, `llm_model`, `llm_fallback_models`는 #368 기준상 advanced manual override input으로 유지합니다. 기본 수동 실행은 `llm_model=""`로 동작하며 code default stage model을 primary로 사용합니다. `llm_model` 또는 `llm_fallback_models`에 Gemini Pro 계열 모델명을 넣으면 `doctor:config` 단계에서 실패합니다.

## Editor-in-Chief Review

PR에서 다음 항목을 확인합니다.

- 이번 주 핵심 메시지가 명확한가?
- Camera HAL 엔지니어가 읽을 이유가 있는가?
- 단순 요약이 아니라 HAL 관점의 해석과 Action Item이 있는가?
- Sources와 References가 충분한가?
- fact-check 결과에 unresolved `must_fix`가 없는가?
- article image가 source attribution과 fallback contract를 지키는가?

## Release

편집자가 PR을 승인하면 merge합니다. GitHub Pages는 `main` 기준으로 반영됩니다.

## Quality Gate Drift 계약

`qualityGatePolicy.hardFailConditions`는 `config/newsletter-policy.json`에 있는 hard fail inventory의 source of truth입니다. `score`는 숫자 품질 점수일 뿐이며 hard fail blocker를 덮어쓸 수 없습니다. `score >= qualityGatePolicy.threshold`여도 blocking deduction, `source_gap`, fact-check `must_fix`, stale claim hard failure, strict mode의 `quality-report.json` recompute drift가 있으면 해당 이슈는 `publish-ready` / `final_publish_ready`가 아닙니다.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### Newsletter Policy

- Source of truth: `config/newsletter-policy.json`
- Main article count: 1-5
- One-article policy: a public newsletter may contain a single fully publishable main article.
- Article count alone does not make a one-article issue degraded or review-only; hard quality gates still apply.
- Supporting-only policy: a single supporting main bucket article may be public-ready when all hard gates pass.
- Review gate Primary Camera Stack articles: disabled by one-article policy
- Publish-ready Primary Camera Stack articles: disabled by one-article policy
- Publish-ready direct AOSP Camera or driver/image pipeline articles: disabled by one-article policy across `direct_aosp_camera`, `camera_driver_image_pipeline`
- Publish-ready supporting main articles: at most 1 total across supporting main buckets
- Primary Camera Stack buckets: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- Supporting main buckets: `android_multimedia_camera_output`, `soc_platform_signal`, `cpp_ai_tooling_fallback`
- Forbidden main buckets: `generic_tech_watchlist`; never promote these to main articles by candidate count alone
- Candidate pool preflight: publishable candidates at least 1; reserve candidates diagnostics only; camera stack candidates at least 0
- Selection windows: primary 7 days; fallback 21 days; reference 90 days
- Selection window enforcement: main selection enforced; fallback window candidates are promoted only when primary window selection is short.
- Catch-up (지난 소식) lane: when fresh selection is below 3 article(s), open main slots are filled with uncovered releases up to 90 days old from buckets `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, at most 2 per issue, covered once each; never displaces fresh content.
- Homepage headline policy: linear decay; decay 2 point(s)/day; replacement margin 5; minimum headline score 40; latest inclusion required true; history max 50
- Publish gate: PASS requires no source gaps, no fact-check must_fix, no blocking deductions, and every article marked publishable by the fact-checker. There is no numeric quality threshold.
- Editorial quality: the fact-checker (LLM) judges each article on usefulness to a Camera HAL SW engineer (topic-agnostic — C++, AI, or Linux articles qualify when they help that engineer). Topic/depth heuristics are not used as deterministic publish gates.
- Hard fail conditions remain blocking: source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->

## Source quality and prompt contract

Source quality(출처 품질)는 수집과 Stage 3 생성 사이에 실행 가능한 정책 계층을 추가합니다.

- Candidate 수집은 article capsule 생성 전에 `scripts/newsroom/collect/source-quality-classifier.js`를 실행합니다.
- 새 candidate는 canonical `source_quality`를 포함하며, 평면 source quality 필드는 호환성 mirror입니다.
- `article-capsules.json`에는 `source_quality`, `main_article_readiness`, `do_not_claim[]`이 포함됩니다.
- `main_article_readiness`는 source readiness, HAL signal readiness, deterministic `selection_input_ready`를 결합합니다. `selection_ready`는 `selection_input_ready`의 deprecated 호환 alias입니다.
- HAL signal quality는 HAL signal layer가 소유하며, source quality는 `hal_impact_axes`를 재계산하지 않습니다.
- HAL/native workflow readiness는 `source-quality-classifier.js`가 아니라 HAL signal layer와 결합된 readiness object가 결정합니다.
- Prompt guardrail은 `main_article_source_allowed=false`를 hard blocker로 취급하며, 산문 추론으로 `main_article_source_blockers[]`를 재정의하는 것을 금지합니다.
- 새 Stage 3 main article은 URL 누락, canonical `source_quality` 누락, 미해소 `source_url_quality=unknown`, `source_quality_status=blocked`, `main_article_source_allowed=false`, `SOURCE_QUALITY_FIELD_DRIFT`가 있으면 실패합니다.
- source quality 필드가 없는 레거시 artifact는 rollout 중 경고를 출력합니다.
- Source effectiveness 및 PR body 요약은 source URL quality 분포, 상태 요약, blocker 요약, 선정 main 커버리지, main 자격 커버리지, 조건부 승격/차단 수, 미확인 수, drift 수, 레거시 경고 수를 노출합니다.
## Source snapshot / `effective_date`

`data/source-monitor-registry.json`에 등록된 monitored source는 bounded fetch로 관찰하고, 이전 `data/source-snapshots/<source_id>.json`과 비교해 `content/source-events/YYYY-MM-DD/source-change-events.json` 및 `.md`를 만듭니다. 이 경로는 review artifact이며 public newsletter renderer가 직접 읽는 입력이 아닙니다.

`published_date`는 원문 source가 명시한 실제 발행일입니다. `effective_date`는 `Last updated`, structured modified date, sitemap `lastmod`, release row date, 또는 snapshot diff에서 source change event를 판단할 때 쓰는 유효 날짜입니다. `published_date`가 없는 문서는 날짜 없는 정적 문서 자체로 main article에 승격하지 않고, monitored source에서 생성된 source change event가 source binding과 date quality를 통과할 때만 candidate가 될 수 있습니다.

`detected_at`, `first_seen_at`, `last_seen_at`은 pipeline 관찰 시점 또는 snapshot state입니다. detected_at, first_seen_at, last_seen_at은 source의 실제 발행일이나 freshness 근거가 아니다. 이 값들은 freshness/date-source/publish-ready evidence로 사용하지 않습니다.

`date_source`와 `date_confidence`는 `scripts/newsroom/common/date-signals.js`의 allowlist와 baseline을 따릅니다. `date_confidence >= 85`인 source date signal만 source relevance와 source binding이 함께 통과할 때 publish-ready date evidence 후보가 될 수 있습니다. `snapshot_detected_at` 및 `content_hash_changed_without_date`는 editor review 또는 watchlist signal로만 다루며 publish-ready date evidence가 아닙니다.

Source monitor report는 `Source Snapshot Changes`, `Source Change Events`, `Evidence Identity / Duplicate Guard`, `Date Quality` 섹션을 포함합니다. Public newsletter artifact에는 raw snapshot state, previous/current diff payload, `processed_source_event_ids`, `processed_evidence_ids`를 노출하지 않습니다.

## Artifact Retention Policy

newsroom pipeline이 생성하는 artifact는 4가지 retention grade로 분류합니다.

| 등급 | 식별자 | Git 커밋 | 보존 위치 |
|------|--------|----------|-----------|
| Public Source of Truth | `public_source_of_truth` | 커밋 | Git |
| Review Required Compact | `review_required_compact` | 커밋 | Git |
| Debug Heavy | `debug_heavy` | 미커밋 | GitHub Actions artifact + manifest |
| Transient Attempt | `transient_attempt` | 미커밋 | GitHub Actions artifact + manifest |

`03-newsletters-editor-pr.yml`의 `peter-evans/create-pull-request` 스텝은 `add-paths` 허용목록으로 `public_source_of_truth`+`review_required_compact` artifact만 커밋합니다. `debug_heavy`+`transient_attempt` artifact는 `newsroom-final-debug-<run_id>` Actions artifact에 full set이 보존되고, `artifact-manifest.json`의 `retained_heavy_artifacts[]`에 path/size/sha256/retention_grade/retention_location이 기록됩니다.

허용목록은 `scripts/print-retention-commit-allowlist.js`가 `retentionCommitAllowlist({root, date, runContext})`를 호출해 생성합니다. PR diff에 `debug_heavy`/`transient_attempt` 파일이 보이지 않는 것은 의도된 동작입니다. heavy artifact를 확인하려면 Actions artifact `newsroom-final-debug-<run_id>`를 다운로드하거나 `artifact-manifest.json`의 `retained_heavy_artifacts`를 참조하세요.

이 정책은 발행 안전성·source binding·image lineage·review-publication state 판정을 약화하지 않습니다. validate:post-generation, resolve-reviewable-artifacts, pr-body 생성은 commit 스텝보다 먼저 in-run working tree에서 실행되므로 add-paths 허용목록의 영향을 받지 않습니다.

`01-newsroom-raw-candidates.yml`과 `02-newsroom-source-discovery.yml`은 candidate JSON이 리뷰 대상이므로 이 허용목록 제한을 적용하지 않습니다.

`content/collected-news/YYYY-MM-DD/`의 파이프라인 입력 파일(`candidates.json`, `manual-candidates.json`, `raw-candidate-manifest.json`, `merged-candidates.json`, `merged-candidate-manifest.json`, `collection-intent.json`, `seed-candidates.json`, `seed-evidence-pack.json`)은 workflow 01 → 02 → 03의 핸드오프 상태로서 `review_required_compact` 등급 파일입니다. `seed-candidates.json`과 `seed-evidence-pack.json`은 seed_used=true 런에서 workflow 02가 생성하며, `validateMergedManifestSchema`가 hash 일치를 strict-check하므로 반드시 커밋되어야 합니다. 순수 디버그 파일(`gemini-candidates.json`)은 `debug_heavy` 등급으로 `.gitignore` 처리됩니다.
