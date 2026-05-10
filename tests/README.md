# Tests Guide

이 folder는 Node built-in test runner로 newsroom automation, quality gate, source selection, rendering, workflow, repository hygiene 계약을 보호합니다.

## 현재 Runner 계약

현재 `package.json` 계약은 아직 flat 구조입니다.

```powershell
npm.cmd run test
```

내부적으로는 아래 명령을 실행합니다.

```powershell
node --test tests/*.test.js
node scripts/test-artifact-manifest.js
node scripts/test-selection-diagnostics.js
```

#82 nested-runner slice가 반영되기 전까지 CI에서 실행되어야 하는 새 test file은 `tests/*.test.js`에 둡니다. Runner를 변경하고 Windows PowerShell에서 검증하기 전에는 `tests/unit/`, `tests/contract/`, `tests/workflow/`, `tests/hygiene/`로 test file을 이동하지 않습니다.

## Target Structure

Migration slice가 끝난 뒤의 목표 구조는 아래와 같습니다.

```text
tests/
  helpers/
  fixtures/
  unit/
    collect/
    common/
    config/
    evidence/
    generate/
    render/
    validate/
  contract/
  workflow/
  hygiene/
```

Test를 추가하거나 이동할 때는 아래 기준을 사용합니다.

| Test purpose | Runner migration 전 현재 위치 | Runner migration 후 target location |
| --- | --- | --- |
| 단일 parser, classifier, config, cache, small helper 동작 | `tests/<name>.test.js` | `tests/unit/<area>/<name>.test.js` |
| Quality gate, source binding, publish status, rendered structure, policy contract | `tests/<name>.test.js` | `tests/contract/<name>.test.js` |
| PR body, artifact writing, fallback builder, generation status, multi-file workflow | `tests/<name>.test.js` | `tests/workflow/<name>.test.js` |
| Encoding, repo hygiene, docs sync, PR template, localization, fixture policy | `tests/<name>.test.js` | `tests/hygiene/<name>.test.js` 또는 `tests/contract/<name>.test.js` |

## Fixture Trust

Fixture policy는 `tests/fixture-policy.test.js`가 검증하고, 세부 정책은 `tests/fixtures/README.md`에 있습니다.

규칙:

- `good/` fixture sample은 curated, non-generated여야 합니다.
- Generated newsletter artifact는 `good/` 또는 golden fixture로 복사하지 않습니다.
- `bad/` fixture는 `PASS`를 기대하면 안 됩니다.
- `source_gap_risk=true`, `reference_only=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `hasDatedEvidence=false`, Camera HAL 연결 없는 generic AI/IT sample은 main article PASS golden이 될 수 없습니다.
- Generated output은 명시적인 smoke/integration check에만 사용할 수 있고 quality 기준으로 삼지 않습니다.

Generated output에서 파생한 regression은 필요한 최소 JSON/text input으로 축약하고, provenance를 fixture metadata 또는 future fixture ledger에 남깁니다.

## Helpers

현재 shared helper는 `tests/helpers/` 아래에 있습니다.

| Helper | Purpose |
| --- | --- |
| `fixture-loader.js` | Safe fixture path resolution과 JSON/text fixture loading. |
| `artifact-builders.js` | Minimal artifact manifest entry builder. |
| `newsroom-builders.js` | Newsroom candidate와 targeted retry builder. |
| `quality-builders.js` | Quality report section과 reporter candidate builder. |

Fixture loading 또는 common builder를 중복 작성하기보다 기존 helper를 우선 사용합니다. #82 helper slice에서는 large workflow test를 분할하기 전에 temp-root, JSON/text write, rendered newsletter fixture, Markdown assertion helper를 추가합니다.

## Generated Artifact Boundary

허용되는 generated artifact reference:

- `newsletters/YYYY-MM-DD/newsletter.md` 같은 path parsing/path contract test.
- Test 내부에서 생성한 minimal temp-root artifact.
- `tests/fixtures/**/bad` 또는 future `regression/` 영역의 minimized regression fixture.
- Public artifact 구조를 확인하되 content quality를 golden으로 삼지 않는 smoke check.

허용하지 않는 사용:

- Generated newsletter를 PASS quality fixture처럼 사용.
- 약화된 quality gate를 통과시키기 위한 fixture update.
- Full generated artifact를 `good/`로 복사.
- 오래된 generated artifact가 malformed라는 이유로 validator를 완화.

## #82 Migration 순서

1. Inventory and guide: `docs/testing/test-inventory.md`와 이 파일.
2. Nested runner preparation: test file 이동 없이 `test:unit`이 nested test folder를 발견하도록 준비합니다.
3. Fixture ledger and trust guard: fixture provenance를 추가하고 guard coverage를 확장합니다.
4. Shared test helpers: temp root, write helper, rendered artifact, Markdown assertion을 공통화합니다.
5. Test folder migration: low-risk set부터 소량 이동합니다.
6. Generated artifact dependency cleanup: generated output은 smoke/integration check에만 남깁니다.
7. Duplicate/obsolete test cleanup: replacement contract가 문서화된 경우에만 삭제 또는 통합합니다.
8. Structure guard and final audit: root test drift와 fixture pollution 재발을 막습니다.

## Validation

Test 또는 fixture를 변경한 뒤에는 전체 검증을 실행합니다.

```powershell
npm.cmd run test
npm.cmd run validate
```

Docs-only 또는 guide 변경에는 아래 명령도 실행합니다.

```powershell
npm.cmd run validate:localization
```

Fixture policy 변경에는 아래 targeted test를 실행합니다.

```powershell
node --test tests\fixture-policy.test.js
```

