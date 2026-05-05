# AOSP Camera / Driver / SoC Platform Newsletter

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform 소식을 수집해 정적 뉴스레터로 발행합니다. 후보 수집과 Gemini 기반 newsroom 자동화는 검토 가능한 PR artifact를 만들고, 발행은 사람이 승인한 PR merge를 통해서만 진행합니다. 비용 절감은 deterministic shortlist, compact article capsule, retry scope 제한으로 처리하며 quality gate를 낮추지 않습니다.

## Start Here

| 문서 | 역할 |
| --- | --- |
| [docs/START_HERE.ko.md](docs/START_HERE.ko.md) | 처음 보는 운영자와 agent를 위한 진입점입니다. |
| [docs/glossary.ko.md](docs/glossary.ko.md) | newsroom, artifact, gate 용어를 설명합니다. |
| [docs/newsroom-workflow.md](docs/newsroom-workflow.md) | 후보 수집부터 PR 생성까지의 workflow를 설명합니다. |
| [docs/config/action-variables.ko.md](docs/config/action-variables.ko.md) | GitHub Actions Secret과 Variable 기본값을 설명합니다. |
| [docs/config/news-sources-fields.ko.md](docs/config/news-sources-fields.ko.md) | `data/news-sources.json` field 계약을 설명합니다. |
| [docs/testing/test-baseline.md](docs/testing/test-baseline.md) | 현재 validation baseline을 기록합니다. |

## Current Operating Model

```text
candidate collection
  -> deterministic shortlist
  -> Gemini reporter/editor/fact-check
  -> quality gate
  -> review PR
  -> GitHub Pages
```

`content/collected-news/YYYY-MM-DD/`에는 raw candidate가, `content/newsroom/YYYY-MM-DD/`에는 review artifact가, `newsletters/YYYY-MM-DD/`에는 public issue output이 저장됩니다. `publish-ready` 상태가 아니면 PR이 만들어져도 발행 가능한 뉴스레터로 보지 않습니다.

## Main Commands

Windows PowerShell에서는 `npm.cmd`를 우선 사용합니다.

```powershell
npm.cmd run test
npm.cmd run validate
npm.cmd run ci
npm.cmd run collect
npm.cmd run generate
```

`collect`는 `data/news-sources.json`에서 후보를 수집합니다. `generate`는 Gemini newsroom pipeline을 실행하며 `GEMINI_API_KEY`가 필요합니다. 전체 로컬 확인은 `npm.cmd run ci`를 사용합니다.

## Repository Map

| 경로 | 역할 |
| --- | --- |
| `.github/workflows/` | newsroom PR workflow와 validation workflow입니다. |
| `data/` | `newsletters.json`과 machine-readable source registry입니다. |
| `docs/` | 운영 문서, glossary, source guide, testing 기록입니다. |
| `scripts/newsroom/` | 실제 collector, generator, renderer, validator 구현입니다. |
| `tests/` | Node built-in test runner 기반 regression test입니다. |
| `content/` | 수집 후보와 newsroom review artifact입니다. |
| `newsletters/` | public newsletter Markdown/HTML output입니다. |
| `assets/` | site image와 article fallback image입니다. |
| `css/` | 정적 사이트 스타일입니다. |
| `templates/` | newsletter Markdown/HTML template입니다. |

## Rules That Must Not Be Weakened

- Newsletter publishing must remain PR-based.
- Do not directly auto-publish generated issues to `main`.
- Do not publish source-less main articles.
- Do not promote watch/reference pages to main articles without dated evidence.
- Do not weaken quality gate, source binding, image validation, or hard blockers.
- Generated artifacts are not automatically trusted as good/golden fixtures.
