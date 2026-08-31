# content 작업 지침

이 폴더는 generated/review artifact를 둡니다. 일반 리팩토링에서 대량 수정하지 마세요.

이 금지는 **일반 리팩토링**을 향한 것입니다. 소유자가 이슈로 확정한 스키마 마이그레이션은 예외이고, 그때도 재직렬화가 아니라 줄 단위 표적 편집으로 하며 `JSON.parse` 동등성과 삭제 줄 수를 가드로 확인합니다(#942/PR #949와 #951이 그 절차를 따랐습니다). 경로는 그 예외에도 해당하지 않습니다 — 사후 정규화하지 않는 이유는 아래 #952 항목에 있습니다.

## Artifact 역할 (Artifact Roles)

- `articles/content/collected-news/YYYY-MM-DD/`는 raw candidate evidence입니다.
- `articles/content/newsroom/YYYY-MM-DD/`는 reporter, editor, fact-check, quality, retry, QA review artifact입니다.
- Public newsletter output은 `articles/newsletters/YYYY-MM-DD/`에 있습니다.

## 보존 등급 (Retention Grade)

artifact는 아래 4등급으로 분류합니다. 등급은 `artifact-manifest.json`의 `retention_grade` 필드에 기록됩니다.

| 등급 | 식별자 | Git 커밋 | 보존 위치 |
|------|--------|----------|-----------|
| Public Source of Truth | `public_source_of_truth` | 커밋 | Git |
| Review Required Compact | `review_required_compact` | 커밋 | Git |
| Debug Heavy | `debug_heavy` | 미커밋 | GitHub Actions artifact + manifest |
| Transient Attempt | `transient_attempt` | 미커밋 | GitHub Actions artifact + manifest |

### public_source_of_truth (커밋)

- `articles/newsletters/YYYY-MM-DD/newsletter.md`
- `articles/newsletters/YYYY-MM-DD/index.html`
- `articles/data/newsletters.json`
- `articles/data/homepage-headline.json`
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
  - `articles/content/collected-news/YYYY-MM-DD/candidates.json` (legacy 호환 경로)
  - `articles/content/collected-news/YYYY-MM-DD/manual-candidates.json`
  - `articles/content/collected-news/YYYY-MM-DD/raw-candidate-manifest.json`
  - `articles/content/collected-news/YYYY-MM-DD/merged-candidates.json`
  - `articles/content/collected-news/YYYY-MM-DD/merged-candidate-manifest.json`
  - `articles/content/collected-news/YYYY-MM-DD/collection-intent.json` (workflow-01 manual collection intent; 존재할 때만 커밋)
  - `articles/content/collected-news/YYYY-MM-DD/seed-candidates.json` (seed_used=true 런에서 workflow 02 seed evidence expansion 산출물; `validateMergedManifestSchema`가 hash 일치를 strict-check하므로 반드시 커밋)
  - `articles/content/collected-news/YYYY-MM-DD/seed-evidence-pack.json` (seed_used=true 런에서 workflow 02 seed evidence expansion 산출물; 동일한 hash strict-check 대상)
- **workflow 02 Gemini source discovery 산출물** (워크플로 핸드오프 상태 — `validateMergedManifestSchema`가 `llm_used=true` 또는 `merge_mode='gemini_source_discovery'`인 경우 strict-check하므로 반드시 Git에 커밋해야 합니다. workflow 03이 이 파일들을 main에서 읽을 수 있어야 합니다):
  - `articles/content/newsroom/YYYY-MM-DD/gemini-usage-report.json` (`usage_report` 필드 strict-check 대상)
  - `articles/content/newsroom/YYYY-MM-DD/gemini-source-proposals.json` (workflow 02 Gemini 제안 원문; manifest 참조 파일)
  - `articles/content/newsroom/YYYY-MM-DD/source-clusters.json` (`source_clusters` 필드 strict-check 대상)
  - `articles/content/newsroom/YYYY-MM-DD/evidence-validation-report.json` (`evidence_validation_report` 필드 strict-check 대상)
  - `articles/content/newsroom/YYYY-MM-DD/gemini-source-proposal-validation-report.json` (`proposal_validation_report` 필드 strict-check 대상)
  - `articles/content/newsroom/YYYY-MM-DD/extracted-source-facts.json` (workflow 02 소스 사실 추출 결과; manifest 참조 파일)

### debug_heavy (Actions + manifest만, 커밋 제외)

- `shortlisted-candidates.json`, `article-capsules.json`
- `editor-draft.{json,md}`, `reporter-candidates.json`
- `linked-evidence-report.json`, `event-bundles.json`, `background-context.json`
- `seed-fetch-report.json`, `seed-merge-report.json`
- `source-change-events.json`
- `recovery-prompt.md` — heavy LLM prompt dump (~10 MB 규모). Git에 커밋하지 않음; GitHub Actions artifact `newsroom-final-debug-<run_id>` + `artifact-manifest.json` → `retained_heavy_artifacts`에서 조회.
- `articles/content/collected-news/YYYY-MM-DD/` 순수 디버그 파일 (파이프라인 입력 파일 제외):
  - `gemini-candidates.json`

> **`editor-draft.{json,md}`는 리뷰 신뢰원(source of truth)이 아닙니다.** debug_heavy 등급이라 커밋되지 않으므로, 로컬 디스크에 남은 `editor-draft.{json,md}`는 커밋된 review artifact를 만든 run이 아니라 **리뷰어의 이전(로컬) `generate` run이 남긴 미커밋 잔재**일 수 있습니다(예: 위클리 incremental로 기사가 나중 run에 추가되면, 로컬 editor-draft는 기사가 더 적은 중간 상태만 담을 수 있음). 발행된 실제 내용을 리뷰할 때는 커밋되는 `review_required_compact` artifact(`newsletter.md`·`quality-report.{json,md}`·`retry-history.{json,md}`)를 신뢰원으로 보세요 — 이들은 한 run에서 함께 커밋되어 서로 일관됩니다. 같은 이유로 로컬 `validate:quality`가 stale editor-draft를 재채점해 거짓 stale을 낼 수 있는데(clean clone·CI에는 editor-draft가 없어 재현 안 됨), 로컬 `editor-draft.json`을 치우고 다시 실행하면 해소됩니다.

### transient_attempt (Actions + manifest만, 커밋 제외)

- `*-attempt-*.{json,md}`, `*-repair-attempt-*`, `*-completion-attempt-*` 패턴 매칭 파일

## Compact Manifest 필드

`retained_heavy_artifacts[]` 항목 구조:

```json
{
  "path": "articles/content/newsroom/YYYY-MM-DD/shortlisted-candidates.json",
  "size": 1234567,
  "sha256": "...",
  "retention_grade": "debug_heavy",
  "retention_location": "github-actions-artifact:newsroom-final-debug-<run_id>"
}
```

`committed_artifacts[]` 항목은 매니페스트를 만든 시점에 존재하면서 `retention_grade`가 `public_source_of_truth` 또는 `review_required_compact`인 파일의 목록입니다. 항목 구조:

```json
{
  "path": "articles/content/newsroom/YYYY-MM-DD/quality-report.json",
  "retention_grade": "review_required_compact"
}
```

- `path`는 저장소 기준 상대 경로입니다.
- `size`·`sha256`은 담지 않습니다(`schema_version` 4부터). 커밋되는 파일의 실제 바이트는 **Git tree가 정본**이므로 `committed_artifacts[]`는 사본을 두지 않습니다. 파일이 그 run에서 어떤 바이트였는지 알아야 하면 해당 커밋의 Git tree를 보세요.
- 같은 매니페스트의 `files[]`와 `review_artifacts[]`도 `size`·`sha256`을 담지 않습니다(`schema_version` 5부터). 두 배열이 담던 값은 같은 항목의 사본이었고 같은 이유로 커밋되는 순간부터 어긋났습니다. `files[]` 항목은 `path`만, `review_artifacts[]` 항목은 리뷰 안내 metadata만 담습니다.
- `size`·`sha256`이 남아 있는 배열은 `retained_heavy_artifacts[]` 하나뿐입니다. 그 파일들은 Git에 커밋되지 않아 Git tree라는 정본이 없고, 해시가 Actions artifact 안의 파일을 식별하는 유일한 수단입니다.
- **`schema_version=2` 매니페스트 2개(2026-05-28·05-29)는 예외입니다.** 두 배열에서 `size`·`sha256`을 똑같이 뺐지만 스탬프는 2로 남겼습니다. 그 파일들에는 `committed_artifacts[]`·`retained_heavy_artifacts[]` 자체가 없어서 5로 올리면 없는 필드를 가졌다고 거짓 주장하게 됩니다(PR #949가 2→4 bump을 거부한 것과 같은 이유). 그래서 "스탬프는 2인데 항목 모양은 5"인 상태이고, 감사할 때 그 두 파일에 바이트 필드가 없는 것은 정상입니다.

## 매니페스트 경로 규약

`artifact-manifest.json`의 `files[]`·`review_artifacts[]`·`retained_heavy_artifacts[]`·`committed_artifacts[]`가 기록하는 경로는 **날짜 구간에 따라 두 규약으로 갈립니다.** 경계는 공개 출력물을 `articles/` 아래로 옮긴 #262 phase 6(2026-06-13 머지)입니다.

| 매니페스트 날짜 | 경로 규약 | 예 |
|------|------|------|
| 2026-06-12까지 | `articles/` 접두 **없음** — 그 시점에는 공개 출력물이 저장소 루트에 있었습니다 | `content/newsroom/...`, `data/newsletters.json`, `newsletters/...`, `sitemap.xml` |
| 2026-06-13부터 | 저장소 루트 기준 | `articles/content/newsroom/...`, `articles/data/newsletters.json`, `state/article-exposure-history.json` |

실제로 커밋된 매니페스트는 옛 규약 8개(2026-05-28~06-11)와 루트 기준 13개(2026-06-16~08-17)이고, 2026-06-12~06-15 날짜의 매니페스트는 없습니다. 그런데도 경계를 첫 관측 날짜인 06-16이 아니라 **06-13으로 잡은 이유는 규약을 바꾼 원인이 관측이 아니라 머지이기 때문입니다.** #262 phase 6은 `42fd4ba1`, 2026-06-13 12:29 KST에 머지됐습니다. 06-13 당일 run은 세 번 돌았고(11:14 / 13:21 / 15:32), 머지 뒤의 두 번이 이미 `articles/` 접두로 기록했습니다. 머지 전에 만들어진 옛 규약 사본은 같은 날 `188c10fa`가 orphan으로 지웠으므로, 트리에 남은 06-13 artifact는 전부 루트 기준입니다. 그러므로 06-13 이후 날짜의 매니페스트는 나중에 backfill이나 replay로 만들어져도 생산자가 루트 기준으로 씁니다 — 06-13을 옛 규약 쪽에 두면 그 날짜를 replay할 때 검사만 옛 규약을 요구해 거짓 실패합니다.

- **`schema_version`은 이 차이를 표시하지 않습니다.** `schema_version=5`가 두 규약에 모두 걸쳐 있습니다(2026-05-30~06-11은 옛 규약, 2026-06-16 이후는 루트 기준). 그러므로 경로 규약을 `schema_version`으로 판별하면 안 됩니다. 판별하려면 매니페스트가 놓인 **날짜 디렉터리**를 쓰세요. 규약을 정한 것은 매니페스트가 기술하는 날짜가 아니라 매니페스트가 *쓰인* 시점이고, replay가 옛 날짜를 오늘 다시 쓰면 생산자는 오늘 규약으로 씁니다. 커밋된 매니페스트는 `date` 필드가 전부 디렉터리 이름과 같아 지금은 두 기준이 일치합니다. `src/shared/tooling/validate/artifact-path-convention-check.js`의 잠금 검사도 디렉터리 기준입니다.
- 매니페스트를 읽는 도구는 **두 규약을 모두 해소해야 합니다.** 경로를 그대로 해소해 보고, 실패하면 `articles/`를 앞에 붙여 다시 해소하세요. 이 fallback이 실제로 회수하는 양은 아래 표에 있습니다.
- `.tmp/`·`cache/`·`state/`는 공개 출력물이 아니라 #262의 `articles/` 이동 대상이 아니었으므로 규약 판별에 쓸 수 없습니다. 실측하면 `.tmp/`·`cache/` 경로는 매니페스트에 한 건도 없고, `state/`는 루트 기준 매니페스트에만 39건 나옵니다 — 옛 규약 시절 같은 파일은 `data/article-exposure-history.json`이라 비교할 옛 형태 자체가 없습니다. 규약 판별에 쓸 수 있는 것은 공개 출력물 경로(`content/`·`data/`·`newsletters/`·`sitemap.xml`)뿐입니다.

### 왜 경로를 정규화하지 않았나 (#952)

과거 매니페스트 21개의 경로를 루트 기준으로 통일하지 **않기로 했습니다.** 이득이 없어서가 아닙니다 — 이득을 먼저 재고, 그 이득을 받을 쪽이 없다고 판단해서입니다.

**정규화하면 1011건이 해소됩니다.** 커밋된 매니페스트 21개의 네 배열을 전수로 재면 아래와 같습니다(경로를 그대로 해소해 보고, 실패하면 `articles/` 접두를 붙이거나 떼어 다시 해소한 결과. 2026-08-24 기준, Git 추적 파일 기준으로 재도 같은 값).

| 배열 | 총계 | 미해소 | 정규화로 해소 | 정규화 후 잔여 |
|------|------|------|------|------|
| `files[]` | 1380 | 756 | 338 | 418 |
| `review_artifacts[]` | 1871 | 1132 | 397 | 735 |
| `retained_heavy_artifacts[]` | 368 | 354 | 5 | 349 |
| `committed_artifacts[]` | 887 | 277 | 271 | 6 |
| 합계 | 4506 | 2519 | **1011** | 1508 |

해소되는 1011건은 **전부 `articles/` 접두를 붙여서** 회수됩니다(떼서 회수되는 것은 0건). 그리고 전부 옛 규약 매니페스트 8개에서 나옵니다 — 루트 기준 매니페스트 13개에서 정규화로 해소되는 것은 0건입니다. 남는 1508건은 경로 규약과 무관합니다. `files[]`의 잔여 418건을 예로 들면 debug_heavy 141건·transient_attempt 208건(애초에 커밋하지 않는 등급), `schema_version=2` 매니페스트 2개(2026-05-28·05-29)의 등급 미기록 63건, `data/article-exposure-history.json` 6건(#262에서 `state/`로 **옮겨진** 파일이라 접두 문제가 아님)입니다.

그런데도 정규화하지 않은 이유는 두 가지입니다.

1. **그 1011건을 읽을 주체가 0곳입니다.** 커밋된 매니페스트를 읽어 그 경로를 해소하는 코드가 저장소에 없습니다(`src`·`.github`·`docs` 전수 확인 — 매니페스트를 여는 코드는 쓰는 쪽뿐입니다). 매니페스트는 사람이 읽는 감사 기록으로만 쓰입니다. 해소율이 올라가도 그 값을 소비하는 쪽이 없으므로 이득이 실현되지 않습니다.
2. **비용이 보존 규칙과 정면으로 충돌합니다.** 1011건을 고치려면 과거 매니페스트 8개를 사후에 다시 써야 합니다. 과거 매니페스트는 그 run이 그 시점에 무엇을 만들었는지를 그 시점의 경로로 남긴 감사 기록이라, 다시 쓰면 아래 보존 규칙(`articles/content/newsroom/**` 대량 수정 금지)에 걸립니다.

**이 판단이 뒤집히는 조건은 하나입니다** — 커밋된 매니페스트의 경로를 실제로 해소하는 소비자가 생기는 것. 그때도 첫 수는 정규화가 아니라 소비자 쪽에 위 `articles/` 접두 fallback을 두는 것입니다. 소비자가 여럿 생겨 같은 fallback이 중복되면 그때 정규화를 다시 검토하세요.

대신 규약을 산문이 아니라 **검사로 잠갔습니다.** 확인 지점이 둘로 나뉘어 있습니다(#957).

- **커밋된 매니페스트 전수 스캔** — `npm run check:artifact-path-convention`(`src/shared/tooling/validate/artifact-path-convention-check.js`). 각 매니페스트가 자기 날짜 구간의 규약을 지키는지 확인합니다. `validate` 체인과 `site-01-validate.yml`에서 돕니다.
- **생산자 출력 검사** — `npm run test:artifact`(`src/shared/tooling/cli/test-artifact-manifest.js`). `buildManifest`·`buildDateReviewManifest`가 새로 만드는 매니페스트가 반드시 저장소 루트 기준인지 확인합니다.

그래서 새 매니페스트가 옛 규약으로 쓰이면 `npm run test`가, 과거 매니페스트가 조용히 정규화되면 `npm run check:artifact-path-convention`이 실패합니다.

**전수 스캔을 `npm run test`에 두지 않는 이유**는 그 스크립트가 워크플로 01·03에서 수집·생성 앞의 blocking 스텝이기 때문입니다. 거기 두면 커밋된 매니페스트 하나가 규약을 어겼을 때 그 주 run이 수집을 시작하기도 전에 멈춥니다 — 코드 결함이 아니라 데이터 파일 하나가 파이프라인을 막는 모양이 됩니다. `check:artifact-retention`이 커밋된 산출물을 훑되 파이프라인을 막지 않는 것과 같은 배치입니다.

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

`newsletters-01-source-collect-pr.yml`과 `newsletters-02-source-discovery-pr.yml`은 candidate JSON 자체가 리뷰 대상이므로 candidate JSON을 의도적으로 커밋합니다. 이 워크플로에는 `add-paths` 허용목록 제한을 적용하지 않습니다.

파이프라인 입력 파일(candidates.json, manual-candidates.json, raw-candidate-manifest.json, merged-candidates.json, merged-candidate-manifest.json, collection-intent.json, seed-candidates.json, seed-evidence-pack.json)은 `review_required_compact` 등급 파일로서, workflow 01 → 02 → 03의 핸드오프 상태입니다. 이 파일들은 `.gitignore`에서 제외되며 Git에 항상 커밋됩니다. 순수 디버그 collected-news 파일(gemini-candidates.json)은 여전히 `.gitignore` 처리됩니다.

## 보존 규칙 (Preservation Rules)

- Generated artifact를 `src/shared/test/fixtures/**/good` 또는 golden fixture로 그대로 복사하지 마세요.
- 명시 요청 없이 `articles/content/newsroom/**`, `articles/content/collected-news/**`를 대량 수정하지 마세요.
- `articles/content/newsroom/**`, `articles/content/collected-news/**`의 기존 generated artifact는 대량 수정 대상이 아닙니다.
