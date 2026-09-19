# Source Effectiveness Report 운영 안내

`Source Effectiveness Report`는 뉴스 소스마다 후보를 얼마나 수집했는지, 그리고 실제 main article에 얼마나 기여했는지를 보여주는 진단 보고서입니다. 이미 있는 artifact만으로 계산합니다. LLM prompt 판단을 쓰지 않고, source registry나 selection policy를 자동으로 바꾸지도 않습니다.

## 실행

```powershell
npm.cmd run report:source-effectiveness -- --date YYYY-MM-DD
```

직접 실행할 수도 있습니다.

```powershell
node src/generator/publish/build-source-effectiveness-report.js --date YYYY-MM-DD
```

날짜는 `--date` → `NEWSLETTER_DATE` → `.tmp/newsletter-date.txt` → 오늘 KST 순서로 정해집니다.

## 입력과 출력

필수 입력은 다음과 같습니다.

- `articles/content/collected-news/YYYY-MM-DD/candidates.json`
- `articles/content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`
- `src/shared/data/news-sources.json`

선택 입력은 다음과 같습니다. 없어도 report 생성은 계속되며, 빠진 항목은 `warnings`에 기록됩니다.

- `articles/content/newsroom/YYYY-MM-DD/reporter-candidates.json`
- `articles/content/newsroom/YYYY-MM-DD/editor-draft.json`
- `articles/content/newsroom/YYYY-MM-DD/fact-check-report.json`
- `articles/content/newsroom/YYYY-MM-DD/quality-report.json`

출력은 다음 위치에 생성됩니다.

- `articles/content/newsroom/YYYY-MM-DD/source-effectiveness-report.json`
- `articles/content/newsroom/YYYY-MM-DD/source-effectiveness-report.md`

## 해석 기준

- `collected_count`: source에서 수집된 unique normalized URL 후보 수입니다.
- `eligible_count`: main article 또는 short article 후보로 deterministic하게 인정되는 수입니다.
- `selected_count`: `final_selected`, `primary_selected`, `selected_for_editor` 중 하나가 `true`인 후보 수입니다.
- `rendered_main_count`: `editor-draft.json`의 main section source URL이 candidate URL과 매칭된 수입니다.
- `duplicate_within_source_count`: 같은 source 안에서 같은 normalized URL이 반복된 추가 항목 수입니다.
- `duplicate_across_sources_count`: 같은 normalized URL이 둘 이상의 source에 나타난 경우 source별로 귀속된 중복 수입니다.

모든 비율(rate)은 분모(denominator)가 `0`이면 `0`으로 계산합니다. Markdown table은 정렬 순서가 고정(deterministic sort)이라, 같은 입력이면 항상 같은 출력이 나옵니다.

## Recommendation

`recommendation`은 아래 분기를 위에서부터 순서대로 평가해 처음 매칭되는 값 하나로 정합니다. 실제로 나올 수 있는 값은 7개입니다.

1. `NO_RECENT_SIGNAL`: 해당 날짜 artifact에서 수집된 후보가 없습니다(`collected_count`가 `0`).
2. `OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR`: official 또는 high priority source가 camera 관련 raw signal은 냈지만(`camera_relevant_raw_count > 0`), eligible 후보가 하나도 없고, rejection reason이 parser/extraction/source_extraction/date/version/anchor 계열(`parser_repair_reason_count > 0`)인 상태입니다.
3. `KEEP`: rendered main article 기여가 있고(`rendered_main_count > 0`), effectiveness score가 `60` 이상, source gap 비율이 `0.3` 이하, noise 비율이 `0.5` 이하인 source입니다.
4. `REVIEW_SOURCE_OR_PARSER`(official 분기): official 또는 high priority source가 eligible 후보를 하나도 내지 못했고 source gap 비율이 `0.25` 이상인 상태입니다. source gap만으로는 파서 고장을 단정할 수 없으므로, source와 exclusion을 함께 점검하라는 권고입니다. eligible 후보가 하나라도 있으면 파서가 항목을 뽑아 낸 것이므로 이 분기를 건너뛰고 아래 분기를 그대로 따라갑니다.
5. `DOWNGRADE_TO_CANDIDATE_ONLY`: non-official generic AI/IT source가 후보를 3건 이상 가져왔지만 eligible/rendered main 기여가 없고, noise 비율이 `0.5` 이상이거나 source gap 비율이 `0.5` 이상인 상태입니다.
6. `REVIEW_SOURCE_OR_PARSER`(일반 분기): source gap 비율이 `0.5` 이상이거나 source gap 후보가 2건 이상이라, URL, dated evidence, parser를 함께 점검해야 합니다.
7. `DISABLE_OR_REVIEW`: non-official source가 후보를 3건 이상 가져왔는데 eligible/rendered main 기여가 없는 상태로, 후속 PR에서 검토합니다.
8. `KEEP_AND_MONITOR`: 위 어느 분기에도 해당하지 않는 기본값입니다. 즉시 조정할 필요는 없지만 추이를 봐야 하는 source입니다.

`official`, `project-official`, `official-community`, `priority=high` source는 곧바로 `DISABLE_OR_REVIEW`로 보내지 않습니다. `DISABLE_OR_REVIEW`와 `DOWNGRADE_TO_CANDIDATE_ONLY`는 non-official source에만 적용되고, official 계열은 먼저 parser repair 계열 분기(2번, 4번)를 거칩니다.

### recommendation과 recommended_action은 다른 어휘입니다

이 report의 `recommendation`은 위 7개 값만 냅니다. `KEEP_AND_FIX_PARSER`는 이 어휘에 없습니다. 같은 이름의 `KEEP_AND_FIX_PARSER`는 source quality 진단 층(`src/generator/diagnostics/source-quality-diagnosis.js`)의 `recommended_action` 어휘에는 살아 있습니다. 진단 층은 이 report를 입력으로 읽은 뒤 자체 어휘로 조치를 다시 판정하므로, 두 필드를 혼동하지 마세요.

## 운영 원칙

이 report는 source 조정(source tuning)을 돕는 근거(evidence) artifact입니다. `src/shared/data/news-sources.json`의 계약 값(`enabled`, `candidateOnly`, `priority`, `reliability` 등)은 이 명령이 자동으로 바꾸지 않습니다. source를 disable하거나 `candidateOnly`로 낮추는 작업은, 별도 PR에서 report와 실제 parser 상태를 함께 검토한 뒤에 진행합니다.
