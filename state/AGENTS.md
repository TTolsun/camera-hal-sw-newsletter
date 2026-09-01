# state 작업 지침

`state/`는 파이프라인 운영 state(source snapshot monitor, article exposure history, deep-dive topic queue)를 둡니다. 읽기 전용 source registry는 `src/shared/data/news-sources.json`, 서빙되는 site data는 `articles/data/`로 분리되어 있으므로 혼동하지 마세요. source registry(`news-sources.json`) 편집 규칙은 그 파일을 소유하는 [src/AGENTS.md](../src/AGENTS.md)에 있습니다. source registry의 사람이 읽는 설명 문서는 `docs/NEWS_SOURCES.md`와 `docs/config/NEWS_SOURCES_FIELDS.md`를 함께 확인합니다.

## JSON 규칙 (JSON Rules)

- `state/` JSON 파일의 JSON keys와 enum-like values는 영어로 유지합니다.
- `schemaVersion`, `source_id` 같은 계약-bearing 값은 번역하지 않습니다.

## Source Monitor Registry (소스 모니터 레지스트리)

- `state/source-monitor-registry.json`은 source snapshot monitor 계약입니다. `schemaVersion`, `source_id`, `url_patterns`, `date_extractors`, bounded fetch 값, boolean policy flag를 validator와 함께 갱신하세요.
- `state/source-snapshots/**`는 reviewable generated state이며 public newsletter renderer 입력이 아닙니다.
- `processed_source_event_ids`, `processed_evidence_ids` 같은 내부 state를 public output에 노출하지 않습니다.

## Article Exposure History (기사 노출 이력)

- `state/article-exposure-history.json`은 재게재 쿨다운과 catch-up의 `everCoveredAsNewsletterArticle` 두 게이트가 보는 발행 기록입니다. 게이트가 인정하는 레코드는 `exposure_type`(또는 `exposure_types`)이 `newsletter_article`인 것뿐입니다. `homepage_headline` 레코드는 홈 헤드라인 재사용 판정용이라 게이트에서는 세지 않습니다.
- `coverage` 블록은 게이트 로직이 읽지 않습니다. 사람이 "어디까지 백필됐나"를 판단하는 선언이고, 리포트에 `article_exposure_coverage`로 그대로 실립니다. 그래서 실제와 어긋나면 다음 백필 범위 판단이 틀립니다(#1037).
- `coverage_starts_at`은 **게이트가 인정하는 레코드가 실제로 시작되는 날**입니다. 그 이전 호의 main 기사는 `newsletter_article` 레코드가 없습니다 — 백필하지 않기로 한 결정입니다(#1037). `backfill_included: true`는 이 시작점이 실시간 기록이 아니라 #963(PR #978)의 백필로 만들어졌다는 뜻입니다. 날짜의 정본은 state 파일의 값과 아래 `BACKFILL_WINDOW_START` 상수 두 곳뿐이니 이 문서에 사본을 적지 마세요 — 사본은 갱신에서 빠져 조용히 거짓이 됩니다.
- 이 선언은 `src/shared/test/contract/selection-republication-cooldown.test.js`의 `BACKFILL_WINDOW_START` 상수와 같아야 하며 테스트가 잠급니다. 상수를 이 파일에서 읽어오게 바꾸지 마세요 — 오래된 레코드를 지울 때 창이 함께 줄어 무증상 통과가 됩니다.
- catch-up 창을 넓혀 나이 창이 `coverage_starts_at` 이전으로 넘어가면, 그 구간에는 게이트가 볼 레코드가 없어 catch-up이 과거 main 기사를 다시 올립니다. 나이(`days_since_published`)의 기준은 실행일이 아니라 **이 호의 이슈 날짜가 정하는 직전 완결 UTC ISO 주**입니다(`freshnessWindowMetadata`, `src/generator/select/newsroom-selection.js`). 단 `COVERAGE_WEEK_KEY`(`coverageWeekKeyOverride`)를 주면 그 주가 앵커가 되고 이슈 날짜는 무시됩니다. 그래서 과거 호를 재실행하거나 백필하면 — override로 과거 주를 겨냥하는 경우까지 — 창도 그 호로 되돌아갑니다. 벽시계가 흘렀다는 사실은 이 위험을 줄여 주지 않습니다. 한편 `catchUpPolicy.maxAgeDays`는 `selectionWindowPolicy.referenceContextDays`를 넘을 수 없고, 위반하면 정책 로드가 throw합니다(`src/shared/common/newsletter-policy.js`). 두 값을 함께 올리는 변경만 이 계약을 건드릴 수 있고, 그때 함께 봐야 합니다.
- `coverage`에 설명용 키를 새로 넣지 마세요. `normalizeExposureHistory`(`src/generator/reporter/article-exposure-history.js`)가 `mode`·`coverage_starts_at`·`backfill_included` 세 키로만 다시 만들기 때문에 다음 쓰기에서 조용히 사라집니다.

## Deep-dive Topic Queue (심층 주제 큐)

- `state/deep-dive-topic-queue.json`은 심층 기사 주제 후보를 쌓아 두는 운영 state입니다. `schemaVersion`은 1입니다.
- 작성자는 수집 단계(워크플로 01)뿐입니다. 발행 단계(03)는 읽어서 주제를 고르고 리포트만 남깁니다. 상태 전환(`covered`/`blocked_until_new_evidence`) 쓰기는 2단계에서 03이 맡습니다.
- 파일이 손상되면 빈 큐로 대체하지 않고 오류를 냅니다. 구현 오류를 콘텐츠 실패로 위장하지 않기 위해서입니다. 쓰기는 임시 파일+rename으로 원자적으로 합니다.
- 계약 전체는 [docs/NEWSROOM_WORKFLOW.md](../docs/NEWSROOM_WORKFLOW.md)의 「심층(deep-dive) 주제 큐」 절이 정본입니다.

## 필수 검증 (Required Validation)

state JSON 계약이나 표시값을 바꾼 뒤에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:config
npm.cmd run validate:localization
npm.cmd run validate
```
