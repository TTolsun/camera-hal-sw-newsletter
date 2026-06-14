# AOSP Camera / Driver / SoC Platform Newsletter

> 뉴스룸(newsroom, 기사 생성 자동화) 기본 공급자는 Gemini입니다. 평소 실행과 예약 실행(scheduled run)은 코드에 박힌 기본값(code default)을 그대로 씁니다. 모델/공급자 재정의(override)인 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS`는 `workflow_dispatch`(수동 실행)에서만 런타임 환경 변수(runtime env)로 전달됩니다. 토큰은 GitHub Secrets에서만 읽습니다.

이 저장소는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform 소식을 모아 정적 뉴스레터로 발행합니다.

동작 방식은 두 단계로 나뉩니다.

- 후보 수집과 Gemini 뉴스룸 자동화는 사람이 검토할 수 있는 리뷰 산출물(review artifact)만 만듭니다.
- 실제 발행은 사람이 승인한 PR merge로만 일어납니다.

비용은 다음 세 가지로 줄입니다. quality gate(품질 게이트, 발행 안전 기준)는 절대 낮추지 않습니다.

- deterministic shortlist(결정론적 숏리스트): 코드가 후보를 미리 추려냄
- compact article capsule(요약된 기사 캡슐): LLM에는 핵심만 추려 전달
- retry scope(재시도 범위) 제한: 다시 시도하는 범위를 좁힘

처음 보는 사람은 모든 파일을 뒤질 필요가 없습니다. 아래 문서부터 읽으세요. 이 README는 긴 운영 매뉴얼이 아니라, 세부 문서로 안내하는 짧은 진입점입니다.

## 시작 가이드

| 문서 | 역할 |
| --- | --- |
| [docs/START_HERE.md](docs/START_HERE.md) | 처음 보는 운영자와 에이전트(agent)를 위한 진입점입니다. |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | 뉴스룸, 산출물(artifact), 게이트 용어를 설명합니다. |
| [docs/NEWSROOM_WORKFLOW.md](docs/NEWSROOM_WORKFLOW.md) | 후보 수집부터 PR 생성까지의 워크플로(workflow)를 설명합니다. |
| [docs/operations/README.md](docs/operations/README.md) | 수동 실행, PR 리뷰, 릴리스, 산출물 리뷰 순서입니다. |
| [docs/config/ACTION_VARIABLES.md](docs/config/ACTION_VARIABLES.md) | GitHub Actions Secret과 Variable 기본값을 설명합니다. |
| [docs/config/NEWS_SOURCES_FIELDS.md](docs/config/NEWS_SOURCES_FIELDS.md) | `src/shared/data/news-sources.json` field 계약을 설명합니다. |
| [src/AGENTS.md](src/AGENTS.md) | #262 재구성 후 `src/` layer 구조와 구현·테스트 규칙을 설명합니다. |

뉴스레터 생성 흐름은 아래와 같습니다. 한 가지만 기억하세요. **생성에 성공했다고 발행 가능한 상태는 아닙니다.**

## 5분 안에 처음 실행하기

```powershell
git clone <repo-url>
cd camera-hal-sw-newsletter
npm install
npm.cmd run test
npm.cmd run validate
```

`test`와 `validate`가 모두 통과하면 로컬 환경이 준비된 것입니다. 실제 뉴스룸 파이프라인을 돌리려면 `GEMINI_API_KEY`가 필요합니다. 자세한 절차는 [운영 안내(docs/operations/README.md)](docs/operations/README.md)를 보세요.

## 현재 운영 모델

```text
candidate collection
  -> deterministic shortlist
  -> LLM reporter/editor/fact-check (default: Gemini)
  -> quality gate
  -> review PR
  -> GitHub Pages
```

단계별 산출물은 폴더가 다릅니다.

- `articles/content/collected-news/YYYY-MM-DD/`: 원시 후보(raw candidate)
- `articles/content/newsroom/YYYY-MM-DD/`: 리뷰 산출물
- `articles/newsletters/YYYY-MM-DD/`: 공개 산출물(public artifact)

PR이 만들어졌더라도 `publish-ready` 상태가 아니면 발행 가능한 뉴스레터로 보지 않습니다.

로컬에서 확인할 때는 아래 명령만 기억하면 됩니다. 변경 범위가 넓거나 확신이 없으면 `ci`를 먼저 쓰세요.

발행 상태는 다음과 같이 읽습니다.

- `publish-ready`: AI가 자동 발행할 수 있는 상태입니다.
- `needs-fix`라도 공개 산출물이 들어 있으면, 편집장이 `main`에 merge하는 것을 사이트 공개 승인으로 봅니다.

`Validate Site and Images` (`.github/workflows/validate-site.yml`)는 구조 검증(structural validation)은 blocking(차단)으로, quality/fact-check 문제는 non-blocking annotation(차단하지 않는 알림)으로 보고합니다.

## 주요 명령

Windows PowerShell에서는 `npm.cmd`를 우선 사용합니다.

| 명령 | 언제 쓰나 | 결과물 |
| --- | --- | --- |
| `npm.cmd run test` | 단위/통합 테스트 회귀 확인 | `src/<layer>/test/` 전수 결과 |
| `npm.cmd run validate` | docs·정책·인코딩·site 무결성 검사 | `validate:*` 체인 보고 |
| `npm.cmd run ci` | test + validate 한꺼번에 | 변경 범위 넓을 때 1차 신뢰도 확인 |
| `npm.cmd run collect` | `src/shared/data/news-sources.json` 기반 후보 수집 | `articles/content/collected-news/YYYY-MM-DD/` |
| `npm.cmd run generate` | LLM 뉴스룸 파이프라인 (Gemini 공급자 사용 시 `GEMINI_API_KEY` 필요) | `articles/content/newsroom/YYYY-MM-DD/` |

공급자/모델 재정의와 사내 API Secret 설정은 [GitHub Actions Secret과 Variable(docs/config/ACTION_VARIABLES.md)](docs/config/ACTION_VARIABLES.md)를 보세요.

폴더는 목적별로 나뉘어 있습니다. 실제 구현과 tooling은 모두 `src/` 아래에 있습니다(#262 재구성으로 root `scripts/` wrapper는 제거됨). 검토 산출물은 `articles/content/`, 공개 발행물은 `articles/newsletters/`로 분리됩니다.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| [`.github/`](.github/README.md) | issue/PR 템플릿, 뉴스룸 PR 워크플로, 검증 워크플로입니다. |
| [`config/`](config/README.md) | newsroom 예산 등 일부 설정입니다. (뉴스레터 정책은 `src/shared/config/newsletter-policy.json`로 이동) |
| [`state/`](state/README.md) | source snapshot monitor, article exposure history 등 파이프라인 운영 state입니다. (source 레지스트리는 `src/shared/data/news-sources.json`, 서빙되는 index data는 `articles/data/`) |
| [`docs/`](docs/README.md) | 운영 문서, 용어집, source 안내입니다. |
| [`src/`](src/AGENTS.md) | 실제 수집기(collector), 생성기(generator), 렌더러(renderer), 검증기(validator), tooling 구현입니다. shared/collector/discovery/generator layer로 나뉘며, 회귀 테스트는 `src/<layer>/test/`에 함께 둡니다. |
| [`articles/content/`](articles/content/README.md) | 수집 후보와 뉴스룸 리뷰 산출물입니다. |
| [`articles/newsletters/`](articles/newsletters/README.md) | 공개 뉴스레터 Markdown/HTML 출력물입니다. |
| [`articles/assets/`](articles/assets/README.md) | 사이트 이미지와 기사 fallback 이미지입니다. |
| [`articles/css/`](articles/css/README.md) | 정적 사이트 스타일입니다. |

## 범위별 AGENTS

영역마다 안전 규칙이 별도 `AGENTS.md`에 정의되어 있습니다. 해당 영역을 고치기 전에 먼저 읽으세요.

| 영역 | 파일 | 보호 대상 |
| --- | --- | --- |
| 저장소 전반 | [AGENTS.md](AGENTS.md) | 인코딩, PR 범위, fixture 신뢰 |
| 구현·테스트 | [src/AGENTS.md](src/AGENTS.md) | layer/의존 방향, 리뷰·발행 가드레일, 테스트·fixture 신뢰 정책 |
| 워크플로 | [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md) | Secret 처리, PR 기반 발행 |
| state | [state/AGENTS.md](state/AGENTS.md) | 파이프라인 운영 state 계약 |
| 문서 | [docs/AGENTS.md](docs/AGENTS.md) | 한국어 우선, audit/worklog 금지 |
| 산출물 보존 | [articles/content/AGENTS.md](articles/content/AGENTS.md) | generated/review artifact 보존 기준, cleanup 금지선 |

마지막으로, 아래 규칙은 문서 정리나 리팩토링 중에도 절대 약화하면 안 됩니다.

## 약화하면 안 되는 규칙

이 목록은 요약입니다. 규칙의 정본은 [AGENTS.md](AGENTS.md)와 scoped AGENTS.md입니다.

- 뉴스레터 발행은 PR 머지를 통해서만 진행합니다.
- 생성된 issue를 `main`에 직접 자동 발행하지 않습니다.
- source가 없는 main article(주요 기사)은 발행하지 않습니다.
- dated evidence(날짜가 명시된 근거) 없는 watch/reference 페이지를 main article로 승격하지 않습니다.
- quality gate, source binding(출처 결속), image validation(이미지 검증), hard blocker(하드 블로커)를 약화하지 않습니다.
- generated artifact를 good/golden fixture(검증된 fixture)로 자동 신뢰하지 않습니다.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update src/shared/config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### 뉴스레터 정책 (Newsletter Policy)

- 정본 출처(source of truth): `src/shared/config/newsletter-policy.json`
- 주요 기사 수: 1-5
- 단일 기사 정책(one-article policy): 공개 뉴스레터는 완전히 발행 가능한 주요 기사 하나만 담을 수 있습니다.
- 기사 수만으로 단일 기사 호가 품질 저하 또는 검토 전용으로 분류되지는 않습니다. 단, 하드 품질 게이트는 그대로 적용됩니다.
- 보조 전용 정책(supporting-only policy): 보조 주요 버킷 기사 하나도 모든 하드 게이트를 통과하면 공개 가능 상태가 될 수 있습니다.
- 검토 게이트(review gate) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) direct AOSP Camera 또는 driver/image pipeline 기사: 단일 기사 정책으로 비활성화됨 (`direct_aosp_camera`, `camera_driver_image_pipeline` 버킷 대상)
- 발행 가능(publish-ready) 보조 주요 기사: 보조 주요 버킷 전체에서 최대 1개
- Primary Camera Stack 버킷: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- 보조 주요 버킷: `android_multimedia_camera_output`, `soc_platform_signal`, `cpp_ai_tooling_fallback`
- 금지 주요 버킷: `generic_tech_watchlist`; 후보 수만으로 이 버킷을 주요 기사로 승격하지 않습니다
- 후보 풀 사전점검(candidate pool preflight): 발행 가능 후보 최소 1개; 예비 후보는 진단용으로만 사용; camera stack 후보 최소 0개
- 선정 기간(selection windows): primary 7일; fallback 21일; reference 90일
- 선정 기간 적용(selection window enforcement): 주요 선정은 강제 적용되며, fallback 기간 후보는 primary 기간 선정이 부족할 때에만 승격됩니다.
- 지난 소식(Catch-up) 레인: 신규 선정이 3개 미만이면, 비어 있는 주요 슬롯을 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent` 버킷에서 최대 90일 이내의 미게재 릴리스로 채웁니다. 호당 최대 2개이며 각각 한 번씩만 게재하고, 신규 콘텐츠를 밀어내지 않습니다.
- 홈페이지 헤드라인 정책(homepage headline policy): linear decay; 일별 감쇠 2 point(s)/day; 교체 마진(replacement margin) 5; 최소 헤드라인 점수(minimum headline score) 40; 최신호 포함 필수(latest inclusion required) true; 이력 최대(history max) 50
- 발행 게이트(publish gate): PASS는 source gap이 없고, fact-check must_fix가 없으며, 차단성 감점(blocking deduction)이 없고, 모든 기사가 fact-checker에 의해 발행 가능으로 표시되어야 합니다. 수치 기반 품질 임계값은 없습니다.
- 편집 품질(editorial quality): fact-checker(LLM)가 각 기사를 Camera HAL SW 엔지니어에게 유용한지 기준으로 판정합니다(주제 무관 — C++, AI, Linux 기사라도 해당 엔지니어에게 도움이 되면 자격이 있습니다). 주제/깊이 휴리스틱은 결정론적 발행 게이트로 사용하지 않습니다.
- 하드 실패 조건은 계속 차단됩니다(hard fail conditions remain blocking): source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->
