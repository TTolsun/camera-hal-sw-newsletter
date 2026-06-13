# 저장소 작업 지침

이 저장소는 Camera HAL SW 뉴스레터 정적 사이트와 Node.js 기반 newsroom 자동화 저장소입니다. 기본 응답은 한국어로 작성하세요. 단, 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명과 공식 출처명은 원문을 유지하세요.

## 저장소 전체 원칙 (Repository-wide Principles)

- 발행 안전성이 최우선입니다. 검증을 약화하거나 quality threshold(품질 기준 점수)를 낮춰 통과시키지 마세요.
- 뉴스레터 발행은 PR 기반입니다. 생성 workflow가 `main`에 직접 발행하거나 자동 merge하지 않습니다.
- 출처 없는 main article, dated evidence(날짜 근거) 없는 watch/reference page, source gap(출처 누락)이 남은 article을 발행하지 않습니다.
- 외부 기사 이미지는 임의 URL로 대체하지 않습니다. 기존 image resolver와 `assets/images/fallback/` 계약을 따릅니다.
- `selectedImage`는 최종 발행 가능한 이미지 경로로 취급합니다.
- 과거 생성 산출물인 `articles/content/newsroom/**`, `articles/content/collected-news/**`, 기존 `articles/newsletters/**` 파일은 명시 요청 없이 대량 수정하지 않습니다.

## Encoding / Shell 규칙

- Repository text file은 명시 예외가 없는 한 UTF-8 without BOM으로 저장합니다.
- 한글이나 non-ASCII 문자가 포함될 수 있는 repository text file을 PowerShell `Set-Content`, `Out-File`, `>` redirection으로 rewrite하지 않습니다.
- Text file 수정은 patch 기반 편집이나 UTF-8 보존이 명확한 Node.js 도구를 사용합니다.
- Commit 전에는 `npm.cmd run check:encoding` 또는 이를 포함한 `npm.cmd run validate`를 실행합니다.
- Repository-wide line ending normalization은 별도 작업으로만 다루며, 일반 feature/fix PR에서 `git add --renormalize .`를 실행하지 않습니다.

## 디렉터리 구조 (Structure)

- root `index.html`과 `articles/css/`, `articles/assets/`는 정적 사이트 surface입니다(#262 phase 6: 공개 출력물은 모두 `articles/` 아래에 위치하고, Pages Actions 배포가 `_site/` 루트로 조립해 서빙 URL을 보존합니다).
- `src/shared/data/news-sources.json`은 machine-readable source of truth이고 `docs/news-sources.md`는 사람이 검토하는 editorial view입니다.
- `articles/content/collected-news/YYYY-MM-DD/`는 raw candidate output입니다.
- `articles/content/newsroom/YYYY-MM-DD/`는 reporter, editor, fact-check, quality, retry, QA review artifact입니다.
- `articles/newsletters/YYYY-MM-DD/`는 public issue output인 `newsletter.md`와 `index.html`입니다.
- 실제 구현과 tooling은 모두 `src/`에 있습니다. `src/shared/**`(공통 런타임·도메인·tooling·런타임 config/data), `src/collector/**`, `src/discovery/**`, `src/generator/**`(select/reporter/editor/quality/repair/diagnostics/render/validate/publish)로 나뉩니다. #262 재구성으로 root `scripts/*.js` wrapper와 `scripts/lib/`는 제거되었고 `scripts/`에는 더 이상 실행 코드가 없습니다.
- `.github/workflows/`는 newsroom PR workflow와 validation workflow입니다.

## Scoped AGENTS 정책 (Scoped AGENTS Policy)

Root `AGENTS.md`는 저장소 전체에 적용됩니다. 폴더별 scoped `AGENTS.md`는 그 폴더가 저장소 기본값과 다른 safety-critical 규칙이나 계약을 가질 때만 추가합니다.

scoped `AGENTS.md`는 이 root 지침을 상속합니다. 즉 폴더별 제약을 더할 뿐, 저장소 전체 규칙을 대체하지 않습니다. 이 root 파일과 충돌하는 scoped 지침을 만들지 마세요.

| Path | scoped 지침이 존재하는 이유 |
| --- | --- |
| `src/AGENTS.md` | 실제 구현, layer/의존 방향, deterministic selection, source binding, quality gate, renderer 계약과 test·fixture 신뢰 정책을 보호합니다. |
| `state/AGENTS.md` | 파이프라인 운영 state(source-monitor-registry, source-snapshots, article-exposure-history) 계약을 보호합니다. |
| `.github/workflows/AGENTS.md` | workflow gate, secret handling, PR-based publishing 정책을 보호합니다. |
| `docs/AGENTS.md` | 문서 한글화, 현재 운영 문서 기준, 링크 유지 규칙을 보호합니다. |
| `articles/content/AGENTS.md` | generated/review artifact 보존 기준과 cleanup 금지선을 보호합니다. |

보기 좋은 대칭을 맞추려는 목적만으로 scoped `AGENTS.md`를 추가하지 마세요. 그 폴더에 위험이나 모호함을 실질적으로 줄이는 규칙이 있을 때만 추가합니다.

## 검증 (Validation)

코드나 산출물을 수정한 뒤에는 기본적으로 아래 명령을 실행하세요.

```powershell
npm.cmd run test
npm.cmd run validate
```

변경 범위가 좁더라도 관련 세부 검증이 있으면 함께 실행합니다. 예를 들어 source registry 변경은 `npm.cmd run validate:config`, 문서/표시값 변경은 `npm.cmd run validate:localization`을 포함합니다.

## Local Agent Scratch (작업용 임시 파일)

- Repository root `PLAN.md`와 `PLAN.local.md`는 repository artifact가 아니라 local-only scratch로 취급합니다.
- 작업 계획이 필요하면 `.tmp/codex/<task>.md` 또는 `.codex/PLAN.local.md`처럼 `.gitignore`로 보호되는 local-only 경로를 사용합니다.
- PR에는 product code, tests, official docs만 포함하고 Codex scratch, worklog, temp plan 문서는 commit하지 않습니다.
- memory/notes/checkpoint 성격의 Markdown, 작업 메모, TODO 정리, 임시 보고서는 repository 문서로 남기지 않습니다.
- 일시적으로 만든 실험용 코드, 디버깅용 one-off script, 재현/분석용 helper는 repository에 저장하지 않습니다. 필요하면 저장소 밖이나 OS 임시 디렉터리에서 사용하고 작업 완료 전에 삭제합니다.
- 과거 issue 해결, 리팩터링 계획, 디버그 baseline 같은 작업 중간 산출물은 repository 문서로 남기지 않습니다. 보존해야 할 정책이나 계약은 현재 코드와 맞는 canonical docs에 직접 통합합니다.

## Fixture Trust Policy (fixture 신뢰 정책)

- `src/shared/test/fixtures/**/good`에는 사람이 검수한 curated fixture만 둡니다.
- generated artifact는 good/golden fixture로 사용하지 않습니다.
- generated artifact에서 회귀 가치가 있는 경우 전체 artifact가 아니라 최소 입력만 `src/shared/test/fixtures/**/bad` 또는 regression fixture로 보존합니다.
- `bad` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- `source_gap_risk=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `reference_only=true`, `hasDatedEvidence=false` sample은 main article PASS fixture가 될 수 없습니다.
- generic AI 또는 일반 IT sample이 Camera HAL / Android Camera / camera workflow / frame / stream / buffer / metadata / NPU/GPU/ISP resource management와 구체적으로 연결되지 않으면 main article PASS fixture가 될 수 없습니다.

## PR Scope (PR 범위)

변경은 좁게 유지하고 관련 파일만 stage하세요. commit 메시지는 간결한 명령형 영어 제목을 사용합니다. unrelated cleanup, large directory reorg, workflow behavior 변경은 사용자 요청 없이 묶지 않습니다.
