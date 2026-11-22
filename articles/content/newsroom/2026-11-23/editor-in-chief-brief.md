# 편집장 브리핑 - 2026-11-23

## 이번 주 핵심 메시지

CameraX 1.7.0에서 물리 렌즈를 고르는 방법이 달라졌습니다. SM-F971과 OPPO PHT110 사례를 따라 렌즈 전환 뒤 캡처 결과와 서비스 로그를 짚고, 녹화 첫 프레임의 PTS가 실제 출력 시각과 어떻게 다른지 살펴봅니다.

## 메인으로 봐야 할 기사

CameraX 1.7.0에서 물리 카메라를 직접 고른다

## Camera HAL 업무 연결 포인트
- 렌즈 목록과 바인딩 결과를 함께 남기면 실패 지점을 좁힐 수 있습니다.
- 지원 목록에서 거절된 요청과 카메라가 받은 뒤 수렴이 늦어진 요청은 조사할 로그가 다릅니다.
- ZSL을 켠 세션과 끈 세션에서 같은 렌즈 전환 뒤 첫 캡처 결과가 돌아오는지 비교할 수 있습니다.
- 앱의 연결 해제 로그를 출력 구성의 물리 ID와 HAL의 마지막 flush 기록에 맞춰 보세요.
- 첫 프레임의 PTS와 첫 출력 콜백을 받은 시각을 따로 남겨야 대기 중이던 프레임과 출력 전달 지연을 구별할 수 있습니다.

## 검증 결과 요약

- 상태: PASS
- must_fix 개수: 0
- source gap 개수: 0
- 의견: 모든 기사가 공식 출처 및 전체 패치 diff에 기반하여 사실 관계를 충실히 반영하고 있으며, 과장된 결론 없이 적용 한계와 엔지니어 진단 포인트를 정확히 분리하여 기술했습니다. Markdown 린트 규칙과 편집 정책을 모두 통과하므로 즉시 발행 가능합니다.

## 품질 게이트
- 품질 점수: 85/100
- 품질 기준: 60
- 품질 상태: PASS
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt editorial-story (briefing 3); 2pt linked-evidence-limitation (3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요); 1pt image-fallback (3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요)

## Article Structure Contract

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0에서 물리 카메라를 직접 고른다 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | low | none |
| 2 | 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | medium | none |
| 3 | SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | medium | none |
| 4 | OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | high | none |
| 5 | 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | pass | present | stream_buffer_metadata | high | none |

## Stale Claim Gate

- Stale claim status: PASS
- Removed global stale items: 0
- Removed unsupported release claims: 0
- Unused references removed: 0
- Hard failures: 0

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 55
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 1
  - article:https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276
    - 5314ee226c5b3430a2c1f574efddc692f854845eb87dd1d5d7060561163dfd0c: coverage_decision=main_article, reason_code=diagnostic_comparison
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 4
- android: 0
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 4
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 68
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 2

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (20)
- main_eligible=false (20)
- source_gap_risk=true (20)
- briefing_only=true (15)
- finalSelectionEligibility=watchlist (15)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439489
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-23
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.


## 편집장 확인 checklist

- [ ] 이번 주 핵심 메시지가 Camera HAL 업무와 직접 연결되는가?
- [ ] 주요 항목의 출처가 충분하고 과장 표현이 없는가?
- [ ] 검증 결과의 must_fix가 모두 해소되었는가?
- [ ] 팀 공유용으로도 충분한 action item이 정리되었는가?

## 권장 판단

APPROVE
