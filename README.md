# AOSP Camera / Driver / SoC Platform Newsletter

> 기본 newsroom provider는 Gemini입니다. 기본 실행과 scheduled run은 code default를 따르며, `workflow_dispatch` 수동 실행에서만 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` override가 runtime env로 전달됩니다. 사내 API 설정은 `INTERNAL_LLM_API_KEY`, `INTERNAL_LLM_ENDPOINT`, `INTERNAL_LLM_API_VERSION`를 사용하며 token은 GitHub Secrets에서만 읽습니다.

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform 소식을 수집해 정적 뉴스레터로 발행합니다. 후보 수집과 Gemini 기반 newsroom 자동화는 검토 가능한 PR artifact를 만들고, 발행은 사람이 승인한 PR merge를 통해서만 진행합니다. 비용 절감은 deterministic shortlist, compact article capsule, retry scope 제한으로 처리하며 quality gate를 낮추지 않습니다.

처음 보는 사람은 모든 파일을 뒤지지 말고 아래 문서부터 읽으면 됩니다. README는 긴 운영 매뉴얼이 아니라, 각 세부 문서로 연결하는 짧은 entry 역할만 합니다.

## Start Here

| 문서 | 역할 |
| --- | --- |
| [docs/START_HERE.ko.md](docs/START_HERE.ko.md) | 처음 보는 운영자와 agent를 위한 진입점입니다. |
| [docs/glossary.ko.md](docs/glossary.ko.md) | newsroom, artifact, gate 용어를 설명합니다. |
| [docs/newsroom-workflow.md](docs/newsroom-workflow.md) | 후보 수집부터 PR 생성까지의 workflow를 설명합니다. |
| [docs/operations/README.ko.md](docs/operations/README.ko.md) | 수동 실행, PR review, release, artifact review 순서입니다. |
| [docs/config/action-variables.ko.md](docs/config/action-variables.ko.md) | GitHub Actions Secret과 Variable 기본값을 설명합니다. |
| [docs/config/news-sources-fields.ko.md](docs/config/news-sources-fields.ko.md) | `data/news-sources.json` field 계약을 설명합니다. |
| [docs/testing/test-baseline.md](docs/testing/test-baseline.md) | 현재 validation baseline을 기록합니다. |
| [scripts/README.md](scripts/README.md) | scripts wrapper와 실제 newsroom 구현 진입점을 설명합니다. |

뉴스레터 생성은 아래 흐름으로 진행됩니다. 중요한 점은 생성 성공과 발행 가능 상태가 다르다는 것입니다.

## Current Operating Model

```text
candidate collection
  -> deterministic shortlist
  -> LLM reporter/editor/fact-check (default: Gemini)
  -> quality gate
  -> review PR
  -> GitHub Pages
```

`content/collected-news/YYYY-MM-DD/`에는 raw candidate가, `content/newsroom/YYYY-MM-DD/`에는 review artifact가, `newsletters/YYYY-MM-DD/`에는 public issue output이 저장됩니다. `publish-ready` 상태가 아니면 PR이 만들어져도 발행 가능한 뉴스레터로 보지 않습니다.

로컬에서 확인할 때는 아래 명령만 기억하면 됩니다. 변경 범위가 넓거나 확신이 없으면 `ci`를 우선 사용합니다.

`publish-ready`는 AI 자동 발행 가능 상태입니다. `needs-fix`라도 public artifact가 포함되면 편집장 main merge를 사이트 공개 승인으로 해석합니다. `Validate Site and Images` (`.github/workflows/validate-site.yml`)는 structural validation은 blocking으로, quality/fact-check 문제는 non-blocking annotation으로 보고합니다.

## Main Commands

Windows PowerShell에서는 `npm.cmd`를 우선 사용합니다.

```powershell
npm.cmd run test
npm.cmd run validate
npm.cmd run ci
npm.cmd run collect
npm.cmd run generate
```

기본 `generate` 실행은 Gemini provider를 사용하므로 `GEMINI_API_KEY`가 필요합니다. `workflow_dispatch` 수동 실행에서 provider/model을 바꾸는 방법과 사내 API secret/variable 설정은 [docs/config/action-variables.ko.md](docs/config/action-variables.ko.md)를 확인합니다.

`collect`는 `data/news-sources.json`에서 후보를 수집합니다. `generate`는 LLM newsroom pipeline(default: Gemini)을 실행합니다. 기본 provider인 Gemini를 사용할 때는 `GEMINI_API_KEY`가 필요합니다. 전체 로컬 확인은 `npm.cmd run ci`를 사용합니다.

폴더 구조는 목적별로 나뉘어 있습니다. 실제 구현은 `scripts/newsroom/`에 있고, 검토 산출물과 공개 발행물은 `content/`와 `newsletters/`에 분리됩니다.

## Repository Map

| 경로 | 역할 |
| --- | --- |
| `.github/workflows/` | newsroom PR workflow와 validation workflow입니다. |
| `data/` | `newsletters.json`과 machine-readable source registry입니다. |
| `docs/` | 운영 문서, glossary, source guide, testing 기록입니다. |
| [`scripts/newsroom/`](scripts/newsroom/README.md) | 실제 collector, generator, renderer, validator 구현입니다. |
| `tests/` | Node built-in test runner 기반 regression test입니다. |
| `content/` | 수집 후보와 newsroom review artifact입니다. |
| `newsletters/` | public newsletter Markdown/HTML output입니다. |
| `assets/` | site image와 article fallback image입니다. |
| `css/` | 정적 사이트 스타일입니다. |
| `templates/` | newsletter Markdown/HTML template입니다. |

마지막으로, 아래 규칙은 문서 정리나 리팩토링 중에도 약화하면 안 됩니다.

## Rules That Must Not Be Weakened

- Newsletter publishing must remain PR-based.
- Do not directly auto-publish generated issues to `main`.
- Do not publish source-less main articles.
- Do not promote watch/reference pages to main articles without dated evidence.
- Do not weaken quality gate, source binding, image validation, or hard blockers.
- Generated artifacts are not automatically trusted as good/golden fixtures.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### Newsletter Policy

- Source of truth: `config/newsletter-policy.json`
- Main article count: 1-5
- One-article policy: a public newsletter may contain a single fully publishable main article.
- Article count alone does not make a one-article issue degraded or review-only; hard quality gates still apply.
- Supporting-only policy: a single supporting main bucket article may be public-ready when all hard gates pass.
- Review gate Primary Camera Stack articles: disabled by one-article policy
- Publish-ready Primary Camera Stack articles: disabled by one-article policy
- Publish-ready direct AOSP Camera or driver/image pipeline articles: disabled by one-article policy across `direct_aosp_camera`, `camera_driver_image_pipeline`
- Publish-ready supporting main articles: at most 1 total across supporting main buckets
- Primary Camera Stack buckets: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- Supporting main buckets: `android_multimedia_camera_output`, `soc_platform_signal`, `cpp_ai_tooling_fallback`
- Forbidden main buckets: `generic_tech_watchlist`; never promote these to main articles by candidate count alone
- Candidate pool preflight: publishable candidates at least 1; reserve candidates diagnostics only; camera stack candidates at least 0
- Selection windows: primary 7 days; fallback 21 days; reference 90 days
- Selection window enforcement: main selection enforced; fallback window candidates are promoted only when primary window selection is short.
- Quality threshold: 85
- Hard fail conditions remain blocking: source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->
