# 사실 검증 보고서 - 2026-06-10

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[0].background
  - 문제: sections[0].background 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 article_sections.background_context를 사용해야 합니다.
  - 제안: sections[0].background 필드를 제거하세요. 내용은 article_sections.background_context에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].why_it_matters
  - 문제: sections[0].why_it_matters 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 article_sections.hal_driver_impact 또는 public_article.editorial_story.why_it_matters를 사용해야 합니다.
  - 제안: sections[0].why_it_matters 필드를 제거하세요. 내용은 article_sections.hal_driver_impact와 public_article.editorial_story.why_it_matters에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].camera_hal_perspective
  - 문제: sections[0].camera_hal_perspective 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 article_sections.hal_driver_impact를 사용해야 합니다.
  - 제안: sections[0].camera_hal_perspective 필드를 제거하세요. 내용은 article_sections.hal_driver_impact에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].team_summary
  - 문제: sections[0].team_summary 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 article_sections.team_share_points를 사용해야 합니다.
  - 제안: sections[0].team_summary 필드를 제거하세요. 내용은 article_sections.team_share_points에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].sources
  - 문제: sections[0].sources 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 public_article.source_links를 사용해야 합니다.
  - 제안: sections[0].sources 필드를 제거하세요. 내용은 public_article.source_links에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].actionability_level
  - 문제: sections[0].actionability_level 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 hal_signal_capsule.actionability_level을 사용해야 합니다.
  - 제안: sections[0].actionability_level 필드를 제거하세요. 내용은 hal_signal_capsule에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md
- 위치: sections[0].effective_actionability_level
  - 문제: sections[0].effective_actionability_level 필드는 더 이상 사용되지 않는 레거시 필드입니다. 대신 hal_signal_capsule.effective_actionability_level을 사용해야 합니다.
  - 제안: sections[0].effective_actionability_level 필드를 제거하세요. 내용은 hal_signal_capsule에 이미 잘 포함되어 있습니다.
  - 출처: docs/editorial-policy.md

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

전반적으로 잘 작성된 기사입니다. 레거시 필드들을 제거하면 됩니다.
