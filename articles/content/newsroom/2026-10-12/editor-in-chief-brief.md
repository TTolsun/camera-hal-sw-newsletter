# 편집장 브리핑 - 2026-10-12

## 이번 주 핵심 메시지

이번 주 뉴스레터에서는 cameraserver의 센서 프라이버시 음소거 동작 제안, Qualcomm CAMSS ISP 파라미터 uAPI 문서화 v10 패치, ChromiumOS platform2 카메라 모듈의 mojom 핸들 마이그레이션 소식을 다룹니다.

## 메인으로 봐야 할 기사

Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토

## Camera HAL 업무 연결 포인트
- cameraserver 센서 프라이버시 음소거 제안(Gerrit 4348947) 검토 및 HAL 세션 상태 전이 영향 분석
- Qualcomm CAMSS ISP v10 패치(V4L2_META_FMT_QCOM_ISP_PARAMS) uAPI 메타데이터 구조 및 OPE 파라미터 블록 검토
- ChromiumOS platform2 카메라 스택의 mojom 핸들 마이그레이션 패치(Gerrit 8506716) IPC 바인딩 변경점 확인

## 검증 결과 요약

- 상태: PASS
- must_fix 개수: 0
- source gap 개수: 0
- 의견: 모든 기사가 사실에 기반하고 있으며, 출처가 명확합니다. 과장된 표현이나 누락된 날짜 정보도 발견되지 않았습니다. 각 기사는 카메라 HAL SW 엔지니어에게 실질적인 가치를 제공하며, HAL/드라이버 관점의 영향과 구체적인 실행 항목을 잘 설명하고 있습니다. `evidence_summary` 및 `confirmed_facts`에 `...` 또는 `summary_truncated=true` 표시가 없으므로, 잘린 근거로 인한 문제는 없습니다.

## 품질 게이트
- 품질 점수: 97/100
- 품질 기준: 60
- 품질 상태: PASS
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토)

## Article Structure Contract

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토 | pass | present | driver_image_pipeline, stream_buffer_metadata | present | none |

## Stale Claim Gate

- Stale claim status: PASS
- Removed global stale items: 1
- Removed unsupported release claims: 0
- Unused references removed: 2
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
- Demoted candidates: unknown
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
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
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
