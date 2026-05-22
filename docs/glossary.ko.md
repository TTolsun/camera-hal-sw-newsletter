# 용어집

이 문서는 newsroom 자동화와 발행 artifact에서 반복되는 용어를 설명합니다. code identifiers, JSON keys, enum values, file names, URLs, commands는 원문을 유지합니다.

| 용어 | 설명 |
| --- | --- |
| `scheduled run` | GitHub Actions가 정해진 시간에 자동으로 후보 수집, 생성, 검증, PR 생성을 시도하는 실행입니다. 기본값은 비용 안전성과 review artifact 보존을 우선합니다. |
| `manual high-quality run` | 사람이 GitHub Actions에서 `Run workflow`로 직접 시작하는 실행입니다. Pro 계열 모델은 명시적으로 허용한 경우에만 사용할 수 있습니다. |
| `fallback model` | 기본 Gemini 모델 호출이 실패했을 때 순서대로 시도하는 대체 모델입니다. scheduled run의 기본 fallback은 Pro 계열을 자동 포함하지 않습니다. |
| `article composition` | main article 수, briefing 수, required section, source/reference 같은 newsletter 구성 규칙입니다. |
| `collectionMode` | source registry에서 후보를 RSS, HTML, watch page 등 어떤 방식으로 수집할지 나타내는 field입니다. |
| `source gap` | 날짜, version, API/component, behavior change, 원문 근거가 부족해 main article로 발행하기 위험한 상태입니다. rewrite로 통과시키지 않고 demote 또는 replace합니다. |
| `quality gate` | `npm.cmd run validate`와 `quality-report.json`이 적용하는 발행 안전 기준입니다. score와 hard blocker를 함께 봅니다. |
| `cost report` | Gemini 호출의 stage/model/attempt, token, thinking token, cached token, estimated cost를 기록하는 비용 artifact입니다. |
| `selection report` | deterministic shortlist와 final selection 판단을 확인하는 artifact 묶음입니다. 주로 `shortlisted-candidates.json`, `article-capsules.json`, PR body diagnostics를 봅니다. |
| `generation status artifact` | `.tmp/newsletter-generation-status.json`입니다. generation status, `publish_ready`, article count, quality/fact-check 상태를 workflow가 읽습니다. |
| `summary cache` | `cache/news-summary/` 아래에 저장되는 후보 요약 cache입니다. 반복 실행의 Gemini 요약 비용을 줄이기 위한 untracked cache입니다. |
| `retry history` | `retry-history.json`과 `retry-history.md`에 남는 재시도 기록입니다. locked article, failed section, repair/replace 정책을 확인합니다. |
| `publish-ready` | 발행 가능한 PR 상태를 뜻하는 label 또는 사람이 읽는 상태 표현입니다. PR 생성 성공과 별개로 quality/fact-check/publish gate가 모두 통과해야 합니다. |
| `needs-fix` | 편집장 수리 또는 검토가 필요한 PR 상태입니다. review artifact는 남기지만 발행 가능한 상태로 보지 않습니다. |
| `fallback-composition` | direct camera/driver 후보가 부족해 SoC/platform/tooling fallback article로 구성을 보강했지만 `publish-ready`는 아닌 diagnostics 상태입니다. |
| `thin-week` | eligible main article 수가 부족해 자동 발행 대상이 아닌 얇은 주간 review path입니다. |
| `source candidate binding` | editor section의 source URL과 deterministic shortlist/reporter candidate를 연결해 source integrity를 검증하는 계약입니다. |
| `watchlist` | 모니터링은 하되 dated evidence나 article candidate 조건이 부족해 main article로 올리지 않는 후보 tier입니다. |
| `reference_only` | 참고자료로만 쓰는 후보 또는 source metadata입니다. main article 후보로 직접 승격하지 않습니다. |
| `candidateOnly` | source registry에서 후보 발굴용 source임을 나타내는 값입니다. 최종 신뢰 source로 쓰기 전에 cross-check가 필요합니다. |
| `requiresCrossCheck` | media/community/paywall 등 단독 최종 근거로 쓰기 위험한 source에 교차 확인이 필요함을 나타냅니다. |
| `finalSelectionEligibility` | 후보의 최종 article 선택 가능성을 나타내는 field입니다. main article에는 `main` 또는 `short` 후보만 사용할 수 있습니다. |
| `section_text_fallback` | renderer나 validator가 structured field 대신 section text에서 필요한 정보를 보완해 읽는 fallback 경로입니다. primary 계약을 대체하지 않습니다. |
| `deterministic shortlist` | Gemini 호출 전에 코드가 source gap, watch/reference page, duplicate URL, relevance score를 기준으로 줄인 후보 목록입니다. |
| `article capsule` | Gemini에 전달하는 compact article input입니다. title, URL, source, date, component, evidence, risk, score 같은 핵심 정보만 담습니다. |
| `collection_intent` | 사람이 중요하다고 지정한 seed URL과 keyword hint를 Stage 1에서 기록하는 수집 의도 artifact입니다. 보통 `content/collected-news/YYYY-MM-DD/collection-intent.json` 경로로 다룹니다. |
| `seed_url` | 사용자가 대표 근거로 지정한 public `https` URL입니다. Stage 2는 이 URL을 deterministic하게 fetch하고, 허용된 linked evidence만 보강 대상으로 봅니다. |
| `keyword_hints` | seed 수집과 source discovery를 돕는 검색/분류 hint입니다. 기사 fact나 source evidence가 아니므로 claim 근거로 쓰면 안 됩니다. |
| `compact_evidence` | Gemini prompt에 전달하기 위해 source-backed fact, linked context, do_not_claim, evidence URL을 압축한 candidate-level evidence capsule입니다. 전체 Evidence Pack을 그대로 넣는 대신 기사 작성에 필요한 최소 근거만 전달합니다. |
| `seed_evidence_pack` | seed URL에서 가져온 원문, linked evidence, 금지 claim, 근거 URL을 묶은 evidence package입니다. Gemini prompt에는 보통 전체 pack이 아니라 필요한 부분만 `compact_evidence`로 압축해 전달합니다. |
| `source_gap_risk` | main article로 발행하기에는 dated evidence, source extraction, source binding이 부족하다는 위험 표시입니다. 이 값이 true인 후보는 quality gate나 selector gate를 우회해서 발행하지 않습니다. |
| `source_url_quality` | source URL이 dated evidence, 공식성, 기사성, 중복 여부, 접근 가능성 측면에서 main article 근거로 적합한지 평가하는 품질 신호입니다. |
| `main_article_source_allowed` | 해당 후보 또는 source가 main article 근거로 사용 가능한지 나타내는 정책 판단 값입니다. false이면 fallback/context/reference로만 다룹니다. |
| `candidate_shortage_reviewable` | 후보 수가 부족하지만 원인을 진단하고 사람이 검토할 수 있도록 artifact를 남기는 상태입니다. 자동 publish-ready와는 다릅니다. |
| `claim.evidence_ids` | article claim이 참조하는 evidence id 목록입니다. fact claim은 source URL과 evidence id를 통해 추적 가능해야 합니다. |
| `manual-candidates.json` | Stage 1에서 사람이 지정한 seed URL, manual candidate, 기본 수집 후보를 보존하는 후보 artifact입니다. |
| `merged-candidates.json` | Stage 2에서 manual candidate, seed evidence, Gemini discovery 후보를 병합한 최종 generation input 후보 artifact입니다. |
| `editor-draft.json` | editor stage가 만든 newsletter draft artifact입니다. public output이 아니라 renderer와 validator가 검토하는 중간 산출물입니다. |
| `quality-report.json` | quality gate 결과를 담는 machine-readable report입니다. score뿐 아니라 hard blocker, source gap, fact-check must_fix 같은 발행 안전 문제를 함께 확인합니다. |
## Source snapshot / date quality

| 용어 | 설명 |
| --- | --- |
| `published_date` | 원문 source가 명시한 실제 발행일입니다. publish-ready freshness 판단에서 가장 강한 날짜 근거입니다. |
| `effective_date` | monitored source의 source change event 판단에 쓰는 유효 날짜입니다. `Last updated`, structured modified date, sitemap `lastmod`, release row date 같은 source date signal에서 옵니다. |
| `detected_at` | pipeline이 source 변화를 관찰한 시각입니다. source의 실제 발행일이나 freshness 근거가 아닙니다. |
| `first_seen_at` | snapshot identity 기준 최초 발견 시각입니다. 재수집 시 보존되며 freshness/date-source/publish-ready evidence로 쓰지 않습니다. |
| `last_seen_at` | snapshot identity 기준 마지막 관찰 시각입니다. freshness/date-source/publish-ready evidence로 쓰지 않습니다. |
| `source_event_id` | source snapshot diff에서 생성된 변경 이벤트 단위 ID입니다. 같은 event 재처리를 막는 duplicate guard에 사용합니다. |
| `evidence_id` | candidate 전환에 쓰이는 근거 단위 ID입니다. 같은 URL이라도 release row, version, anchor가 다르면 별도 evidence가 될 수 있습니다. |
| `date_source` | `effective_date` 또는 `published_date`의 출처를 나타내는 enum 값입니다. allowlist는 `scripts/newsroom/common/date-signals.js`와 validator가 공유합니다. |
| `date_confidence` | `date_source`별 기준 신뢰도 점수입니다. `date_confidence >= 85`만 source relevance와 source binding이 함께 통과할 때 publish-ready date evidence 후보가 될 수 있습니다. |
| `needs_editor_date_review` | 날짜 근거가 약하거나 content hash 기반 변화라 editor 확인이 필요한 상태입니다. 기본적으로 publish-ready date evidence가 아닙니다. |

detected_at, first_seen_at, last_seen_at은 source의 실제 발행일이나 freshness 근거가 아니다.
