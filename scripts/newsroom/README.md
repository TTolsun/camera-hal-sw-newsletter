# scripts/newsroom

이 폴더는 실제 newsroom 구현을 담습니다. root `scripts/*.js`와 `scripts/lib/**`는 compatibility wrapper/shim이므로, 실제 동작을 확인하거나 수정할 때는 이 폴더의 module부터 읽습니다.

## Module map

| Path | Role |
| --- | --- |
| `cli/` | command entrypoint, workflow-facing output, validation command wrapper입니다. |
| `collect/` | source page/RSS parsing과 candidate collection입니다. |
| `common/` | shared runtime config, artifact paths, scope helpers입니다. |
| `generate/` | deterministic selection, article capsule, retry/summary cache logic입니다. |
| `llm/` | LLM provider dispatch, model policy, retry/cost diagnostics입니다. |
| `metrics/` | source effectiveness와 newsroom 운영 지표 report입니다. |
| `render/` | newsletter schema, Markdown/HTML rendering, image resolution입니다. |
| `validate/` | quality gate, config validation, site/output validation입니다. |

## Suggested read order

1. `common/`
2. `collect/`
3. `generate/`
4. `llm/`
5. `render/`
6. `validate/`
7. `metrics/`
8. `cli/`

## Do not weaken

- source binding
- quality gate와 hard blocker
- image fallback contract
- PR-based publication

Generated artifact path나 public output contract를 바꾸는 작업은 workflow, docs, tests를 함께 갱신해야 합니다.
