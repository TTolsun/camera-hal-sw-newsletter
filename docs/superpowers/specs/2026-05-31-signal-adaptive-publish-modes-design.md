# 신호 적응형 발행 모드 (Signal-Adaptive Publish Modes) 설계

작성일: 2026-05-31
상태: 설계 승인 대기 → 구현 계획 단계 진입 예정

## 배경과 문제

이 저장소는 AOSP Camera Framework / Camera HAL / Camera Driver / V4L2·libcamera / ISP·image sensor / SoC platform 뉴스레터를 자동 생성한다. 그러나 운영 데이터가 구조적 문제를 드러낸다.

객관적 관측 (2026-05-31 실패 run `26710089998` 및 최근 발행물 기준):

- 최근 `03-newsroom-final-pr` run 12개 중 5개 실패 (약 42%). 단발 사고가 아닌 만성 상태.
- 실패 run의 `generation-status.json`: 입력 후보 42개 → 발행 가능(eligible) 2개. 그나마 둘 다 카메라 코어 기사가 아니라 Google I/O 일반 발표 + AI Studio 도구.
- 실제 발행된 `newsletters/2026-05-30/newsletter.md`: 두 기사 모두 본문에 "이번 변화는 Camera HAL에 직접적인 API 변경을 요구하지 않습니다"라고 명시. 즉 "카메라 HAL 뉴스레터인데 카메라 HAL 뉴스가 없는" 상태.
- `data/news-sources.json`의 소스 59개(enabled)가 `camera_relevance`/`tier` 같은 신호 분류 메타데이터를 가지고 있지 않음 — 신호와 잡음을 구분할 축 자체가 부재.

근본 원인: 시스템이 **"매일 메인 기사가 있는 리포트를 만들어야 한다"** 는 암묵적 가정 위에 서 있다. 카메라 코어 뉴스는 그렇게 자주 나오지 않으므로, 시스템은 부족분을 fallback 후보를 메인으로 억지 승격해서 채운다. 이 억지 승격이 editor의 claim binding / selected group coverage 검증과 충돌해 CI 실패로 이어진다.

직접적인 실패 사슬 (run 26710089998):
1. selection이 코어 0건 상태에서 fallback 2건을 메인으로 선택.
2. editor(Gemini)가 1차로 claim binding 실패 (`verified_facts` 2개를 `claim_type=fact` claim이 못 덮음).
3. repair 패스가 claim은 늘렸지만 섹션을 1개로 줄여 `android_native_tooling_workflow` 그룹을 누락 → `selected group coverage` 검증 실패.
4. `repairSucceeded: false` → generation exit 1 → 공개 아티팩트 미생성 → "Ensure public newsletter artifacts" 스텝에서 job 실패.

PR #467(`feat: promote cpp_fallback by LLM camera-dev relevance`)은 이 부족분 문제를 "fallback을 메인으로 승격"하는 방향으로 풀려 했으나, 토글 기본값 `false`로 비활성 상태이며 실패의 원인도 해결책도 아니었다. #467은 7단계 파이프라인(source-discovery → reporter → capsule → selection → quality → public-article → fact-check)에 `camera_dev_workflow_relevance` 필드를 배선하고, PR #466 회귀를 막는 `dropDecisionMetadataMustFix` 필터를 덧댄 복잡도 부채를 남겼다.

## 설계 목표

1. "카메라 코어 뉴스가 없는 날"을 시스템이 정직하게 수용한다 — 없는 것을 억지로 만들지 않는다.
2. 그런 날에도 좁은 코어 엔지니어(Camera HAL/driver/검증/SoC 실무자)에게 읽을 가치를 제공한다.
3. 단기 CI 실패의 근본 원인(억지 승격 → claim binding/group coverage 충돌)을 구조적으로 제거한다.
4. 품질 게이트를 낮추지 않는다 — 게이트의 *종류*를 발행 모드에 맞게 바꾼다.

명시적 비목표 (YAGNI):

- 새 소스 대량 추가 / RSS firehose 수집 강화. (S/N은 LLM 합성으로 푼다고 결정. 수집 확장은 별도 후속 과제.)
- 모드 자동 재평가/강등 루프. (selection 직후 1회 확정으로 결정.)
- 발행 주기 변경(주간↔일간). (모드는 *형식*을 바꾸지 *주기*는 그대로.)

## 방향 결정 요약 (브레인스토밍 합의)

- 독자/가치 무게중심: 좁은 코어 + 큐레이션된 맥락 레이어
- 핵심 병목: 수집·맥락·게이트·다양성 전부
- S/N 전략: LLM 합성·큐레이션 중심 (소스는 그대로, 가공에 투자)
- 1차 전략 축: 탄력 발행을 상위 원칙으로
- 단기/장기 통합: 둘을 하나의 설계로
- CONTEXT 모드 성격: 실무 레이더 중심
- #467 정리: CONTEXT 모드 완성 후 동일 설계에서 제거

## 핵심 개념: 3가지 발행 모드

그날 수집된 신호량을 selection 단계 산출물에서 결정론적으로 측정해, 발행 "모드"를 고른다.

| 모드 | 트리거 | 형식 |
|------|--------|------|
| **DEEP** (코어의 날) | 카메라 코어 후보(`direct_aosp_camera` + `camera_driver_image_pipeline`) ≥ 1건, dated evidence + source binding 통과 | 현행 메인 기사 1–3개 + 깊은 HAL 분석. 현행 엄격 게이트 유지. |
| **CONTEXT** (맥락의 날) | 코어 0건이지만 인접/SoC/도구 신호 ≥ `contextMinSignals` | 메인 기사 강요 없음. "실무 레이더" 형식의 맥락 브리핑. |
| **QUIET** (조용한 날) | 발행할 신호가 임계 미만 | 억지 발행 안 함. "주목할 변화 없음 + 다음 관전 포인트" 최소 노트. |

이 구조가 PR #467의 cpp_fallback 메인 승격 장치를 대체한다. 코어가 없으면 승격하는 대신 CONTEXT 모드로 형식을 전환하므로, 승격에 따르는 claim binding 압박이 발생하지 않는다.

## 컴포넌트 1: 모드 판정 모듈

원칙: CLAUDE.md의 "deterministic code, not the LLM, decides" 를 따른다. 모드는 LLM이 아니라 결정론적 코드가 고른다.

입력 (이미 `compositionSummary`가 산출하는 카운트, 모두 dated evidence + source binding 통과분):

```
coreCount     = direct_aosp_camera_count + camera_driver_image_pipeline_count
adjacentCount = android_platform_camera_adjacent_count + android_multimedia_camera_output_count
contextCount  = soc_platform_signal_count + cpp_ai_tooling_fallback_count
```

판정 규칙 (위에서부터 첫 매치):

```
coreCount >= 1                                   → DEEP
coreCount == 0 && (adjacentCount + contextCount) >= contextMinSignals  → CONTEXT
그 외                                            → QUIET
```

확정 시점: **selection 직후 1회.** 결정론적 selection이 끝난 직후 그 카운트로 모드를 고정한다. 이후 editor / fact-check / 렌더링 단계는 고정된 모드를 전제로 동작한다. 모드는 재평가/강등하지 않는다 — 단순성과 디버깅 가능성, PR 리뷰어의 예측 가능성을 우선한다.

기록: 확정된 모드와 판정 입력 카운트를 `generation-status.json`에 기록한다. PR 리뷰어가 "오늘은 CONTEXT라 메인 기사가 없는 게 정상"임을 확인할 수 있어야 한다.

위치: 모드 판정은 selection 산출물을 입력받는 작은 순수 함수로 분리한다. 입력은 `compositionSummary`(또는 그 카운트 필드), 출력은 모드 enum + 판정 근거 객체. 다른 단계의 내부를 알 필요가 없어야 한다.

## 컴포넌트 2: 정책 config 개정

`config/newsletter-policy.json`:

- 제거: `cppFallbackMainPromotion` 블록. (CONTEXT 모드가 대체)
- 추가: `publishModePolicy` 블록.

```json
"publishModePolicy": {
  "contextMinSignals": 1,
  "description": "발행 모드 판정 임계값. coreCount>=1이면 DEEP, core 0건이고 인접+맥락 신호가 contextMinSignals 이상이면 CONTEXT, 그 외 QUIET."
}
```

기존 원칙 유지: 정책 수치는 코드가 아니라 config에 둔다. `newsletter-policy.js`의 검증/정규화 함수가 `publishModePolicy`를 검증한다. 정책 문서(`docs/editorial-policy.md`, `README.md` 생성 블록)는 config 변경 후 `npm.cmd run sync:policy-docs`로 동기화한다.

## 컴포넌트 3: 모드별 게이트 분기

이 컴포넌트가 단기 CI 실패의 직접 해결책이다.

- **DEEP**: 현행 게이트 전부 유지. claim binding, source binding, selected group coverage 모두 엄격. 코어 기사는 정밀해야 하므로 완화하지 않는다.
- **CONTEXT**: "메인 기사 ≥ 1" 을 요구하는 검증을 면제한다. 구체적으로 `validateSelectedGroupCoverage`(및 관련 publish-ready 게이트)가 현재 모드를 인식해, CONTEXT 모드에서는 "선택된 모든 그룹이 메인 섹션으로 렌더링되어야 한다"는 요구를 적용하지 않는다. 대신 CONTEXT 고유 검증(맥락 연결의 정직성 — 컴포넌트 4)을 적용한다. 이로써 run 26710089998 같은 실패가 구조적으로 불가능해진다.
- **QUIET**: 발행물이 최소 형식(브리핑 + 관전 포인트)이므로 검증할 메인 기사가 없다.

품질 안전장치 (중요): 모드 분기는 품질 게이트를 *낮추는* 것이 아니다. CLAUDE.md 비협상 원칙(source-less main article 금지, dated evidence 필수, source binding 등)은 모드와 무관하게 유지된다. CONTEXT/QUIET는 "코어 메인 기사 존재"를 강요하지 않을 뿐, 실제로 발행되는 모든 콘텐츠는 여전히 근거·출처 규칙을 통과해야 한다.

## 컴포넌트 4: CONTEXT 모드 콘텐츠 — 실무 레이더

성격: "당장 쓸 일은 없지만 레이더에 올려둡니다." 진행 중인 변화를 정직하게 정리하는 데 무게를 둔다. 환각 리스크가 가장 낮고(진행 중 사실의 정리·연결이지 단정이 아님), 좁은 코어 엔지니어에게 정확히 유익하다.

형식:

```
1. 3줄 브리핑 (현행 유지)

2. "이번 기간 카메라 코어는 조용했습니다" — 정직한 한 줄.
   왜 DEEP이 아닌지 독자에게 명시 (신뢰 형성).

3. 맥락 기사 1–2개 (LLM 합성):
   - 단일 SoC/도구/표준 발표를 그대로 옮기지 않는다.
   - "이 변화가 Camera HAL/driver/검증 워크플로우에 왜, 어떻게 닿는가"를
     editorial-policy.md의 해석 기준(stream/buffer/metadata/request/result,
     CTS/VTS/Camera ITS, thermal/latency/frame drop/memory/contention)으로 연결.
   - editorial-policy.md의 좋은 예/나쁜 예 규칙을 CONTEXT 프롬프트에 명시 주입.

4. 관전 포인트 (선택):
   - 다음에 주목할 코어 변화 (곧 나올 CameraX 릴리스, 진행 중 libcamera 패치,
     SoC 전력/발열 추세 등). 단순 요약이 아니라 엔지니어의 레이더 역할.
```

CONTEXT 고유 안전장치:

- 근거 없는 과장 금지. "이 SoC 변화가 카메라에 영향을 준다"고 단정하지 않는다. "~한 검증 포인트를 점검할 만하다"처럼 검증 가능한 행동으로 연결한다. (이는 editorial-policy.md에 이미 존재하는 규칙을 CONTEXT 프롬프트에 명시 주입하는 것이며 새 규칙이 아니다.)
- "재미"를 위해 품질 게이트를 낮추지 않는다. CONTEXT는 "코어 기사 정밀도" 대신 "맥락 연결의 정직성"을 검증한다.

## 컴포넌트 5: PR #467 승격 로직 정리

CONTEXT 모드가 동작하여 fallback 승격을 대체하는 것이 확인된 뒤, 동일 설계 범위 안에서 #467의 잔재를 제거한다 (기능 공백 없이 교체).

제거 대상:

- `camera_dev_workflow_relevance` / `_reason` / `_source` 필드의 7단계 배선 (source-discovery, reporter, capsule, selection, quality, public-article, schema).
- `dropDecisionMetadataMustFix` 필터 및 호출부.
- `cppFallbackMainPromotion` 정책 토글 및 관련 분기 (`isSupportingMainBucket`, `compositionSummary`의 `cpp_fallback_camera_dev_relevant_count` 등).
- `detectCameraDevWorkflowRelevanceDeterministic` 및 관련 테스트.

주의: 제거는 단계적으로, 각 제거 후 `npm.cmd run test` + `npm.cmd run validate`로 회귀를 확인한다. 제거가 CONTEXT 모드의 동작을 깨지 않는지 검증한 뒤 진행한다.

## 단기 fail 수정의 흡수

| 앞서 식별된 단기 조치 | 이 설계에서의 처리 |
|---|---|
| ① `GEMINI_TEMPERATURE_EDITOR` 0.55→0.35 완화 | 설계와 독립적인 선행 hotfix PR로 분리. PR #465 튜닝의 회귀 의심을 먼저 가린다. |
| ② repair 패스가 selected group coverage 보존 | 여전히 필요(DEEP 모드 잔존 버그). 단 CONTEXT 모드가 코어 0건 케이스를 흡수해 발동 빈도 급감. |
| ③ editor 프롬프트에 "모든 verified_fact는 claim_type=fact claim 필요" 명시 | DEEP 모드 프롬프트 강화로 편입. |

## 구현 범위 요약

1. 모드 판정 모듈 (selection 직후 1회, `compositionSummary` 입력, `generation-status.json` 기록).
2. `newsletter-policy.json` 개정 (`cppFallbackMainPromotion` 제거, `publishModePolicy` 추가) + 검증/정규화 + 정책 문서 동기화.
3. 모드별 게이트 분기 (`validateSelectedGroupCoverage` 등이 모드 인식; CONTEXT/QUIET는 메인 기사 강요 면제).
4. CONTEXT 모드 렌더링 + 프롬프트 (실무 레이더 형식, editorial-policy.md 해석 기준 주입).
5. QUIET 모드 최소 발행물 형식.
6. PR #467 승격 로직 단계적 제거 (CONTEXT 검증 후).
7. (선행/독립) temperature hotfix PR.
8. DEEP 모드 보강: repair group coverage 보존 + editor 프롬프트 claim 규칙 명시.

## 영향받는 주요 파일 (예비 — 구현 계획에서 확정)

- `scripts/newsroom/generate/newsroom-selection.js` — 모드 판정, `compositionSummary`.
- `scripts/newsroom/common/newsletter-policy.js` — `publishModePolicy` 검증/정규화, `cppFallbackMainPromotion` 제거.
- `config/newsletter-policy.json` — 정책 개정.
- `scripts/newsroom/validate/editor-output-contract.js` — 모드 인식 group coverage 게이트, repair 보존.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js` — 모드별 프롬프트 분기, 상태 기록, #467 배선 제거.
- `scripts/newsroom/render/` — CONTEXT/QUIET 렌더링.
- `scripts/newsroom/collect/gemini-source-discovery.js`, `scripts/newsroom/generate/article-capsules.js`, `scripts/newsroom/render/newsletter-schema.js`, `scripts/newsroom/common/public-article-contract.js`, `scripts/newsroom/common/fact-check-repair.js`, `scripts/newsroom/domain/aosp-camera-scope.js` — #467 배선 제거.
- `docs/editorial-policy.md` — 발행 모드 정책 기술, #467 섹션 제거.
- 테스트: 모드 판정/게이트/CONTEXT 렌더링 신규 + #467 테스트 제거.

## 검증 기준

- `npm.cmd run test` + `npm.cmd run validate` 통과.
- 코어 0건 시나리오(run 26710089998 재현 입력)에서 CONTEXT 모드로 정상 발행 — exit 1 없음.
- 코어 ≥1건 시나리오에서 DEEP 모드로 현행과 동등한 발행.
- 신호가 임계 미만인 시나리오에서 QUIET 모드로 최소 노트 발행 — exit 1 없음, 억지 메인 기사 없음.
- `generation-status.json`에 모드와 판정 근거가 기록됨.
- #467 제거 후에도 전체 게이트 회귀 없음.
