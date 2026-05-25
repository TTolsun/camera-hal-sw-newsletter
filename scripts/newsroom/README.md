# scripts/newsroom

이 폴더는 실제 newsroom 구현을 담습니다. root `scripts/*.js`와 `scripts/lib/**`는 compatibility wrapper/shim이므로, 실제 동작을 확인하거나 수정할 때는 이 폴더의 module부터 읽습니다.

## Module map

| Path | Role |
| --- | --- |
| `cli/` | command entrypoint, workflow-facing output, validation command wrapper입니다. |
| `adapters/` | provider raw output을 internal domain model로 변환하는 adapter boundary입니다. |
| `collect/` | source page/RSS parsing과 candidate collection입니다. |
| `common/` | shared runtime config, artifact paths, scope helpers입니다. |
| `domain/` | newsletter domain model, legacy normalizer, validation error 계약입니다. |
| `evidence/` | seed evidence, linked evidence, evidence diagnostics 관련 helper입니다. |
| `generate/` | deterministic selection, article capsule, retry/summary cache logic입니다. |
| `llm/` | LLM provider dispatch, model policy, retry/cost diagnostics입니다. |
| `metrics/` | source effectiveness와 newsroom 운영 지표 report입니다. |
| `render/` | newsletter schema, Markdown/HTML rendering, image resolution입니다. |
| `sources/` | source registry와 source quality 판단에 가까운 helper입니다. |
| `validate/` | quality gate, config validation, site/output validation입니다. |

## Suggested read order

1. `common/`
2. `collect/`
3. `evidence/`
4. `sources/`
5. `generate/`
6. `llm/`
7. `render/`
8. `validate/`
9. `metrics/`
10. `cli/`

## Do not weaken

- source binding
- quality gate와 hard blocker
- image fallback contract
- PR-based publication

Generated artifact path나 public output contract를 바꾸는 작업은 workflow, docs, tests를 함께 갱신해야 합니다.

## Validation

실제 newsroom 구현을 수정한 뒤에는 변경 범위에 맞는 targeted test를 먼저 실행하고 전체 검증으로 닫습니다.

```powershell
npm.cmd run test
npm.cmd run validate
```
