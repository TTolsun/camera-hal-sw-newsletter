# Issue #188 루트 문서 현행성 감사

이 문서는 #188에서 제안한 `docs/audit/**` 산출물을 저장소 지침에 맞춰 단일 reviewable 계획/감사 문서로 축소한 결과입니다. 목적은 root folder별 README/AGENTS coverage, 실제 source of truth, 문서 drift, folder별 자체 리뷰, 최종 취합 리뷰를 한 곳에서 확인하는 것입니다.

이 문서는 코드 동작을 바꾸지 않습니다. `package.json` scripts, GitHub Actions behavior, public URL, artifact schema, validator rule, quality threshold는 변경 대상이 아닙니다.

## PR 압축 기준

| #188 원문 slice | 이번 구현 위치 | 포함 내용 |
| --- | --- | --- |
| PR 1 audit framework | PR 1 | 이 문서의 감사 형식, folder inventory, coverage matrix |
| PR 2 root inventory / source-of-truth map | PR 1 | root folder 목록과 source-of-truth map |
| PR 3 workflow/tooling audit | PR 2 | `.github/`, `config/`, `scripts/`, `scripts/newsroom/`, `tests/` 감사 |
| PR 4 content/public/docs audit | PR 3 | `assets/`, `css/`, `content/`, `data/`, `docs/`, `newsletters/`, `templates/`, root files 감사 |
| PR 5 README/AGENTS update batch 1 | PR 2 | workflow/tooling README/AGENTS 보강 |
| PR 6 README/AGENTS update batch 2 | PR 3 | public/content/docs README/AGENTS 보강 |
| PR 7 glossary pass | PR 3 | `docs/glossary.ko.md` field/artifact 설명 보강 |
| PR 8 final verification | PR 3 | README/AGENTS 역할 분리, 용어 일관성, policy drift 점검 |

## 루트 폴더 목록

| 경로 | 현재 역할 | README coverage | AGENTS coverage | 감사 판단 |
| --- | --- | --- | --- | --- |
| `.github/` | issue/PR template와 workflow surface | `.github/README.md` 추가 | `.github/workflows/AGENTS.md` 존재 | workflow secret, PR 기반 발행, validation gate 설명 필요 |
| `assets/` | 정적 사이트 image와 fallback image | `assets/README.md` 추가 | root guidance 상속 | image resolver와 fallback 계약 설명 필요 |
| `config/` | newsletter policy와 runtime budget config | `config/README.md` 추가 | root guidance 상속 | generated policy block의 source of truth 설명 필요 |
| `content/` | raw candidate와 newsroom review artifact | `content/README.md` 추가 | `content/AGENTS.md` 존재 | generated artifact 보존/cleanup 경계 설명 필요 |
| `css/` | 정적 사이트 stylesheet | `css/README.md` 추가 | root guidance 상속 | public site surface와 newsletter renderer 분리 설명 필요 |
| `data/` | site index data와 source registry | `data/README.md` 추가 | `data/AGENTS.md` 존재 | 사람이 읽는 값과 계약-bearing 값 분리 설명 필요 |
| `docs/` | 운영, 설정, architecture, testing 문서 | `docs/README.md` 추가 | `docs/AGENTS.md` 존재 | current/archive guidance와 계획 문서 위치 설명 필요 |
| `newsletters/` | public newsletter Markdown/HTML output | `newsletters/README.md` 추가 | root guidance 상속 | public URL surface와 generated output 주의 필요 |
| `scripts/` | npm/GitHub Actions command compatibility wrapper | `scripts/README.md` 보강 | root guidance 상속 | root wrapper와 실제 구현 분리 설명 필요 |
| `scripts/newsroom/` | 실제 collector/generator/renderer/validator 구현 | `scripts/newsroom/README.md` 보강 | `scripts/newsroom/AGENTS.md` 존재 | 실제 하위 폴더 목록과 gate 계약 보강 필요 |
| `templates/` | newsletter Markdown/HTML template | `templates/README.md` 추가 | root guidance 상속 | renderer 입력 template와 policy block 분리 설명 필요 |
| `tests/` | Node built-in test runner 기반 regression test | `tests/README.md` 존재 | `tests/AGENTS.md` 존재 | fixture trust와 root test migration 설명 유지 |
| root files | entrypoint, metadata, policy, public site root | `README.md` 보강 | `AGENTS.md` 보강 | navigation-first README와 AI 작업 지침 역할 분리 필요 |
| `tools/` | 현재 없음 | 없음 | 없음 | future candidate로만 기록 |

## README / AGENTS coverage matrix

| 대상 | 사람용 README 상태 | AI용 AGENTS 상태 | 최종 판단 |
| --- | --- | --- | --- |
| `.github/` | 추가됨 | `.github/workflows/AGENTS.md`로 workflow 한정 guidance 제공 | root `.github/AGENTS.md`는 불필요 |
| `assets/` | 추가됨 | root guidance 상속 | image fallback 계약은 README로 충분 |
| `config/` | 추가됨 | root guidance 상속 | policy config 변경은 root/data/docs guidance로 충분 |
| `content/` | 추가됨 | 존재 | generated artifact 보존 기준 분리됨 |
| `css/` | 추가됨 | root guidance 상속 | 정적 스타일만 다루므로 scoped AGENTS 불필요 |
| `data/` | 추가됨 | 존재 | JSON 계약-bearing 값 보호 기준 있음 |
| `docs/` | 추가됨 | 존재 | current/archive guidance 구분 있음 |
| `newsletters/` | 추가됨 | root/content guidance 상속 | public output이므로 README 경고로 충분 |
| `scripts/` | 보강됨 | root guidance 상속 | 실제 구현은 `scripts/newsroom/AGENTS.md`가 보호 |
| `scripts/newsroom/` | 보강됨 | 존재 | source binding, gate, renderer 계약 보호 |
| `templates/` | 추가됨 | root guidance 상속 | renderer template surface라 scoped AGENTS 불필요 |
| `tests/` | 유지 | 존재 | fixture trust와 validation guidance 충분 |
| root files | 보강됨 | 보강됨 | README는 entry, AGENTS는 작업 규칙으로 분리 |

새 scoped `AGENTS.md`는 root guidance만으로 위험한 folder-specific 작업 규칙을 전달할 수 없을 때만 추가합니다. 이번 감사에서는 새 scoped `AGENTS.md`가 필요한 새 folder를 발견하지 않았습니다.

## Source-of-truth map

| 영역 | Source of truth | 관련 문서/검증 |
| --- | --- | --- |
| 발행 정책과 article count | `config/newsletter-policy.json` | `README.md` generated policy block, `npm.cmd run check:policy-docs` |
| workflow stage 역할 | `.github/workflows/01-newsroom-manual-source-collect-pr.yml`, `.github/workflows/02-newsroom-gemini-source-discovery-pr.yml`, `.github/workflows/03-newsroom-final-pr.yml` | `.github/README.md`, `.github/workflows/AGENTS.md`, `docs/newsroom-workflow.md` |
| source registry 계약 | `data/news-sources.json` | `data/README.md`, `data/AGENTS.md`, `docs/config/news-sources-fields.ko.md`, `npm.cmd run validate:config` |
| 실제 newsroom 구현 | `scripts/newsroom/{cli,collect,common,evidence,generate,llm,metrics,render,sources,validate}/` | `scripts/README.md`, `scripts/newsroom/README.md`, `scripts/newsroom/AGENTS.md` |
| public newsletter output | `newsletters/YYYY-MM-DD/newsletter.md`, `newsletters/YYYY-MM-DD/index.html`, `data/newsletters.json` | `newsletters/README.md`, `npm.cmd run validate:public`, `npm.cmd run validate:site` |
| review artifact | `content/collected-news/**`, `content/newsroom/**` | `content/README.md`, `content/AGENTS.md` |
| image contract | image resolver in `scripts/newsroom/render/`, `assets/images/fallback/` | `assets/README.md`, `npm.cmd run validate:images` |
| tests and fixtures | `tests/**`, `tests/fixtures/fixture-ledger.json` | `tests/README.md`, `tests/AGENTS.md`, `tests/fixtures/README.md`, `npm.cmd run check:fixtures` |
| localization contract | `scripts/newsroom/cli/validate-localization.js` | `docs/AGENTS.md`, `docs/glossary.ko.md`, `npm.cmd run validate:localization` |

## 폴더별 감사 결과

### `.github/`

#### 확인한 source

- `.github/workflows/01-newsroom-manual-source-collect-pr.yml`
- `.github/workflows/02-newsroom-gemini-source-discovery-pr.yml`
- `.github/workflows/03-newsroom-final-pr.yml`
- `.github/workflows/validate-site.yml`
- `.github/workflows/AGENTS.md`
- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE/**`

#### README 상태

`.github/README.md`를 추가했습니다. 01/02/03 workflow 역할, `workflow_dispatch`와 scheduled run 차이, secret 취급, PR 기반 발행 모델을 설명합니다.

#### AGENTS 상태

`.github/workflows/AGENTS.md`가 workflow folder에 필요한 추가 제약을 이미 제공합니다. root `.github/AGENTS.md`는 이번 범위에서 만들지 않습니다.

#### Drift / missing guidance

workflow stage가 01/02/03으로 나뉘었지만 root README에서는 자세한 stage owner가 드러나지 않았습니다. `.github/README.md`에서 stage별 책임과 금지선을 명시했습니다.

#### Proposed updates

`.github/README.md`에서 workflow 파일별 역할과 검증 명령을 안내합니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| 실제 구조 반영 | PASS | 현재 workflow 파일명을 기준으로 작성했습니다. |
| obsolete path 제거 | PASS | old weekly newsroom workflow 이름을 guidance로 쓰지 않았습니다. |
| AI guardrail | PASS | secret, PR 기반 발행, artifact 보존을 강조했습니다. |
| 검증 명령 | PASS | `npm.cmd run test`, `npm.cmd run validate`를 유지합니다. |

### `config/`

#### 확인한 source

- `config/newsletter-policy.json`
- `config/newsroom-budget.json`
- `scripts/newsroom/cli/sync-policy-docs.js`
- `scripts/newsroom/validate/**`
- `package.json`

#### README 상태

`config/README.md`를 추가했습니다. policy config와 budget config의 역할, generated policy block 갱신 방식, validation command를 설명합니다.

#### AGENTS 상태

root `AGENTS.md`를 상속합니다. config는 작은 계약 surface라 별도 scoped `AGENTS.md`를 만들지 않습니다.

#### Drift / missing guidance

`README.md`의 Newsletter Policy block은 generated block이므로 config를 직접 수정한 뒤 `sync:policy-docs` 또는 `check:policy-docs` 관계를 문서화해야 했습니다.

#### Proposed updates

`config/README.md`에 `config/newsletter-policy.json`이 policy source of truth임을 명시합니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| 실제 구조 반영 | PASS | 현재 두 JSON config만 설명했습니다. |
| policy drift 방지 | PASS | generated block 직접 수정 금지와 `check:policy-docs`를 명시했습니다. |
| AI guardrail | PASS | quality threshold를 낮춰 통과시키지 말라고 명시했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:config`, `npm.cmd run check:policy-docs`, `npm.cmd run validate`를 안내했습니다. |

### `scripts/`

#### 확인한 source

- `scripts/*.js`
- `scripts/lib/**`
- `scripts/newsroom/**`
- `scripts/README.md`
- `package.json`

#### README 상태

`scripts/README.md`를 보강했습니다. root wrapper와 `scripts/lib/**` shim은 compatibility surface이고 실제 구현은 `scripts/newsroom/` 아래에 둔다는 점을 유지했습니다.

#### AGENTS 상태

root `AGENTS.md`를 상속합니다. 실제 구현 folder인 `scripts/newsroom/`에는 scoped `AGENTS.md`가 있습니다.

#### Drift / missing guidance

`scripts/newsroom/README.md`의 module map이 실제 하위 폴더에서 `evidence`, `sources`를 빠뜨렸습니다.

#### Proposed updates

`scripts/newsroom/README.md`의 module map을 실제 폴더 기준으로 갱신하고, `scripts/README.md`에 wrapper 변경 시 docs/tests/workflow를 같이 갱신하라는 문구를 보강했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| 실제 구조 반영 | PASS | `cli`, `collect`, `common`, `evidence`, `generate`, `llm`, `metrics`, `render`, `sources`, `validate`를 기준으로 작성했습니다. |
| obsolete path 제거 | PASS | root wrapper에 business logic을 추가하지 않도록 유지했습니다. |
| AI guardrail | PASS | 실제 동작 수정 시작점을 `scripts/newsroom/`으로 제한했습니다. |
| 검증 명령 | PASS | wrapper나 implementation contract 변경 시 `npm.cmd run test`, `npm.cmd run validate`를 안내했습니다. |

### `scripts/newsroom/`

#### 확인한 source

- `scripts/newsroom/cli/`
- `scripts/newsroom/collect/`
- `scripts/newsroom/common/`
- `scripts/newsroom/evidence/`
- `scripts/newsroom/generate/`
- `scripts/newsroom/llm/`
- `scripts/newsroom/metrics/`
- `scripts/newsroom/render/`
- `scripts/newsroom/sources/`
- `scripts/newsroom/validate/`
- `scripts/newsroom/AGENTS.md`

#### README 상태

`scripts/newsroom/README.md`를 실제 하위 폴더 기준으로 보강했습니다.

#### AGENTS 상태

`scripts/newsroom/AGENTS.md`가 source binding, deterministic selection, quality gate, renderer 계약을 보호합니다.

#### Drift / missing guidance

module map이 일부 새 하위 폴더를 설명하지 않아 agent가 책임 위치를 잘못 추론할 수 있었습니다.

#### Proposed updates

module map과 읽기 순서를 실제 폴더 기준으로 정리했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| 실제 구조 반영 | PASS | 실제 directory list와 맞췄습니다. |
| gate 약화 없음 | PASS | source binding, quality gate, hard blocker를 유지했습니다. |
| legacy wrapper 분리 | PASS | root scripts는 wrapper로 남긴다는 설명을 유지했습니다. |
| 검증 명령 | PASS | 구현 변경 시 full validation이 필요함을 유지했습니다. |

### `tests/`

#### 확인한 source

- `tests/README.md`
- `tests/AGENTS.md`
- `tests/fixtures/README.md`
- `tests/root-test-allowlist.json`
- `tests/{unit,contract,workflow,hygiene,helpers,newsroom,fixtures}/`
- `package.json`

#### README 상태

기존 `tests/README.md`가 runner, folder 선택, fixture trust, helper, validation을 충분히 설명합니다.

#### AGENTS 상태

`tests/AGENTS.md`가 fixture trust와 regression test 작성 규칙을 보호합니다.

#### Drift / missing guidance

큰 drift는 발견하지 않았습니다. root test migration 완료 baseline과 fixture trust policy가 명확합니다.

#### Proposed updates

이번 PR에서는 유지합니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| 실제 구조 반영 | PASS | nested test folder와 root allowlist 설명이 현재 구조와 맞습니다. |
| fixture trust | PASS | generated artifact를 good/golden fixture로 쓰지 않는 규칙이 있습니다. |
| AI guardrail | PASS | validator 약화 금지가 명확합니다. |
| 검증 명령 | PASS | `npm.cmd run test`, `npm.cmd run validate`를 안내합니다. |

### `assets/`

#### 확인한 source

- `assets/images/`
- `assets/images/fallback/`
- `scripts/newsroom/render/**`
- `scripts/newsroom/validate/**`
- `package.json`

#### README 상태

`assets/README.md`를 추가했습니다.

#### AGENTS 상태

root guidance를 상속합니다. image fallback 계약은 README로 충분히 설명됩니다.

#### Drift / missing guidance

외부 기사 이미지를 임의 URL로 대체하지 말라는 root guidance가 있지만, asset folder 자체의 역할 설명이 없었습니다.

#### Proposed updates

`selectedImage`, fallback asset, external image validation 경계를 README에 명시했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| public surface 반영 | PASS | site image와 fallback image 역할을 분리했습니다. |
| image 계약 보호 | PASS | 임의 외부 URL 대체 금지를 명시했습니다. |
| generated artifact 오해 방지 | PASS | 기사 출력은 `newsletters/`와 renderer를 통해 생성된다고 설명했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:images`, `npm.cmd run validate`를 안내했습니다. |

### `css/`

#### 확인한 source

- `css/styles.css`
- `css/hero-override.css`
- `index.html`
- `templates/newsletter.html`

#### README 상태

`css/README.md`를 추가했습니다.

#### AGENTS 상태

root guidance를 상속합니다. 별도 scoped AGENTS는 필요하지 않습니다.

#### Drift / missing guidance

정적 사이트 stylesheet와 newsletter renderer/template surface의 관계가 문서화되어 있지 않았습니다.

#### Proposed updates

public site style 변경 시 homepage, archive, newsletter page를 함께 확인하도록 안내했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| public surface 반영 | PASS | `index.html`과 generated newsletter HTML 영향 가능성을 적었습니다. |
| runtime 변경 없음 | PASS | CSS 문서만 추가했습니다. |
| AI guardrail | PASS | renderer/schema 변경과 스타일 변경을 섞지 않도록 안내했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:site`, `npm.cmd run validate`를 안내했습니다. |

### `content/`

#### 확인한 source

- `content/AGENTS.md`
- `content/collected-news/**`
- `content/newsroom/**`
- `content/audit/**`

#### README 상태

`content/README.md`를 추가했습니다.

#### AGENTS 상태

`content/AGENTS.md`가 generated/review artifact 보존 기준과 cleanup 금지선을 보호합니다.

#### Drift / missing guidance

folder-level README가 없어 raw candidate, review artifact, audit artifact의 차이가 root README에만 짧게 남아 있었습니다.

#### Proposed updates

generated artifact를 source of truth처럼 다루지 말고, 수정/cleanup은 명시 요청과 보존 기준을 따르도록 README에 명시했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| generated artifact 경계 | PASS | raw/review/audit 역할을 분리했습니다. |
| mass rewrite 금지 | PASS | 명시 요청 없는 대량 수정 금지를 반복했습니다. |
| fixture trust | PASS | generated artifact를 good/golden fixture로 쓰지 않는 기준과 맞습니다. |
| 검증 명령 | PASS | artifact 변경 시 public/site/quality validation을 안내했습니다. |

### `data/`

#### 확인한 source

- `data/AGENTS.md`
- `data/news-sources.json`
- `data/newsletters.json`
- `docs/config/news-sources-fields.ko.md`
- `docs/news-sources.md`

#### README 상태

`data/README.md`를 추가했습니다.

#### AGENTS 상태

`data/AGENTS.md`가 source registry 계약과 계약-bearing 값 번역 금지를 보호합니다.

#### Drift / missing guidance

사람이 읽는 표시값과 machine contract 값의 차이가 folder README에는 없었습니다.

#### Proposed updates

`news-sources.json`과 `newsletters.json`의 역할, 검증 명령, 번역 가능 범위를 README에 명시했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| JSON 계약 반영 | PASS | `id`, `category`, `priority` 같은 계약-bearing 값 유지 기준을 적었습니다. |
| source of truth 명확화 | PASS | `news-sources.json`과 docs editorial view를 분리했습니다. |
| public index 영향 | PASS | `newsletters.json`이 site index data임을 설명했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:config`, `npm.cmd run validate:localization`, `npm.cmd run validate`를 안내했습니다. |

### `docs/`

#### 확인한 source

- `docs/AGENTS.md`
- `docs/START_HERE.ko.md`
- `docs/glossary.ko.md`
- `docs/newsroom-workflow.md`
- `docs/config/**`
- `docs/operations/**`
- `docs/plans/**`
- `docs/archive/**`

#### README 상태

`docs/README.md`를 추가했습니다.

#### AGENTS 상태

`docs/AGENTS.md`가 current/archive guidance와 링크 유지 규칙을 보호합니다.

#### Drift / missing guidance

`docs/START_HERE.ko.md`에는 주요 문서 안내가 있으나, docs folder 내부의 하위 폴더 역할을 한눈에 보는 README가 없었습니다.

#### Proposed updates

`docs/README.md`와 `docs/START_HERE.ko.md`에서 docs 하위 폴더와 새 root folder README 링크를 정리했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| current/archive 구분 | PASS | `docs/archive/**`는 현재 guidance가 아니라고 명시했습니다. |
| navigation-first 유지 | PASS | root README에 긴 설명을 중복하지 않았습니다. |
| 한글 문서 품질 | PASS | 사용자-facing 설명은 한국어로 작성했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:localization`, `npm.cmd run validate`를 안내했습니다. |

### `newsletters/`

#### 확인한 source

- `newsletters/YYYY-MM-DD/newsletter.md`
- `newsletters/YYYY-MM-DD/index.html`
- `data/newsletters.json`
- `scripts/newsroom/render/**`
- `scripts/newsroom/validate/**`

#### README 상태

`newsletters/README.md`를 추가했습니다.

#### AGENTS 상태

root guidance와 content/public artifact guidance를 상속합니다.

#### Drift / missing guidance

public newsletter output이 merge된 `main` 기준으로 GitHub Pages에 표시된다는 설명이 folder-level README에는 없었습니다.

#### Proposed updates

public URL surface, manual rewrite 금지, `data/newsletters.json` sync, validation command를 README에 명시했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| public artifact 경계 | PASS | generated output과 public site 표시 기준을 설명했습니다. |
| source of truth 오해 방지 | PASS | 최종 근거는 source/candidate/evidence artifact와 validator임을 설명했습니다. |
| mass rewrite 금지 | PASS | 기존 issue output 대량 수정 금지를 적었습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:public`, `npm.cmd run validate:site`, `npm.cmd run validate`를 안내했습니다. |

### `templates/`

#### 확인한 source

- `templates/newsletter.md`
- `templates/newsletter.html`
- `scripts/newsroom/render/**`
- `docs/newsletter-template.md`

#### README 상태

`templates/README.md`를 추가했습니다.

#### AGENTS 상태

root guidance를 상속합니다. renderer contract는 `scripts/newsroom/AGENTS.md`가 보호합니다.

#### Drift / missing guidance

template 변경이 renderer, validation, public output에 영향을 준다는 folder-level 설명이 없었습니다.

#### Proposed updates

template은 renderer 입력 surface이며 schema나 validator 변경과 함께 검토해야 한다고 설명했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| renderer boundary | PASS | template과 renderer/schema를 분리했습니다. |
| public output 영향 | PASS | `newsletters/**` output에 영향을 줄 수 있음을 적었습니다. |
| policy block 보호 | PASS | generated policy block은 config에서 갱신한다고 설명했습니다. |
| 검증 명령 | PASS | `npm.cmd run validate:site`, `npm.cmd run validate:public`, `npm.cmd run validate`를 안내했습니다. |

### root files

#### 확인한 source

- `README.md`
- `AGENTS.md`
- `package.json`
- `.editorconfig`
- `.gitattributes`
- `.gitignore`
- `index.html`

#### README 상태

root README는 navigation-first entry 역할을 유지하되 folder README 링크와 root map을 보강했습니다.

#### AGENTS 상태

root AGENTS는 저장소 전체 작업 규칙을 유지하고, scoped AGENTS 상속 규칙과 실제 `scripts/newsroom/` 하위 폴더 목록을 보강했습니다.

#### Drift / missing guidance

root README는 자세한 workflow/manual을 중복하지 않는 방향이 맞습니다. 다만 새 folder README로 연결하는 링크가 부족했습니다.

#### Proposed updates

root README의 folder map을 링크 중심으로 보강하고, root AGENTS의 scoped policy에 상속 규칙을 추가했습니다.

#### 자체 리뷰

| Check | Result | Notes |
| --- | --- | --- |
| README/AGENTS 역할 분리 | PASS | README는 진입/탐색, AGENTS는 작업 규칙으로 유지했습니다. |
| policy drift 방지 | PASS | Newsletter Policy generated block은 직접 수정하지 않았습니다. |
| local scratch 보호 | PASS | `PLAN.md` local-only 원칙을 유지했습니다. |
| 검증 명령 | PASS | root guidance의 `npm.cmd run test`, `npm.cmd run validate`를 유지했습니다. |

## Main agent 취합 리뷰

### 문서 간 충돌

- root README는 짧은 navigation entry로 유지했습니다.
- folder README는 사람용 orientation과 주요 검증 명령을 제공합니다.
- scoped AGENTS는 folder-specific 금지/주의 사항만 담당하고 root AGENTS를 대체하지 않습니다.

결과: PASS

### 용어 일관성

- `publish-ready`, `needs-fix`, `review-only-publication`, `diagnostics-only`는 workflow label/상태 이름으로 원문을 유지했습니다.
- `quality gate`, `source binding`, `hard blocker`, `generated artifact`는 용어집과 README에서 같은 의미로 사용합니다.
- `collection_intent`, `seed_url`, `keyword_hints`, `compact_evidence`, `source_gap_risk`, `claim.evidence_ids`는 `docs/glossary.ko.md`에 설명을 보강했습니다.

결과: PASS

### Obsolete reference 점검

- old weekly newsroom workflow 이름을 현재 guidance로 쓰지 않았습니다.
- 01/02/03 workflow는 `.github/workflows/`의 실제 파일명 기준으로 설명했습니다.
- `tools/`는 현재 root에 없으므로 future candidate로만 기록했습니다.

결과: PASS

### Public path / generated artifact risk

- `index.html`, `assets/`, `css/`, `data/newsletters.json`, `newsletters/**`는 public/static site surface로 설명했습니다.
- `content/collected-news/**`, `content/newsroom/**`는 review/generated artifact로 설명했습니다.
- generated artifact를 good/golden fixture나 source of truth처럼 취급하지 않도록 content, tests, newsletters 설명을 맞췄습니다.

결과: PASS

### Policy drift 점검

현재 공식 문서의 기준 값은 `config/newsletter-policy.json`과 README generated policy block입니다. `content/newsroom/**`와 오래된 generated artifact에는 당시 실행 시점의 policy 문구가 남아 있을 수 있으며, 이번 docs-only 작업에서는 과거 산출물을 rewrite하지 않습니다.

- Main article count: `1-5`
- Quality threshold: `85`
- Source-less main article, `source_gap_risk`, duplicate source URL 같은 hard fail condition은 blocking입니다.

결과: PASS, active official docs 기준

## 남은 follow-up

| Issue | 남은 범위 | #188에서의 처리 |
| --- | --- | --- |
| #44 | root restructure와 public URL/path contract 정리 | 구조 이동 없이 현재 root map만 문서화 |
| #58 | dead code/obsolete file 후보 정리 | delete 후보 목록화는 별도 cleanup으로 유지 |
| #43 | internal domain model boundary | docs에서 future/open boundary로만 언급 |
| #72 | pipeline architecture refactor | #185 stage 역할을 current boundary로 문서화 |

## Validation record

PR branch: `codex/issue-188-root-docs-guidance`

| Command | Result |
| --- | --- |
| targeted Markdown newline/BOM check | PASS: 대상 Markdown file은 UTF-8 without BOM, LF-only, `CR=0` |
| `git diff --check` | PASS |
| `npm.cmd run check:encoding` | PASS |
| `npm.cmd run validate:localization` | PASS |
| `npm.cmd run check:policy-docs` | PASS |
| `npm.cmd run check:repo-hygiene` | PASS |
| `npm.cmd run validate:archive` | PASS |
| `npm.cmd run test` | PASS |
| `npm.cmd run validate` | PASS |
| policy drift stale value grep | PASS: `quality threshold 90`, `main articles 5-6`, `MIN_FINAL_ARTICLES=4` pattern 없음 |

`npm.cmd run validate`의 historical newsletter artifact warning은 warning-only이며, 이번 PR의 docs guidance 변경 범위 밖이라 수정하지 않았습니다.

Policy drift 점검:

```powershell
git grep "quality threshold"
git grep "Quality threshold"
git grep "Main article count"
git grep "MIN_FINAL_ARTICLES"
git grep "primaryCameraStack"
git grep "publish-ready"
git grep "needs-fix"
git grep "source_gap_risk"
git grep "collection-intent"
git grep "compact_evidence"
```
