# Source Effectiveness Report 운영 안내

`Source Effectiveness Report`는 뉴스 소스별 수집량과 실제 main article 기여도를 기존 artifact만으로 계산하는 진단 보고서입니다. LLM prompt 판단을 사용하지 않으며, source registry나 selection policy를 자동으로 변경하지 않습니다.

## 실행

```powershell
npm.cmd run report:source-effectiveness -- --date YYYY-MM-DD
```

직접 실행할 수도 있습니다.

```powershell
node scripts/build-source-effectiveness-report.js --date YYYY-MM-DD
```

날짜는 `--date`, `NEWSLETTER_DATE`, `.tmp/newsletter-date.txt`, 오늘 KST 순서로 결정됩니다.

## 입력과 출력

필수 입력은 다음과 같습니다.

- `content/collected-news/YYYY-MM-DD/candidates.json`
- `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`
- `data/news-sources.json`

선택 입력은 다음과 같습니다. 누락되어도 report 생성은 계속되고 `warnings`에 기록됩니다.

- `content/newsroom/YYYY-MM-DD/reporter-candidates.json`
- `content/newsroom/YYYY-MM-DD/editor-draft.json`
- `content/newsroom/YYYY-MM-DD/fact-check-report.json`
- `content/newsroom/YYYY-MM-DD/quality-report.json`

출력은 다음 위치에 생성됩니다.

- `content/newsroom/YYYY-MM-DD/source-effectiveness-report.json`
- `content/newsroom/YYYY-MM-DD/source-effectiveness-report.md`

## 해석 기준

- `collected_count`: source에서 수집된 unique normalized URL 후보 수입니다.
- `eligible_count`: main article 또는 short article 후보로 deterministic하게 인정되는 수입니다.
- `selected_count`: `final_selected`, `primary_selected`, `selected_for_editor` 중 하나가 `true`인 후보 수입니다.
- `rendered_main_count`: `editor-draft.json`의 main section source URL이 candidate URL과 매칭된 수입니다.
- `duplicate_within_source_count`: 같은 source 안에서 같은 normalized URL이 반복된 추가 항목 수입니다.
- `duplicate_across_sources_count`: 같은 normalized URL이 둘 이상의 source에 나타난 경우 source별로 귀속된 중복 수입니다.

모든 rate는 denominator가 `0`이면 `0`으로 계산합니다. Markdown table은 deterministic sort를 사용하므로 같은 입력에서는 같은 출력이 생성됩니다.

## Recommendation

- `NO_RECENT_SIGNAL`: 해당 날짜 artifact에서 수집된 후보가 없습니다.
- `OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR`: official 또는 high priority source가 수집은 되었지만 eligible 후보가 없는 상태입니다.
- `KEEP`: rendered main article 기여가 있는 source입니다.
- `KEEP_AND_FIX_PARSER`: official 또는 high priority source에서 parser/source evidence 보강이 필요한 상태입니다.
- `DOWNGRADE_TO_CANDIDATE_ONLY`: generic AI/IT source가 많은 후보를 가져오지만 eligible/rendered 기여가 없는 상태입니다.
- `REVIEW_SOURCE_OR_PARSER`: source gap 비율이 높아 URL, dated evidence, parser를 함께 점검해야 합니다.
- `DISABLE_OR_REVIEW`: non-official source가 반복적으로 기여하지 못할 때 후속 PR에서 검토할 상태입니다.
- `KEEP_AND_MONITOR`: 즉시 조정할 필요는 없지만 추이를 봐야 하는 source입니다.

`official`, `project-official`, `official-community`, `priority=high` source는 바로 `DISABLE_OR_REVIEW`로 보내지 않고 parser repair 계열 recommendation을 우선 적용합니다.

## 운영 원칙

이 report는 source tuning을 위한 evidence artifact입니다. `enabled`, `candidateOnly`, `priority`, `reliability` 같은 `data/news-sources.json` 계약 값은 이 명령이 자동 변경하지 않습니다. source를 disable하거나 `candidateOnly`로 낮추는 작업은 별도 PR에서 report와 실제 parser 상태를 함께 검토한 뒤 진행합니다.
