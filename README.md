# AOSP Camera / Driver / SoC Platform Newsletter

> 기본 뉴스룸(newsroom) 공급자는 Gemini입니다. 기본 실행과 예약 실행(scheduled run)은 코드 기본값(code default)을 따르며, `workflow_dispatch` 수동 실행에서만 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` 재정의(override)가 런타임 환경 변수(runtime env)로 전달됩니다. 토큰은 GitHub Secrets에서만 읽습니다.

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform 소식을 수집해 정적 뉴스레터로 발행합니다. 후보 수집과 Gemini 기반 뉴스룸 자동화는 검토 가능한 리뷰 산출물(review artifact)을 만들고, 발행은 사람이 승인한 PR merge를 통해서만 진행합니다. 비용 절감은 deterministic shortlist(결정론적 숏리스트), compact article capsule(요약된 기사 캡슐), retry scope(재시도 범위) 제한으로 처리하며 quality gate(품질 게이트)를 낮추지 않습니다.

처음 보는 사람은 모든 파일을 뒤지지 말고 아래 문서부터 읽으면 됩니다. README는 긴 운영 매뉴얼이 아니라, 각 세부 문서로 연결하는 짧은 진입점 역할만 합니다.

## 시작 가이드

| 문서 | 역할 |
| --- | --- |
| [docs/START_HERE.ko.md](docs/START_HERE.ko.md) | 처음 보는 운영자와 에이전트(agent)를 위한 진입점입니다. |
| [docs/glossary.ko.md](docs/glossary.ko.md) | 뉴스룸, 산출물(artifact), 게이트 용어를 설명합니다. |
| [docs/newsroom-workflow.md](docs/newsroom-workflow.md) | 후보 수집부터 PR 생성까지의 워크플로(workflow)를 설명합니다. |
| [docs/operations/README.ko.md](docs/operations/README.ko.md) | 수동 실행, PR 리뷰, 릴리스, 산출물 리뷰 순서입니다. |
| [docs/config/action-variables.ko.md](docs/config/action-variables.ko.md) | GitHub Actions Secret과 Variable 기본값을 설명합니다. |
| [docs/config/news-sources-fields.ko.md](docs/config/news-sources-fields.ko.md) | `src/core/data/news-sources.json` field 계약을 설명합니다. |
| [src/AGENTS.md](src/AGENTS.md) | #262 재구성 후 `src/` layer 구조와 구현·테스트 규칙을 설명합니다. |

뉴스레터 생성은 아래 흐름으로 진행됩니다. 중요한 점은 생성 성공과 발행 가능 상태가 다르다는 것입니다.

## 5분 안에 처음 실행하기

```powershell
git clone <repo-url>
cd camera-hal-sw-newsletter
npm install
npm.cmd run test
npm.cmd run validate
```

`test`와 `validate`가 모두 통과하면 로컬 환경이 준비된 것입니다. 실제 뉴스룸 파이프라인 실행은 `GEMINI_API_KEY`가 필요하며, 자세한 절차는 [docs/operations/README.ko.md](docs/operations/README.ko.md)를 확인합니다.

## 현재 운영 모델

```text
candidate collection
  -> deterministic shortlist
  -> LLM reporter/editor/fact-check (default: Gemini)
  -> quality gate
  -> review PR
  -> GitHub Pages
```

`articles/content/collected-news/YYYY-MM-DD/`에는 원시 후보(raw candidate)가, `articles/content/newsroom/YYYY-MM-DD/`에는 리뷰 산출물이, `articles/newsletters/YYYY-MM-DD/`에는 공개 산출물(public artifact)이 저장됩니다. `publish-ready` 상태가 아니면 PR이 만들어져도 발행 가능한 뉴스레터로 보지 않습니다.

로컬에서 확인할 때는 아래 명령만 기억하면 됩니다. 변경 범위가 넓거나 확신이 없으면 `ci`를 우선 사용합니다.

`publish-ready`는 AI 자동 발행 가능 상태입니다. `needs-fix`라도 공개 산출물이 포함되면 편집장 main merge를 사이트 공개 승인으로 해석합니다. `Validate Site and Images` (`.github/workflows/validate-site.yml`)는 구조 검증(structural validation)은 blocking(차단)으로, quality/fact-check 문제는 non-blocking annotation(비차단 알림)으로 보고합니다.

## 주요 명령

Windows PowerShell에서는 `npm.cmd`를 우선 사용합니다.

| 명령 | 언제 쓰나 | 결과물 |
| --- | --- | --- |
| `npm.cmd run test` | 단위/통합 테스트 회귀 확인 | `tests/` 전수 결과 |
| `npm.cmd run validate` | docs·정책·인코딩·site 무결성 검사 | `validate:*` 체인 보고 |
| `npm.cmd run ci` | test + validate 한꺼번에 | 변경 범위 넓을 때 1차 신뢰도 확인 |
| `npm.cmd run collect` | `src/core/data/news-sources.json` 기반 후보 수집 | `articles/content/collected-news/YYYY-MM-DD/` |
| `npm.cmd run generate` | LLM 뉴스룸 파이프라인 (Gemini 공급자 사용 시 `GEMINI_API_KEY` 필요) | `articles/content/newsroom/YYYY-MM-DD/` |

공급자/모델 재정의와 사내 API Secret 설정은 [docs/config/action-variables.ko.md](docs/config/action-variables.ko.md)를 확인합니다.

폴더 구조는 목적별로 나뉘어 있습니다. 실제 구현과 tooling은 모두 `src/`에 있고(#262 재구성으로 root `scripts/` wrapper는 제거됨), 검토 산출물과 공개 발행물은 `content/`와 `newsletters/`에 분리됩니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| [`.github/`](.github/README.md) | issue/PR 템플릿, 뉴스룸 PR 워크플로, 검증 워크플로입니다. |
| [`config/`](config/README.md) | newsroom 예산 등 일부 설정입니다. (뉴스레터 정책은 `src/core/config/newsletter-policy.json`로 이동) |
| [`state/`](state/README.md) | source snapshot monitor, article exposure history 등 파이프라인 운영 state입니다. (source 레지스트리는 `src/core/data/news-sources.json`, 서빙되는 index data는 `articles/data/`) |
| [`docs/`](docs/README.md) | 운영 문서, 용어집, source 안내입니다. |
| [`src/`](src/AGENTS.md) | 실제 수집기(collector), 생성기(generator), 렌더러(renderer), 검증기(validator), tooling 구현입니다. core/collector/discovery/generator layer로 나뉘며, 회귀 테스트는 `src/<layer>/test/`에 함께 둡니다. |
| [`articles/content/`](articles/content/README.md) | 수집 후보와 뉴스룸 리뷰 산출물입니다. |
| [`articles/newsletters/`](articles/newsletters/README.md) | 공개 뉴스레터 Markdown/HTML 출력물입니다. |
| [`articles/assets/`](articles/assets/README.md) | 사이트 이미지와 기사 fallback 이미지입니다. |
| [`articles/css/`](articles/css/README.md) | 정적 사이트 스타일입니다. |

## 범위별 AGENTS

각 영역에는 안전 규칙이 별도 `AGENTS.md`로 정의되어 있습니다. 해당 영역을 수정할 때 먼저 읽으세요.

| 영역 | 파일 | 보호 대상 |
| --- | --- | --- |
| 저장소 전반 | [AGENTS.md](AGENTS.md) | 인코딩, PR 범위, fixture 신뢰 |
| 구현·테스트 | [src/AGENTS.md](src/AGENTS.md) | layer/의존 방향, 리뷰·발행 가드레일, 테스트·fixture 신뢰 정책 |
| 워크플로 | [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md) | Secret 처리, PR 기반 발행 |
| state | [state/AGENTS.md](state/AGENTS.md) | 파이프라인 운영 state 계약 |
| 문서 | [docs/AGENTS.md](docs/AGENTS.md) | 한국어 우선, audit/worklog 금지 |

마지막으로, 아래 규칙은 문서 정리나 리팩토링 중에도 약화하면 안 됩니다.

## 약화하면 안 되는 규칙

- 뉴스레터 발행은 PR 머지를 통해서만 진행합니다.
- 생성된 issue를 `main`에 직접 자동 발행하지 않습니다.
- source가 없는 main article(주요 기사)은 발행하지 않습니다.
- dated evidence(날짜가 명시된 근거) 없는 watch/reference 페이지를 main article로 승격하지 않습니다.
- quality gate, source binding(출처 결속), image validation(이미지 검증), hard blocker(하드 블로커)를 약화하지 않습니다.
- generated artifact를 good/golden fixture(검증된 fixture)로 자동 신뢰하지 않습니다.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update src/core/config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### Newsletter Policy

- Source of truth: `src/core/config/newsletter-policy.json`
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
- Catch-up (지난 소식) lane: when fresh selection is below 3 article(s), open main slots are filled with uncovered releases up to 90 days old from buckets `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, at most 2 per issue, covered once each; never displaces fresh content.
- Homepage headline policy: linear decay; decay 2 point(s)/day; replacement margin 5; minimum headline score 40; latest inclusion required true; history max 50
- Publish gate: PASS requires no source gaps, no fact-check must_fix, no blocking deductions, and every article marked publishable by the fact-checker. There is no numeric quality threshold.
- Editorial quality: the fact-checker (LLM) judges each article on usefulness to a Camera HAL SW engineer (topic-agnostic — C++, AI, or Linux articles qualify when they help that engineer). Topic/depth heuristics are not used as deterministic publish gates.
- Hard fail conditions remain blocking: source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->
