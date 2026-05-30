# Fixture 신뢰 정책

`tests/fixtures`는 사람이 검수한 curated fixture와 generated artifact에서 축약한 bad/regression fixture를 분리합니다.

## 규칙

- `good/` fixture는 사람이 검수한 curated sample만 허용합니다.
- generated artifact는 `good/` 또는 golden fixture로 복사하지 않습니다.
- generated artifact에서 회귀 가치가 있는 입력은 전체 artifact가 아니라 최소 JSON/text sample만 `bad/` 또는 regression fixture로 둡니다.
- `bad/` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- `source_gap_risk=true`, `reference_only=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `hasDatedEvidence=false` fixture는 main article PASS golden이 될 수 없습니다.
- generic AI 또는 일반 IT sample이 Camera HAL / Android Camera / camera workflow / frame / stream / buffer / metadata / NPU/GPU/ISP resource management와 구체적으로 연결되지 않으면 PASS golden이 될 수 없습니다.

## metadata 형식

JSON fixture는 가능하면 아래 필드를 둡니다.

```json
{
  "metadata": {
    "generated": false,
    "source": "curated"
  },
  "policyFlags": {
    "source_gap_risk": false,
    "reference_only": false,
    "finalSelectionEligibility": "main",
    "hasDatedEvidence": true,
    "generic_ai_without_hal_connection": false
  },
  "expected": {
    "status": "PASS"
  }
}
```

## Fixture ledger

`fixture-ledger.json` schemaVersion 2는 커밋된 fixture provenance의 source of truth입니다.
커밋된 모든 fixture 파일에는 아래 필드를 갖는 ledger entry가 정확히 하나씩 있어야 합니다.

- `path`: fixture-relative path, `/` 구분자 사용.
- `source`: `curated`, `synthetic`, `minimized-generated-regression` 중 하나.
- `allowedUse`: `good`, `bad`, `linked-evidence`, `parser-source-html`, `workflow-shape` 중 하나.
- `expectedStatus`: JSON gate fixture의 기대 pass/fail 분류, source text/html fixture는 `n/a`.
- `protectedPolicy`: fixture가 보호하는 regression 계약.
- `generatedArtifact`: `good/` 바깥에 있는 minimized generated regression sample에만 `true`.
- `relatedRules`: `quality_gate`, `selection`, `source_binding`, `seed_evidence`, `linked_evidence`,
  `parser_contract`, `workflow_shape`, `artifact_provenance` 중 non-empty rule tag 배열.

Ledger v2 provenance 정책:

- `curated` → curated/reference fixture.
- `synthetic` → 사람이 직접 작성한 축약 예시.
- `minimized-generated-regression` → generated output에서 축약한 경우에만 허용. non-public, minimized, regression 범위여야 합니다.

`good/` fixture는 curated, non-generated, PASS-only여야 합니다. `bad/` fixture는 `PASS`를 기대하면 안 됩니다.

커밋된 fixture 파일을 추가, 삭제, 이동할 때는 같은 변경에서 `fixture-ledger.json`을 갱신하고 `npm.cmd run check:fixtures`를 실행합니다. ledger에는 `.gitkeep`, `README.md`, `fixture-ledger.json` 자체를 제외한 모든 커밋된 fixture 파일에 대해 정확히 하나의 entry가 있어야 합니다.

Generated regression fixture는 `fixture-ledger.json`에 fixture-local provenance를 남기고, `metadata.generated: true`, `metadata.source: "minimized-generated-regression"`을 설정합니다.
커밋된 fixture 파일 안에 `content/newsroom/YYYY-MM-DD`, `content/collected-news/YYYY-MM-DD`, `newsletters/YYYY-MM-DD` 경로를 포함하지 않습니다.
`generatedArtifact: true`는 `bad/` 또는 regression 전용 fixture에만 사용합니다. `good/` fixture는 curated non-generated 상태를 유지합니다.

## Layout

현재 fixture layout은 저장소 계약입니다.

- `quality/good/`
- `quality/bad/`
- `selection/good/`
- `selection/bad/`
- `seed-evidence/good/`
- `seed-evidence/bad/`
- `seed-evidence/workflow-shapes/`

Generated artifact cleanup의 일환으로 fixture를 `good/quality/` 또는 `bad/quality/`로 이동하지 마세요.
Fixture layout 이동은 별도의 scoped 변경으로 처리합니다.

`seed-evidence/workflow-shapes/`는 generated artifact 사본이 아니라 seed-only,
seed-plus-Gemini 같은 merge output contract를 최소 synthetic input으로 표현하는
domain-first fixture 위치입니다. 이 경로의 ledger entry는 `allowedUse: "workflow-shape"`와
`relatedRules: ["seed_evidence", "workflow_shape"]`를 포함해야 합니다.

## Seed evidence artifact boundary

`collection-intent.json`, `seed-evidence-pack.json`, `seed-candidates.json`, `compact_evidence` 이름은 seed evidence 계약을 보호하는 테스트에서 synthetic 또는 workflow-shape fixture에 등장할 수 있습니다. 이 이름들은 전역적으로 금지되지 않습니다.

아래 경우에만 금지됩니다.

- `metadata.generated=true`
- `metadata.source=generated_artifact`
- `metadata.source=minimized-generated-regression`
- ledger `generatedArtifact=true`
- ledger `source=minimized-generated-regression`

Generated seed artifact는 workflow-shape, smoke, minimized regression evidence로만 사용합니다. quality PASS golden, source/evidence correctness golden, HAL impact golden, claim binding golden fixture가 되어서는 안 됩니다.

## Fixture 변경 체크리스트

- Generated newsletter artifact를 `good/` 또는 golden fixture로 복사하지 않습니다.
- `good/` fixture는 curated non-generated 상태를 유지합니다.
- `bad/` fixture의 `expected.status`를 `PASS`로 설정하지 않습니다.
- source gap, reference-only, watchlist, exclude, undated evidence, generic AI/IT sample을 PASS golden fixture로 만들지 않습니다.
- 같은 변경에서 `fixture-ledger.json`을 갱신합니다.
- `npm.cmd run check:fixtures`를 실행합니다.
