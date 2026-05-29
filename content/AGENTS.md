# content 작업 지침

이 폴더는 generated/review artifact를 둡니다. 일반 리팩토링에서 대량 수정하지 마세요.

## Artifact Roles

- `content/collected-news/YYYY-MM-DD/`는 raw candidate evidence입니다.
- `content/newsroom/YYYY-MM-DD/`는 reporter, editor, fact-check, quality, retry, QA review artifact입니다.
- Public newsletter output은 `newsletters/YYYY-MM-DD/`에 있습니다.

## 보존 등급 (Retention Grade)

artifact는 아래 4등급으로 분류합니다. 등급은 `artifact-manifest.json`의 `retention_grade` 필드에 기록됩니다.

| 등급 | 식별자 | Git 커밋 | 보존 위치 |
|------|--------|----------|-----------|
| Public Source of Truth | `public_source_of_truth` | 커밋 | Git |
| Review Required Compact | `review_required_compact` | 커밋 | Git |
| Debug Heavy | `debug_heavy` | 미커밋 | GitHub Actions artifact + manifest |
| Transient Attempt | `transient_attempt` | 미커밋 | GitHub Actions artifact + manifest |

### PUB — `public_source_of_truth` (커밋)

- `newsletters/YYYY-MM-DD/newsletter.md`
- `newsletters/YYYY-MM-DD/index.html`
- `data/newsletters.json`
- `data/homepage-headline.json`
- `data/article-exposure-history.json`

### RRC — `review_required_compact` (커밋)

- `00-review-guide.md`, `editor-in-chief-brief.md`, `generation-status.json`
- `fact-check-report.{json,md}`, `quality-report.{json,md}`, `hal-signal-quality-report.{json,md}`
- `stale-claim-report.{json,md}`, `image-audit-report.{json,md}`, `source-quality-report.{json,md}`
- `selection-report.{json,md}`, `selection-diagnostics.md`
- `source-quality-diagnosis.{json,md}`, `evidence-pack-summary.json`
- `retry-history.{json,md}`, `release-qa-report.md`
- `linked-evidence-diagnostics.md`, `event-bundle-diagnostics.md`
- `source-effectiveness-report.{json,md}`, `source-discovery-feedback-report.{json,md}`
- `gemini-source-discovery-report.md`, `cost-report.md`
- `summary-cache-report.{json,md}`, `artifact-manifest.json`
- `news-candidates.md`, seed `*.md`, `source-change-events.md`

### DBG — `debug_heavy` (Actions + manifest만, 커밋 제외)

- `shortlisted-candidates.json`, `article-capsules.json`
- `editor-draft.{json,md}`, `reporter-candidates.json`
- `linked-evidence-report.json`, `event-bundles.json`, `background-context.json`
- `source-clusters.json`, `extracted-source-facts.json`, `evidence-validation-report.json`
- `gemini-*.json`, `seed-fetch-report.json`, `seed-merge-report.json`
- `source-change-events.json`
- `recovery-prompt.md` — heavy LLM prompt dump (~10 MB 규모). Git에 커밋하지 않음; GitHub Actions artifact `newsroom-final-debug-<run_id>` + `artifact-manifest.json` → `retained_heavy_artifacts`에서 조회.
- `content/collected-news/YYYY-MM-DD/` 전체 (candidates, manual-candidates, collection-intent, raw-candidate-manifest, merged-candidates, merged-candidate-manifest, gemini-candidates, seed-candidates, seed-evidence-pack.json)

### TRA — `transient_attempt` (Actions + manifest만, 커밋 제외)

- `*-attempt-*.{json,md}`, `*-repair-attempt-*`, `*-completion-attempt-*` 패턴 매칭 파일

## Compact Manifest 필드

`retained_heavy_artifacts[]` 항목 구조:

```json
{
  "path": "content/newsroom/YYYY-MM-DD/shortlisted-candidates.json",
  "size": 1234567,
  "sha256": "...",
  "retention_grade": "debug_heavy",
  "retention_location": "github-actions-artifact:newsroom-final-debug-<run_id>"
}
```

`committed_artifacts[]` 항목은 `retention_grade`가 `public_source_of_truth` 또는 `review_required_compact`인 파일 목록입니다.

## 실패 run 최소 증거

실패 run이더라도 아래 RRC artifact는 Git에 커밋되어야 합니다.

- `generation-status.json`
- `selection-diagnostics.md`
- `selection-report.{json,md}`
- `quality-report.{json,md}`, `fact-check-report.{json,md}`, `hal-signal-quality-report.{json,md}`
- `artifact-manifest.json` (heavy artifact 목록과 retention_location 포함)

`recovery-prompt.md`는 DBG 등급으로 Git에 커밋하지 않습니다. 실패 run의 recovery-prompt는 GitHub Actions artifact `newsroom-final-debug-<run_id>`에서 다운로드하거나, `artifact-manifest.json` → `retained_heavy_artifacts`에서 path/sha256으로 조회하세요.

heavy artifact 전체는 GitHub Actions artifact `newsroom-final-debug-<run_id>`에 보존됩니다.

## 삭제 가능 vs 보존

- DBG/TRA 과거 파일은 Git history에서 삭제 대상으로 표시할 수 있습니다. 이 파일들은 이미 해당 run의 Actions artifact + manifest에서 size/sha256/retention_location으로 추적됩니다.
- PUB/RRC 파일은 검토 및 발행 계약의 일부이므로 임의 삭제 금지입니다.
- 과거 커밋에 이미 포함된 heavy 파일(DBG/TRA)은 이번 정책 변경으로 소급 삭제하지 않습니다. 실제 cleanup은 별도 PR에서 처리합니다.

## RAW/Source-Discovery PR 예외

`01-newsroom-raw-candidates.yml`과 `02-newsroom-source-discovery.yml`은 candidate JSON 자체가 리뷰 대상이므로 candidate JSON을 의도적으로 커밋합니다. 이 워크플로에는 `add-paths` 허용목록 제한을 적용하지 않습니다.

## Preservation Rules

- Generated artifact를 `tests/fixtures/**/good` 또는 golden fixture로 그대로 복사하지 마세요.
- 명시 요청 없이 `content/newsroom/**`, `content/collected-news/**`를 대량 수정하지 마세요.
- `content/newsroom/**`, `content/collected-news/**`의 기존 generated artifact는 대량 수정 대상이 아닙니다.
