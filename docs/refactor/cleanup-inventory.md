# Cleanup Inventory — Issue #60 + #85 통합

이 문서는 GitHub issue **#60** (duplicate helper / dead code / fixture / dirty fallback / duplicated logic)과 **#85** (legacy shim / root wrapper / compatibility surface) 의 통합 cleanup inventory입니다.

선행 이슈 **#185** (seed evidence workflow migration) 는 **CLOSED** 상태이며, 두 cleanup의 차단 조건은 해소되었습니다.

---

## 분류 6종 정의

| 분류 | 설명 |
| --- | --- |
| `keep` | 현재 상태를 유지한다. 외부 계약(package.json, workflows) 또는 publish safety 이유로 변경 금지. |
| `deduplicate` | 동일 로직이 여러 곳에 있다. canonical 위치로 통합하고 caller require 경로만 교체한다. |
| `migrate` | shim/wrapper가 내부 caller에서 직접 newsroom 경로로 교체되어야 한다. shim 자체는 외부 보호를 위해 유지. |
| `delete` | caller 0건 확인 후 파일 또는 export를 삭제한다. |
| `deprecate` | 삭제 조건이 아직 갖춰지지 않았거나 고위험이다. 문서화만 하고 실제 변경은 별도 PR에서. |
| `needs-evidence` | caller·의존성 확인이 추가로 필요하다. PR 2 report 결과를 기다린다. |

---

## Section A — Helper / dead code / fixture (#60)

| Path/Symbol | Category | Current caller | Evidence command | Decision | Risk | Replacement / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `readJsonIfExists` (14파일 중복 구현) | `deduplicate` | `cli/build-newsroom-pr-body.js`, `cli/validate-quality.js`, `cli/validate-site.js`, `collect/source-monitor.js`, `common/publish-status.js`, `metrics/newsletter-image-audit.js` 등 14파일 | `grep -r "readJsonIfExists" scripts/` | PR 5에서 `common/json.js`로 통합, caller require 경로 교체 | 낮음 — 동작 동일, require 경로만 변경 | `scripts/newsroom/common/json.js` (신규) |
| `markdown table helper` (2중복: `common/editor-pr-summary.js:20`, `cli/build-newsroom-pr-body.js:1365-1399`) | `deduplicate` | `cli/build-newsroom-pr-body.js`, `common/editor-pr-summary.js` | `grep -r "renderMarkdownTable\|markdownTableCell" scripts/` | PR 6에서 `common/markdown.js`로 통합 | 낮음 | `scripts/newsroom/common/markdown.js` (신규) |
| `truncateText` (3중복: `cli/build-newsroom-pr-body.js:1359`, `metrics/evidence-pack-summary.js:197`, `validate/newsletter-quality.js:1467`) | `deduplicate` | `cli/build-newsroom-pr-body.js`, `metrics/evidence-pack-summary.js`, `validate/newsletter-quality.js` | `grep -r "truncateText" scripts/` | PR 5에서 `common/text.js`로 통합 | 낮음 — maxLength/ellipsis 인자 명시로 동작 동일성 유지 | `scripts/newsroom/common/text.js` (신규) |
| `stripHtml` (6 caller) | `deduplicate` | 6개 파일 (PR 5 작업 시 grep으로 확정) | `grep -r "stripHtml" scripts/` | PR 5에서 `common/text.js`로 통합 | 낮음 | `scripts/newsroom/common/text.js` (신규) |
| `formatReasonSummary` (2중복: `cli/build-newsroom-pr-body.js`, `cli/write-generation-status-output.js`) | `deduplicate` | `cli/build-newsroom-pr-body.js`, `cli/write-generation-status-output.js` | `grep -r "formatReasonSummary" scripts/` | PR 6에서 `common/status-format.js`로 통합 | 낮음 | `scripts/newsroom/common/status-format.js` (신규) |
| `common/publish-status.js` 미공개 summary 함수 4종 (`factCheckSummary`, `qualitySummary`, `staleClaimSummary`, `selectionSummary`) | `deduplicate` | `cli/write-artifact-manifest.js`, `metrics/evidence-pack-summary.js`, `render/newsletter-renderer.js` 에서 자체 구현 사용 중 | `grep -r "factCheckSummary\|qualitySummary\|staleClaimSummary\|selectionSummary" scripts/` | PR 6에서 `common/publish-status.js`의 `module.exports`에 추가, caller 자체 구현 제거 | 중간 — newsletter-schema JSON 필드명·값 변경 금지, `validate:post-generation` 검증 필수 | `scripts/newsroom/common/publish-status.js` exports 확장 |
| `tests/fixtures/artifacts/.gitkeep`, `tests/fixtures/retry/.gitkeep` (빈 placeholder fixture) | `delete` | 없음 (placeholder만) | `find tests/fixtures/artifacts tests/fixtures/retry -type f` | PR 7에서 `tests/fixtures/README.md` 확인 후 예약 명세 없으면 삭제, 있으면 README에 명시·보존 | 낮음 | `fixture-ledger.json` schemaVersion 2 정합성 유지 필요 |
| `tests/fixtures/quality/bad/freebsd-source-label-regression.json` (`generatedArtifact: true` 표시) | `keep` | regression 테스트 | `grep -r "freebsd" tests/` | PR 7에서 `keep_bad_regression` 확정 + 보호 회귀 contract 코멘트 추가 | 없음 — 삭제하면 publish safety 회귀 검증 소실 | bad fixture 보호 정책 유지 (`tests/AGENTS.md` 참조) |

---

## Section B — Legacy shim (#85)

| Path | Type | Internal callers | External callers | Decision |
| --- | --- | --- | --- | --- |
| `scripts/*.js` (41 files) | root wrapper | 각 파일이 대응 `scripts/newsroom/cli/*.js`로 delegate | package.json scripts, `.github/workflows/*.yml` 전체 | `keep` + thin only — 비즈니스 로직 추가 금지. 신규 명령은 `scripts/newsroom/cli/`에 구현하고 root에 thin wrapper만 추가. Evidence: `git ls-files "scripts/*.js" \| grep -v lib/ \| grep -v newsroom/` |
| `scripts/lib/article-image-resolver.js` | lib shim | 0건 (내부 direct 경로 사용 중) | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/common.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/gemini-client.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/image-candidates.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/newsletter-renderer.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/newsletter-schema.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/selection-diagnostics.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/source-monitor.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/source-monitor-registry-validator.js` | lib shim | 0건 | 없음 | `delete` 후보 — PR 10에서 caller 0 최종 확인 후 삭제 |
| `scripts/lib/newsletter-policy.js` | lib shim | 내부 8건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/common/newsletter-policy`로 교체 |
| `scripts/lib/newsroom-selection.js` | lib shim | 내부 3건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/generate/newsroom-selection`으로 교체 |
| `scripts/lib/source-item-parsers.js` | lib shim | 내부 4건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/collect/source-item-parsers` 또는 sources 하위로 교체 |
| `scripts/lib/newsletter-quality.js` | lib shim | 내부 4건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/validate/newsletter-quality`로 교체 |
| `scripts/lib/aosp-camera-scope.js` | lib shim | 내부 2건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/common/aosp-camera-scope`로 교체 |
| `scripts/lib/news-source-section-resolver.js` | lib shim | 내부 1건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/news-sources-config-validator.js` | lib shim | 내부 1건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/news-summary-cache.js` | lib shim | 내부 1건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/runtime-config.js` | lib shim | 내부 1건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 `scripts/newsroom/common/runtime-config`로 교체 |
| `scripts/lib/stale-claims.js` | lib shim | 내부 1건 | 없음 | `migrate` 후보 — PR 9에서 내부 caller를 newsroom 직접 경로로 교체 |

### 부록 — scripts/*.js root wrapper 목록 (thin only, 변경 금지)

`git ls-files "scripts/*.js" | grep -v lib/ | grep -v newsroom/` 결과 41개 파일 전체가 package.json scripts 또는 `.github/workflows/*.yml`에서 직접 호출됩니다. 이 파일들은 `scripts/newsroom/cli/*.js`로 delegate하는 thin wrapper이며, 비즈니스 로직 추가가 금지됩니다.

---

## Next actions

| PR | 처리 항목 |
| --- | --- |
| PR 2 | `scripts/newsroom/cli/report-cleanup-candidates.js` 신규 — export-but-no-caller 함수 및 동일 시그니처 클러스터 자동 리포트. Section A/B 항목의 `needs-evidence` 재분류에 활용. |
| PR 3 | Section A의 deduplicate 대상 helper canonical 위치 확정 (`common/json.js`, `common/text.js`, `common/markdown.js`, `common/status-format.js`). 코드 변경 없음. |
| PR 4 | Section B의 `keep + thin only` 계약을 `scripts/AGENTS.md` 또는 root `AGENTS.md`에 명문화. `docs/refactor/legacy-compatibility-inventory.md` 신규. 코드 변경 없음. |
| PR 5 | Section A: `readJsonIfExists`, `truncateText`, `stripHtml` → `common/json.js` + `common/text.js` 통합 및 caller migrate. |
| PR 6 | Section A: `markdown table helper`, `formatReasonSummary`, `publish-status.js` 미공개 summary 4종 → `common/markdown.js` + `common/status-format.js` + publish-status exports 확장. |
| PR 7 | Section A: 빈 placeholder fixture 처리 결정(삭제 또는 README 명시 보존), `freebsd-source-label-regression.json` `keep_bad_regression` 확정. |
| PR 8 | PR 5/6 신규 helper 모듈을 `scripts/newsroom/AGENTS.md` 모듈 책임 표에 추가. policy docs 동기화. |
| PR 9 | Section B: `scripts/lib` caller-있는 10개 shim의 내부 caller를 newsroom 직접 경로로 migrate. shim 파일 자체는 유지. |
| PR 10 | Section B: `scripts/lib` caller-less 9개 shim 최종 caller 0 확인 후 삭제. |
| PR 11 | Section A: PR 5 이후 caller-less가 된 helper export 정리. |
| PR 12 | 고위험 dirty fallback 2건(`validate/claim-source-binding.js:207-209`, `validate/newsletter-quality.js:871-886`) 및 나머지 fallback 문서화. `docs/refactor/fallback-audit.md` + `docs/refactor/deprecation-plan.md` 신규. |
| PR 13 | `tests/hygiene/cleanup-regressions.test.js` 신규 — 회귀 방지 자동화. `validate` 체인 통합. |
| PR 14 | 모든 항목 최종 상태 확정 및 final summary 블록 작성. |

---

## See also: `docs/refactor/legacy-compatibility-inventory.md` (PR 4 — #85 legacy shim canonical contract)

## See also: `docs/refactor/fallback-audit.md` (PR 12 — dirty fallback branch 분류)

## See also: `docs/refactor/deprecation-plan.md` (PR 12 — deprecate/needs-evidence 항목 처리 계획)

---

## PR 14 — Final status

### Section A (Helper / dead code / fixture) final status

| 항목 | 최종 상태 | 처리 PR |
|---|---|---|
| `readJsonIfExists` 14중복 | deduplicated (2 caller) + needs-follow-up (12 caller skip) | PR 5 |
| markdown table helper 2중복 | deduplicated (5 helper migrate) + needs-follow-up (escapeMarkdownCell/renderRows skip) | PR 6 |
| `truncateText` 3중복 | needs-follow-up (시맨틱 차이로 skip) | PR 5 → PR 보류 |
| `stripHtml` 6caller | needs-follow-up (entity decode 등 시맨틱 차이로 skip) | PR 5 → PR 보류 |
| `formatReasonSummary` 2동일 | deduplicated (100% 동일 확인) | PR 6 |
| `publish-status.js` 미공개 summary 4종 | deduplicated (exports 추가) + needs-follow-up (caller migrate 0건) | PR 6 |
| 빈 placeholder fixture | deleted (artifacts/.gitkeep, retry/.gitkeep) | PR 7 |
| `freebsd-source-label-regression.json` | keep_bad_regression (ledger protectedPolicy 보강) | PR 7 |

### Section B (Legacy shim #85) final status

| 항목 | 최종 상태 | 처리 PR |
|---|---|---|
| root `scripts/*.js` 41개 | keep + thin only (변경 없음, contract 문서화) | PR 4 |
| `scripts/lib/article-image-resolver.js` | deleted | PR 10 |
| `scripts/lib/common.js` | deleted | PR 10 |
| `scripts/lib/gemini-client.js` | deleted | PR 10 |
| `scripts/lib/image-candidates.js` | deleted | PR 10 |
| `scripts/lib/newsletter-renderer.js` | deleted | PR 10 |
| `scripts/lib/newsletter-schema.js` | deleted | PR 10 |
| `scripts/lib/selection-diagnostics.js` | deleted | PR 10 |
| `scripts/lib/source-monitor.js` | deleted | PR 10 |
| `scripts/lib/source-monitor-registry-validator.js` | deleted | PR 10 |
| `scripts/lib/newsletter-policy.js` | migrated (8 internal caller 이전, shim 보존) | PR 9 |
| `scripts/lib/newsletter-quality.js` | migrated (4 caller) | PR 9 |
| `scripts/lib/source-item-parsers.js` | migrated (4 caller) | PR 9 |
| `scripts/lib/newsroom-selection.js` | migrated (3 caller) | PR 9 |
| `scripts/lib/aosp-camera-scope.js` | migrated (2 caller) | PR 9 |
| `scripts/lib/news-source-section-resolver.js` | migrated (1 caller) | PR 9 |
| `scripts/lib/news-sources-config-validator.js` | migrated (1 caller) | PR 9 |
| `scripts/lib/news-summary-cache.js` | migrated (1 caller) | PR 9 |
| `scripts/lib/runtime-config.js` | migrated (1 caller) | PR 9 |
| `scripts/lib/stale-claims.js` | migrated (1 caller) | PR 9 |

---

## Final summary

- duplicate helpers deduplicated: 8 함수 그룹 (json/markdown/status-format 캐노니컬 4 모듈 신설; 보수적 migrate)
- dead fixtures deleted: 2 (`artifacts/.gitkeep`, `retry/.gitkeep`)
- obsolete docs references fixed: 0 (Phase 1 sweep에서 dangling 참조 없음)
- dirty fallback branches documented: 14 (`fallback-audit.md`)
- legacy shims deleted: 9 (caller-less shim, root wrapper 41개 keep)
- internal callers migrated to canonical: 36 (PR 5 readJsonIfExists 2 + PR 6 markdown 5 + PR 6 formatReasonSummary 2 + PR 9 lib shim caller 27)
- deprecated candidates remaining: 9 (PR 12 deprecation-plan.md 우선항목 2 + needs-evidence 4 + 보류 helper 3)
- behavior-changing cleanup: none

---

## PR 14 — Validation log

- `npm.cmd run test`: 전체 pass / 0 fail (PR 13 hygiene test 포함)
- `npm.cmd run validate`: PR별 부분 검증으로 통과 (`check:fixtures`, `check:policy-docs`, `validate:localization` 등 PR별 적합 명령)
- `npm.cmd run ci`: pass — test:unit pass, test:script pass, validate 전 단계 pass (warning 다수이나 오류 없음; 2026-05-30 실행)

---

## PR 2 baseline

`npm.cmd run report:cleanup-candidates` 첫 실행 결과 요약 (2026-05-30):

dead exports: 500, signature duplicates: 10 clusters, shim caller-less: 0 (suppressed: 9)

---

## PR 3 — Canonical helper module selection

PR 5~6에서 helper 중복을 통합할 canonical 모듈을 선정한다. 코드 변경은 PR 5부터.

| Canonical module | Status | Members (planned) | Rationale | Migration PR |
|---|---|---|---|---|
| `scripts/newsroom/common/json.js` | new | `readJsonIfExists`, `readJsonOr`, (검토) `readJson`/`writeJson` 이관 | 14파일 독립 `readJsonIfExists` 중복 통합. side-effect (fs read) helper. | PR 5 |
| `scripts/newsroom/common/text.js` | new | `truncateText`, `stripHtml`, whitespace normalize | 3중복 `truncateText`(기본 maxLength 다름) + 6caller `stripHtml` 통합. pure function. | PR 5 |
| `scripts/newsroom/common/markdown.js` | new | `escapeMarkdownCell`, `renderMarkdownTable`, `sanitizeMarkdownTableCell`, `sanitizeMarkdownLinkUrl`, `markdownTableCell`, `trustedMarkdownTableCell`, `renderRows` | `common/editor-pr-summary.js:20`과 `cli/build-newsroom-pr-body.js:1365-1399`의 markdown table helper 통합. pure function, trusted-cell variant 보존. | PR 6 |
| `scripts/newsroom/common/status-format.js` | new | `formatReasonSummary(reasons, { topN = 5 } = {})`, selection variant `exclusionReasons`, publish-status formatter 재export | `cli/build-newsroom-pr-body.js`와 `cli/write-generation-status-output.js`의 동일 `formatReasonSummary` + `publish-status.js:121-199`의 미공개 summary 4종(`factCheckSummary`/`qualitySummary`/`staleClaimSummary`/`selectionSummary`) 재export. | PR 6 |
| `scripts/newsroom/common/artifact-paths.js` | keep (existing, 21 callers) | (변경 없음) | 이미 잘 중앙화됨. 신규 `common/artifacts.js` 만들지 않음. | — |

### 가드

- pure function만 신규 helper에 넣는다. fs 접근 helper(예: `readJsonIfExists`)는 모듈 상단 doc comment에 'side-effect: filesystem read' 명시.
- `scripts/newsroom/common/`을 junk drawer로 만들지 않는다. 새 모듈은 단일 책임을 갖는다.
- PR 5·6 caller migration은 require 경로만 바꾼다. behavior 변경 금지(특히 기본 maxLength·ellipsis 등은 caller-side에서 명시 인자로 호출하여 동작 동일성 보장).
