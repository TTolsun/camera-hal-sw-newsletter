# 저장소 작업 지침

이 저장소는 Camera HAL SW 뉴스레터를 정적 사이트로 발행하고, Node.js 자동화로 후보 수집과 Gemini 기반 편집 과정을 실행합니다.

기본 응답은 한국어로 작성하세요. 단, 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명과 공식 출처명은 원문을 유지하세요.

## 프로젝트 구조와 모듈 구성

- `index.html`은 아카이브 랜딩 페이지이며 `data/newsletters.json`을 읽습니다.
- `css/`는 공통 사이트 스타일입니다. UI 작업이 아니라면 레이아웃 변경을 최소화합니다.
- `assets/images/fallback/`은 기사 이미지 검증에서 사용하는 로컬 fallback 이미지를 보관합니다.
- `data/news-sources.json`은 기계가 읽는 출처 registry이고, `docs/news-sources.md`는 사람이 검토하는 editorial view입니다.
- `content/collected-news/YYYY-MM-DD/`는 원본 후보 수집 결과를 저장합니다.
- `content/newsroom/YYYY-MM-DD/`는 reporter 후보, editor draft, fact-check, brief, QA report 같은 검토 산출물을 저장합니다.
- `newsletters/YYYY-MM-DD/`는 발행 이슈 산출물인 `newsletter.md`와 `index.html`을 저장합니다.
- `scripts/`는 기존 command entry wrapper와 `scripts/lib` 호환 shim을 포함합니다.
- 실제 수집, Gemini 생성, 렌더링, 이미지 해석, 검증 로직은 `scripts/newsroom/{cli,collect,generate,render,validate,common}/` 아래에 책임별로 둡니다.
- `.github/workflows/`는 newsroom PR workflow와 검증 workflow를 포함합니다.

## 빌드, 테스트, 개발 명령

Node 20을 사용합니다.

```powershell
npm.cmd run collect
```

`data/news-sources.json`에서 후보를 수집합니다. 필요하면 `NEWSLETTER_DATE=YYYY-MM-DD`, `LOOKBACK_DAYS=21`을 설정합니다.

```powershell
npm.cmd run generate
```

Gemini newsroom pipeline을 실행합니다. `GEMINI_API_KEY`가 필요하며, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`로 모델을 조정할 수 있습니다.

```powershell
npm.cmd run test
npm.cmd run validate
```

PR gate의 기본 검증입니다. `npm.cmd run test`는 unit/regression test와 script-level artifact/selection diagnostics test를 실행하고, `npm.cmd run validate`는 설정, 사이트, 외부 이미지, 품질, 한글화 검증을 실행합니다.

필요한 세부 검증은 아래 명령으로 실행합니다.

```powershell
npm.cmd run test:unit
npm.cmd run test:script
npm.cmd run test:artifact
npm.cmd run test:selection-diagnostics
npm.cmd run validate:config
npm.cmd run validate:site
npm.cmd run validate:images
npm.cmd run validate:quality
npm.cmd run validate:localization
```

정적 사이트를 로컬에서 확인할 때는 HTTP server를 사용합니다.

```powershell
npx serve .
```

## 코딩 스타일과 이름 규칙

JavaScript는 CommonJS `require`, 2칸 들여쓰기, 세미콜론, `path.join` 또는 `path.resolve` 기반 명시적 경로를 사용합니다. 파일명은 `validate-quality.js`처럼 소문자 hyphen 형식을 선호합니다. 날짜 디렉터리는 `YYYY-MM-DD` 형식을 지켜야 합니다. `issue-briefing`, `issue-section`, `source-list`, `reference-list`처럼 validator가 의존하는 HTML hook은 보존합니다.

## 문서와 JSON 한글화 규칙

사람이 읽는 Markdown 문서와 표시용 JSON 값은 기본적으로 한국어로 작성합니다. 단, 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명과 공식 출처명은 변경하지 않습니다.

JSON은 값만 한글화합니다. `id`, `category`, `priority`, `reliability`, `collectionModeHint`, `schemaVersion` 같은 내부 계약 값은 번역하지 않습니다. `usageHint`, `title`, `summary`, 사람이 읽는 설명 문구는 한국어를 우선합니다.

과거 생성 산출물인 `content/newsroom/**`, `content/collected-news/**`, 기존 `newsletters/**` 파일은 별도 작업 요청이 없으면 대량 번역하지 않습니다. 앞으로 생성되는 Markdown 라벨과 템플릿은 한국어를 유지합니다.

## Fixture 신뢰 정책

- `tests/fixtures/**/good`에는 사람이 검수한 curated fixture만 둡니다.
- generated artifact는 good/golden fixture로 사용하지 않습니다.
- generated artifact에서 회귀 가치가 있는 경우 전체 artifact가 아니라 최소 입력만 `tests/fixtures/**/bad` 또는 regression fixture로 보존합니다.
- `bad` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- `source_gap_risk=true`, `finalSelectionEligibility=watchlist`, `finalSelectionEligibility=exclude`, `reference_only=true`, `hasDatedEvidence=false` sample은 main article PASS fixture가 될 수 없습니다.
- generic AI 또는 일반 IT sample이 Camera HAL / Android Camera / camera workflow / frame / stream / buffer / metadata / NPU/GPU/ISP resource management와 구체적으로 연결되지 않으면 main article PASS fixture가 될 수 없습니다.

## 테스트 지침

별도 unit/regression test와 publication validator를 모두 권위 있는 PR gate로 취급합니다. 코드나 산출물을 수정한 뒤에는 기본적으로 `npm.cmd run test`와 `npm.cmd run validate`를 실행하세요. 변경 범위가 좁더라도 관련 세부 검증이 있으면 함께 실행합니다.

발행 산출물에는 `TODO`가 없어야 하며, 필수 섹션과 참조, 기사 이미지 fallback 규칙, deterministic quality threshold를 만족해야 합니다. 검증을 통과시키기 위해 quality threshold, hard blocker, validator를 약화하지 않습니다.

## Commit과 PR 지침

최근 이력은 `Generate Camera HAL newsletter 2026-05-02`, `Add newsletter quality gate`, `Align newsletter operations docs and validation`처럼 간결한 명령형 제목을 사용합니다. commit은 좁게 유지하고 관련 파일만 stage합니다.

뉴스레터 발행은 PR 기반입니다. PR에는 필요한 경우 생성된 `newsletters/`, `content/newsroom/`, `content/collected-news/`, `data/newsletters.json` 변경, 검증 상태, fact-check 또는 quality report의 `needs-fix` 맥락을 포함합니다.

## Agent 전용 지침

발행 위험을 숨기기 위해 검증을 약화하지 않습니다. 생성 결과에 편집 수정이 필요하면 review artifact를 보존합니다. 외부 이미지를 임의 URL로 대체하지 말고 resolver와 로컬 fallback 계약을 사용합니다. `selectedImage`는 최종 발행 가능한 이미지 경로로 취급합니다.
