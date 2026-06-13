# 사실 검증 보고서 - 2026-06-13

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: summary
  - 문제: 하드 블록된 소스(Linux 미디어 메일링 리스트의 NXP Neoisp 및 Qualcomm JPEG V4L2 mem2mem 인코더 패치)에 대한 언급이 포함되어 있습니다. 정책에 따라 블록된 소스는 확인된 세부 사실처럼 사용되거나 뉴스레터에 포함될 수 없습니다.
  - 제안: 하드 블록된 소스에 대한 언급을 제거하고, 발행 가능한 기사(Android CLI 및 GitHub를 통한 CameraX 마이그레이션 지원 스킬 추가)에 대한 내용으로만 요약을 재작성해야 합니다.
  - 출처: https://lore.kernel.org/linux-media/aixdEPsghlc2S7Zl@SMW015318/
- 위치: briefing[1]
  - 문제: 하드 블록된 소스(NXP Neoisp ISP 드라이버 패치)에 대한 언급이 포함되어 있습니다. 정책에 따라 블록된 소스는 확인된 세부 사실처럼 사용되거나 뉴스레터에 포함될 수 없습니다.
  - 제안: 해당 브리핑 항목을 제거해야 합니다.
  - 출처: https://lore.kernel.org/linux-media/aixdEPsghlc2S7Zl@SMW015318/
- 위치: briefing[2]
  - 문제: 하드 블록된 소스(Qualcomm JPEG V4L2 mem2mem 인코더 드라이버 패치)에 대한 언급이 포함되어 있습니다. 정책에 따라 블록된 소스는 확인된 세부 사실처럼 사용되거나 뉴스레터에 포함될 수 없습니다.
  - 제안: 해당 브리핑 항목을 제거해야 합니다.
  - 출처: https://lore.kernel.org/linux-media/20260612194417.1737009-1-atanas.filipov@oss.qualcomm.com/
- 위치: action_items[2]
  - 문제: 하드 블록된 소스(Linux 미디어 메일링 리스트의 NXP Neoisp 및 Qualcomm JPEG V4L2 mem2mem 인코더 패치)에 대한 모니터링 액션이 포함되어 있습니다. 정책에 따라 블록된 소스는 확인된 세부 사실처럼 사용되거나 뉴스레터에 포함될 수 없습니다.
  - 제안: 해당 액션 항목을 제거해야 합니다.
  - 출처: https://lore.kernel.org/linux-media/aixdEPsghlc2S7Zl@SMW015318/

## 권장 수정

- 없음

## 출처 공백

- 하드 블록된 소스인 'Re: [PATCH v3 6/8] media: platform: Add NXP Neoisp Image Signal Processor' (https://lore.kernel.org/linux-media/aixdEPsghlc2S7Zl@SMW015318/)는 'cross_check_required_but_missing' 상태로, 1차 확인이 누락되어 있습니다. 이 소스에 기반한 내용은 뉴스레터에 포함되어서는 안 됩니다.
- 하드 블록된 소스인 '[PATCH v1 0/4] This series adds support for the Qualcomm JPEG V4L2 mem2mem encoder.' (https://lore.kernel.org/linux-media/20260612194417.1737009-1-atanas.filipov@oss.qualcomm.com/)는 'cross_check_required_but_missing' 상태로, 1차 확인이 누락되어 있습니다. 이 소스에 기반한 내용은 뉴스레터에 포함되어서는 안 됩니다.

## 최종 의견

제공된 Editor draft JSON은 'hard_blocked_groups'로 명시된 Linux 미디어 메일링 리스트의 두 기사(NXP Neoisp ISP 드라이버 및 Qualcomm JPEG V4L2 mem2mem 인코더 패치)를 summary, briefing, action_items에 포함하고 있습니다. 정책에 따라 블록된 소스는 확인된 사실로 사용되거나 뉴스레터에 포함될 수 없으므로, 이 부분은 반드시 수정되어야 합니다. 유일하게 발행 가능한 기사(Android CLI 및 GitHub를 통한 CameraX 마이그레이션 지원 스킬 추가)는 품질 기준을 충족합니다.
