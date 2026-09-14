# 편집장 브리핑 - 2026-09-14

## 이번 주 핵심 메시지

이번 주에는 Linux 미디어 서브시스템 및 libcamera 프로젝트에서 카메라 드라이버와 ISP 이미지 파이프라인의 핵심적인 수정 및 기능 확장 제안이 대거 공개되었습니다. Rockchip RKISP1 ISP의 Bayer demosaicing 바이패스 로직 오류 수정, 새로운 os02g10 이미지 센서 드라이버 추가, 그리고 libcamera에서의 IMX355 테스트 패턴 매핑 수정 및 LensShadingCorrection/ToneCurve 메타데이터 제어 기능 확장이 포함됩니다. 이러한 변화는 하위 카메라 스택의 안정성을 높이고 Android Camera HAL 계층에서의 이미지 품질 제어 및 검증 효율성을 크게 향상시킬 것입니다.

## 메인으로 봐야 할 기사

Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안

## Camera HAL 업무 연결 포인트
- RKISP1 기반 플랫폼 개발 팀은 제안된 demosaicing 바이패스 수정 패치(https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/)를 적용하여 RAW 및 YUV 이미지 품질 회귀 테스트를 수행하십시오.
- OmniVision os02g10 센서 도입 예정인 프로젝트는 v5 패치 시리즈(https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/)를 통합하고 v4l2-compliance 도구를 사용해 규격 준수 여부를 검증하십시오.
- Sony IMX355 센서 및 libcamera 스택 사용 팀은 제안된 테스트 패턴 모드 매핑 수정 패치(https://patchwork.libcamera.org/patch/28200/)를 적용하여 SENSOR_TEST_PATTERN_MODE 요청 시의 출력 무결성을 검증하십시오.
- libcamera 기반 RAW/DNG 저장 담당자는 제안된 패치(https://patchwork.libcamera.org/patch/28219/)의 결과 메타데이터와 DNG 저장 프로그램의 연동을 검토하십시오.

## 검증 결과 요약

- 상태: PASS
- must_fix 개수: 0
- source gap 개수: 0
- 의견: 제공된 모든 기사는 Camera HAL/Driver 엔지니어에게 실질적인 가치를 제공하며, 사실 확인, 출처 명시, 과장 금지, 구체적인 Action Item 제시 등 편집 정책을 잘 준수하고 있습니다. 모든 기사가 '제안된 패치'임을 명확히 밝혀 과장 위험을 낮추고 있습니다. 이미지 후보가 없어 fallback 이미지를 사용한 것은 정책에 부합합니다. 전반적으로 발행 가능한 품질입니다.

## 품질 게이트
- 품질 점수: 94/100
- 품질 기준: 60
- 품질 상태: PASS
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt image-fallback (Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안); 1pt image-fallback (OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안); 1pt image-fallback (libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안)

## Article Structure Contract

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | pass | present+guarded | driver_image_pipeline, soc_resource_contention | present | guardrail-only |
| 2 | OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | pass | present+guarded | driver_image_pipeline, performance_latency_frame_drop | present | guardrail-only |
| 3 | libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | pass | present+guarded | driver_image_pipeline | present | guardrail-only |
| 4 | libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata | present | guardrail-only |

## Stale Claim Gate

- Stale claim status: PASS
- Removed global stale items: 0
- Removed unsupported release claims: 0
- Unused references removed: 0
- Hard failures: 0

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 71
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 5
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 5
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max
- release_class_after_reconciliation_pool_size: 1
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: not_in_reporter_input
- republication_history_loaded: true
- republication_history_main_articles: 23
- republication_cooldown_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- missing dated evidence (24)
- final_selection_blocked=true (23)
- main_eligible=false (22)
- selection_window=unknown_not_main (22)
- source_gap_risk=true (22)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-14
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
