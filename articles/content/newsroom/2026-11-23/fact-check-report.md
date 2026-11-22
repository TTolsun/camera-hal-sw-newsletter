# 사실 검증 보고서 - 2026-11-23

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[2].claims[1].impact_level
  - 문제: claims[1]의 claim text는 OPPO PHT110 기기에서 물리 카메라 ID 2 또는 3을 타깃팅할 때 벤더 HAL 내부의 P2StreamingNode 및 BasicSession::flush 단계에서 멈추는 현상을 기술하고 있습니다. 이는 HAL 인터페이스 계약 자체의 변경이 아니라 벤더 HAL 내부 구현 및 파이프라인의 멈춤 현상에 해당하므로 direct_hal_contract 분류 기준에 부합하지 않습니다.
  - 제안: 해당 claim의 impact_level을 driver_image_pipeline 또는 camera_framework_behavior로 수정하세요.
  - 출처: https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995

## 권장 수정

- sections[1] 및 sections[2]: 프레임워크 레이어의 쿼크 등록은 상위 앱 크래시를 막기 위한 우회책이므로, 벤더 HAL 및 ISP 파이프라인 개발자가 펌웨어 레벨에서 해당 노드 락업 문제를 근본 해결해야 한다는 기술적 권고를 보강하면 더욱 유익합니다.

## 출처 공백

- 없음

## 최종 의견

전체 5개 기사 모두 원문 Gerrit diff 및 공식 릴리스 노트와 완벽하게 일치하며, 금지된 Markdown 문법 없이 고품질로 작성되었습니다. 다만 section 2의 oppo_pht110_hal_hang 클레임에 지정된 impact_level이 direct_hal_contract로 분류되어 있으므로, 실제 계층에 부합하는 driver_image_pipeline 또는 camera_framework_behavior로 수정이 완료되면 즉시 발행 가능합니다.
