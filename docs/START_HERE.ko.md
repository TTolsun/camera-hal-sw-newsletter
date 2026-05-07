# 처음 보는 사람은 여기부터

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC/CPU/GPU/NPU, power/thermal/performance 관련 소식을 수집하고 Gemini 기반 newsroom 자동화로 검토 가능한 정적 뉴스레터를 만드는 프로젝트입니다.

발행은 자동으로 `main`에 직접 들어가지 않습니다. 후보 수집, deterministic shortlist, Gemini 생성, 검증, 편집자 검토 PR을 거쳐 사람이 확인한 뒤 merge하면 GitHub Pages가 발행합니다.

## 먼저 읽을 문서

| 문서 | 역할 |
| --- | --- |
| [README.md](../README.md) | 짧은 저장소 entry 문서입니다. |
| [glossary.ko.md](glossary.ko.md) | newsroom과 artifact 용어를 설명합니다. |
| [newsroom-workflow.md](newsroom-workflow.md) | 후보 수집부터 PR 생성까지의 운영 흐름입니다. |
| [operations/README.ko.md](operations/README.ko.md) | 수동 실행, PR review, release, artifact review 순서입니다. |
| [config/action-variables.ko.md](config/action-variables.ko.md) | GitHub Actions Secret과 Variable 설명입니다. |
| [config/news-sources-fields.ko.md](config/news-sources-fields.ko.md) | `data/news-sources.json` field 계약입니다. |
| [testing/test-baseline.md](testing/test-baseline.md) | 현재 test/validation baseline입니다. |

Newsletter Policy의 현재 값은 `config/newsletter-policy.json`이 source of truth입니다. 대표 운영 문서의 generated Newsletter Policy block은 스크립트로 갱신되며, 일반 문서에서 article count 숫자를 직접 수정하지 않습니다.

## 문서 역할

| 경로 | 역할 |
| --- | --- |
| `docs/glossary.ko.md` | 코드 식별자와 artifact 이름의 의미를 설명합니다. |
| `docs/newsroom-workflow.md` | newsroom pipeline, quality gate, artifact, GitHub Actions 운영을 설명합니다. |
| `docs/editorial-policy.md` | newsletter editorial policy와 scope 판단 기준입니다. |
| `docs/news-sources.md` | 사람이 검토하는 source editorial view입니다. |
| `docs/news-sources-guide.md` | source registry 수정 절차입니다. |
| `docs/newsletter-template.md` | newsletter 구조와 template 계약입니다. |
| `docs/config/` | runtime config와 source registry field 설명입니다. |
| `docs/testing/` | validation baseline과 generated artifact audit 기록입니다. |
| `docs/plans/` | 승인된 계획 또는 완료된 계획 기록입니다. |
| `docs/operations/` | 반복 운영 절차의 짧은 안내입니다. |
| `docs/archive/` | 현재 guidance로 쓰지 않는 과거 note입니다. |
| `docs/AGENTS.md` | docs 폴더의 current/archive guidance 구분과 링크 유지 규칙입니다. |

## 주요 폴더

| 경로 | 역할 |
| --- | --- |
| `.github/workflows/` | 후보 수집, Gemini 생성, 검증, PR 생성, Pages 검증 workflow입니다. |
| `data/` | `newsletters.json`과 machine-readable source registry인 `news-sources.json`입니다. |
| `scripts/newsroom/` | 실제 collector, generator, renderer, validator 구현입니다. |
| `tests/` | Node built-in test runner 기반 regression test입니다. |
| `content/collected-news/` | 날짜별 raw candidate output인 `YYYY-MM-DD/candidates.json`입니다. |
| `content/newsroom/` | 날짜별 reporter, editor, fact-check, quality, retry, QA artifact입니다. |
| `newsletters/` | 발행될 날짜별 `newsletter.md`와 `index.html`입니다. |
| `templates/` | newsletter Markdown/HTML template입니다. |
| `assets/` | site image와 article-image fallback asset입니다. |
| `css/` | 정적 사이트 공통 스타일입니다. |

## 안전한 수정 순서

1. 관련 scoped `AGENTS.md`를 확인합니다.
2. PR 하나에는 한 관심사만 담습니다.
3. 변경 후 `npm.cmd run test`를 실행합니다.
4. 변경 후 `npm.cmd run validate`를 실행합니다.
5. source registry나 문서 변경처럼 범위가 좁은 경우에도 관련 targeted validation을 함께 실행합니다.
6. generated artifact가 생겼다면 `content/collected-news/`, `content/newsroom/`, `newsletters/`, `data/newsletters.json` 변경을 직접 확인합니다.
