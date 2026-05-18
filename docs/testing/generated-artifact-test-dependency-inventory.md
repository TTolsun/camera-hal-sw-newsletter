# Generated Artifact Test Dependency Inventory

Issue #62 is not a rebuild of fixture governance. It closes the remaining risk that generated newsletter artifacts can become trusted golden fixtures.

## Already Done in main

- `npm.cmd run check:fixtures` exists and runs `node --test tests/contract/fixture-policy.test.js`.
- `npm.cmd run validate` already includes `check:fixtures`.
- `tests/contract/fixture-policy.test.js` enforces fixture trust policy.
- `tests/fixtures/fixture-ledger.json` is the source of truth for committed fixture provenance.
- `tests/fixtures/README.md` documents fixture trust rules.
- `docs/testing/test-inventory.md` remains the broad test inventory.

## Scope

This document tracks only generated artifact dependency boundaries. It does not replace `docs/testing/test-inventory.md` and does not describe the full test layout or helper inventory.

Allowed classification values:

- `path_contract_allowed`: the test validates path routing or path parsing and does not treat generated output content as golden truth.
- `temp_artifact_allowed`: the test creates disposable artifacts under a temp root during the test.
- `workflow_shape_allowed`: the test validates artifact shape or workflow wiring without trusting generated content as a quality golden.
- `site_smoke_allowed`: the test checks static site publication plumbing without making generated article content a fixture oracle.
- `minimized_regression_allowed`: the fixture is a reduced regression sample, must live outside `good/`, and must not expect `PASS`.
- `migrate_to_synthetic_fixture`: the test still depends on generated output content and should be moved to a curated synthetic fixture.

`migrate_to_synthetic_fixture` is complete only when:

- the generated artifact file read is removed from the unit, contract, or validation test;
- the replacement fixture exists under `tests/fixtures/**`;
- `tests/fixtures/fixture-ledger.json` has a matching entry;
- the expected status and protected policy are explicit; and
- the test name clearly separates contract usage from smoke usage.

## Current Inventory

| Surface | Classification | Status | Notes |
| --- | --- | --- | --- |
| `tests/helpers/artifact-builders.js` | `workflow_shape_allowed` | closed | Helper defaults use date-scoped artifact paths to build workflow-shape inputs only. |
| `tests/contract/fixture-policy.test.js` | `minimized_regression_allowed` | closed | Generated provenance is forbidden for `good/`; minimized generated regressions are allowed only as non-PASS bad fixtures. |
| `tests/contract/public-newsletter-validator.test.js` | `path_contract_allowed` | closed | Internal artifact path strings are negative validator inputs, not trusted content fixtures. |
| `tests/contract/rendered-issue-structure.test.js` | `temp_artifact_allowed` | closed | The rendered output contract uses temp-root artifacts and does not add committed rendered fixtures for #62. |
| `tests/contract/validation-targets.test.js` | `path_contract_allowed` | closed | Path targets are contract inputs, not article golden content. |
| `tests/contract/validator-strictness.test.js` | `path_contract_allowed` | closed | Archive and stale-link path strings are validator contract inputs only. |
| `tests/workflow/homepage-archive.test.js` | `path_contract_allowed` | closed | Archive path behavior is validated without promoting generated article content to a fixture. |
| `tests/workflow/source-effectiveness-report.test.js` | `workflow_shape_allowed` | closed | Source-effectiveness report artifact paths validate report shape and aggregation. |
| `tests/workflow/workflow-scripts.test.js` | `workflow_shape_allowed` | closed | Workflow artifact names and wiring are shape contracts only. |
| `tests/unit/common/runtime-config.test.js` | `path_contract_allowed` | closed | Env path parsing and newline rejection are configuration path contracts only. |
| `tests/unit/seed-url-evidence.test.js` | `workflow_shape_allowed` | closed | Seed evidence shape is validated without allowing generated seed artifacts to become `good/` fixtures. |
| `tests/unit/common/candidate-artifacts.test.js` | `workflow_shape_allowed` | closed | Candidate artifact helpers validate structure and naming only. |
| `tests/fixtures/quality/good/**` | `migrate_to_synthetic_fixture` | closed | Good quality fixtures are curated, non-generated, and ledger-backed. |
| `tests/fixtures/selection/good/**` | `migrate_to_synthetic_fixture` | closed | Good selection fixtures are curated, non-generated, and ledger-backed. |
| `tests/fixtures/seed-evidence/good/**` | `workflow_shape_allowed` | closed | Seed artifact names may appear only in curated non-generated good fixtures. |

## Audit Command

Use this command when updating the inventory:

```powershell
rg "newsletters/\d{4}-\d{2}-\d{2}|content/newsroom/\d{4}-\d{2}-\d{2}|content/collected-news/\d{4}-\d{2}-\d{2}" tests scripts
```

Any match must be classified above or removed. Matches in generated artifact path-contract tests are allowed only when they do not make generated article content a golden fixture.

## Final #62 Status

- Quality and selection generated golden fixtures: `0`
- Generated good fixtures: `0`
- Bad fixtures with `PASS` expected status: `0`
- Rendered committed fixtures added for #62: `0`
- Unclassified generated artifact test dependencies: `0`
