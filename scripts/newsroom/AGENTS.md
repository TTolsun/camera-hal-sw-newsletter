# scripts/newsroom 작업 지침

이 폴더는 실제 newsroom 구현을 담습니다. root `scripts/*.js`와 `scripts/lib/**`는 compatibility wrapper/shim으로 유지하고, 명시 요청 없이는 제거하지 마세요.

## Responsibility Split

- `cli/`: command entrypoint, workflow-facing output, validation command wrapper입니다.
- `collect/`: source page/RSS parsing과 candidate collection입니다.
- `generate/`: deterministic selection, article capsule, generation orchestration, summary cache logic입니다.
- `llm/`: Gemini/Internal LLM provider client, model policy, retry/cost diagnostics입니다.
- `metrics/`: source effectiveness와 newsroom 운영 지표 report입니다.
- `render/`: newsletter schema, Markdown/HTML rendering, image resolution입니다.
- `validate/`: quality gate와 config validation입니다.
- `common/`: shared runtime config, artifact paths, scope helpers입니다.

## Implementation Rules

- CommonJS `require`, 2칸 들여쓰기, 세미콜론, Node 20 compatibility를 유지합니다.
- prompt-only logic으로 deterministic validation을 대체하지 마세요.
- quality gate, hard blocker, source integrity check, image fallback contract를 약화하지 마세요.
- generated artifact path를 바꿀 때는 workflow, docs, tests를 함께 갱신해야 합니다.
- root wrapper와 `scripts/lib/**` shim은 compatibility surface입니다. 별도 PR 없이 import path를 대량 교체하지 마세요.

## Review Publication Guardrail

- PR body, report, validation 구현은 policy 설명 전체를 grep하지 말고 `Diagnostics-only Status`, `발행 상태 요약`, `Public Newsletter Readiness` 같은 concrete state section 기준으로 `diagnostics_only`와 `review_publication_ready`를 판정합니다.
- `final_publish_ready=false`는 AI 자동 발행 기준 미충족일 뿐입니다. 이 값만 보고 homepage 미표시를 정상 상태로 설명하지 마세요.
- `review_publication_ready=true`이면 `newsletters/YYYY-MM-DD/index.html`, `newsletters/YYYY-MM-DD/newsletter.md`, `data/newsletters.json` entry가 있어야 하며, `homepage_visible_after_merge=true`는 resolver가 이 public artifact와 index entry를 검증한 결과여야 합니다.
- `diagnostics_only=true`이면 public newsletter files가 없는 진단 전용 PR입니다. PR body에는 merge해도 homepage에 표시되지 않음을 명시해야 합니다.

## Test Expectations

다음을 수정하면 test를 추가하거나 갱신하세요.

- selection
- source binding
- quality gate
- image fallback
- runtime config
- Gemini/LLM client
- renderer

기본 검증:

```powershell
npm.cmd run test
npm.cmd run validate
```

관련 범위가 좁으면 targeted test도 함께 실행합니다.

```powershell
node scripts/run-node-tests.js tests
```
