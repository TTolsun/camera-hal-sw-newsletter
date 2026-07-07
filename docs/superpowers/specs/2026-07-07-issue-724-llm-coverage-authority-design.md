# #724 — LLM coverage 권한 wiring 설계 (결정론 재조정 경유)

- 이슈: #724 (LLM coverage 권한 wiring: editorial-plan의 coverage_decision을 실제 composition에 반영, #700 §1 follow-up)
- 작성일: 2026-07-07
- 상태: 설계 확정 대기(사용자 리뷰 gate)
- 접근: **A — editorial-plan LLM 뒤·editor 앞에 결정론 coverage 재조정 스테이지 신설**

## 배경과 문제

#700에서 LLM editorial-plan 스테이지가 default-ON으로 항상 실행되며, 후보별 `coverage_decision`(main_article / short_mention / reference_only / exclude)과 `impact_level`을 생성한다. 그러나 이 신호는 **advisory-only**다 — `editorFacingEditorialPlan`([src/generator/publish/orchestrator-editorial-plan-stage.js:62-68](../../../src/generator/publish/orchestrator-editorial-plan-stage.js#L62-L68))이 editor로 넘기기 전 `coverage_decision`/`impact_level`을 strip하고, 신호는 `editorial-plan.json` 아티팩트에만 남는다. 어떤 candidate가 main article이 되는지는 여전히 결정론 selection(`src/generator/select/`)이 정한다.

추가로, 현재 editorial-plan LLM은 **이미 selected된 main 집합만** 입력으로 받는다([gemini-newsroom-newsletter.js:477-479](../../../src/generator/publish/gemini-newsroom-newsletter.js#L477), `capsuleInputFromReport(articleCapsuleReport, 'selected')`). 따라서 현재 배선으로는 coverage_decision이 반영되더라도 **강등만 가능하고 승급은 불가능**하다(reserve 후보를 보지 못함).

## 동기와 성공 기준

- **동기**: 관찰된 편성 오류 사례는 없음. #700 §1의 원래 구상("LLM이 main/short/reference/exclude를 실제로 결정")을 완성하는 것이 목적(설계 완결성).
- **성공(=done) 기준**: 관찰된 버그가 없으므로 "LLM 편성이 결정론보다 낫다"는 증명은 요구하지 않는다. 대신:
  1. 발행안전 불변식 **무회귀**(아래 불변식 절 전부 보존).
  2. LLM이 만든 편성 변화가 **사람 리뷰어에게 방어 가능**(리뷰어가 `coverage-reconciliation.json` diff를 보고 각 변화의 근거를 납득할 수 있음).
  3. 프로덕션 ON/OFF A/B로 1·2를 실증한 뒤에만 default ON 승격.

## 권한 경계 결정 (확정)

- **양방향(승급 + 강등)** — source-eligible 집합 안에서 LLM coverage_decision이 tier를 재배치한다.
- **hard blocker는 어느 경우든 결정론 유지**: source-binding / evidence / freshness / hard-fail / source_gap_risk / duplicate URL / stale-claim 등 `qualityGatePolicy.hardFailConditions`와 source 자격 판정은 결정론 validator가 그대로 담당한다. reconciler는 이들을 우회하지 않는다.
- LLM은 **결정론이 이미 발행가능 main 자격을 부여한 봉투 안에서만** 등급을 재배치한다.

## 아키텍처

### 파이프라인 변경

```
현행:
  선정(결정론) → capsules[selected] → editorial-plan LLM(coverage strip)
    → editor(selected) → judge/quality/render

신규:
  선정(결정론) → capsules[shortlisted = selected + reserve]
    → editorial-plan LLM(shortlist 전체에 coverage 부여)
    → ★ coverage 재조정(결정론, 신규) ★
    → editor(재조정된 selected) → judge/quality/render
```

두 지점만 바뀐다:
1. editorial-plan LLM 입력을 `'selected'` → `'shortlisted'`(selected + reserve)로 확장([orchestrator-editorial-plan-stage.js:45](../../../src/generator/publish/orchestrator-editorial-plan-stage.js#L45)의 `capsuleInputFromReport(..., 'selected')`). reporter는 이미 `'shortlisted'`를 받으므로 기존 패턴과 일치. **이 확장은 A/B 플래그 ON일 때만** 적용한다 — OFF에서는 `'selected'`를 유지해 editorial-plan.json·토큰 비용까지 현행과 동일하게 둔다(승급이 필요한 ON 경로에서만 reserve를 LLM에 노출).
2. `editorFacingEditorialPlan` strip을 제거하지 않는다(editor는 여전히 framing 필드만 받음). 대신 coverage_decision/impact_level은 **신규 reconciler**가 소비한다.

### 슬라이스 경계 (범위 축소)

이 슬라이스는 **main 집합 권한만** 배선한다. LLM 4등급을 편성에 다음과 같이 매핑한다:

- `main_article` → main 집합 후보.
- `short_mention` / `reference_only` / `exclude` → **"main 아님"으로 collapse**(main 집합에서 빠짐).

즉 이 슬라이스에서 `short_mention`/`reference_only`/`exclude`의 **상호 구분은 편성에 영향을 주지 않고**(전부 "main 아님") diff 아티팩트에만 기록한다. **참고자료(reference) 섹션은 기존 결정론 로직([reference-articles.js](../../../src/generator/render/reference-articles.js))을 그대로 유지**한다 — LLM 등급이 참고 섹션 구성을 바꾸지 않는다. 참고 섹션까지 LLM에 위임하는 것(reference_only vs exclude를 실제로 구분)은 **명시적 Phase 2 follow-up**으로 남긴다(YAGNI: 이 슬라이스의 핵심 가치는 main 편성 권한이고, 참고 섹션은 이미 결정론 자격 로직을 가짐). #700 구상은 이렇게 증분으로 완성한다.

### 신규 모듈: coverage 재조정 (순수 결정론)

`src/generator/select/coverage-reconciliation.js` (선정 계층에 두어 selection-composition-gates·selection-policy-constants를 재사용).

시그니처(순수 함수, LLM 호출 없음):

```
reconcileCoverage({ shortlistReport, llmCoverageByHash, policy }) -> {
  selected,               // 재조정된 main 집합 (editor로 전달)
  nonMain,                // main에서 빠진 후보(원 등급 short/reference/exclude 라벨 보존) — 이 슬라이스에선 편성 미소비, diff 기록용
  diff                    // 결정론 편성 vs LLM 제안 vs 재조정 결과 + 후보별 사유
}
```

알고리즘(순서 고정, 전부 결정론):

1. **제안 tier 매핑**: 각 후보의 LLM `coverage_decision`을 제안 tier로 읽는다. LLM이 채점하지 않은 후보는 결정론 tier를 유지한다(selected → main 후보, reserve → reference 후보).
2. **승급 자격 가드**: tier=main 제안은 후보가 **결정론적으로 main-eligible**일 때만 허용한다 — `main_article_source_allowed === true` ∧ 비-`forbiddenMainBuckets`(generic_tech_watchlist) ∧ `main_article_score_eligible !== false`(`mainArticleScoreThreshold` 42 충족) ∧ selection window 내. 위반 시 main→reference로 clamp. → **LLM은 결정론이 main 자격을 주지 않은 후보를 main으로 올릴 수 없다**(source-binding·forbidden·임계 상향 침식 0).
3. **cap clamp**: tier=main 집합에 `articlePolicy` 제약을 결정론으로 재적용 — `mainArticleCount.max`(5), `publishReadyComposition.supportingMainMaxAllowed`(1), forbidden 버킷 배제, `reviewCompositionGatePasses` 규칙. 제안 main이 초과하면 순서 (a) LLM `impact_level` desc → (b) `deterministic_score` desc(재현가능 tiebreak)로 top-N만 main 유지, 나머지는 reference로 강등.
4. **발행가능 floor**: main < `mainArticleCount.min`(1)이면, 결정론 최고점 main-eligible 후보로 backfill(LLM의 exclude/강등을 무시)해 floor를 채운다. → **LLM은 뉴스레터를 발행불가(빈/미달)로 만들 수 없다**.
5. **weekly 한도**: `weeklyArticleLimit`/`rank_then_drop`은 선정에서 이미 결정론으로 적용됨. reconciler는 이를 느슨하게 만들지 않는다.
6. **산출**: 재조정된 main 집합이 `shortlistReport.selected_articles`를 대체해 editor로 전달된다. main에서 빠진 후보(short/reference/exclude)는 main 집합을 벗어날 뿐이며, 참고자료 섹션 구성은 기존 결정론 로직이 그대로 정한다(이 슬라이스는 참고 섹션을 바꾸지 않음).

### editor 계약 보존

editor는 변경 없이 **확정된 selected 집합을 받아 전부 렌더**한다(group-coverage 계약 무변경). 변화는 순수 상류(집합 내용)에서만 일어나며, editor가 기사를 병합/드롭하지 않는다 → 커널 patch series 조각을 editor가 1기사로 병합해 발행 차단되던 취약성(과거 진단)을 회피한다.

## A/B 토글과 리뷰어 아티팩트

- 환경 플래그 `NEWSROOM_LLM_COVERAGE_AUTHORITY`, **default OFF**.
  - OFF: reconciler는 passthrough이고 editorial-plan 입력도 `'selected'`를 유지한다. selected = 결정론 selected, coverage는 `editorial-plan.json`에만 기록 → **editorial-plan.json·토큰 비용·편성이 전부 현행과 동일**.
  - ON: reconciler 적용.
- reconciler는 **항상** `coverage-reconciliation.json`을 newsroom 디렉터리에 기록한다: 결정론 편성 · LLM 제안 · 재조정 결과 · 후보별 diff(적용된 guard/clamp/backfill 사유). 이 아티팩트가 A/B "방어 가능" 기준을 충족시키는 리뷰어 근거다. OFF에서도 기록(제안 대비 결정론 편성이 무엇을 무시했는지 shadow 비교 가능).

> 참고: #728이 editorial-plan의 best-effort graceful-degradation 토글을 제거했으나, 이 플래그는 그것과 다르다 — 위험한 신권한의 **의도적 A/B 롤아웃 플래그**이며, OFF가 현행과 동일함을 보장하는 회귀 안전장치다. best-effort 예외를 되살리는 것이 아니다.

## 보존 불변식 (명시·테스트 잠금)

1. hard blocker(source-binding/evidence/freshness/hard-fail/source_gap_risk/duplicate URL/stale-claim)는 결정론 validator 그대로. reconciler는 우회 불가.
2. main 승급은 결정론 main-eligible 후보에만(가드).
3. `mainArticleCount`·`supportingMainMaxAllowed`·`forbiddenMainBuckets`·`reviewCompositionGatePasses`는 결정론 clamp.
4. 발행가능 floor는 결정론 backfill(LLM이 발행불가로 못 만듦).
5. **OFF 플래그 = 현행과 동일**(golden 회귀).
6. 품질 게이트·threshold는 낮추지 않는다.

## 원칙/계약 문서 갱신

- [CLAUDE.md:65](../../../CLAUDE.md#L65)의 핵심 원칙을 새 경계로 갱신:
  - 현행: "어떤 candidate를 main article로 만들지는 LLM이 아니라 deterministic code가 결정한다."
  - 신규: "발행가능 main *자격*(source-binding/evidence/freshness/cap/floor/forbidden)은 deterministic code가 결정한다. 그 결정론적으로 허용된 봉투 *안에서* coverage 등급(main/short/reference/exclude) 재배치는 LLM editorial-plan이 제안하고 deterministic reconciler가 불변식을 강제한다."
- [src/AGENTS.md](../../../src/AGENTS.md)의 review-publication guardrail도 동반 갱신(경계 재정의 반영). `.github/workflows/AGENTS.md`는 발행 계약 무변경이므로 손대지 않는다.

## 테스트 (TDD, RED→GREEN)

- reconciler 단위: ①승급 가드가 ineligible(source 미허용/forbidden/임계 미달/윈도우 밖)을 reference로 clamp ②cap clamp가 impact→score 순으로 top-N 유지 ③floor backfill이 과다 exclude를 복구 ④exclude가 드롭 ⑤OFF passthrough가 결정론 selected와 동일.
- 통합: editorial-plan 입력이 reserve 포함으로 확장됨 · editor가 재조정된 집합을 받음.
- 계약(golden): OFF 플래그에서 selected 집합이 변경 전과 동일(바이트/구성).
- 아티팩트 shape: `coverage-reconciliation.json` 스키마 검증.

## 롤아웃

1. default OFF로 브랜치에 랜딩(모든 test + validate 통과, OFF=현행 동일 실증).
2. 프로덕션 A/B(ON vs OFF) ≥2 주기 실행.
3. `coverage-reconciliation.json` diff의 방어가능성 + 안전 불변식 무회귀를 사용자가 리뷰.
4. 사용자 승인 후에만 default ON 승격(별도 커밋). **자율 머지 안 함**.

## 대안(기록)

- **demote-only**(더 좁은 슬라이스): editorial-plan 입력을 확장하지 않고 selected 집합 내 강등만 허용. 승급 없음 → reserve 노출 불필요, reconciler가 더 단순. 이슈의 "좁은 슬라이스" 표현에는 더 부합하나, 사용자가 양방향을 택함. 양방향의 위험이 크다고 판단되면 이 축소안으로 되돌릴 수 있음.
- **접근 B**(selection이 coverage 소비): selection이 editorial-plan보다 먼저 실행되어 파이프라인 역전 필요 → 기각.
- **접근 C**(editor가 coverage 직접 소비, strip 제거만): cap/eligibility/floor 강제를 LLM에 위임 → 확정 불변식 위반, editor 병합 취약성 → 기각.
