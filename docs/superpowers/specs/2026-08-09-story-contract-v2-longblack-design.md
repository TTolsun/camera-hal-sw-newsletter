# Story Contract v2 — 롱블랙 서사 기사 전환 설계

- 날짜: 2026-08-09
- 상태: 설계 확정 대기 (사용자 리뷰 전)
- 근거 조사: 코드 감사 워크플로우(13 agent, 5개 fabrication 패턴 확정) + 설계 워크플로우(맵 7 + 설계안 3 + 심사 3렌즈)

## 1. 문제

생성된 기사가 호마다 비슷비슷하다. 원인은 LLM이 아니라 코드가 기사의 형태와 일부 내용을 결정하기 때문이다.

측정된 사실:

1. **골격이 코드에 고정.** 모든 기사가 같은 실루엣: 리드 → 본문(평문 문단 나열) → 고정 소제목 `### Camera HAL/Driver 관점에서의 의미`(newsletter-renderer.js:166) → `**출처**`. W20~W32 전 기사 100% 동일, 예외 0.
2. **인트로가 템플릿.** `이번 주에는 '…' 소식을 다룹니다`(weekly-newsletter-page.js:46-48)가 매주 첫 문장. LLM이 쓴 `draft.summary`는 구조적으로 도달 불가(`weeklySummaryText(titles) || draft.summary` — 제목이 하나라도 있으면 항상 템플릿 승리). 이 문장이 md 2행·hero subtitle·og:description(소셜 공유 문구)까지 차지한다.
3. **코드가 쓴 보일러플레이트가 LLM 입력으로 순환.** `buildStaticBackgroundContext`/`buildHalPerspective`(article-field-builder.js:232,253)가 impact class 5종당 고정 한국어 문단을 만들고, orchestrator-stage-prompts.js:90이 editor에게 "background-context.json 없으면 `background_context_static`을 사용"하라고 지시 — 5개 논조로 수렴하는 공식 경로.
4. **프롬프트가 양식 채우기를 강제.** "3-5개 자연스러운 문단"(newsletter-prompts.js:68), 고정 3-beat 아크(:106), editorial_story 6칸 각 1~2문장(orchestrator-stage-prompts.js:124).
5. **검증·파서가 고정 구조를 전제.** public-newsletter.js:158 정규식은 고정 소제목을 파싱 전제로 삼고(비일치 시 무음 skip — hard fail은 아님), validate-site.js:491은 warn 수준의 advisory다. 구조를 실질적으로 고정하는 것은 md 기사 splitter(`^## \d+.`)·렌더러 하드코딩·계약 테스트들이며, 소제목 문자열 자체는 지금도 hard gate가 아니다 — 다만 v1 byte-identity와 checkpointItems 파서 호환 때문에 시그니처 박스 라벨은 문자 그대로 유지한다(§4.1).

추가로 감사에서 확정된 코드 fabrication — 감사가 확정한 패턴은 총 5개이며, 그중 주간 인트로 템플릿(위 2번)은 v2 트랙 T10(§4.7)으로 해소하고 나머지 4개(F1~F4)는 v2와 별개 독립 트랙으로 수정한다:

- **F1 (최악, 라이브)**: fallback 이미지에 가짜 출처 캡션. `articleImageMarkdown`/`articleMediaHtml`이 `image.usedFallback`을 검사하지 않고 `section.sources[0]`으로 `이미지: [실제 기사 제목](URL)` 캡션을 합성(newsletter-renderer.js:107-135). W31 전 5개 기사 + W30 1개 라이브. rendered-issue-structure.js:206은 이 가짜 캡션을 오히려 강제.
- **F2 (라이브 오보)**: `QUIET_CORE_CONTEXT_NOTE = '이번 기간 카메라 코어 직접 변경은 없었습니다…'`(newsletter-renderer.js:570)가 `publish_mode === 'CONTEXT'` 플래그 하나로 출력 — W26에서 V4L2 센서 드라이버 기사(정확히 카메라 코어 변경) 바로 위에 인쇄됨. 팩트체커가 본 적 없는 기간-수준 사실 주장.
- **F3 (라이브 링크 텍스트)**: roundup-child-topic-extractor.js:214가 `${block.heading} - ${parentTitle}` 합성 제목 생성(2026-06-16/20/21/22 참고자료에 존재하지 않는 페이지 제목), aosp-release-camera-changes.js:210도 동종 합성 제목.
- **F4 (조건부)**: homepage-headline.js:331 fallback 체인이 `candidate.reason`(수집기 내부 근거 문자열, 예: `LWN.net (high, p1, score 74)…`)을 홈 히어로 lead로 승격 가능.

## 2. 목표 / 비목표

**목표**

1. 기사 본문을 LLM이 롱블랙 결(장면/질문 훅, 서사 전개, 기사별 소제목, 문단 리듬)로 자유 작성.
2. AOSP Camera HAL 개발자 필수 메시지는 구조적으로 보장 — 기사 끝 시그니처 박스(`camera_hal_takeaway`) 유지 + 결정론 게이트 존치. (사용자 확정)
3. 독자 도달 코드 fabrication 전면 제거 — 원칙: **fail/demote over fabricate**.
4. 주간 인트로를 에디터 레터로 전환하되, 과거 사고(LLM 요약이 실제 기사와 불일치 → 그래서 헤드라인 파생으로 바꿨던 이력)를 결정론 일관성 게이트로 재발 방지.

**비목표**

- 기존 발행분(W20~W32) 재렌더/변경 없음. v1은 영구 지원(quality recompute·syncWeeklyArticleImages가 구 아티팩트를 계속 재검증/재렌더하므로).
- 이슈 레벨 골격(`## N.` 번호, 브리핑 3불릿, `**출처**`/참고자료)은 이번 범위에서 유지 — 파서·게이트 그물 보존. 다음 증분.
- 안전/사실성 게이트 약화 없음. 소스 바인딩·claim 커버리지·prose-leakage·overclaim 게이트 전부 존치.

## 3. 결정 요약

3개 설계안(body_markdown 단일 필드 / flat 배열+`### ` 관례 / body_sections 구조화)을 3렌즈(스키마 호환 리스크 / fail-closed 게이트 강도 / 편집 품질)로 심사한 결과:

| 안 | 스키마 리스크 | 게이트 강도 | 편집 품질 | 합계 |
|---|---|---|---|---|
| **A. body_markdown 단일 필드** | 6 | 8 | 9 | **23 — 채택** |
| B. flat 배열 + `### ` 관례 | 9 | 6 | 5 | 20 |
| C. body_sections 구조화 | 4 | 7 | 6 | 17 — #633 거부 형상 재현, 탈락 |

**채택: A.** `body_paragraphs`(string 배열)를 `body_markdown`(단일 string)으로 교체. 스키마 상태 수가 오히려 줄고(배열→string), 서사 자유도가 최대이며, 결정론 lint로 fail-closed를 회수한다. B의 단계적 롤아웃 전략과 심사에서 나온 보완책을 접목한다(§5).

## 4. 상세 설계

### 4.1 본문 표현: `body_markdown`

- LLM이 기사 서사 전체를 markdown으로 작성. 문단은 빈 줄 구분, 소제목은 `### ` 줄(0~4개, 라벨 자유).
- 허용 문법은 **allow-list**: `### ` 헤딩 줄과 평문 문단 줄만. 그 외 전부 lint fail — `#`/`##`/`####+` 헤딩(md 기사 splitter가 `^## \d+.`에 의존하므로 `##`는 치명), setext 헤딩(`===`/`---` 밑줄), 리스트 마커(`- `, `* `, `1. `), 인용(`>`), `---` 수평선, `![` 이미지, `[..](..)` 링크, 백틱/코드펜스, raw HTML, `**…**` 볼드 라벨 줄. (심사 지적 반영: deny-list 나열이 아니라 allow-list라 누락 구문이 자동 차단됨)
- 인라인 마크업 미해석 — HTML 렌더는 v1과 동일하게 문단별 escapeHtml. md/HTML 표현 항상 일치, injection 표면 없음.
- 전용 정규화 `normalizeBodyMarkdown`(CRLF→LF, 줄내 공백 collapse, 연속 빈 줄 축약, trim). v1 경로(compactText/normalizeStringArray) 절대 미경유 — compactText가 문단 경계를 파괴하고 lowercase dedupe가 소제목을 무음 drop하는 함정 실증됨.
- 결정론 파서 `parseBodyBlocks(body_markdown) → [{type:'subheading'|'paragraph', text, blockIndex}]` 하나가 lint·렌더·문단 수 게이트·repair 주소의 단일 정본. blank-line split + `### ` prefix 판별뿐인 ~20줄 함수(범용 md 파서 아님).
- 시그니처 박스: `camera_hal_takeaway` 별도 필드 그대로. md 라벨 `### Camera HAL/Driver 관점에서의 의미`, HTML 라벨 `Camera HAL · Driver 관점`을 문자 그대로 유지 — public-newsletter.js:158 등 기존 게이트 무수정 존속.

### 4.2 editorSchema 변경 (상태 수 순감소)

- **감축 선지불(독립 PR, v1 호환)**: LLM 값이 어차피 무시/미소비임이 실증된 필드 삭제 — `decision_metadata`(normalizeDecisionMetadata가 전량 코드 파생), `actionability_upgrade_evidence`, optional 4종(article_tier/topic_area/camera_output_relevance/newsletter_relevance). 합계 -14 props, -1 nested object.
- **v2 본문**: `body_paragraphs` 삭제 → `body_markdown`(string, required) 추가.
- **editorial_story 6→2**: `{not_to_overclaim, editor_take}`만 존치(안전 기능). reader_scenario/what_happened/why_it_matters/field_scenario 4슬롯 삭제 — 훅 지시는 lead+body 도입부 프롬프트로 이전. 심사 지적: 6키 필드명 자체가 v1 템플릿 어휘라 유지 시 인벤토리식 사고를 되강제.
- **버전**: story_contract_version=2 (NUMBER 그대로), public_contract_version='story-v2', generation_contract_version=2.
- **머지 게이트**: gemini-3.5-flash·2.5-flash·flash-lite 3모델 responseSchema 수용 실측 스크립트 통과(#633 교훈: 수용성은 실측으로만 보증).

### 4.3 프롬프트 재작성 (요지)

- "3-5 문단"·7항목 커버리지·고정 3-beat 아크·슬롯당 "1~2문장" 카운트 전부 삭제. 대체: 기사마다 리듬을 달리하라(짧은 훅 문단·긴 전개 문단 혼용). 소스 확인 구체 명사·수치·제약 보존 의무는 유지.
- lead = 장면/질문 훅(가정형, 사실 단정 금지). HAL과의 거리는 "본문 어딘가에서 반드시" — 위치 자유, 내용 필수.
- 소제목: 그 기사에서만 말이 되는 구체 표현. deny-list(v1 고정 라벨 + 관점 헤딩 계열 + Impact/Layer/Scope 류 + 내부 키 어휘)를 lint와 **같은 상수를 import**해 프롬프트에 공급. **강조는 볼드 금지 대신 문장 구조로**(심사 지적: 대체 수단 미명시 시 따옴표 남용으로 샘).
- orchestrator-stage-prompts.js:90 — `background_context_static` "먼저 사용" 복사 지시를 **참고자료-전용**(자기 문장으로 재작성, 복사 금지)으로 교체. do_not_overstate가 이미 쓰는 규약(:54-55)과 동일 패턴. 빌더 자체는 존치(근본원인은 복사 지시).
- voice 2변형(editor·completion) 동시 재작성 — completion 경로 누락 시 v1 톤 기사 혼입 함정 체크리스트화. editorialPlanPrompt 확장: plan 단계에서 기사별 소제목 후보·서사 아크 선제안(targeted repair 정밀도 유지).
- fact-check 3스택에 면제 조항: "서사형 훅·장면·기사별 소제목은 의도된 v2 스타일, 과장 must_fix 아님". NEWSLETTER_TEMPLATE.md v2 재작성 + 롱블랙 결 골든 예시 문서 신설(no-fact-copy 규칙 유지).

### 4.4 렌더러

- `isStoryV2Article`(version===2 && body_markdown 유효) 신설. 기존 `isStoryArticle`(===1) 분기는 바이트 하나 안 건드림 — v1 byte-identity 기계적 보증. domain-renderer-equivalence.test가 최상위 안전핀.
- md v2 분기: `## N. headline` → 이미지 → `_subtitle_` → lead → body_markdown 그대로 → 시그니처 박스 → 출처. 소제목이 `###`라 validate-site splitter(`^## \d+.`)에 구조적 불가시.
- HTML v2 분기: 같은 카드 셸 + parseBodyBlocks로 `<h3 class="article-subheading">`/`<p>` 방출(escapeHtml). 시그니처 박스·출처 HTML은 v1 헬퍼 재사용.
- **무음 다운그레이드 2종 → fail 전환**: ① 미지원 버전의 legacy 무음 다운렌더 → render throw(validation이 선차단, 최후 방어선), ② `uniquePublicParagraphs` 무음 문단 drop → v2에서는 lint fail→repair→demote(무음 변형은 fabrication의 이웃).
- CSS: `.article-subheading` 신설(DESIGN.md ramp 준수, 예 1.17rem/600), homepage-archive.test.js에 잠금 추가(기존 블록 재구조화 금지, 액센트 #0066cc 무변).

### 4.5 검증기

- `SUPPORTED_*` 세트에 v2 추가(v1 영구 존치). 마커 3종 "버전 패밀리 일치" 매트릭스 — ('story-v1',1,1)/('story-v2',2,2)만 complete, 혼합 트리플은 새 issue type으로 fail.
- 본문 lint 신설(public-body-markdown.js): forbidden construct(4.1 allow-list 위반), insufficient_public_body_paragraphs(소제목 제외 문단 <2), dangling_subheading(소제목 뒤 문단 없음), duplicate_block. **duplicate_block은 정규화 후 완전/준완전 일치만 hard fail** — lead 훅의 본문 후반 변주 재등장(서사의 정당한 에코)은 차단하지 않음(심사 지적 반영).
- 소제목 존재는 **advisory**(soft 신호)만 — hard 강제하면 "모든 기사에 소제목"이라는 새 고정 템플릿이 됨.
- **스캐너 3종 동기 + 드리프트 가드**: prose-leakage 식별자·스캔 필드, combinedSectionText, publicJsonTextValues, fact-check blocklist에 body_markdown 등록. 등록 누락 = 무음 fail-open이므로, "v2 필드가 스캐너 목록에 빠지면 fail하는 커버리지 계약 테스트"를 동반(심사 지적 반영).
- artifact 버전 정본: newsletters.json 엔트리에 `public_contract_version` 기록(부재=v1 해석, backfill 불요). validate-site/rendered-issue-structure가 이걸로 이슈별 판별.
- newsletter-domain-normalize.js:274 하드코드 `1` 제거 — 실제 마커에서 버전 carry(미수정 시 v2 draft가 quality recompute에서 v1 stamp — PR #643 동형 버그).

### 4.6 Repair (targeted, patch-only 유지)

- 전체 필드: `/public_article/body_markdown` — 구조 붕괴 lint 실패 전용. headline/source identity 스냅샷 가드 + 적용 후 lint 재실행.
- 블록 단위: 가상 포인터 `/public_article/body_markdown/blocks/{i}` — 리졸버가 parseBodyBlocks로 i번째 블록만 교체 후 재직렬화, setByPointer 등 기존 메커니즘 무수정. patchTargets에 블록 미리보기 동봉(인덱스 드리프트 방지). **블록 패치 실패는 patch fail → demote. 전체 필드 교체로 자동 폴백하지 않음**(심사 지적: 자동 폴백은 identity-drift 금지 형상의 재진입).
- deductionRepairPolicy에 v2 issue code 전수 등록(unknown-code 기본값 함정 봉인).

### 4.7 주간 에디터 레터

- 최종 기사 확정 후(finalize) 별도 소형 LLM 호출로 `issue.intro_letter`(2~5문장) 생성. 스키마 `{intro_letter: STRING}` 단독 — editorSchema 상태 예산 무영향. 입력은 최종 headline+lead만.
- 결정론 게이트 `lintIntroLetter`: ① 기사별 변별 토큰 최소 1개 등장(커버리지), ② 레터의 기술 식별자가 최종 headline/lead 토큰 집합의 부분집합(유령 기사 금지), ③ prose-leakage 스캔, ④ 길이 상하한. 실패 시 1회 재생성 → 재실패 시 기존 `weeklySummaryText`로 fallback(로그 기록). — 이것이 v2에서 유일하게 남는 독자 도달 결정론 문장(승인된 명시적 fallback).
- upsert 멱등: 저장된 레터를 현재 제목 집합에 게이트 재실행 — 통과 시 재사용(바이트 멱등), 실패 시 재생성→fallback. `issue.briefing`(제목 목록)·archive 카드 요약은 무변(validate-site 잠금 유지). 게이트와 인트로 채택은 같은 PR(무방비 기간 0).

### 4.8 Fabrication 제거 (v2 경로)

- `buildStoryFromPublicArticle`/`completeStoryPublicArticle`의 prose 합성(템플릿 reader_scenario, 기본 not_to_overclaim, source_subtitle fallback, headline suffix 5종) — v2 경로에서 삭제. v1 재검증 경로에서는 버전 가드 뒤 존치.
- **계층 주의(코드리뷰 확정 사항)**: `completeStoryPublicArticle`은 editor-output validation 단계의 `deterministicallyRepairEditorSchema`(editor-output-contract.js:216-283)가 **draft 전체 루프에서 무조건 호출**하며, 이 단계에는 per-article demote 개념이 없다 — 한 섹션이라도 reason_codes가 남으면 draft 전체가 `{editor:null}`로 실패하고, orchestrator-editor-stage.js catch(:103-119)가 whole-draft LLM repair → `lastKnownValidEditor` revert → attempt 실패로 확산시킨다. "demote + completion top-up"은 그보다 뒤의 post-selection 단계 메커니즘이다. 따라서 v2에서 합성을 그냥 삭제하면 기사 1건의 결손이 draft 전체 실패로 번진다. **T7 설계 보완**: v2 경로의 deterministicallyRepairEditorSchema에 per-article 강등 경로를 신설 — story 필수 필드 결손 섹션은 reason_codes로 draft를 죽이는 대신 해당 섹션을 draft에서 제거(demote 마킹)하고 잔여 섹션으로 draft를 유지한다. 최소 발행 기사 수 미달일 때만 draft 수준 실패로 승격. reviewableReturn/lastKnownValidEditor 경로는 무수정.
- headline 중복 → duplicate_headline issue 신설 → `/public_article/headline` 패치 repair → 실패 시 demote.
- 결정론 fallback 문구 생성 경로 제거, 탐지 패턴(PUBLIC_PROSE_PLACEHOLDER_PATTERNS)은 회귀 가드로 영구 존치.
- 독자 비도달 확인 존치: 합성 validation wrapper, fallbackFactCheckForRepairFailure, demote 메타데이터, revertUncoveredPatchedVerifiedFacts(LLM 원문 복원 — fabrication 아님).

### 4.9 v2 무관 라이브 fabrication 수정 (별도 트랙, 즉시 가능)

- **F1** (해결 — PR #861): fallback 이미지는 캡션 무출력, 게이트는 fallback에 캡션이 붙어 있으면 오히려 차단(양방향). 구현에서는 `image.usedFallback` 플래그가 아니라 렌더 경로로 판정했다 — 플래그가 false인데 경로는 fallback인 발행물이 실재하고, 렌더 결과만 보는 게이트와 술어를 통일해야 두 층 판정이 갈리지 않기 때문이다. 기존 발행분 재렌더는 F2·F3와 함께 정하기로 남겼다.
- **F2**: `QUIET_CORE_CONTEXT_NOTE` 삭제 — CONTEXT 모드는 라벨/뱃지로 표현하거나 demote. 코드가 기간-수준 사실 주장을 쓰지 않는다.
- **F3**: roundup child 합성 제목 `${heading} - ${parentTitle}`과 aosp-release 합성 제목 — 실제 페이지 제목/anchor 존재 확인 또는 "『부모 제목』 내 섹션" 형식으로 실존 표기.
- **F4**: homepage-headline fallback 체인에서 `candidate.reason` 제거 — summary/description 없으면 히어로 lead 무출력.

## 5. 마이그레이션 / 롤아웃

- **inert 선행 원칙**: T1~T8은 "v2를 수용하지만 아무 producer도 v2를 만들지 않는" 상태로 순차 머지 — 각 PR 후에도 라이브는 v1 그대로(전체 test+validate 통과가 머지 조건).
- **producer flip(T9)은 원자 PR**: 스키마+프롬프트+repair whitelist가 분리 불가(whitelist 누락 = diagnostics-only 발행차단, P:199 자체 경고). 머지 게이트 = 3모델 스키마 수용 실측.
- **컷오버는 ISO 주 경계**: 주말 발행 완료 후 T9 머지, 월요일 첫 run부터 v2. 혼합 주 가드: 기존 v1 issue.json에 v2 섹션 병합 시 명시 에러(무음 오염 대신 중단).
- **첫 v2 주는 감독 실행**: 3모델 수용 실측, lint fail→repair→demote 리허설, 구주차 re-render diff 0, validate:site/quality 전 게이트 PASS, 라이브 200.
- **롤백**: T9 revert 한 PR(validator의 v2 수용 상태는 무해 — producer가 v1로 돌아가면 즉시 v1 발행 재개).

## 6. 태스크 분해 (이슈 단위)

| # | 제목 | 의존 | 트랙 |
|---|---|---|---|
| T1 | body_markdown 파서/정규화/lint 모듈 신설 (무배선) | — | v2 |
| T2 | 계약 코어 버전 인지: SUPPORTED 세트·마커 매트릭스·정규화/검증 v2 분기 | T1 | v2 |
| T3 | 스캐너 3종 body_markdown 동기 + 커버리지 드리프트 가드 테스트 | T2 | v2 |
| T4 | newsletters.json 버전 정본 필드 + 이슈별 버전 판별 | T2 | v2 |
| T5 | 렌더러 v2 분기(md/HTML/CSS) + 무음 다운렌더 fail 전환 + v1 바이트 불변 회귀 | T2 | v2 |
| T6 | repair 가상 블록 포인터 + v2 issue code 정책 등록 | T1,T2 | v2 |
| T7 | 결정론 prose 합성 v2 차단(demote 전환) + headline suffix 폐지 | T2 | v2 |
| T8 | 스키마 감축 선지불 + 3모델 수용 실측 harness | — | v2 |
| T9 | producer flip: v2 스키마+프롬프트 전면 재작성+repair whitelist (원자, 주 경계) | T1~T8 | v2 |
| T10 | 주간 에디터 레터 + lintIntroLetter 게이트 + fallback | T4 | v2 |
| T11 | 컷오버 감독 실행 + 사후 정리(dead code·llm-wiki) | T9,T10 | v2 |
| F1 | fallback 이미지 가짜 출처 캡션 제거 (라이브) | — | fabrication |
| F2 | QUIET_CORE_CONTEXT_NOTE 기간-수준 오보 제거 (라이브) | — | fabrication |
| F3 | 합성 링크 제목(roundup child·aosp release) 실존화 | — | fabrication |
| F4 | 홈 히어로 fallback에서 수집기 내부 rationale 차단 | — | fabrication |

F1~F4는 v2와 독립 — 즉시 착수 가능하며 기존 발행분 재렌더 정책(대상 주차만 최소 수정) 판단은 각 이슈에서.

## 7. 리스크와 한계 (심사 자인 사항)

1. in-band markdown 관례는 constrained decoding이 강제 불가 — 초기 몇 주 repair 부하·demote율 상승 가능. 완화: 골든 예시 문서 품질 + plan 단계 소제목 선제안.
2. 가상 블록 포인터는 repo 고유 주소 계약 — repair LLM 인덱스 오류율 실측 전 미지수. 완화: patchTargets 미리보기 + 실패 시 demote(자동 전체 교체 금지).
3. Gemini 스키마 수용성은 실측 시점의 스냅샷 — 모델 업데이트로 재변동 가능. harness를 T9 이후에도 보존.
4. intro_letter 변별 토큰 추출은 한국어·영문 혼합 헤드라인에서 휴리스틱 — false negative는 fallback으로 안전, false positive(유령 언급 통과)는 잔존 리스크. 레터 채택률 모니터링.
5. T9는 구조적으로 큰 원자 PR — prompt-contract 가드 "이식"(삭제 아님) 리뷰 집중 필요.
6. editorial_story 4슬롯 삭제로 가정형 경계 등 슬롯별 게이트 압력이 프롬프트 지시로만 남음 — not_to_overclaim 존치로 부분 방어, judge advisory에 위임.
7. 브리핑 3불릿·`## N.` 골격 유지는 롱블랙 순수주의 관점의 타협 — 의도적 범위 제외, 다음 증분.
