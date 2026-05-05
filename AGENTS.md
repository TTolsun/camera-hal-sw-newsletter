# 저장소 작업 지침

이 저장소는 Camera HAL SW 뉴스레터 정적 사이트와 Node.js 기반 newsroom 자동화 저장소입니다. 기본 응답은 한국어로 작성하세요. 단, 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명과 공식 출처명은 원문을 유지하세요.

## Repository-wide Principles

- 발행 안전성이 최우선입니다. 검증을 약화하거나 quality threshold를 낮춰 통과시키지 마세요.
- 뉴스레터 발행은 PR 기반입니다. 생성 workflow가 `main`에 직접 발행하거나 자동 merge하지 않습니다.
- 출처 없는 main article, dated evidence 없는 watch/reference page, source gap이 남은 article을 발행하지 않습니다.
- 외부 기사 이미지는 임의 URL로 대체하지 않습니다. 기존 image resolver와 `assets/images/fallback/` 계약을 따릅니다.
- `selectedImage`는 최종 발행 가능한 이미지 경로로 취급합니다.
- 과거 생성 산출물인 `content/newsroom/**`, `content/collected-news/**`, 기존 `newsletters/**` 파일은 명시 요청 없이 대량 수정하지 않습니다.

## Structure

- `index.html`, `css/`, `assets/`는 정적 사이트 surface입니다.
- `data/news-sources.json`은 machine-readable source of truth이고 `docs/news-sources.md`는 사람이 검토하는 editorial view입니다.
- `content/collected-news/YYYY-MM-DD/`는 raw candidate output입니다.
- `content/newsroom/YYYY-MM-DD/`는 reporter, editor, fact-check, quality, retry, QA review artifact입니다.
- `newsletters/YYYY-MM-DD/`는 public issue output인 `newsletter.md`와 `index.html`입니다.
- `scripts/` root와 `scripts/lib/`는 compatibility wrapper/shim입니다. 실제 구현은 `scripts/newsroom/{cli,collect,generate,render,validate,common}/`에 둡니다.
- `.github/workflows/`는 newsroom PR workflow와 validation workflow입니다.

## Scoped AGENTS Policy

Root `AGENTS.md` applies to the whole repository. Scoped `AGENTS.md` files are added only when a folder has safety-critical rules or contracts that differ from the repository-wide defaults.

| Path | Why scoped guidance exists |
| --- | --- |
| `scripts/newsroom/AGENTS.md` | 실제 newsroom 구현, deterministic selection, source binding, quality gate, renderer 계약을 보호합니다. |
| `tests/AGENTS.md` | fixture 신뢰 정책과 regression test 작성 규칙을 보호합니다. |
| `data/AGENTS.md` | `news-sources.json` source registry 계약을 보호합니다. |
| `.github/workflows/AGENTS.md` | workflow gate, secret handling, PR-based publishing 정책을 보호합니다. |
| `docs/AGENTS.md` | 문서 한글화, current/archive guidance 구분, 링크 유지 규칙을 보호합니다. |
| `content/AGENTS.md` | generated/review artifact 보존 기준과 cleanup 금지선을 보호합니다. |

Do not add scoped `AGENTS.md` files only for visual symmetry. Add one only when the folder has rules that meaningfully reduce risk or ambiguity.

## Validation

코드나 산출물을 수정한 뒤에는 기본적으로 아래 명령을 실행하세요.

```powershell
npm.cmd run test
npm.cmd run validate
```

변경 범위가 좁더라도 관련 세부 검증이 있으면 함께 실행합니다. 예를 들어 source registry 변경은 `npm.cmd run validate:config`, 문서/표시값 변경은 `npm.cmd run validate:localization`을 포함합니다.

## Fixture Trust Policy

- `tests/fixtures/**/good`에는 사람이 검수한 curated fixture만 둡니다.
- generated artifact는 good/golden fixture로 사용하지 않습니다.
- generated artifact에서 회귀 가치가 있는 경우 전체 artifact가 아니라 최소 입력만 `tests/fixtures/**/bad` 또는 regression fixture로 보존합니다.
- `bad` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- `source_gap_risk=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `reference_only=true`, `hasDatedEvidence=false` sample은 main article PASS fixture가 될 수 없습니다.
- generic AI 또는 일반 IT sample이 Camera HAL / Android Camera / camera workflow / frame / stream / buffer / metadata / NPU/GPU/ISP resource management와 구체적으로 연결되지 않으면 main article PASS fixture가 될 수 없습니다.

## PR Scope

변경은 좁게 유지하고 관련 파일만 stage하세요. commit 메시지는 간결한 명령형 영어 제목을 사용합니다. unrelated cleanup, large directory reorg, workflow behavior 변경은 사용자 요청 없이 묶지 않습니다.
