# Camera HAL SW 뉴스레터 Newsroom workflow

이 문서는 AOSP Camera / Camera Driver / SoC Platform 뉴스레터를, 사람의 수작업을 최소화하면서 주 1회(월요일) 만들어 내는 역할 기반(role-based) workflow를 설명합니다. 즉 후보 수집부터 LLM 작성, 검증, 검토용 PR 생성까지 각 단계를 어떤 역할이 맡는지 정리합니다.

## 품질 게이트

newsroom pipeline은 실행마다 `articles/content/newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 만듭니다. 어떤 호가 발행 준비(publish-ready) 상태가 되려면, deterministic score(결정론적 점수)가 `src/shared/config/newsletter-policy.json`의 `qualityGatePolicy.threshold` 이상이어야 합니다.

이 threshold를 낮춘 것은 LLM 비용과 false negative(잘못된 탈락)를 줄이기 위한 운영 튜닝일 뿐, 품질 검증을 건너뛰는 것이 아닙니다. 점수가 threshold를 넘더라도, source gap(출처 공백), fact-check `must_fix`, 발행에 치명적인 deduction(감점)이 있으면 publish-ready로 보지 않습니다.

draft가 gate를 통과하지 못하면 generator가 재시도합니다.

- 재시도 횟수는 `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼이며 기본값은 `1`입니다.
- 이미 article quality check를 통과한 section은 그대로 보존합니다.
- 재시도 한 번에서 repair(수리) 또는 replace(교체)할 section 수는 `NEWSROOM_MAX_SECTION_REPAIRS=1`로 제한합니다.
- `retry-history.json`과 `retry-history.md`에 locked article, failed section, repair policy, skipped repair section을 남깁니다.
- Gemini API의 retry 최대 대기 시간 기본값은 `GEMINI_RETRY_MAX_DELAY_MS=300000`입니다(300000ms = 5분).

quality gate는 AOSP Camera / Camera Driver / SoC Platform relevance, evidence specificity, engineering depth, actionability, source integrity, article composition을 점검합니다.

판정 결과는 두 종류로 나뉩니다.

- hard fail(즉시 차단): source 없음, source gap, duplicate main article, invalid/broken source URL, underfilled article count, 확장 범위(expanded scope)와의 연결이 없는 generic AI/main article이 여기에 해당합니다. 이 경우 점수가 충분해도 Hard blocker result: NEEDS_FIX 또는 `publish_ready=false`를 강제합니다.
- soft deduction(감점): actionability 부족, 약한 설명, local fallback image처럼 단독으로 발행을 막기보다는 개선 권고에 가까운 항목입니다. 점수와 report에 남깁니다. 단, 이렇게 감점된 뒤에도 Quality score가 정해진 threshold 미만이면 통과하지 못합니다.

`quality-report.json`의 `article_results`는 기사별로 `PASS` / `DEMOTE` / `FAIL`, hard fail reason, soft deduction, repair action을 표시합니다. 재시도 후에도 점수가 낮거나 blocker가 남으면, weekly workflow는 review PR을 만들고 `needs-fix`로 표시할 수 있습니다. 여기서 중요한 점은, 검토용 PR이 만들어졌다는 사실과 발행 가능 품질을 통과했다는 사실은 별개라는 것입니다. `publish-ready` 라벨과 PR body의 `final_publish_ready=true`가 둘 다 있을 때만 발행 가능한 이슈로 취급합니다.

workflow의 `create-newsroom-pr` job은 후보 수집, LLM 생성, 검증, review PR 생성을 담당합니다. 검토 가능한 `articles/content/newsroom/YYYY-MM-DD/` artifact와 PR body가 만들어지면, fact-check나 quality가 실패하더라도 이 job 자체는 성공할 수 있습니다. 반대로 치명적 생성 오류(fatal generation error)로 review artifact가 아예 없으면 job은 실패합니다.

publish/deploy gate는 다음 조건이 모두 충족될 때만 통과합니다: `final_publish_ready=true`, fact-check `PASS`, quality `PASS`, policy minimum article count(정책상 최소 기사 수), 발행 가능한 `composition_mode`, source integrity, stale claim 없음.

PR label은 상태를 구분해서 보여 줍니다.

- `needs-fix`: 편집장의 수리 또는 검토가 필요한 PR.
- `fallback-composition`: direct camera/driver 후보가 부족해 SoC/platform/tooling fallback을 썼지만 아직 `publish-ready`는 아닌 PR에만 붙는 진단(diagnostics) label.
- `thin-week`: 자동 발행 대상이 아닌, 신호가 얇은(thin) 주간 검토 경로.
- `publish-ready`: 최종 발행 gate를 통과한 PR에만 사용.

summary cache는 restore(복원)와 save(저장)를 분리하고, save를 `if: always()`로 실행합니다. 이렇게 하면 실패한 run 이후 재시도 비용이 줄어듭니다.

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

기본 provider는 `gemini`입니다. 예약 자동 실행(scheduled run)은 `runtime-config.js`의 `DEFAULT_RUNTIME_CONFIG`에 정의된 provider/model/fallback model을 그대로 씁니다. 즉 scheduled run은 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` repo variable을 읽지 않습니다.

`llm_provider`, `llm_model`, `llm_fallback_models` input이 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` runtime env로 전달되는 경우는 `workflow_dispatch` 수동 실행뿐입니다. stage별 selector는 다음과 같습니다.

- Stage 1 source collection: LLM을 호출하지 않으므로 `llm_provider` selector가 없습니다.
- Stage 2 source discovery: `llm_provider`와 `llm_model`을 제공합니다.
- Stage 3 final generation: `llm_provider`, `llm_model`, `llm_fallback_models`를 모두 제공합니다.

이슈 초안에 나오는 `llm_api_provider`는 예시 이름이며, 현재 공개 workflow 계약은 `llm_provider`입니다.

provider별 자격 요건은 다음과 같습니다.

- `LLM_PROVIDER=gemini`: `GEMINI_API_KEY`만 있으면 됩니다.
- `LLM_PROVIDER=openapi`: 예약된(reserved) provider enum입니다. 전용 구현 PR이 나오기 전까지는 `provider_not_implemented`로 fail-fast합니다.

token은 GitHub Secrets에서만 읽고, log, artifact, PR body 어디에도 출력하지 않습니다.

## Role 1. Candidate Collector

- `src/shared/data/news-sources.json`의 enabled source를 읽습니다.
- JSON registry가 없을 때만 `docs/NEWS_SOURCES.md`의 `- Name: URL` 형식을 fallback으로 사용합니다.
- RSS 또는 HTML page에서 후보를 수집하고 `articles/content/collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
- media/community/candidate-only source는 최종 기사로 올리기 전에 공식 출처 교차 확인이 필요합니다.

## Role 2. LLM Reporter

LLM을 호출하기 전에, `src/generator/select/newsroom-selection.js`가 deterministic(결정론적)으로 후보를 정리합니다. 순서는 다음과 같습니다.

1. `articles/content/collected-news/YYYY-MM-DD/candidates.json`을 읽고 source-gap/watch/reference 후보를 제거합니다.
2. URL과 거의 같은 제목(near-duplicate title)을 dedupe합니다.
3. 자격을 갖춘(eligible) 후보를 점수화한 뒤 `articles/content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`을 작성합니다.

LLM prompt에는 후보 전체가 아니라 `articles/content/newsroom/YYYY-MM-DD/article-capsules.json`의 compact capsule(압축 캡슐)만 전달합니다.

shortlist는 기본 8-12개 수준이고 hard cap(상한)은 12개입니다. 핵심은 **LLM이 아니라 local selector(결정론적 코드)가 main article 후보를 정한다**는 점입니다. selector는 LLM reporter/editor prompt가 돌기 전에 deterministic scoring으로 후보를 줄이고, `src/shared/config/newsletter-policy.json`이 정한 final main article input을 고릅니다.

scoring은 다음을 함께 봅니다: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, `soc_platform_signal`, `cpp_ai_tooling_fallback`, `generic_tech_watchlist` bucket 분류와 더불어 구체 evidence, 최신성, 실무 actionability, source reliability.

다음은 main article에서 제외되거나 크게 감점됩니다: source gap, 날짜 근거 없음, dated evidence 없는 watch page, 구체 API/component 근거 없음.

추가 규칙:

- SoC/CPU/GPU/NPU/ISP/power/thermal/performance 기사는 정책상 supporting main bucket일 때만 main article 보강에 쓸 수 있습니다.
- `generic_tech_watchlist`는 main article로 올리지 않고 briefing/watchlist로 둡니다.
- 자격을 갖춘 비중복(non-duplicate) final input이 정책상 article count range를 못 채우면, 생성은 일찍 실패하고 `articles/content/newsroom/YYYY-MM-DD/recovery-prompt.md`를 남깁니다.

- 수집 후보 중 AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, Android platform camera-adjacent, SoC platform, C++, LLVM/Clang/GCC, AI workflow와 관련된 항목을 점수화합니다.
- source name, source URL, candidateOnly, requiresCrossCheck, imageCandidates를 유지합니다.
- 출력: `articles/content/newsroom/YYYY-MM-DD/reporter-candidates.json`.
- `article-capsules.json`은 title, url, source, published_date, topic_type, component, what_changed, why_hal_engineer_cares, evidence, risk, score를 중심으로 한 compact prompt 입력입니다. stage별로 전달하는 capsule이 다릅니다: reporter stage에는 상위 shortlist capsule 8-12개, editor/fact-check/repair/completion stage에는 최종 선택된(final-selected) 또는 필요한 completion capsule만 전달합니다.

LLM reporter는 수집된 후보 전체가 아니라 deterministic shortlist만 받습니다. 요약, tag, evidence field를 보강할 수는 있지만, local이 정한 `selected=true` final article decision은 반드시 그대로 유지해야 합니다.

## Role 3. LLM Editor

- 한국어 newsletter 초안을 작성합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources를 포함합니다.
- 이미지 URL을 새로 만들지 않고 collector가 제공한 `imageCandidates`에서만 선택합니다.
- 출력: `articles/content/newsroom/YYYY-MM-DD/editor-draft.json`, `articles/content/newsroom/YYYY-MM-DD/editor-draft.md`.

editor는 deterministic final article input과 locked/retry context만 받습니다. retry가 필요할 때의 처리 방식은 다음과 같습니다.

- 통과한 section은 lock(고정)하고, repair prompt는 실패한 section만 다시 생성하도록 요청합니다.
- source gap이나 자격 없는 source(ineligible source)는 다시 쓰지(rewrite) 않고 demote(강등) 또는 replace(교체) 대상으로 처리합니다.
- weak HAL relevance와 duplicate는 replace 대상, missing actionability와 required/evidence 부족은 같은 출처 안에서 고치는 same-source section repair 대상으로 나눕니다.
- retry artifact에는 `locked_sections`, `failed_sections`, `regenerated_sections`, `repair_plan`, `skipped_repair_plan`, 그리고 거부된 retry output을 기록합니다.

## Role 4. LLM Fact Checker

- 출처 누락, 과장 표현, 사실과 해석 혼동, Action Item 누락, Camera HAL 관점 약화를 확인합니다.
- `NEEDS_FIX`와 `must_fix`가 있으면 workflow의 최종 gate가 실패해야 합니다.
- 출력: `articles/content/newsroom/YYYY-MM-DD/fact-check-report.json`, `articles/content/newsroom/YYYY-MM-DD/fact-check-report.md`.

## Role 5. Artifact Writer

- `articles/newsletters/YYYY-MM-DD/newsletter.md`를 생성합니다.
- `articles/newsletters/YYYY-MM-DD/index.html`을 생성합니다.
- `articles/data/newsletters.json`을 갱신합니다.
- `articles/content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`, `00-review-guide.md`, `release-qa-report.md`, `artifact-manifest.json`을 생성합니다.
- `00-review-guide.md`는 아래 순서로 review artifact를 묶습니다.
  1. 편집장 브리프
  2. Seed 근거 요약
  3. 최종 기사 / 공개 출력
  4. 사실성 / 품질 / HAL 게이트
  5. 후보 선정 진단
  6. 필요 시 확인
  7. 디버그 근거
  8. 미분류 산출물
- `artifact-manifest.json`은 `schema_version=3`입니다. legacy consumer 호환을 위해 `files[].path`, `files[].size`, `files[].sha256`에는 실제로 존재하는 파일만 넣습니다. review 순서, 빠진 예상 artifact(missing expected artifact), `review_blocking`, `review_attention_required` 같은 안내성(advisory) metadata는 `files[]`가 아니라 `review_artifacts[]`에 둡니다.
- `review_blocking`과 `review_attention_required`는 리뷰어 안내용 metadata입니다. 이 값은 deterministic publish gate, quality gate, source gate, public artifact readiness 판단을 변경하지 않습니다.
- `artifact-manifest.json` 파일은 hash churn 방지를 위해 manifest `files[]` hashing 대상에서 제외합니다. `00-review-guide.md`와 `release-qa-report.md`는 존재하면 `files[]`에 포함될 수 있지만 derived artifact라서 `missingRequired` 판단에는 사용하지 않습니다.
- Manifest surface는 두 가지입니다.
  - `articles/content/newsroom/YYYY-MM-DD/artifact-manifest.json`: date-scoped review package manifest입니다. `files[]`와 `review_artifacts[]`는 review inventory 기준으로 생성합니다.
  - snapshot root `artifact-manifest.json`: workflow snapshot manifest입니다. `.tmp/**`, cache, debug file 같은 snapshot file을 추가로 포함할 수 있으며 같은 `schema_version=3`와 review metadata field를 사용합니다.

### 결정론적 이미지 바인딩 repair

editor는 이미지의 권리나 관련성이 불확실하면 `selectedImage`를 비워 두고, renderer는 local fallback visual(로컬 대체 이미지)을 씁니다. 생성이 끝나면 workflow가 `npm run newsroom:repair-images -- --date <date>`를 실행합니다. 이 명령은 editor-draft의 유효한 `imageCandidates` 중 audit 규칙을 통과한 후보를 deterministic하게 binding하고 daily Markdown/HTML을 다시 만듭니다. local fallback visual은 유효한 candidate가 정말로 하나도 없는 기사에만 남습니다.

repair는 같은 ISO week의 weekly 산출물도 함께 동기화합니다. 동작은 다음과 같습니다.

- weekly upsert는 identity가 같은 기사를 exact duplicate로 거부합니다. 따라서 단순 재실행만으로는 수리된 이미지가 weekly에 반영되지 않습니다.
- 그래서 repair는, identity가 일치하는 weekly section의 image field를 daily editor-draft 상태로 직접 복사합니다. 그런 다음 `articles/newsletters/<weeklyKey>/{index.html,newsletter.md,issue.json}`을 다시 만들고 `articles/data/newsletters-weekly.json` entry의 `article_images`를 갱신합니다.
- weekly artifact가 없으면 아무 일도 하지 않으며(no-op), 여러 번 실행해도 결과가 같습니다(idempotent).
- 수리 대상(repairable) 기사가 0인 날짜라도 `--date`로 실행하면 weekly 동기화는 항상 수행합니다. 덕분에 오래된(stale) weekly를 재실행으로 복구할 수 있습니다. (반면 `--all-repairable`은 repairable이 0인 날짜는 방문하지 않습니다.)
- `article_images`에 https 이미지가 하나도 없으면, site-root 기준 상대 경로(fallback) 1개를 넣어 둡니다. 이렇게 해서 홈페이지 Latest card가 항상 이미지를 갖도록 보장합니다.

## Role 6. Validator

`npm run validate`는 저장소 전체(repository-wide)의 safety gate입니다. Stage 3 final workflow에서 생성 직후에 도는 post-generation gate는 `npm run validate:post-generation`을 씁니다. 이 chain은 `validate:quality`를 다시 돌리지 않고, 대신 final Markdown/HTML public artifact를 `validate:llm-publication-quality`의 LLM API judge로 확인합니다.

주요 validate 단계는 다음과 같습니다.

- `npm run validate:config`: `src/shared/data/news-sources.json`의 구조, 필수 field, source ID, URL, category-to-section mapping, source entry 안의 중복 `section` 금지, canonical JSON formatting을 확인합니다.
- `npm run validate:site`: metadata, 파일 존재, TODO leak, 중복 날짜(duplicate date), required sections, source/reference, HTML class hook, anchor balance를 확인합니다.
  - 검증 대상(current/changed/generated)에 해당하는 artifact에 fact-check `must_fix`가 남아 있으면 hard fail입니다.
  - 같은 `must_fix`가 엄격 대상 밖의 과거(historical) artifact에서만 발견되면, 소급해서 hard fail 처리하지 않고 warning-only로만 기록합니다. 단 그래도 publish-ready로 보지는 않습니다.
- `npm run validate:images`: article image URL과 local fallback file의 존재를 확인합니다.
  - 외부 이미지가 404, timeout, invalid content-type 등으로 실패하더라도, local fallback이 있고 최종 `selectedImage`가 fallback 경로로 정리돼 있으면 warning only입니다.
  - 원본 URL은 `originalImage` 또는 `resolvedImage.originalUrl`에 보존합니다. fallback 파일이 없거나 깨진 외부 URL이 publish 산출물에 그대로 남은 경우에만 fail합니다.
- `npm run validate:quality`: deterministic quality report를 다시 계산해 다음을 차단합니다: 정책상 article count range 위반, Primary Camera Stack 필수 조건 미달, forbidden main bucket 포함, main section 간 source URL 중복, source 누락, Camera HAL perspective 누락, action item 부족, source-gap에 매핑된 candidate, dated evidence 없는 selected candidate. AI/C++ 기사는 정책상 supporting main bucket일 때만 보강 기사로 허용합니다.
- `npm run validate:post-generation`: Stage 3 final workflow에서 public newsletter files가 준비된 뒤에 도는 post-generation gate입니다. `validate:quality`는 포함하지 않고, `validate:llm-publication-quality`가 LLM API로 실제 렌더링된 public artifact를 검사합니다.
- `npm run validate:localization`: 유지 대상 문서와 표시용 JSON 값이 한국어 규칙을 지키는지 확인합니다.

## 편집자 승인 발행 정책

발행 상태를 나타내는 값들의 의미는 다음과 같습니다.

- `publish-ready`: AI가 자동으로 발행해도 되는 상태입니다. `has_ai_publish_ready=true`일 때만 씁니다.
- `review_publication_ready=true`: `public_newsletter_ready=true`인 검증된 public issue가 있지만 `final_publish_ready=false`라서, 편집장이 검토한 뒤 merge해야만 공개할 수 있다는 뜻입니다. 이 값은 파일이 존재하는지(raw file existence)가 아니라 `resolve-reviewable-artifacts`의 public newsletter readiness 결과에서만 파생합니다.
- `diagnostics_only=true`: `review_pr_ready=true && public_newsletter_ready=false`인 진단 전용 PR입니다. merge해도 Newsletter 홈페이지에는 표시되지 않으며, public files가 왜 없는지를 PR body에 남겨야 합니다.
- `homepage_visible_after_merge=true`: `articles/data/newsletters.json`의 date/html/md entry가 실제 `articles/newsletters/YYYY-MM-DD/index.html` 및 `newsletter.md`와 일치하는 public issue에만 설정합니다. 최종 판단은 `resolve-reviewable-artifacts`가 public files와 index entry를 다시 검증한 결과를 따릅니다.
- `needs-fix`: 편집장 검토 또는 수정이 필요한 상태입니다. label 부착 규칙은 다음과 같습니다.
  - 자동 발행 기준을 통과하지 못한 editor review PR에는 넓은 의미의 신호인 `review-only`를 붙입니다.
  - 그중 public files가 준비된 review publication PR에는 `review-only-publication`을, public files가 없는 진단 PR에는 `diagnostics-only`를 함께 붙입니다.
  - 이 두 세부 label은 동시에 붙으면 안 됩니다.
- `final_publish_ready=false`: 자동 발행 기준을 못 채웠다는 뜻입니다. 다만 이 값 하나만으로 `review_publication_ready=true`인 PR의 공개 가능성을 막지는 않습니다.
- `Site 01 - Validate Site and Images` (`.github/workflows/site-01-validate.yml`): 구조 검증(structural validation)은 blocking으로 유지하고, quality/fact-check 문제는 발행을 막지 않는(non-blocking) annotation으로 보고합니다.

## URL Summary Cache

Reporter가 만든 summary record는 두 위치에 cache됩니다: `cache/news-summary/by-url/{sha256(normalized_url)}.json`과 `cache/news-summary/by-content/{content_hash}.json`. 이 cache file은 의도적으로 Git에 추적하지 않으며(untracked), CI에서는 `actions/cache`로 복원합니다.

cache hit 판정 순서는 다음과 같습니다.

- 먼저 같은 normalized URL이 있는지 확인합니다.
- URL이 다르더라도 `content_hash`가 같으면 by-content record를 재사용합니다.

`content_hash`는 title, summary, version/release, API/component, behavior evidence를 중심으로 계산하고 URL, published date, source metadata는 제외합니다. 따라서 published date나 source label만 바뀐 경우에는 summary를 다시 만들지 않고, freshness와 metadata만 현재 candidate를 기준으로 다시 판단합니다. 반대로 article evidence가 바뀌면 `content-hash-mismatch`로 보고 miss 처리합니다.

generator는 `articles/content/newsroom/YYYY-MM-DD/summary-cache-report.json`, `summary-cache-report.md`, `.tmp/summary-cache-report.json`에 cache hit/miss와 miss reason을 남깁니다. 이 report는 비용 분석용 debug artifact이며, generated cache file 자체는 `cache/news-summary/` 아래에 남아 PR diff에 포함되지 않습니다.

## Cost Report

비용 artifact는 provider-neutral한 LLM 비용 리포트입니다. Gemini provider에서는 Gemini usage metadata와 local pricing table로 estimated cost를 계산하고, internal provider는 pricing table이 없으면 `estimated_cost_usd=null`과 pricing warning을 남깁니다.

Gemini 호출이 성공적으로 응답을 반환하면 generator는 response usage metadata를 stage/model/attempt 단위로 기록합니다. 비용 리포트는 `.tmp/newsroom-cost-report.json`과 `articles/content/newsroom/YYYY-MM-DD/cost-report.md`에 남으며, prompt tokens, output tokens, thinking tokens, cached tokens, total tokens, estimated cost를 포함합니다.

Gemini request에는 stage별 thinking budget(추론 예산)과 temperature를 적용합니다. thinking budget 기본값은 stage별로 reporter `512`, editor/completion `1024`, repair `1024`, fact-check `2048`, judge `1024`, scoring `0`입니다. editor/fact-check/judge에서 thinking budget을 켜면 하루 약 12K thinking 토큰이 추가되는데, Gemini 2.5 가격 기준으로 수 센트 수준입니다. 이는 fact-check 정확도와 publication-ready 판정의 신뢰도가 올라가는 것으로 정당화됩니다. 비용이 예상을 넘으면 `GEMINI_THINKING_BUDGET_JUDGE=0` 같은 env override로 코드 변경 없이 바로 조정할 수 있습니다.

temperature 기본값도 stage별로 다릅니다: reporter `0.30`, editor `0.40`, fact-check `0.20`, repair `0.25`, judge `0.20`, source discovery `0.45`, 기타(default) `0.35`. `GEMINI_TEMPERATURE_*` 환경변수로 각 stage를 따로 조정할 수 있습니다(범위 0 이상 2 이하).

thinking budget과 temperature는 `GEMINI_THINKING_BUDGET_*`, `GEMINI_TEMPERATURE_*` 환경변수로 조정합니다. cost report의 call row에는 실제 response의 `thinking_tokens`와 함께 `thinking_budget_requested`, `thinking_budget_applied`가 남습니다.

thinking 설정은 호출하는 모델의 패밀리(family)에 맞춰 다르게 전달됩니다.

- Gemini 3.x 단계(editor): `thinkingBudget` 대신 `thinkingLevel`을 씁니다. budget 값을 `<=512`이면 LOW, `<=2048`이면 MEDIUM, `>2048`이면 HIGH로 번역합니다.
- `gemini-2.5-flash-lite`: budget을 유효 범위(512~24576)로 클램프(clamp)하고, budget이 0이면 thinkingConfig를 아예 생략합니다.
- `gemini-2.5/2.0-flash`: `thinkingBudget`을 그대로 사용합니다(0이면 off).

`NEWSROOM_WARN_COST_USD`와 `NEWSROOM_MAX_COST_USD`는 비용 관찰용 기준값입니다. 현재 운영 기준으로 두 값을 넘어도 workflow를 실패시키지 않고 warning만 출력합니다. 이 리포트는 비용 발생 위치를 파악하기 위한 artifact이며, 품질 점수나 publish readiness 판단을 변경하지 않습니다.

Stage별 기본 모델은 다음과 같습니다.

- reporter/fact-checker: `gemini-2.5-flash`
- editor: `gemini-3.5-flash`
- repair: `gemini-3.5-flash` (editor와 같은 schema를 재생성하므로 editor 모델에 맞춤)
- public article judge / source discovery: `gemini-2.5-flash-lite`
- 기본 fallback: `gemini-2.5-flash` → `gemini-2.5-flash-lite` 순서 (flash 우선, flash-lite는 최후 안전망)

source discovery(`newsletters-02-source-discovery-pr.yml`의 Gemini source/linked evidence 발견)는 후보를 새로 쓰지 않고 선별/판정만 하는 단계라서, 비용이 가장 낮은 `gemini-2.5-flash-lite`로 고정합니다. Gemini Pro 계열 모델명은 모든 public model override 경로에서 validation error로 차단합니다. 비용 리포트는 call 단위 `pro_model` audit marker를 유지하지만, 정상 run에서는 항상 `false`여야 하고 report 단위 정책은 `Pro policy: disabled`로 고정됩니다.

Stage별 model routing은 아래 우선순위를 따릅니다.

1. `LLM_MODEL` 또는 `GEMINI_MODEL`이 지정되면 모든 stage의 primary model을 한꺼번에 override합니다.
2. 그렇지 않으면 `NEWSROOM_REPORTER_MODEL`, `NEWSROOM_EDITOR_MODEL`, `NEWSROOM_FACTCHECK_MODEL`, `NEWSROOM_REPAIR_MODEL`, `NEWSROOM_JUDGE_MODEL`, `NEWSROOM_SOURCEDISCOVERY_MODEL`이 각자 해당 stage만 override합니다.
3. 비어 있는 stage는 code default를 씁니다.

`LLM_FALLBACK_MODELS` 또는 `GEMINI_FALLBACK_MODELS`는 모든 stage primary 뒤에 붙는 fallback chain입니다.

| 설정 | reporter | editor | factcheck | repair | judge | sourceDiscovery |
| --- | --- | --- | --- | --- | --- | --- |
| env 없음 | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` |
| `NEWSROOM_EDITOR_MODEL=gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-2.5-flash` | `gemini-3.5-flash` | `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` |
| `LLM_FALLBACK_MODELS=gemini-2.5-flash-lite` | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback | primary 실패 시 fallback |

fact-checker는 새 글을 쓰는 stage가 아닙니다. source gap, unsupported claim, dated evidence 누락, forbidden bucket, 과장된 HAL impact 같은 구조화된 위반(structured violation)을 탐지하는 stage입니다. source binding과 hard blocker의 최종 방어선은 deterministic validator이지만, 품질 판정 자체는 fact-checker(LLM)에 맡깁니다. 그래서 fact-checker 기본 모델은 `gemini-2.5-flash`로 두면서 thinking(추론)을 켜 판정 신뢰성을 높입니다.

모델 선택의 나머지 이유는 다음과 같습니다.

- 문장 작성이 가장 복잡한 editor에는 `gemini-3.5-flash`(thinkingLevel MEDIUM)를 씁니다.
- 발행 구제(repair)는 editor와 같은 section 재생성 schema를 다루므로 같은 `gemini-3.5-flash`로 맞춥니다.
- `gemini-2.5-flash`는 이 복잡한 nested section schema를 serving 단계에서 거부합니다(HTTP 400, "schema produces a constraint that has too many states for serving"). 그래서 repair에는 쓸 수 없습니다.
- repair의 thinking은 model-family routing에 따라, 3.x에서는 thinkingBudget 1024가 thinkingLevel MEDIUM으로 번역됩니다.

## Final Cost Reduction Operating Model

현재 운영 모델은 비용을 낮추기 위해 품질 기준을 낮추지 않습니다. 비용 절감은 네 가지 장치로 이루어집니다.

- deterministic scoring이 LLM 호출 전에 Camera HAL / Android Camera 후보를 먼저 줄입니다.
- `article-capsules.json`이 full context 대신 compact capsule만 Gemini에 전달합니다.
- quality retry는 전체 뉴스레터 재생성이 아니라 실패 section repair 또는 replace로 제한합니다.
- scheduled run과 manual run은 Flash/Flash-Lite 및 stage별 code default를 기본으로 사용합니다. Stage 3 수동 실행에서 `llm_model`을 비워 두면 code default stage model이 사용되며, Gemini Pro 계열 모델명은 runtime validation에서 차단됩니다.

운영자가 비용 원인을 확인할 때는 아래 순서로 artifact를 봅니다.

| 확인 대상 | 위치 | 판단 기준 |
| --- | --- | --- |
| cost report(비용 리포트) | `.tmp/newsroom-cost-report.json`, `articles/content/newsroom/YYYY-MM-DD/cost-report.md` | stage/model/attempt별 estimated cost, `thinking_tokens`, `cached_tokens`, `pro_model=false` 유지 여부를 확인합니다. |
| selection report(기사 선정 리포트) | `articles/content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`, `article-capsules.json`, PR 본문 selection diagnostics | 후보가 8-12개 수준으로 제한됐는지, generic AI/C++가 HAL 후보를 밀어내지 않았는지 확인합니다. |
| quality report(품질 리포트) | `articles/content/newsroom/YYYY-MM-DD/quality-report.json`, `quality-report.md` | hard fail과 soft deduction을 분리해 보고, `article_results`의 `PASS` / `DEMOTE` / `FAIL`과 repair action을 확인합니다. |
| generation status artifact(생성 상태 결과 파일) | `.tmp/newsletter-generation-status.json` | `publish_ready`, `quality_status`, `final_selected_article_count_for_gate`, failure reason을 확인합니다. |
| summary cache report(요약 cache 리포트) | `.tmp/summary-cache-report.json`, `articles/content/newsroom/YYYY-MM-DD/summary-cache-report.md` | cache hit/miss와 miss reason을 보고 반복 요약 비용을 확인합니다. |

## Safe Scheduled Defaults

현재 scheduled run의 provider/model 기본값은 GitHub Variables가 아니라 `DEFAULT_RUNTIME_CONFIG`에서 정해집니다. 기본 provider는 `LLM_PROVIDER=gemini`이고, stage별 code default는 reporter/fact-checker `gemini-2.5-flash`, editor/repair `gemini-3.5-flash`, public article judge·source discovery `gemini-2.5-flash-lite`, fallback `gemini-2.5-flash` → `gemini-2.5-flash-lite`입니다. Workflow YAML은 Pro 계열 fallback 모델을 자동으로 추가하지 않으며, runtime config는 Gemini Pro 계열 모델명을 모든 public model override 경로에서 차단합니다.

scheduled run(예약 자동 실행)의 안전 기본값은 아래와 같습니다. provider/model은 code default를 쓰고, 나머지는 workflow와 runtime config의 기본값을 그대로 씁니다.

```text
LOOKBACK_DAYS=35  # 워크플로 명시값. runtime 기본값도 35 (#574, 주 1회 전환)이며 scheduled run은 catch-up 풀(#483)을 위해 35일 윈도우를 사용
LLM_PROVIDER=gemini
LLM_MODEL unset
GEMINI_MODEL unset
NEWSROOM_REPORTER_MODEL=gemini-2.5-flash
NEWSROOM_EDITOR_MODEL=gemini-3.5-flash
NEWSROOM_FACTCHECK_MODEL=gemini-2.5-flash
NEWSROOM_REPAIR_MODEL=gemini-3.5-flash
NEWSROOM_JUDGE_MODEL=gemini-2.5-flash-lite
NEWSROOM_SOURCEDISCOVERY_MODEL=gemini-2.5-flash-lite
LLM_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
GEMINI_THINKING_BUDGET_REPORTER=512
GEMINI_THINKING_BUDGET_EDITOR=1024
GEMINI_THINKING_BUDGET_REPAIR=1024
GEMINI_THINKING_BUDGET_FACTCHECK=2048
GEMINI_THINKING_BUDGET_JUDGE=1024
GEMINI_THINKING_BUDGET_SCORING=0
GEMINI_TEMPERATURE_DEFAULT=0.35
GEMINI_TEMPERATURE_SOURCE_DISCOVERY=0.45
GEMINI_TEMPERATURE_REPORTER=0.30
GEMINI_TEMPERATURE_EDITOR=0.40
GEMINI_TEMPERATURE_FACTCHECK=0.20
GEMINI_TEMPERATURE_REPAIR=0.25
GEMINI_TEMPERATURE_JUDGE=0.20
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.2
NEWSROOM_MAX_COST_USD=0.35
```

manual high-quality run(수동 고품질 실행)의 기본 입력은 `llm_model=""`입니다. 이때 workflow는 `LLM_MODEL`을 전달하지 않으므로 code default stage model을 씁니다. 수동 실행에서도 `llm_model`, `llm_fallback_models`, stage별 model variable에 Gemini Pro 계열 모델명을 넣으면 `doctor:config` 단계에서 실패합니다.

## Seed Evidence Workflow Priority

Seed evidence workflow migration은 newsroom pipeline 안에서 P0급(P0-equivalent) 작업으로 취급합니다. 우선순위 관계는 다음과 같습니다.

- `seed evidence workflow migration > legacy compatibility cleanup`: seed evidence migration이 레거시 정리보다 우선합니다.
- `source/evidence/security/publish safety > seed evidence workflow migration`: 그러나 출처/근거/보안/발행 안전성은 seed evidence migration보다도 항상 우선하는 절대 기준입니다.

Legacy-pattern test failure(과거 패턴 때문에 나는 테스트 실패)는 다음 조건을 **모두** 만족할 때만 blocker에서 분리할 수 있습니다.

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

PR마다 failure classification(실패 분류)을 다음 중 하나로 기록합니다: `A. New workflow blocker`, `B. Source / evidence / security blocker`, `C. Legacy-pattern compatibility failure`, `D. Snapshot/report formatting drift`, `E. Follow-up cleanup candidate`. 여기서 `A/B`는 항상 blocker이고, `C/D/E`만 위 조건을 충족할 때 후속 처리로 분리할 수 있습니다.

## Recovery Artifacts

`articles/content/newsroom/YYYY-MM-DD/recovery-prompt.md`는 deterministic selection, LLM JSON parsing, fact-check, quality, validation이 retry 후에도 끝내 실패할 때 작성됩니다. 이 파일에는 shortlist, selected input, failed section, quality deduction, fact-check finding, 그리고 그대로 다시 돌릴 수 있는 rerun command가 들어 있습니다.

이 파일은 **`debug_heavy`** 등급이라 Git에 커밋하지 않습니다. 실패한 run의 recovery-prompt를 보려면 다음 중 하나를 쓰세요.

- GitHub Actions artifact `newsroom-final-debug-<run_id>`에서 다운로드합니다.
- 해당 날짜의 `artifact-manifest.json` → `retained_heavy_artifacts`에서 path/sha256으로 찾습니다.

## GitHub Actions 운영

### 주간 RAW 후보 수집

`Newsletters 01 - Source Collection PR` (`.github/workflows/newsletters-01-source-collect-pr.yml`) workflow 자체에는 schedule이 없습니다. `workflow_dispatch`(수동)와 `workflow_call`(다른 workflow가 호출)만 있습니다. 예약 경로에서는 아래 00 orchestrator가 주 1회 월요일 09:00 KST에 이 workflow를 호출합니다.

```text
KST Mon 09:00 = UTC Mon 00:00
branch: newsroom-raw/YYYY-MM-DD
```

workflow는 `main`에 직접 push하지 않습니다. 수동 실행 시에는 RAW candidate 검토용 PR을 만듭니다.

### 3-stage RAW workflow

현재 schedule entrypoint는 `Newsletters 00 - Weekly Orchestrator` (`.github/workflows/newsletters-00-orchestrator.yml`)입니다. cron(`0 0 * * 1`)을 가진 workflow는 00 하나뿐이고, 00이 collect(01) → discover(02) → generate(03)를 순서대로 호출합니다. 따라서 final newsletter generation도 예약 경로에서 자동 실행됩니다. 각 단계를 따로 돌리려면 `workflow_dispatch`로 수동 실행합니다.

- `Newsletters 01 - Source Collection PR` (`.github/workflows/newsletters-01-source-collect-pr.yml`): `collect`만 실행해 `manual-candidates.json`, 호환용 `candidates.json`, `raw-candidate-manifest.json`을 만듭니다. Gemini/API secret은 쓰지 않습니다.
- `Newsletters 02 - Source Discovery PR` (`.github/workflows/newsletters-02-source-discovery-pr.yml`): source discovery 전용 workflow입니다. 따라서 `NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=true`로 고정 실행하고, 별도 toggle input은 없습니다. 동작 순서는 LLM credential preflight → Gemini proposal을 `gemini-source-proposals.json`에 저장 → deterministic fetch/normalize/schema validation을 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영, 입니다. (`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=false`로 자격 증명 없이 도는 disabled pass-through는 code 수준에서는 여전히 지원하지만, 이 workflow에서는 노출하지 않습니다.) workflow 02는 아래 파일들을 `merged-candidate-manifest.json`의 strict-check 필드에 기록합니다. `validateMergedManifestSchema`가 `llm_used=true` 또는 `merge_mode='gemini_source_discovery'` 조건에서 이 파일들의 존재를 필수로 검증하므로, 모두 Git에 커밋(`review_required_compact` 등급)해야 합니다:
  - `gemini-usage-report.json` (`usage_report` 필드)
  - `gemini-source-proposals.json` (Gemini 제안 원문)
  - `gemini-source-proposal-validation-report.json` (`proposal_validation_report` 필드)
  - `source-clusters.json` (`source_clusters` 필드)
  - `evidence-validation-report.json` (`evidence_validation_report` 필드)
  - `extracted-source-facts.json` (소스 사실 추출 결과)
- `Newsletters 03 - Editor PR` (`.github/workflows/newsletters-03-editor-pr.yml`): `NEWSROOM_CANDIDATE_INPUT_MODE=artifact`로 approved candidate artifact만 읽고 `collect`를 재실행하지 않습니다.

Stage 2/3 manual run의 `newsletter_date`는 optional입니다. 비워두면 workflow 실행 시점의 KST 날짜(`YYYY-MM-DD`)로 resolve되며, resolved date는 workflow log에 출력됩니다.

### Secret

Repository Settings > Secrets and variables > Actions:

```text
GEMINI_API_KEY
```

`NEWSROOM_PR_TOKEN` (선택, 권장): newsletter PR(`newsletters-03-editor-pr.yml`)의 검증 workflow(`site-01-validate`)가 자동 실행되게 하려면 필요합니다. GitHub은 기본 `GITHUB_TOKEN`으로 만든 PR에는 `on: pull_request` workflow를 실행하지 않으므로(재귀 방지), 이 secret이 없으면 검증이 `action_required` 상태로 멈추고 사람이 Actions 탭에서 "Approve and run"을 눌러야 검증이 실행됩니다. fine-grained PAT(이 repository 대상, Contents read/write + Pull requests read/write) 또는 GitHub App token을 권장합니다. secret이 없으면 workflow는 기존 `GITHUB_TOKEN` 동작으로 폴백하므로 파이프라인이 깨지지는 않습니다. 이 토큰은 PR 생성에만 쓰며 자동 merge나 `main` 직접 push에는 쓰지 않습니다(PR 기반 발행 모델 유지).

선택 변수:

```text
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
# thinking budget 기본값은 코드(runtime-config.js)가 정본이며, 비워두면 코드 기본값을 사용합니다.
# 아래는 repo variable로 override할 때의 예시이며, 값은 코드 기본값과 동일합니다.
GEMINI_THINKING_BUDGET_REPORTER=512
GEMINI_THINKING_BUDGET_EDITOR=1024
GEMINI_THINKING_BUDGET_REPAIR=1024
GEMINI_THINKING_BUDGET_FACTCHECK=2048
GEMINI_THINKING_BUDGET_JUDGE=1024
GEMINI_THINKING_BUDGET_SCORING=0
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.2
NEWSROOM_MAX_COST_USD=0.35
```

### 수동 Final Generation 실행

GitHub Actions에서 `Newsletters 03 - Editor PR` (`.github/workflows/newsletters-03-editor-pr.yml`)을 선택하고 `Run workflow`를 누릅니다. 입력과 동작은 다음과 같습니다.

- `newsletter_date`는 optional입니다. 비워 두면 workflow 실행 시점의 KST 날짜(`YYYY-MM-DD`)로 resolve됩니다.
- 특정 날짜를 다시 생성하려면 `newsletter_date`만 입력하면 됩니다. candidate artifact path는 더 이상 input으로 받지 않습니다.
- Stage 3는 승인된 artifact를 `merged-candidates.json` → `manual-candidates.json` → legacy `candidates.json` 순서로 자동 선택합니다.
- `llm_provider`, `llm_model`, `llm_fallback_models`는 #368 기준으로 advanced manual override input(고급 수동 재정의 입력)으로 남겨 둡니다. 기본 수동 실행은 `llm_model=""`로 동작하며 code default stage model을 primary로 씁니다.
- `llm_model` 또는 `llm_fallback_models`에 Gemini Pro 계열 모델명을 넣으면 `doctor:config` 단계에서 실패합니다.

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

`qualityGatePolicy.hardFailConditions`는 `src/shared/config/newsletter-policy.json`에 있는 hard fail 목록(inventory)의 source of truth입니다. `score`는 숫자로 된 품질 점수일 뿐이고, hard fail blocker를 덮어쓸 수 없습니다. 즉 `score >= qualityGatePolicy.threshold`이더라도 다음 중 하나라도 있으면 그 이슈는 `publish-ready` / `final_publish_ready`가 아닙니다: blocking deduction, `source_gap`, fact-check `must_fix`, stale claim hard failure, strict mode에서 `quality-report.json`을 다시 계산했을 때의 drift.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update src/shared/config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### 뉴스레터 정책 (Newsletter Policy)

- 정본 출처(source of truth): `src/shared/config/newsletter-policy.json`
- 주요 기사 수: 1-5
- 단일 기사 정책(one-article policy): 공개 뉴스레터는 완전히 발행 가능한 주요 기사 하나만 담을 수 있습니다.
- 기사 수만으로 단일 기사 호가 품질 저하 또는 검토 전용으로 분류되지는 않습니다. 단, 하드 품질 게이트는 그대로 적용됩니다.
- 보조 전용 정책(supporting-only policy): 보조 주요 버킷 기사 하나도 모든 하드 게이트를 통과하면 공개 가능 상태가 될 수 있습니다.
- 검토 게이트(review gate) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) direct AOSP Camera 또는 driver/image pipeline 기사: 단일 기사 정책으로 비활성화됨 (`direct_aosp_camera`, `camera_driver_image_pipeline` 버킷 대상)
- 발행 가능(publish-ready) 보조 주요 기사: 보조 주요 버킷 전체에서 최대 1개
- Primary Camera Stack 버킷: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- 보조 주요 버킷: `android_multimedia_camera_output`, `soc_platform_signal`, `cpp_ai_tooling_fallback`
- 금지 주요 버킷: `generic_tech_watchlist`; 후보 수만으로 이 버킷을 주요 기사로 승격하지 않습니다
- 후보 풀 사전점검(candidate pool preflight): 발행 가능 후보 최소 1개; 예비 후보는 진단용으로만 사용; camera stack 후보 최소 0개
- 선정 기간(selection windows): primary 7일; fallback 21일; reference 35일
- 선정 기간 적용(selection window enforcement): 주요 선정은 강제 적용되며, fallback 기간 후보는 primary 기간 선정이 부족할 때에만 승격됩니다.
- 지난 소식(Catch-up) 레인: 신규 선정이 3개 미만이면, 비어 있는 주요 슬롯을 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent` 버킷에서 최대 35일 이내의 미게재 릴리스로 채웁니다. 호당 최대 2개이며 각각 한 번씩만 게재하고, 신규 콘텐츠를 밀어내지 않습니다.
- 릴리스 캐치업(release-class) 레인: 릴리스 채널(collectionModeHint `release-note-watch`) 소스의 미게재 릴리스는, 신규 선정이 목표를 채운 주에도 주요 기사 최대치 아래 여유 슬롯을 호당 최대 1개까지 쓸 수 있습니다. 같은 품질 하한·중복·게재 이력 검사를 그대로 통과해야 하며, 신규 콘텐츠를 밀어내지 않습니다.
- 홈페이지 헤드라인 정책(homepage headline policy): linear decay; 일별 감쇠 2 point(s)/day; 교체 마진(replacement margin) 5; 최소 헤드라인 점수(minimum headline score) 40; 최신호 포함 필수(latest inclusion required) true; 이력 최대(history max) 50
- 발행 게이트(publish gate): PASS는 source gap이 없고, fact-check must_fix가 없으며, 차단성 감점(blocking deduction)이 없고, 모든 기사가 fact-checker에 의해 발행 가능으로 표시되어야 합니다. 수치 기반 품질 임계값은 없습니다.
- 편집 품질(editorial quality): fact-checker(LLM)가 각 기사를 Camera HAL SW 엔지니어에게 유용한지 기준으로 판정합니다(주제 무관 — C++, AI, Linux 기사라도 해당 엔지니어에게 도움이 되면 자격이 있습니다). 주제/깊이 휴리스틱은 결정론적 발행 게이트로 사용하지 않습니다.
- 하드 실패 조건은 계속 차단됩니다(hard fail conditions remain blocking): source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->

## Source quality and prompt contract

Source quality(출처 품질)는 수집 단계와 Stage 3 생성 단계 사이에, 실행 가능한 정책 계층을 한 겹 더 둡니다. 규칙은 다음과 같습니다.

- Candidate 수집은 article capsule을 만들기 전에 `src/shared/collect/source-quality-classifier.js`를 실행합니다.
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

`state/source-monitor-registry.json`에 등록된 monitored source(감시 대상 출처)는 bounded fetch(범위를 제한한 가져오기)로 관찰합니다. 이를 이전 snapshot인 `state/source-snapshots/<source_id>.json`과 비교해 `articles/content/source-events/YYYY-MM-DD/source-change-events.json`과 `.md`를 만듭니다. 이 경로는 검토용 review artifact일 뿐, public newsletter renderer가 직접 읽는 입력이 아닙니다.

날짜 관련 field는 서로 의미가 다르므로 구분해야 합니다.

- `published_date`: 원문 source가 명시한 실제 발행일입니다.
- `effective_date`: source change event를 판단할 때 쓰는 유효 날짜입니다. `Last updated`, structured modified date, sitemap `lastmod`, release row date, 또는 snapshot diff에서 얻습니다.
- `published_date`가 없는 문서는 "날짜 없는 정적 문서"로 보고 그 자체로는 main article로 승격하지 않습니다. 단, monitored source에서 만들어진 source change event가 source binding과 date quality를 통과하면 candidate가 될 수 있습니다.
- `detected_at`, `first_seen_at`, `last_seen_at`: pipeline이 관찰한 시점 또는 snapshot 상태입니다. 이 값들은 source의 실제 발행일이나 freshness(최신성) 근거가 아닙니다. 따라서 freshness/date-source/publish-ready evidence로 사용하지 않습니다.

`date_source`와 `date_confidence`는 `src/shared/common/date-signals.js`의 allowlist와 baseline을 따릅니다. `date_confidence >= 85`인 source date signal만, source relevance와 source binding이 함께 통과할 때 publish-ready date evidence 후보가 될 수 있습니다. `snapshot_detected_at`과 `content_hash_changed_without_date`는 editor review나 watchlist signal로만 다루며, publish-ready date evidence가 아닙니다.

Source monitor report는 `Source Snapshot Changes`, `Source Change Events`, `Evidence Identity / Duplicate Guard`, `Date Quality` 섹션을 포함합니다. Public newsletter artifact에는 raw snapshot state, previous/current diff payload, `processed_source_event_ids`, `processed_evidence_ids`를 노출하지 않습니다.

## Artifact Retention Policy

newsroom pipeline이 생성하는 artifact는 4가지 retention grade로 분류합니다.

| 등급 | 식별자 | Git 커밋 | 보존 위치 |
|------|--------|----------|-----------|
| Public Source of Truth | `public_source_of_truth` | 커밋 | Git |
| Review Required Compact | `review_required_compact` | 커밋 | Git |
| Debug Heavy | `debug_heavy` | 미커밋 | GitHub Actions artifact + manifest |
| Transient Attempt | `transient_attempt` | 미커밋 | GitHub Actions artifact + manifest |

`newsletters-03-editor-pr.yml`의 `peter-evans/create-pull-request` 스텝은 `add-paths` 허용목록을 써서 `public_source_of_truth`와 `review_required_compact` artifact만 커밋합니다. `debug_heavy`와 `transient_attempt` artifact는 커밋하지 않는 대신, full set을 `newsroom-final-debug-<run_id>` Actions artifact에 보존하고 `artifact-manifest.json`의 `retained_heavy_artifacts[]`에 path/size/sha256/retention_grade/retention_location을 기록합니다.

허용목록은 `src/generator/publish/print-retention-commit-allowlist.js`가 `retentionCommitAllowlist({root, date, runContext})`를 호출해 만듭니다. 그래서 PR diff에 `debug_heavy`/`transient_attempt` 파일이 보이지 않는 것은 의도된 동작입니다. heavy artifact를 확인하려면 Actions artifact `newsroom-final-debug-<run_id>`를 다운로드하거나 `artifact-manifest.json`의 `retained_heavy_artifacts`를 보세요.

이 정책은 발행 안전성·source binding·image lineage·review-publication state 판정을 약화하지 않습니다. validate:post-generation, resolve-reviewable-artifacts, pr-body 생성은 commit 스텝보다 **먼저** in-run working tree에서 돌기 때문에, add-paths 허용목록의 영향을 받지 않습니다.

`newsletters-01-source-collect-pr.yml`과 `newsletters-02-source-discovery-pr.yml`은 candidate JSON이 리뷰 대상이므로 이 허용목록 제한을 적용하지 않습니다.

`articles/content/collected-news/YYYY-MM-DD/`에 있는 파이프라인 입력 파일들(`candidates.json`, `manual-candidates.json`, `raw-candidate-manifest.json`, `merged-candidates.json`, `merged-candidate-manifest.json`, `collection-intent.json`, `seed-candidates.json`, `seed-evidence-pack.json`)은 workflow 01 → 02 → 03 사이를 넘겨주는 핸드오프 상태이므로 `review_required_compact` 등급입니다. 이 중 `seed-candidates.json`과 `seed-evidence-pack.json`은 seed_used=true 런에서 workflow 02가 만들며, `validateMergedManifestSchema`가 hash 일치를 strict-check하므로 반드시 커밋해야 합니다. 순수 디버그 파일인 `gemini-candidates.json`은 `debug_heavy` 등급이라 `.gitignore`로 제외합니다.
