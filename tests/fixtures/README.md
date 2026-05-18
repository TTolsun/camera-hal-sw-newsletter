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

`fixture-ledger.json` is the source of truth for committed fixture provenance.
Every committed fixture file must have exactly one ledger entry with:

- `path`: fixture-relative path using `/` separators.
- `source`: `curated`, `synthetic`, or `minimized-generated-regression`.
- `allowedUse`: `good`, `bad`, `linked-evidence`, `parser-source-html`, or `workflow-shape`.
- `expectedStatus`: expected pass/fail class for JSON gate fixtures, or `n/a` for source text/html fixtures.
- `protectedPolicy`: the regression contract protected by the fixture.
- `generatedArtifact`: `true` only for minimized generated regression samples outside `good/`.

`good/` fixtures must be curated, non-generated, and PASS-only. `bad/` fixtures must not expect `PASS`.

When adding, deleting, or moving committed fixture files, update `fixture-ledger.json`
in the same change and run `npm.cmd run check:fixtures`. The ledger must contain
exactly one entry for every committed fixture file, excluding `.gitkeep`,
`README.md`, and `fixture-ledger.json` itself.

Generated regression fixtures must keep their fixture-local provenance in
`fixture-ledger.json`, set `metadata.generated: true`, and use
`metadata.source: "minimized-generated-regression"`.
Do not embed `content/newsroom/YYYY-MM-DD`, `content/collected-news/YYYY-MM-DD`, or
`newsletters/YYYY-MM-DD` paths inside committed fixture files.
Only `bad/` or dedicated regression-purpose fixtures may set
`generatedArtifact: true`; `good/` fixtures must stay curated and non-generated.

## Layout

Current fixture layout is the repository contract:

- `quality/good/`
- `quality/bad/`
- `selection/good/`
- `selection/bad/`
- `seed-evidence/good/`
- `seed-evidence/bad/`

Do not migrate fixtures to `good/quality/` or `bad/quality/` as part of generated artifact cleanup.
Fixture layout migration must be handled as a separate scoped change.

## Seed evidence artifact boundary

`collection-intent.json`, `seed-evidence-pack.json`, `seed-candidates.json`, and
`compact_evidence` names may appear in synthetic or workflow-shape fixtures when
the test protects the #185 seed evidence contract. These names are not banned
globally.

They are banned only when a `good/` fixture has generated provenance:

- `metadata.generated=true`
- `metadata.source=generated_artifact`
- `metadata.source=minimized-generated-regression`
- ledger `generatedArtifact=true`
- ledger `source=minimized-generated-regression`

Generated #185 artifacts may be used only as workflow-shape, smoke, or minimized
regression evidence. They must not become quality PASS golden, source/evidence
correctness golden, HAL impact golden, or claim binding golden fixtures.

## Fixture change checklist

- Do not copy a generated newsletter artifact into a `good/` or golden fixture.
- Keep `good/` fixtures curated and non-generated.
- Keep `bad/` fixture `expected.status` values away from `PASS`.
- Do not turn source gap, reference-only, watchlist, exclude, undated evidence,
  or generic AI/IT samples into PASS golden fixtures.
- Update `fixture-ledger.json` in the same change.
- Run `npm.cmd run check:fixtures`.
