# 사실 검증 보고서 - 2026-05-22

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[0].actionability_level
  - 문제: actionability_level is 'none'. All main articles must have concrete action items.
  - 제안: Update actionability_level to reflect the concrete action items provided in `action_items`.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].hal_signal_capsule.do_not_overstate
  - 문제: The `do_not_overstate` field contains an array of strings, but it should be a single string.
  - 제안: Combine the array elements into a single string for the `do_not_overstate` field.
  - 출처: https://goo.gle/AdaptiveApps_IO26

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

The article has concrete action items, but the `actionability_level` in the main article section and `hal_signal_capsule` is incorrectly set to 'none'. This should be updated to reflect the presence of actionable items. Additionally, the `do_not_overstate` field in `hal_signal_capsule` is an array of strings, which needs to be a single string.
