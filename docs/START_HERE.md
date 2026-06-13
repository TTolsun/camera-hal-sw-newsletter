# 처음 보는 사람은 여기부터

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC/CPU/GPU/NPU, power/thermal/performance 관련 소식을 모으는 프로젝트입니다. Gemini 기반 newsroom(기사 생성 자동화)이 사람이 검토할 수 있는 정적 뉴스레터를 만듭니다.

발행이 `main`에 자동으로 들어가는 일은 없습니다. 순서는 이렇습니다. 후보 수집 → deterministic shortlist(코드가 후보를 미리 추림) → Gemini 생성 → 검증 → 편집자 검토 PR. 사람이 확인하고 merge하면 그때 GitHub Pages가 발행합니다.

## 먼저 읽을 문서

| 문서 | 역할 |
| --- | --- |
| [README.md](../README.md) | 짧은 저장소 entry 문서입니다. |
| [glossary.md](glossary.md) | newsroom과 artifact 용어를 설명합니다. |
| [newsroom-workflow.md](newsroom-workflow.md) | 후보 수집부터 PR 생성까지의 운영 흐름입니다. |
| [operations/README.md](operations/README.md) | 수동 실행, PR review, release, artifact review 순서입니다. |
| [config/action-variables.md](config/action-variables.md) | GitHub Actions Secret과 Variable 설명입니다. |
| [config/news-sources-fields.md](config/news-sources-fields.md) | `src/shared/data/news-sources.json` field 계약입니다. |
| [src/AGENTS.md](../src/AGENTS.md) | #262 재구성 후 `src/` layer 구조와 구현·테스트 규칙을 설명합니다. |

Newsletter Policy의 현재 값은 `src/shared/config/newsletter-policy.json`이 정본(source of truth)입니다. 대표 운영 문서에 들어가는 generated Newsletter Policy block은 스크립트가 자동으로 갱신합니다. 일반 문서에서 article count(기사 수) 같은 숫자를 손으로 고치지 마세요.

## 문서 역할

| 경로 | 역할 |
| --- | --- |
| `docs/glossary.md` | 코드 식별자와 artifact 이름의 의미를 설명합니다. |
| `docs/README.md` | docs 하위 폴더와 현재 운영 문서 기준을 안내합니다. |
| `docs/newsroom-workflow.md` | newsroom pipeline, quality gate, artifact, GitHub Actions 운영을 설명합니다. |
| `docs/editorial-policy.md` | newsletter editorial policy와 scope 판단 기준입니다. |
| `docs/news-sources.md` | 사람이 검토하는 source editorial view입니다. |
| `docs/news-sources-guide.md` | source registry 수정 절차입니다. |
| `docs/newsletter-template.md` | newsletter 구조와 template 계약입니다. |
| `docs/config/` | runtime config와 source registry field 설명입니다. |
| `docs/operations/` | 반복 운영 절차의 짧은 안내입니다. |
| `docs/AGENTS.md` | docs 폴더의 현재 운영 문서 기준과 링크 유지 규칙입니다. |

## 주요 폴더

| 경로 | 역할 |
| --- | --- |
| [`.github/`](../.github/README.md) | 후보 수집, Gemini 생성, 검증, PR 생성, Pages 검증 workflow입니다. |
| [`config/`](../config/README.md) | budget config입니다. (newsletter policy는 `src/shared/config/newsletter-policy.json`로 이동) |
| [`state/`](../state/README.md) | source snapshot monitor, article exposure history 등 파이프라인 운영 state입니다. (source registry는 `src/shared/data/news-sources.json`, 서빙되는 index data는 `articles/data/`) |
| [`src/`](../src/AGENTS.md) | 실제 collector, generator, renderer, validator, tooling 구현입니다. shared/collector/discovery/generator layer로 나뉘며, regression test는 `src/<layer>/test/`에 함께 둡니다. |
| [`articles/content/`](../articles/content/README.md) | 날짜별 raw candidate와 newsroom review artifact입니다. |
| [`articles/newsletters/`](../articles/newsletters/README.md) | 발행될 날짜별 `newsletter.md`와 `index.html`입니다. |
| [`articles/assets/`](../articles/assets/README.md) | site image와 article-image fallback asset입니다. |
| [`articles/css/`](../articles/css/README.md) | 정적 사이트 공통 스타일입니다. |

## 안전한 수정 순서

1. 고치려는 영역의 `AGENTS.md`(해당 폴더 전용 규칙)를 먼저 확인합니다.
2. PR 하나에는 한 가지 주제만 담습니다.
3. 변경 후 `npm.cmd run test`를 실행합니다.
4. 변경 후 `npm.cmd run validate`를 실행합니다.
5. source registry나 문서 변경처럼 범위가 좁아도, 관련된 targeted validation(좁은 범위 검증)을 함께 실행합니다.
6. generated artifact가 새로 생겼다면 `articles/content/collected-news/`, `articles/content/newsroom/`, `articles/newsletters/`, `articles/data/newsletters.json`의 변경 내용을 직접 확인합니다.
