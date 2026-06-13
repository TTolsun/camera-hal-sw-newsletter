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

### public_source_of_truth (커밋)

- `newsletters/YYYY-MM-DD/newsletter.md`
- `newsletters/YYYY-MM-DD/index.html`
- `data/newsletters.json`
- `data/homepage-headline.json`
- `state/article-exposure-history.json`

### review_required_compact (커밋)

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
- **collected-news 파이프라인 입력 파일** (워크플로 핸드오프 상태 — workflow 01 → main → workflow 02 → main → workflow 03 순서로 전달되므로 반드시 Git에 커밋해야 합니다):
  - `content/collected-news/YYYY-MM-DD/candidates.json` (legacy 호환 경로)
  - `content/collected-news/YYYY-MM-DD/manual-candidates.json`
  - `content/collected-news/YYYY-MM-DD/raw-candidate-manifest.json`
  - `content/collected-news/YYYY-MM-DD/merged-candidates.json`
  - `content/collected-news/YYYY-MM-DD/merged-candidate-manifest.json`
  - `content/collected-news/YYYY-MM-DD/collection-intent.json` (workflow-01 manual collection intent; 존재할 때만 커밋)
  - `content/collected-news/YYYY-MM-DD/seed-candidates.json` (seed_used=true 런에서 workflow 02 seed evidence expansion 산출물; `validateMergedManifestSchema`가 hash 일치를 strict-check하므로 반드시 커밋)
  - `content/collected-news/YYYY-MM-DD/seed-evidence-pack.json` (seed_used=true 런에서 workflow 02 seed evidence expansion 산출물; 동일한 hash strict-check 대상)
- **workflow 02 Gemini source discovery 산출물** (워크플로 핸드오프 상태 — `validateMergedManifestSchema`가 `llm_used=true` 또는 `merge_mode='gemini_source_discovery'`인 경우 strict-check하므로 반드시 Git에 커밋해야 합니다. workflow 03이 이 파일들을 main에서 읽을 수 있어야 합니다):
  - `content/newsroom/YYYY-MM-DD/gemini-usage-report.json` (`usage_report` 필드 strict-check 대상)
  - `content/newsroom/YYYY-MM-DD/gemini-source-proposals.json` (workflow 02 Gemini 제안 원문; manifest 참조 파일)
  - `content/newsroom/YYYY-MM-DD/source-clusters.json` (`source_clusters` 필드 strict-check 대상)
  - `content/newsroom/YYYY-MM-DD/evidence-validation-report.json` (`evidence_validation_report` 필드 strict-check 대상)
  - `content/newsroom/YYYY-MM-DD/gemini-source-proposal-validation-report.json` (`proposal_validation_report` 필드 strict-check 대상)
  - `content/newsroom/YYYY-MM-DD/extracted-source-facts.json` (workflow 02 소스 사실 추출 결과; manifest 참조 파일)

### debug_heavy (Actions + manifest만, 커밋 제외)

- `shortlisted-candidates.json`, `article-capsules.json`
- `editor-draft.{json,md}`, `reporter-candidates.json`
- `linked-evidence-report.json`, `event-bundles.json`, `background-context.json`
- `seed-fetch-report.json`, `seed-merge-report.json`
- `source-change-events.json`
- `recovery-prompt.md` — heavy LLM prompt dump (~10 MB 규모). Git에 커밋하지 않음; GitHub Actions artifact `newsroom-final-debug-<run_id>` + `artifact-manifest.json` → `retained_heavy_artifacts`에서 조회.
- `content/collected-news/YYYY-MM-DD/` 순수 디버그 파일 (파이프라인 입력 파일 제외):
  - `gemini-candidates.json`

### transient_attempt (Actions + manifest만, 커밋 제외)

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

실패 run이더라도 아래 review_required_compact artifact는 Git에 커밋되어야 합니다.

- `generation-status.json`
- `selection-diagnostics.md`
- `selection-report.{json,md}`
- `quality-report.{json,md}`, `fact-check-report.{json,md}`, `hal-signal-quality-report.{json,md}`
- `artifact-manifest.json` (heavy artifact 목록과 retention_location 포함)

`recovery-prompt.md`는 debug_heavy 등급으로 Git에 커밋하지 않습니다. 실패 run의 recovery-prompt는 GitHub Actions artifact `newsroom-final-debug-<run_id>`에서 다운로드하거나, `artifact-manifest.json` → `retained_heavy_artifacts`에서 path/sha256으로 조회하세요.

heavy artifact 전체는 GitHub Actions artifact `newsroom-final-debug-<run_id>`에 보존됩니다.

## 삭제 가능 vs 보존

- debug_heavy/transient_attempt 과거 파일은 Git history에서 삭제 대상으로 표시할 수 있습니다. 이 파일들은 이미 해당 run의 Actions artifact + manifest에서 size/sha256/retention_location으로 추적됩니다.
- public_source_of_truth/review_required_compact 파일은 검토 및 발행 계약의 일부이므로 임의 삭제 금지입니다.
- 과거 커밋에 이미 포함된 heavy 파일(debug_heavy/transient_attempt)은 이번 정책 변경으로 소급 삭제하지 않습니다. 실제 cleanup은 별도 PR에서 처리합니다.

## RAW/Source-Discovery PR 예외

`01-newsroom-raw-candidates.yml`과 `02-newsroom-source-discovery.yml`은 candidate JSON 자체가 리뷰 대상이므로 candidate JSON을 의도적으로 커밋합니다. 이 워크플로에는 `add-paths` 허용목록 제한을 적용하지 않습니다.

파이프라인 입력 파일(candidates.json, manual-candidates.json, raw-candidate-manifest.json, merged-candidates.json, merged-candidate-manifest.json, collection-intent.json, seed-candidates.json, seed-evidence-pack.json)은 `review_required_compact` 등급 파일로서, workflow 01 → 02 → 03의 핸드오프 상태입니다. 이 파일들은 `.gitignore`에서 제외되며 Git에 항상 커밋됩니다. 순수 디버그 collected-news 파일(gemini-candidates.json)은 여전히 `.gitignore` 처리됩니다.

## Preservation Rules

- Generated artifact를 `tests/fixtures/**/good` 또는 golden fixture로 그대로 복사하지 마세요.
- 명시 요청 없이 `content/newsroom/**`, `content/collected-news/**`를 대량 수정하지 마세요.
- `content/newsroom/**`, `content/collected-news/**`의 기존 generated artifact는 대량 수정 대상이 아닙니다.
