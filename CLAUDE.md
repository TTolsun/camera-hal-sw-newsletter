# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 지침입니다.

이 파일은 저장소에 커밋되는 공유 파일입니다. worktree에서 작업할 때도 함께 실리도록 추적 대상으로 둡니다.

안전 규칙의 정본은 AGENTS.md이고, 이 파일은 AGENTS.md에서 유도되지 않는 불변식과 함정만 담습니다. AGENTS.md가 이미 담고 있는 내용은 여기 옮겨 적지 않습니다. 개인 메모나 일회성 작업 기록은 이 파일이 아니라 `.tmp/`처럼 `.gitignore`로 보호되는 경로에 둡니다.

## 이 저장소는 무엇인가

AOSP Camera Framework / Camera HAL / Camera Driver / V4L2·libcamera / ISP·image sensor / SoC platform 뉴스를 다루는 정적 뉴스레터 사이트와, 그 사이트를 만들어 내는 Node.js 기반 newsroom 자동화 저장소입니다.

## 안전 규칙은 AGENTS.md가 정본이다

이 저장소는 폴더별로 계층화된 `AGENTS.md` 체계를 가집니다. 해당 영역을 수정하기 전에 먼저 읽으세요. 이 파일들은 약화하면 안 되는 발행 안전(publish-safety) 계약을 담고 있습니다.

- Root [AGENTS.md](AGENTS.md) — 저장소 전체 원칙(발행은 PR 기반, 자동 merge 없음), 응답 언어, encoding/shell 규칙, 디렉터리 구조, local scratch, PR scope, fixture trust.
- [src/AGENTS.md](src/AGENTS.md) — 구현 규칙, layer/의존 규칙, review-publication guardrail, test와 fixture-trust 정책.
- [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md) — secret 처리, PR 기반 발행, publication-state label.
- [state/AGENTS.md](state/AGENTS.md) — 파이프라인 운영 state(source-monitor-registry, source-snapshots, article-exposure-history) 계약.
- [docs/AGENTS.md](docs/AGENTS.md), [articles/content/AGENTS.md](articles/content/AGENTS.md) — 문서 한글화, generated-artifact 보존.

이 파일들에서 나온 핵심 비협상(non-negotiable) 규칙은 다음과 같습니다.

- 통과시키려고 quality gate나 threshold를 낮추지 않는다.
- 출처 없는 main article, 또는 날짜 근거 없이 main으로 승격된 watch/reference page를 발행하지 않는다.
- article image를 임의 URL로 대체하지 않는다(resolver와 `articles/assets/images/fallback/` 계약을 따른다).
- generated newsletter를 `main`에 직접 push하지 않는다.
- `GEMINI_API_KEY`/`INTERNAL_LLM_API_KEY`는 GitHub Secrets 이외의 경로에서 읽지 않는다.

## 저장소 파악은 llm-wiki부터

저장소 구조, 정책 값, 모듈 위치가 궁금하면 코드 grep 전에 `llm-wiki/index.md`(로컬 전용, gitignored)를 먼저 확인하세요. 코드에서 파생된 문서이므로 정확한 수치와 경로는 코드로 재확인합니다. 스키마와 운영 규칙은 `llm-wiki/AGENTS.md` 참고.

## 작업 원칙 (Karpathy Guidelines)

코드를 작성·리뷰·리팩터링할 때는 `andrej-karpathy-skills:karpathy-guidelines` skill을 호출해 따르세요. 핵심: 구현 전에 생각, 단순함 우선, 수술적 변경, 검증 가능한 성공 기준.

이 원칙이 AGENTS.md의 발행 안전 규칙과 충돌하면 항상 AGENTS.md가 우선합니다.

## 명령어

Windows PowerShell에서는 `npm`보다 `npm.cmd`를 사용하세요.

```powershell
npm.cmd run test        # test:unit (run-node-tests.js over src) + test:script
npm.cmd run validate    # full safety gate (encoding, hygiene, fixtures, policy, config, site, quality, localization, ...)
npm.cmd run ci          # test + validate
npm.cmd run collect     # collect candidates from src/shared/data/news-sources.json -> articles/content/collected-news/
npm.cmd run generate    # run the LLM newsroom pipeline (needs GEMINI_API_KEY for default provider)
```

`validate`는 여러 `validate:*`와 `check:*` 하위 스크립트를 길게 이어 붙인 체인입니다([package.json](package.json) 참고). 변경 범위가 좁으면 해당 부분만 골라 실행하세요. 예를 들어 source-registry 변경 뒤에는 `npm.cmd run validate:config`, 문서/표시값 변경 뒤에는 `npm.cmd run validate:localization`을 실행합니다.

단일 테스트 파일을 직접 실행:

```powershell
node src/shared/tooling/cli/run-node-tests.js src       # all unit tests (the runner)
node --test src/generator/test/contract/fixture-policy.test.js # one file via Node's built-in runner
```

코드나 artifact를 수정한 뒤의 기본 검증은 `npm.cmd run test` + `npm.cmd run validate`입니다.

## 아키텍처

파이프라인 단계·layer 구성·모듈 위치는 매 세션 주입되는 llm-wiki 색인([[pipeline]]/[[overview]])을 보세요. 코드에서 유도되지 않는 불변식은 전부 AGENTS.md에 있습니다.

- 발행 주기(weekly self-contained), 정책 config source of truth — [AGENTS.md](AGENTS.md) "발행 주기와 정책".
- coverage 권한 경계(#724) — [src/AGENTS.md](src/AGENTS.md).
- PR 생성 성공 ≠ `publish-ready`, scheduled run의 LLM provider 결정 — [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md).

## 컨벤션

- **구현:** CommonJS `require`, 2칸 들여쓰기, 세미콜론, Node 20 compatibility.

encoding/shell, generated artifact 보존, local scratch, PR scope는 [AGENTS.md](AGENTS.md)가 정본입니다.
