# 사실 검증 보고서 - 2026-06-14

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: briefing[1]
  - 문제: The candidate article for 'Allwinner V3s SoC MIPI D-PHY support' (https://lore.kernel.org/linux-media/ai6smn4BnbAIMXCt@collins/) is marked as 'hard_blocked_group' and 'main_article_source_allowed: false' due to 'cross_check_required_but_missing'. It should not be included in the briefing or action items.
  - 제안: Remove the briefing bullet related to Allwinner V3s SoC MIPI D-PHY support. This content is from a hard-blocked source and cannot be published.
  - 출처: https://lore.kernel.org/linux-media/ai6smn4BnbAIMXCt@collins/
- 위치: briefing[2]
  - 문제: The candidate article for 'V4L2 stateless HEVC/AV1 tile counts' (https://lore.kernel.org/linux-media/20260614131003.2524025-1-michael.bommarito@gmail.com/) is marked as 'hard_blocked_group' and 'main_article_source_allowed: false' due to 'cross_check_required_but_missing'. It should not be included in the briefing or action items.
  - 제안: Remove the briefing bullet related to V4L2 stateless HEVC/AV1 tile counts. This content is from a hard-blocked source and cannot be published.
  - 출처: https://lore.kernel.org/linux-media/20260614131003.2524025-1-michael.bommarito@gmail.com/
- 위치: action_items[1]
  - 문제: The action item refers to 'Allwinner V3s/V3/S3 SoC 기반 플랫폼을 사용하는 경우, MIPI D-PHY 드라이버 패치(v10)의 메인라인 적용 여부를 모니터링하고 이미지 센서 초기화 및 스트림 설정 영향을 분석하십시오.' which is derived from a hard-blocked source (https://lore.kernel.org/linux-media/ai6smn4BnbAIMXCt@collins/). Hard-blocked content cannot be used for action items.
  - 제안: Remove this action item. Content from hard-blocked sources cannot be used.
  - 출처: https://lore.kernel.org/linux-media/ai6smn4BnbAIMXCt@collins/
- 위치: action_items[2]
  - 문제: The action item refers to 'stateless HEVC/AV1 비디오 디코딩 파이프라인을 사용하는 SoC 플랫폼 드라이버에서 V4L2 타일 카운트 유효성 검사 패치를 검토하여 잠재적인 오버플로우나 오작동 방지 대책을 수립하십시오.' which is derived from a hard-blocked source (https://lore.kernel.org/linux-media/20260614131003.2524025-1-michael.bommarito@gmail.com/). Hard-blocked content cannot be used for action items.
  - 제안: Remove this action item. Content from hard-blocked sources cannot be used.
  - 출처: https://lore.kernel.org/linux-media/20260614131003.2524025-1-michael.bommarito@gmail.com/
- 위치: summary
  - 문제: The summary mentions 'Allwinner V3s SoC의 MIPI D-PHY 지원 패치 및 V4L2 stateless HEVC/AV1 타일 카운트 유효성 검사' which are derived from hard-blocked sources. Content from hard-blocked sources should not be included in the summary.
  - 제안: Rewrite the summary to only include information from allowed sources. Remove references to hard-blocked content.
  - 출처: 
- 위치: sections[0].hal_signal_capsule.check_within_2_weeks
  - 문제: The 'check_within_2_weeks' field is too generic for an 'android_platform_camera_adjacent' article. It should name a specific follow-up aligned with the bucket scope.
  - 제안: Make the 'check_within_2_weeks' more specific, e.g., 'Perfetto SQL 및 Trace Analysis 스킬을 활용한 카메라 파이프라인 분석 자동화 검토'.
  - 출처: https://developer.android.com/tools/agents/android-cli#skills-add

## 권장 수정

- The 'actionability_level' for candidate 'ab2b8e420e165e841a8448556c2b636ccb0b611a38490d2f796bdd384b5fa6ee' is 'none'. While the article provides action items, the signal quality status is 'weak_signal' and 'hal_signal_ready' is false. Consider strengthening the actionability in the candidate metadata or ensuring the action items are highly concrete and measurable to improve signal quality.
- The 'summary' should be updated to reflect only the content from the single publishable article, as the other two candidates are hard-blocked. The current summary includes references to hard-blocked content.

## 출처 공백

- The article 'Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry' (https://lore.kernel.org/linux-media/ai6smn4BnbAIMXCt@collins/) is a mailing list discussion and requires cross-check for primary confirmation, which is missing. This prevents its use as a main article.
- The article '[PATCH 0/6] media: v4l2-ctrls: bound stateless HEVC/AV1 tile counts' (https://lore.kernel.org/linux-media/20260614131003.2524025-1-michael.bommarito@gmail.com/) is a mailing list discussion and requires cross-check for primary confirmation, which is missing. This prevents its use as a main article.

## 최종 의견

The newsletter draft contains critical factual errors related to source eligibility. Two of the three selected candidates are hard-blocked due to missing cross-check and 'main_article_source_allowed: false', yet they are included in the briefing and action items. This violates the editorial policy and requires immediate 'must_fix' actions. The summary also needs to be updated to reflect only publishable content. The remaining article is publishable and relevant to Camera HAL SW engineers, but its 'actionability_level' is 'none' in the candidate metadata, which is a weak signal.
