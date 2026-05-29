# 사실 검증 보고서 - 2026-05-29

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[0].public_article.decision_metadata.impact
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.scope
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.action
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[0].public_article.decision_metadata.overclaim_risk
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://goo.gle/AdaptiveApps_IO26
- 위치: sections[1].public_article.decision_metadata.impact
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.scope
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.action
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- 위치: sections[1].public_article.decision_metadata.overclaim_risk
  - 문제: decision_metadata 필드는 내부 구조화 필드이며 public article prose에 노출되어서는 안 됩니다.
  - 제안: decision_metadata 필드를 public_article에서 제거하십시오.
  - 출처: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

decision_metadata 필드는 public article에 노출되어서는 안 됩니다. 해당 필드를 제거해야 합니다.
