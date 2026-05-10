# Test Inventory

이 문서는 issue #82의 `tests/` 구조화 작업을 위한 현재 상태 inventory입니다. 목적은 test folder migration 전에 test, fixture, helper의 책임과 이동 후보를 고정하는 것입니다. 이 문서는 runtime behavior, quality gate, source selection, publish gate 정책을 변경하지 않습니다.

## 현재 Runner 계약

현재 branch에서 2026-05-11 KST 기준으로 확인했습니다.

| Command | 현재 동작 | 결과 |
| --- | --- | --- |
| `npm.cmd run test` | `npm run test:unit`와 `npm run test:script`를 순서대로 실행합니다. | 통과. `node --test` 기준 373개 test가 pass했고 script test 2개도 통과했습니다. |
| `npm.cmd run test:unit` | `node --test "tests/**/*.test.js"`를 실행합니다. | 현재 root와 nested test 373개를 실행하며, 향후 nested test folder도 발견합니다. |
| `npm.cmd run test:script` | `node scripts/test-artifact-manifest.js && node scripts/test-selection-diagnostics.js`를 실행합니다. | 통과. |

중요 제약: runner는 nested-aware command로 전환했습니다. Slice 8 이후 새 root `tests/*.test.js` 추가는 `tests/root-test-allowlist.json` guard로 제한하고, 새 test는 목적별 nested folder에 둡니다.

## 분류 기준

| Category | 의미 | Migration 후 target folder |
| --- | --- | --- |
| `unit` | 단일 module 또는 helper 동작 검증입니다. | `tests/unit/<area>/` |
| `contract` | 깨지면 안 되는 policy/gate 동작 검증입니다. | `tests/contract/` |
| `workflow` | 여러 artifact, PR body, publish status, generation status 같은 흐름 검증입니다. | `tests/workflow/` |
| `fixture-trust` | fixture policy와 provenance 검증입니다. | `tests/contract/` 또는 `tests/hygiene/` |
| `hygiene` | repo, encoding, docs, template, config, localization 검증입니다. | `tests/hygiene/` |

Generated artifact dependency는 아래처럼 분류합니다.

| Value | 의미 |
| --- | --- |
| `none` | generated artifact path 또는 file을 사용하지 않습니다. |
| `path-contract` | path parsing 또는 output shape 검증을 위해 generated artifact path string을 사용합니다. quality golden으로 쓰지 않습니다. |
| `temp-artifact` | test 안에서 temp root 아래 최소 artifact를 만듭니다. |
| `minimized-regression` | generated artifact 또는 historical run에서 축약한 fixture를 사용합니다. |
| `live-output-smoke` | 현재 tracked generated output을 smoke/integration 입력으로만 읽습니다. 이 값은 드물고 명시적이어야 합니다. |

## Test File Inventory

| Test file | Category | 보호하는 contract | Fixture/helper | Generated artifact dependency | Migration target | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/unit/collect/aosp-camera-scope.test.js` | `unit` | Camera relevance bucket classification. | Inline sample. | `none` | `tests/unit/collect/` | Scope/classifier test와 가까운 위치로 이동합니다. |
| `tests/unit/generate/article-capsules.test.js` | `unit` | Compact article capsule shape와 prompt input trimming. | Inline `candidate()` helper. | `none` | `tests/unit/generate/` | Candidate builder는 후속 helper slice에서 공통화 후보입니다. |
| `tests/unit/collect/collector-relevance.test.js` | `unit` | Collector relevance와 source classification boundary. | `tests/helpers/fixture-loader`, `source-html` fixtures. | `none` | `tests/unit/collect/` | Parser/relevance fixture는 synthetic 기준을 유지합니다. |
| `tests/editor-output-contract.test.js` | `contract` | Editor output schema, repair contract, diagnostic artifact. | Local temp/read helper. | `temp-artifact` | `tests/contract/` | Temp/read helper 공통화 후보입니다. |
| `tests/unit/generate/fact-check-repair.test.js` | `unit` | Fact-check repair filtering. | Inline section helper. | `none` | `tests/unit/generate/` | Slice 5에서 이동했습니다. |
| `tests/fixture-policy.test.js` | `fixture-trust` | `good` fixture curated 여부, `bad` fixture PASS 금지, blocker flag PASS golden 금지. | `tests/helpers/fixture-loader`. | `none` | `tests/contract/` 또는 `tests/hygiene/` | Fixture ledger slice에서 유지/확장합니다. |
| `tests/unit/common/gemini-client.test.js` | `unit` | Gemini client retry, fallback, cost, usage metadata. | Inline fake Gemini helper. | `none` | `tests/unit/common/` | Provider-specific raw response fixture는 adapter 영역에만 둡니다. |
| `tests/generation-status.test.js` | `unit` | Generation status parsing과 editorial reviewability field. | Inline sample. | `none` | `tests/unit/common/` | Low-risk move 후보입니다. |
| `tests/homepage-archive.test.js` | `unit` | Homepage inline script의 latest/archive rendering. | `index.html`에서 script 추출, inline DOM shim. | `path-contract` | `tests/unit/render/` | Public data path contract를 검증하며 generated issue quality 기준은 아닙니다. |
| `tests/unit/evidence/impact-classifier.test.js` | `unit` | Linked evidence impact classifier enum과 conservative recommendation. | Inline evidence helper. | `none` | `tests/unit/evidence/` | Slice 5에서 이동했습니다. |
| `tests/linked-evidence-diagnostics.test.js` | `workflow` | Linked evidence diagnostics artifact 생성과 후보별 failure isolation. | Temp dir, inline candidate. | `temp-artifact` | `tests/workflow/` | Temp/write helper 공통화 후보입니다. |
| `tests/linked-evidence-extractor.test.js` | `unit` | Supported evidence type link extraction. | `linked-evidence` text/html fixtures. | `none` | `tests/unit/evidence/` | Low-risk move 후보입니다. |
| `tests/linked-evidence-resolver.test.js` | `unit` | Resolver fetch behavior, blocked/failed/unsupported status, payload cap. | `fixture-loader`, fake fetch helper. | `none` | `tests/unit/evidence/` | Fake fetch helper 공통화 후보입니다. |
| `tests/unit/evidence/linked-evidence-schema.test.js` | `unit` | Linked evidence normalization shape와 compatibility. | Inline sample. | `none` | `tests/unit/evidence/` | Slice 5에서 이동했습니다. |
| `tests/unit/common/llm-client.test.js` | `unit` | Provider-agnostic LLM client와 internal provider behavior. | Inline fake fetch. | `none` | `tests/unit/common/` | Resolver test와 fake fetch helper를 공유할 수 있습니다. |
| `tests/unit/common/news-summary-cache.test.js` | `unit` | Summary cache key와 diagnostics. | Local `tempDir()`, candidate helper. | `none` | `tests/unit/common/` | Temp helper 공통화 후보입니다. |
| `tests/newsletter-quality.test.js` | `contract` | Quality gate hard blocker, article composition policy, source binding, linked evidence overclaim check. | `tests/helpers/quality-builders`, `quality` bad/good fixtures. | `minimized-regression` | `tests/contract/` | Large file입니다. helper와 fixture ledger 이후에만 분할합니다. |
| `tests/newsroom-selection.test.js` | `contract` | Deterministic selection, eligibility, fallback composition, exclusion reason. | `fixture-loader`, `selection` bad/good fixtures, inline builders. | `minimized-regression` | `tests/contract/` | Large file입니다. builder extraction 후 분할합니다. |
| `tests/policy-docs.test.js` | `hygiene` | Policy docs generated block marker와 drift detection. | Temp root. | `none` | `tests/hygiene/` | Temp helper 공통화 후보입니다. |
| `tests/pr-template.test.js` | `hygiene` | Split PR template contract와 localization scan coverage. | Direct template read. | `none` | `tests/hygiene/` | Low-risk move 후보입니다. |
| `tests/rendered-issue-structure.test.js` | `contract` | Rendered Markdown/HTML structural validator와 site validator agreement. | `tests/helpers/fs.js`, rendered fixture builder. | `temp-artifact` | `tests/contract/` 또는 `tests/unit/validate/` | Local temp/write helper 중복은 Slice 7에서 제거했습니다. |
| `tests/hygiene/repo-hygiene.test.js` | `hygiene` | Root scratch, repo hygiene, root test allowlist guard. | Inline path sample, `tests/root-test-allowlist.json`. | `none` | `tests/hygiene/` | Slice 8에서 root test drift guard를 추가했습니다. |
| `tests/unit/common/runtime-config.test.js` | `unit` | Runtime env parsing과 provider policy. | Inline env helper. | `none` | `tests/unit/common/` | Low-risk move 후보입니다. |
| `tests/selection-report-artifact.test.js` | `workflow` | Deterministic pre-LLM failure artifact와 selection report output. | Temp root, generated status artifact. | `temp-artifact` | `tests/workflow/` | Minimal temp artifact만 사용합니다. |
| `tests/source-effectiveness-report.test.js` | `workflow` | Source effectiveness report aggregation과 artifact writing. | `source-effectiveness` fixture, temp root. | `temp-artifact` | `tests/workflow/` | Fixture ledger에서 `workflow-shape`로 표시해야 합니다. |
| `tests/unit/collect/source-item-parsers.test.js` | `unit` | Source parser row extraction과 dated evidence rule. | `source-html` fixtures. | `none` | `tests/unit/collect/` | Low-risk move 후보입니다. |
| `tests/stale-claims.test.js` | `unit` | Stale claim scrub와 retention behavior. | Inline source/section. | `none` | `tests/unit/validate/` | Low-risk move 후보입니다. |
| `tests/targeted-retry.test.js` | `contract` | Targeted retry, repair validation, source lock preservation, failed repair reviewability. | `tests/helpers/newsroom-builders`, inline sample. | `temp-artifact` | `tests/contract/` | `workflow-scripts` helper 검토 후 helper extraction 후보입니다. |
| `tests/hygiene/text-encoding.test.js` | `hygiene` | Encoding detector, BOM, replacement char, text path allowlist. | Inline buffer. | `none` | `tests/hygiene/` | Slice 5에서 이동했습니다. |
| `tests/unit/config/validate-config.test.js` | `unit` | Source registry config validation. | Inline valid registry helper. | `none` | `tests/unit/config/` | Low-risk move 후보입니다. |
| `tests/validation-targets.test.js` | `unit` | Changed artifact date detection과 strict target-date selection. | Inline path string. | `path-contract` | `tests/unit/validate/` | Path string 자체가 검증 대상입니다. |
| `tests/validator-strictness.test.js` | `contract` | Historical vs strict `validate-site`와 `validate-quality` behavior. | `tests/helpers/fs.js`, minimal artifact. | `temp-artifact` | `tests/contract/` | Local temp/write helper 중복은 Slice 7에서 제거했습니다. |
| `tests/workflow-scripts.test.js` | `workflow` | PR body, publish status, fallback builder, reviewable artifacts, workflow wiring, publication annotation. | 많은 local temp/write/build helper. | `temp-artifact` | `tests/workflow/` | 가장 큰 파일입니다. helper extraction과 contract mapping 이후에만 분할합니다. |

## Script Test Inventory

| Script | Current runner | Role | Migration note |
| --- | --- | --- | --- |
| `scripts/test-artifact-manifest.js` | `npm.cmd run test:script` | `scripts/newsroom/cli/test-artifact-manifest.js` compatibility wrapper. | #85에서 script wrapper compatibility를 다루기 전까지 유지합니다. |
| `scripts/test-selection-diagnostics.js` | `npm.cmd run test:script` | `scripts/newsroom/cli/test-selection-diagnostics.js` compatibility wrapper. | #85에서 script wrapper compatibility를 다루기 전까지 유지합니다. |
| `scripts/test-article-image-fallback-contract.js` | 현재 `test:script`에 포함되지 않음. | Image fallback contract test compatibility wrapper. | Inventory만 남깁니다. #82 Slice 1에서 wire/delete하지 않습니다. |

## Fixture Inventory

| Fixture area | 현재 file 수 | 목적 | Trust status | Follow-up |
| --- | ---: | --- | --- | --- |
| `tests/fixtures/linked-evidence/` | 4 | Extractor/resolver용 synthetic text/html. | Curated synthetic. | Fixture ledger slice에서 ledger entry를 추가합니다. |
| `tests/fixtures/quality/good/` | 1 | PASS quality-gate sample. | Curated, non-generated여야 합니다. | Ledger metadata와 guard 확장 대상입니다. |
| `tests/fixtures/quality/bad/` | 3 | Quality hard-fail과 regression sample. | Bad/regression이며 `PASS`를 기대하면 안 됩니다. | Provenance와 protected contract metadata를 추가합니다. |
| `tests/fixtures/quality/borderline/` | `.gitkeep` | Reserved. | Empty. | Final fixture audit에서 유지/삭제를 결정합니다. |
| `tests/fixtures/selection/good/` | 1 | PASS selection sample. | Curated, non-generated여야 합니다. | Ledger metadata와 guard 확장 대상입니다. |
| `tests/fixtures/selection/bad/` | 2 | Selection exclusion sample. | Bad/regression이며 PASS golden이 되면 안 됩니다. | Provenance와 protected contract metadata를 추가합니다. |
| `tests/fixtures/selection/borderline/` | `.gitkeep` | Reserved. | Empty. | Final fixture audit에서 유지/삭제를 결정합니다. |
| `tests/fixtures/source-effectiveness/` | 1 | Source effectiveness reporting workflow-shape fixture. | Synthetic workflow fixture. | Quality golden이 아니라 `workflow-shape`로 ledger에 표시합니다. |
| `tests/fixtures/source-html/` | 13 | Parser source HTML fixture. | Curated synthetic/minimized source page. | Parser unit test 아래 유지합니다. |
| `tests/fixtures/artifacts/` | `.gitkeep` | Reserved artifact fixture area. | Empty. | Generated dependency cleanup에서 결정합니다. |
| `tests/fixtures/retry/` | `.gitkeep` | Reserved retry fixture area. | Empty. | Targeted retry/helper cleanup에서 결정합니다. |

## Helper Inventory

| Helper file | 현재 consumer | 책임 | Follow-up |
| --- | --- | --- | --- |
| `tests/helpers/fixture-loader.js` | Fixture policy, parser, extractor, quality, selection tests. | Safe fixture path resolution과 JSON/text fixture loading. | 유지합니다. 필요하면 ledger helper를 추가합니다. |
| `tests/helpers/fs.js` | Policy, source effectiveness, selection artifact, rendered structure, validator strictness tests. | Temp root, JSON/text write, JSON read helper. | Shared Test Helpers slice에서 추가했고 Slice 7에서 명확한 duplicate helper를 추가 치환했습니다. |
| `tests/helpers/artifact-builders.js` | Artifact manifest tests. | Minimal artifact manifest entry builder. | 유지합니다. Workflow helper naming으로 정리할 수 있습니다. |
| `tests/helpers/newsroom-builders.js` | Targeted retry tests. | Candidate와 retry section builder. | 더 넓은 newsroom builder로 확장 후보입니다. |
| `tests/helpers/quality-builders.js` | Newsletter quality tests. | Quality report section과 reporter candidate builder. | Large quality tests의 duplicated fixture logic을 흡수할 수 있습니다. |

## 중복 Helper 후보

아래 pattern은 여러 test file에 반복됩니다. Runner와 inventory slice 이후에 처리합니다.

| Pattern | 현재 예시 | Suggested shared helper |
| --- | --- | --- |
| `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 기반 temp root 생성 | `editor-output-contract`, `news-summary-cache`, `workflow-scripts` | `tests/helpers/fs.js`를 사용하도록 점진적으로 전환합니다. |
| `writeJson` / `writeText` helper | `workflow-scripts` | `tests/helpers/fs.js`를 사용하도록 점진적으로 전환합니다. |
| Minimal newsletter/public artifact builder | `rendered-issue-structure`, `validator-strictness`, `workflow-scripts` | `tests/helpers/newsletter-fixtures.js` |
| Markdown section extraction/order assertion | `workflow-scripts`와 PR body tests | `tests/helpers/markdown-assertions.js` |
| Candidate/source builder helper | `article-capsules`, `newsroom-selection`, `newsletter-quality`, `targeted-retry` | Domain-specific builder under `tests/helpers/` |

## 8-Slice 상태

| Slice | Status | Notes |
| --- | --- | --- |
| 1. Inventory + Guide | Complete | 이 문서와 `tests/README.md`입니다. |
| 2. Nested Runner Preparation | Complete | `test:unit`을 nested-aware glob로 변경하고 기존 flat runner와 비교 검증했습니다. |
| 3. Fixture Ledger + Trust Guard | Complete | `fixture-ledger.json`과 `check:fixtures`로 fixture provenance와 trust guard를 검증합니다. |
| 4. Shared Test Helpers | Complete | `tests/helpers/fs.js`를 추가하고 low-risk temp/write helper 중복을 먼저 치환했습니다. |
| 5. Test Folder Migration 1 | Complete | Low-risk unit/hygiene test 5개를 nested folder로 이동했습니다. |
| 6. Generated Artifact Dependency Cleanup | Complete | Generated regression fixture provenance를 ledger-local metadata로 제한하고 generated artifact path embedding을 guard합니다. |
| 7. Duplicate/Obsolete Test Cleanup | Complete | 명확한 local temp/write helper 중복을 제거했고 large workflow helper는 후속 후보로 남겼습니다. |
| 8. Structure Guard + Final Audit | Complete | `tests/root-test-allowlist.json`과 repo hygiene guard로 신규 root test drift를 차단합니다. |
