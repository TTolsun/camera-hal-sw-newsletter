# src 작업 지침

이 폴더는 실제 newsroom 구현, tooling, 그리고 layer별 test를 담습니다. #262 src 재구성으로 모든 구현은 `src/` 아래로 이동했고, 과거 root `scripts/*.js` wrapper와 `scripts/lib/**` shim은 제거되었습니다. 더 이상 wrapper/shim layer는 없으니, 옛 경로를 복원하거나 새 wrapper를 추가하지 마세요.

## Layer Layout & Responsibility Split

구현은 네 개의 layer로 나뉩니다.

- `src/shared/**`: cross-cutting 런타임과 도메인 기반입니다.
  - `common/`: shared runtime config, artifact path, scope helper입니다.
  - `collect/`: source page/RSS parsing과 candidate collection 공통 로직입니다.
  - `domain/`: 도메인 모델과 분류 규칙입니다.
  - `evidence/`: linked-evidence 추출·해소·진단과 candidate evidence 검증입니다.
  - `sources/`: source registry와 source별 parser adapter입니다.
  - `llm/`: model policy와 LLM provider 공통 로직입니다.
  - `adapters/llm/`: raw provider(Gemini/Internal) response shape이 허용되는 유일한 위치입니다.
  - `cli/`: candidate collection 등 core command entrypoint입니다.
  - `config/`, `data/`: 런타임 config(`newsletter-policy.json`)와 source registry(`news-sources.json`)입니다.
  - `tooling/`: `check-*`/`validate`/`test` entrypoint입니다.
- `src/collector/**`: candidate collection layer입니다.
- `src/discovery/**`: Gemini source discovery layer입니다.
- `src/generator/**`: 생성·발행 layer입니다.
  - `select/`: deterministic selection, article capsule입니다.
  - `reporter/`: LLM client, article building, provider client, validation target입니다.
  - `editor/`, `quality/`, `repair/`: editorial 보강, quality gate, per-article salvage입니다.
  - `render/`: newsletter schema, Markdown/HTML rendering, image resolution입니다.
  - `publish/`: generation/PR body/status/manifest/validator CLI entrypoint입니다.

테스트는 각 layer 옆 `src/<layer>/test/**`에, fixture는 `src/shared/test/fixtures/**`에 둡니다.

## Module Dependency Rules

- 모듈 간 순환 의존성(circular dependency)을 만들지 마세요. `npm.cmd run check:circular-dependencies`가 `src/**`의 상대경로 require 그래프를 분석해 순환을 검출하며, `validate`와 `validate:post-generation` 체인에 포함됩니다. 현재 baseline은 순환 0개입니다.
- 이 검사는 그래프 기준이므로 파일을 옮겨서 순환을 숨길 수 없습니다. 순환이 생기면 shared contract를 `src/shared/common/`(또는 적절한 shared 모듈)으로 분리해 한 방향 의존으로 끊으세요.
- layer 의존은 한 방향입니다: `shared ← collector ← discovery ← generator`. 즉 `shared/`는 다른 layer를 import하지 않고, `collector/`·`discovery/`·`generator/`는 자신보다 하위 layer만 import합니다. `shared/common/`은 도메인 모듈(`collect/`, `llm/`, `evidence/` 등 상위 동작 모듈)을 import하지 않습니다. 실행 흐름은 collect -> generate -> render/llm -> validate 한 방향입니다.
- provider별 raw response 구조(Gemini/Internal의 원시 응답 shape)는 `src/shared/llm/`과 `src/shared/adapters/llm/`(과 `*/test/**/llm-response/` fixture) 밖에서 참조하지 마세요. 도메인 모듈은 adapter가 정규화한 모델만 다룹니다. `npm.cmd run check:domain-model-boundary`가 이 경계를 강제하며, 허용 경계와 구체 marker 목록은 `docs/workflows/llm-provider-domain-boundary.md`에 있습니다. Internal/Gemini provider의 request/response 차이는 provider client 안에만 가둡니다.

## Implementation Rules

- CommonJS `require`, 2칸 들여쓰기, 세미콜론, Node 20 compatibility를 유지합니다.
- prompt-only logic으로 **safety** deterministic validation(source binding, fact-check must_fix, claim evidence_id, required fields, composition, stale claim, duplicate URL)을 대체하지 마세요. 단, **editorial 품질/깊이 판정**은 fact-checker(LLM)의 `article_quality[]` verdict("Camera HAL SW 엔지니어에게의 유용성", 주제 무관)가 담당하며 deterministic topic/depth heuristic으로 gate하지 않습니다.
- safety hard blocker, source integrity check, image fallback contract, fact-checker usefulness verdict gate를 약화하지 마세요. publish gate는 numeric threshold가 아니라 (안전 검사 통과) AND (모든 기사 publishable)의 boolean입니다.
- generated artifact path를 바꿀 때는 workflow, docs, tests를 함께 갱신해야 합니다.
- 일시적인 실험, 재현, probe, local 분석용 script는 `src/` 아래에 남기지 않습니다. 영구 script가 필요하면 유지보수 가능한 CLI/tool로 범위와 검증을 명확히 합니다. `npm.cmd run check:repo-hygiene`가 `src/` 아래 one-off script와 misplaced test file을 검출합니다.

## Review Publication Guardrail

- PR body, report, validation 구현은 policy 설명 전체를 grep하지 말고 `Diagnostics-only Status`, `발행 상태 요약`, `Public Newsletter Readiness` 같은 concrete state section 기준으로 `diagnostics_only`와 `review_publication_ready`를 판정합니다.
- `final_publish_ready=false`는 AI 자동 발행 기준 미충족일 뿐입니다. 이 값만 보고 homepage 미표시를 정상 상태로 설명하지 마세요.
- `review_publication_ready=true`이면 `articles/newsletters/YYYY-MM-DD/index.html`, `articles/newsletters/YYYY-MM-DD/newsletter.md`, `data/newsletters.json` entry가 있어야 하며, `homepage_visible_after_merge=true`는 resolver가 이 public artifact와 index entry를 검증한 결과여야 합니다.
- `diagnostics_only=true`이면 public newsletter files가 없는 진단 전용 PR입니다. PR body에는 merge해도 homepage에 표시되지 않음을 명시해야 합니다.

## Tests & Fixtures

이 영역의 test는 Node built-in test runner 기반 regression test입니다. production validator를 약화해서 test를 통과시키지 마세요. test는 layer 옆 `src/<layer>/test/**`에 두고, root에 loose `*.test.js`를 남기지 않습니다.

### Fixture Trust Policy

- fixture를 추가하기 전에 `src/shared/test/fixtures/README.md`의 신뢰 정책을 먼저 확인하세요.
- `good/` 또는 golden fixture는 사람이 검수한 curated sample만 허용합니다.
- generated artifact 전체를 `good/` 또는 golden fixture로 복사하지 마세요.
- generated artifact에서 회귀 테스트 가치가 있는 경우 최소 입력만 `bad/` 또는 regression fixture로 축약하세요.
- `bad/` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- source gap, watchlist, reference-only, exclude, undated evidence, generic AI without HAL connection sample을 main article PASS 기준으로 만들지 마세요.

### Test Style & Expectations

- Node built-in test runner를 사용합니다.
- regression fixture는 최소 입력으로 유지합니다.
- test name은 보호하려는 policy를 설명해야 합니다.
- source gap, watch/reference page promotion prevention, duplicate URL binding, stale claims, quality hard blockers, image fallback contract, workflow script status output은 우선 test 대상입니다.
- 다음을 수정하면 test를 추가하거나 갱신하세요: selection, source binding, quality gate, image fallback, runtime config, Gemini/LLM client, renderer.

## Validation

기본 검증:

```powershell
npm.cmd run test
npm.cmd run validate
```

관련 범위가 좁으면 targeted test도 함께 실행합니다.

```powershell
node src/shared/tooling/cli/run-node-tests.js src
```
