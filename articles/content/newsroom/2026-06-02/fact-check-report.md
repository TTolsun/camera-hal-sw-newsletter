# 사실 검증 보고서 - 2026-06-02

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[0].public_article.decision_metadata.impact
  - 문제: impact_level enum violation: 'Low' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'Low' with a valid enum value from the allowed list, e.g., 'app_api_or_framework_adjacent'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.scope
  - 문제: scope enum violation: 'Framework' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'Framework' with a valid enum value from the allowed list, e.g., 'camera_framework_behavior'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.scope
  - 문제: scope enum violation: 'SoC' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'SoC' with a valid enum value from the allowed list, e.g., 'soc_resource_contention'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.action
  - 문제: action enum violation: 'Watch' is not a valid enum value. Allowed values are: 'test', 'log', 'metric', 'device_class', 'api_component', 'stream_combination', 'owner', 'poc_handoff', 'reference_only', 'watchlist'.
  - 제안: Replace 'Watch' with a valid enum value from the allowed list, e.g., 'watchlist'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.action
  - 문제: action enum violation: 'Test' is not a valid enum value. Allowed values are: 'test', 'log', 'metric', 'device_class', 'api_component', 'stream_combination', 'owner', 'poc_handoff', 'reference_only', 'watchlist'.
  - 제안: Replace 'Test' with a valid enum value from the allowed list, e.g., 'test'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.overclaim_risk
  - 문제: overclaim_risk enum violation: 'High' is not a valid enum value. Allowed values are: 'low', 'medium', 'high'.
  - 제안: Replace 'High' with a valid enum value from the allowed list, e.g., 'high'.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[1].public_article.decision_metadata.impact
  - 문제: impact_level enum violation: 'Medium' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'Medium' with a valid enum value from the allowed list, e.g., 'native_tooling_workflow'.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.scope
  - 문제: scope enum violation: 'Tooling' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'Tooling' with a valid enum value from the allowed list, e.g., 'native_tooling_workflow'.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.scope
  - 문제: scope enum violation: 'AI' is not a valid enum value. Allowed values are: 'direct_hal_contract', 'camera_framework_behavior', 'app_api_or_framework_adjacent', 'driver_image_pipeline', 'stream_buffer_metadata', 'cts_vts_its_cdd', 'performance_latency_thermal', 'soc_resource_contention', 'native_tooling_workflow', 'no_hal_runtime_impact', 'unknown'.
  - 제안: Replace 'AI' with a valid enum value from the allowed list, e.g., 'native_tooling_workflow' if it impacts tooling, or 'unknown' if the impact is not directly on HAL/driver.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.action
  - 문제: action enum violation: 'Watch' is not a valid enum value. Allowed values are: 'test', 'log', 'metric', 'device_class', 'api_component', 'stream_combination', 'owner', 'poc_handoff', 'reference_only', 'watchlist'.
  - 제안: Replace 'Watch' with a valid enum value from the allowed list, e.g., 'watchlist'.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.action
  - 문제: action enum violation: 'Test' is not a valid enum value. Allowed values are: 'test', 'log', 'metric', 'device_class', 'api_component', 'stream_combination', 'owner', 'poc_handoff', 'reference_only', 'watchlist'.
  - 제안: Replace 'Test' with a valid enum value from the allowed list, e.g., 'test'.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.overclaim_risk
  - 문제: overclaim_risk enum violation: 'Medium' is not a valid enum value. Allowed values are: 'low', 'medium', 'high'.
  - 제안: Replace 'Medium' with a valid enum value from the allowed list, e.g., 'medium'.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

The content is well-written and follows the editorial policy. However, there are several enum violations in the `public_article.decision_metadata` fields. These fields must use the exact enum values specified in the schema. Please correct the `impact`, `scope`, `action`, and `overclaim_risk` fields to use the allowed enum values.
