# 강한 기술근거 커널 메일링리스트 패치의 main 자격 부여 — 설계

작성일: 2026-06-15

## 배경과 문제

2026-06-15 자동 생성 결과물(PR #624)이 diagnostics-only(발행 차단)로 끝났다. 근본 원인을 산출물로 추적한 결과:

- 그날 후보 3개 중 진짜 카메라 내용 2개는 lore.kernel.org linux-media 메일링리스트 패치였다.
  - `[PATCH v2 0/6] media: v4l2-ctrls: bound stateless HEVC/AV1 tile counts`
  - `Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry`
- 두 패치 모두 `main_article_source_allowed: false`였다. linux-media 소스가 `mainArticlePolicy: conditional` + `requiresCrossCheck: true`로 설정돼 있어, 2차 확증(primary confirmation) 없이는 main 기사로 못 쓰기 때문이다.
- 그날 유일하게 `main_article_source_allowed: true`였던 후보는 약한 `android_platform_camera_adjacent` 기사였고, editor는 그걸 단독 main으로 올렸다. 그 기사가 fact-check must_fix(actionability 모순)에 걸리고 → repair fail-closed → 기사가 1개뿐이라 salvage도 불가 → 전체 발행 차단.

즉 **editor와 하류 게이트는 정상 동작했고**, 진짜 손볼 지점은 "병합도 안 된 커널 패치를 단독 출처로 헤드라인 삼지 말자"는 교차검증 규칙이 **기술근거가 강한 패치까지 일률적으로 막은 것**이다.

## 목표

기술근거가 강한 `project_mailing_list_source` 패치를 main 기사로 승격 가능하게 한다. 단:

- 얇은 답장·근거 약한 포스트·Reddit 등 community-signal 소스는 계속 main 불가.
- 승격하더라도 안전 계약(출처 없는 main 금지, hard-fail 게이트 불변)은 유지한다.
- "통과시키려고 게이트를 낮추는" 것이 아니라, "구조화된 기술 패치 = 1차 증거"라는 올바른 모델로 교차검증의 의미를 재정의한다.

## 비목표 (YAGNI)

- 새 `coverage_type` 서브시스템이나 추측성 프레이밍 가드는 만들지 않는다. 승격된 패치 main의 "제안/리뷰 중" 프레이밍은 기존 source_extraction 증거·date-framing·fact-check overclaim 가드로 1차 대응한다. 워크플로우 실행에서 실제 overclaim/must_fix 문제가 관찰되면 그때 타겟 가드를 추가한다.
- decision 모델(`decisionFromCandidate`)은 건드리지 않는다. 실제 run에서 패치는 이미 selected되어 capsule까지 도달했으므로, capsule 단계 승격만으로 충분하다.

## 판정 기준

`evidenceStrength()`와 `technicalDepth()`([src/discovery/score-source-candidates.js](../../../src/discovery/score-source-candidates.js))는 candidate 필드만 읽는 순수 함수다(이산값: evidence ∈ {0, 0.25, 0.55, 0.9}, depth ∈ {0.25, 0.55, 0.85}).

후보가 다음을 모두 만족하면 main 자격으로 승격한다:

1. `source_quality.source_role === 'project_mailing_list_source'`
2. `evidenceStrength(candidate) >= evidenceStrengthMin` (= 0.5)
3. `technicalDepth(candidate) >= technicalDepthMin` (= 0.5)
4. 현재 `source_quality.main_article_source_blockers`가 교차검증 계열(`cross_check_required_but_missing`, `candidate_only_without_primary_confirmation`)만 포함 — `source_gap_risk`, `unknown_source_quality`, `linked_evidence_*`, `missing_url`, `reference_only` 같은 다른 blocker가 있으면 승격하지 않는다.

실데이터 검증(2026-06-15, 0.5 기준): lore 후보 13개 중 4개만 통과하고 전부 강한 V4L2 HEVC/AV1 시리즈다. 얇은 MIPI 답장(depth 0.25), BUG 리포트, 근거 0짜리 fragment는 전부 차단 유지. 점수가 이극화돼 있어 0.5·0.65·0.8 결과가 동일(4개)하므로 0.5는 안전하다. #623 thread 그룹화로 V4L2 시리즈는 1개 그룹 → 대표 main 1개로 합쳐져 범람도 통제된다.

## 통합 지점 (레이어 분석 결과)

레이어 의존은 단방향: `shared ← collector ← discovery ← generator`. 따라서 `shared/collect`의 `classifySourceQuality`는 discovery의 점수 함수를 import할 수 없다. 반면 **generator/select는 discovery를 import할 수 있다.**

- 새 모듈 [src/generator/select/mailing-list-patch-eligibility.js](../../../src/generator/select/mailing-list-patch-eligibility.js):
  - `upgradeMailingListPatchEligibility(sourceQuality, candidate, policy)` — `evidenceStrength`/`technicalDepth`(discovery에서 export)와 정책 임계값을 읽어, 위 기준을 만족하면 source-quality 객체를 승격해 반환하는 순수 함수. 승격 시: `main_article_source_allowed = true`, `source_quality_status = 'allowed'`, `cross_check_status = 'required_satisfied'`, `conditional_evidence_type = 'project_patch_strong_evidence'`, 교차검증 blocker 제거, reason 갱신.
  - `applyMailingListPatchEligibilityToCandidate(candidate, policy)` — 위 함수를 candidate에 적용하되, canonical `source_quality` 객체와 top-level flat 필드(`sourceQualityFlatFields`)를 함께 갱신해 `SOURCE_QUALITY_FIELD_DRIFT`를 방지한다.
- 적용 지점은 **선택 단계의 [decorateCandidate](../../../src/generator/select/newsroom-selection.js)** — 모든 후보가 거치는 단일 per-candidate 데코레이션 지점. 여기서 candidate를 승격하면 shortlist → reporter input → editor hard-block 검증(`hardBlockReasonForCandidate`) → quality gate(`candidateSelectionViolation`)가 모두 같은 승격 값을 본다.
  - 주의: 처음에는 `buildArticleCapsule`에서만 승격했으나, capsule은 `article-capsules.json` 아티팩트에만 반영되고 editor/quality gate는 원본 candidate의 source_quality를 다시 읽어 patch를 계속 blocked 처리한다(적대적 리뷰에서 blocker로 확인). 그래서 candidate 단계(decorateCandidate)로 이동했다.
- `evidenceStrength`/`technicalDepth`를 score-source-candidates.js의 `module.exports`에 추가한다(generator는 discovery를 import할 수 있다).

## 설정 (config 기반)

[src/shared/config/newsletter-policy.json](../../../src/shared/config/newsletter-policy.json)에 새 블록을 추가한다:

```json
"sourceEligibilityPolicy": {
  "mailingListPatchMainArticle": {
    "enabled": true,
    "sourceRole": "project_mailing_list_source",
    "evidenceStrengthMin": 0.5,
    "technicalDepthMin": 0.5
  }
}
```

변경 후 `npm.cmd run sync:policy-docs` 실행, `check:policy-docs`가 검증한다.

## 테스트

contract/unit 테스트(합성 candidate 사용 — 생성 산출물 복사 금지, fixture-trust 준수):

- 강한 패치(role=project_mailing_list_source, evidence 0.9, depth 0.85, blocker=cross_check만) → 승격되어 `main_article_source_allowed: true`, readiness 통과.
- 얇은 답장(depth 0.25) → 승격 안 됨.
- 근거 0 fragment(evidence 0) → 승격 안 됨.
- 다른 blocker 존재(source_gap_risk 등) → 승격 안 됨.
- 비-mailing-list `conditional` 소스 → 영향 없음.
- Reddit/community-signal → 계속 차단(별도 영구 차단 경로 유지).
- 기존 핀 테스트(`candidate-decision-model.test.js` Case 3 등)가 그대로 통과하는지 확인.

전체 검증: `npm.cmd run test` + `npm.cmd run validate`.

## 검증 (사용자 요청)

`newsletters-00-orchestrator` GitHub 워크플로우를 실행해 기사가 정상 생성되는지(파이프라인 미회귀, 강한 패치가 있으면 main 승격) 확인한다.
