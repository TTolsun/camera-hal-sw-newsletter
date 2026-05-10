# Tests Guide

이 폴더는 Node built-in test runner로 newsroom automation, quality gate, source selection, rendering, workflow, repository hygiene 계약을 보호합니다. Production validator를 약화하거나 fixture 기대값을 낮춰서 test를 통과시키지 않습니다.

상세 test inventory와 migration 기록은 `docs/testing/test-inventory.md`를 기준으로 봅니다. 이 파일은 새 test를 어디에 둘지, 어떤 fixture/helper 계약을 지킬지 결정하는 짧은 작업 가이드입니다.

## Runner 계약

기본 검증은 repository root에서 실행합니다.

```powershell
npm.cmd run test
```

현재 `npm.cmd run test`는 아래 흐름을 실행합니다.

```powershell
node --test "tests/**/*.test.js"
node scripts/test-artifact-manifest.js
node scripts/test-selection-diagnostics.js
```

Root `tests/*.test.js` migration은 완료되었습니다. `tests/root-test-allowlist.json`은 `[]`인 완료 baseline이며, 새 root test를 허용하는 확장 지점이 아닙니다. 새 test file은 항상 목적별 nested folder에 둡니다.

## Folder 선택

새 test는 보호하려는 동작 기준으로 위치를 정합니다.

| Folder | Use for |
| --- | --- |
| `tests/unit/collect/` | Collector relevance, source parser, source-specific row extraction. |
| `tests/unit/common/` | Shared client/cache/runtime behavior such as Gemini, LLM, runtime config, summary cache. |
| `tests/unit/config/` | Source registry/config validation behavior. |
| `tests/unit/evidence/` | Linked evidence extraction, resolution, diagnostics, schema, impact classifier. |
| `tests/unit/generate/` | Generation-local helpers such as article capsule or fact-check repair logic. |
| `tests/contract/` | Quality gate, source binding, rendered issue structure, fixture trust, strict validation targets, validator behavior. |
| `tests/workflow/` | PR body, generation status, source effectiveness, fallback/public artifact flow, targeted retry, homepage/archive behavior. |
| `tests/hygiene/` | Repo hygiene, encoding, policy docs, PR template, localization-facing checks. |
| `tests/helpers/` | Shared fixture loading, temp root, artifact, newsroom, and quality builders. |
| `tests/fixtures/` | Curated/minimized fixture inputs covered by the fixture trust policy. |

Path를 이동하면 import path뿐 아니라 `package.json`의 direct test path, `docs/testing/test-inventory.md`, 관련 README 문구도 함께 확인합니다.

## Fixture Trust

Fixture policy는 `tests/contract/fixture-policy.test.js`와 `npm.cmd run check:fixtures`가 검증합니다. 세부 정책과 ledger 규칙은 `tests/fixtures/README.md`를 따릅니다.

핵심 규칙:

- `good/` fixture sample은 사람이 검수한 curated, non-generated sample이어야 합니다.
- Generated newsletter artifact 전체를 `good/` 또는 golden fixture로 복사하지 않습니다.
- `bad/` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- `source_gap_risk=true`, `reference_only=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `hasDatedEvidence=false`, Camera HAL 연결 없는 generic AI/IT sample은 main article PASS golden이 될 수 없습니다.
- Generated output에서 회귀 가치가 있으면 전체 artifact가 아니라 최소 JSON/text input만 regression fixture로 축약하고 provenance를 ledger에 남깁니다.

## Helpers

중복 helper를 test file 안에 새로 만들기 전에 `tests/helpers/`를 먼저 확인합니다.

| Helper | Purpose |
| --- | --- |
| `fixture-loader.js` | Safe fixture path resolution과 JSON/text fixture loading. |
| `fs.js` | Temp root, JSON/text write, JSON read helper. |
| `artifact-builders.js` | Minimal artifact manifest entry builder. |
| `newsroom-builders.js` | Newsroom candidate와 targeted retry builder. |
| `quality-builders.js` | Quality report section과 reporter candidate builder. |

새 helper는 여러 test가 같은 setup/write/assertion을 반복하고, helper name이 보호하는 domain contract를 분명히 설명할 때만 추가합니다.

## Generated Artifact Boundary

허용되는 사용:

- Path parsing 또는 path contract 검증을 위한 `newsletters/YYYY-MM-DD/newsletter.md` 같은 문자열.
- Test 내부에서 생성하는 minimal temp-root artifact.
- `tests/fixtures/**/bad` 또는 regression 목적의 minimized fixture.
- Public artifact 구조 smoke check. 단, content quality golden으로 삼지 않습니다.

허용하지 않는 사용:

- Generated newsletter를 PASS quality fixture처럼 사용.
- Quality gate를 통과시키기 위해 fixture 기대값이나 validator 기준을 완화.
- Full generated artifact를 `good/`로 복사.
- 오래된 generated artifact가 malformed라는 이유로 validator를 완화.

## Validation

Test, fixture, helper를 변경한 뒤에는 기본적으로 실행합니다.

```powershell
npm.cmd run test
npm.cmd run validate
```

변경 범위가 좁으면 targeted test를 먼저 실행하고 전체 검증으로 닫습니다.

```powershell
node --test tests\contract\fixture-policy.test.js
npm.cmd run check:fixtures
npm.cmd run check:repo-hygiene
npm.cmd run test:source-effectiveness
```

Docs-only 변경은 `npm.cmd run validate:localization`도 함께 확인합니다.
