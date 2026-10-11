# 편집장 브리핑 - 2026-10-12

## 이번 주 핵심 메시지

AOSP 프라이버시 토글의 조건부 mute 제안, Qualcomm CAMSS ISP 문서화 패치의 구조체 리뷰, ChromeOS 카메라 IPC 핸들 타입 전환을 살펴봅니다.

## 메인으로 봐야 할 기사

cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안

## Camera HAL 업무 연결 포인트
- Gerrit 4348947의 리뷰 및 머지 상태 확인
- UID 가시성·mute 지원 조합별 ERROR_CAMERA_DISABLED와 세션 유지 여부 비교
- qcom-camss-config.h 메타데이터 블록 정의 및 OPE 파이프라인 단계별 구조체 확인
- v4l2_isp 공통 구조체 적용에 따른 메인라인 커널 패치 머지 추적
- camera3.mojom·dmabuf.mojom과 HAL 어댑터의 핸들 타입 대조

## 검증 결과 요약

- 상태: PASS
- must_fix 개수: 0
- source gap 개수: 0
- 의견: 모든 기사가 편집 정책을 준수하며, 출처에 기반한 사실과 HAL/드라이버 관점의 실질적인 정보를 제공합니다. 과장된 표현이나 출처 없는 주장은 발견되지 않았습니다. 모든 `summary_truncated=true` 항목은 유일한 근거가 아니거나, 잘린 내용이 뒷받침하지 않는 결론적 주장을 포함하지 않아 `must_fix`로 분류되지 않았습니다.

## 품질 게이트
- 품질 점수: 95/100
- 품질 기준: 60
- 품질 상태: PASS
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 3); 1pt image-fallback (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안); 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토); 1pt image-fallback (ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지)

## Article Structure Contract

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안 | pass | present | framework_hal_contract, driver_image_pipeline | present | none |
| 2 | Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토 | pass | present | driver_image_pipeline, stream_buffer_metadata | present | none |
| 3 | ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지 | pass | present | driver_image_pipeline, soc_resource_contention | present | none |

## Stale Claim Gate

- Stale claim status: PASS
- Removed global stale items: 0
- Removed unsupported release claims: 0
- Unused references removed: 0
- Hard failures: 0

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 61
- Final eligible candidates: 12
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 4
- Demoted candidates: 0
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 9
- direct_aosp_camera: 1
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 3
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 39
- republication_cooldown_blocked: 2
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (32)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (22)
- briefing_only=true (21)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://source.android.com/docs/compatibility/cts/its-release-notes-17
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947
- public_render_reconciled: true
- public_rendered_headline_key: url:https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-12
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
