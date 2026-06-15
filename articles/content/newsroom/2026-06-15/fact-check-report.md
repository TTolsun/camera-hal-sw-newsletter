# 사실 검증 보고서 - 2026-06-15

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: summary
  - 문제: The summary includes references to two articles that are hard-blocked from being rendered as main content due to source quality issues (cross-check required but missing).
  - 제안: The summary should only refer to the 'Android skills' article, as it is the only one selected and rendered. Remove mentions of 'SM8550 DTS JPEG 인코더 노드 추가 패치' and 'V4L2 메모리 해제 버그'.
  - 출처: https://lore.kernel.org/linux-media/178144969601.60470.9256616923389083658@gmail.com/
- 위치: briefing
  - 문제: The briefing includes two articles that are hard-blocked from being rendered as main content due to source quality issues (cross-check required but missing).
  - 제안: The briefing should only include the 'Android skills' article. Remove the briefing points related to 'Qualcomm SM8550 DTS에 JPEG 인코더 하드웨어 노드 추가' and 'Linux 커널 V4L2 서브시스템의 v4l2_release에서 KASAN slab-use-after-free 버그'.
  - 출처: https://lore.kernel.org/linux-media/178144969601.60470.9256616923389083658@gmail.com/
- 위치: action_items (top-level)
  - 문제: The top-level action items include actions for two articles that are hard-blocked from being rendered as main content due to source quality issues (cross-check required but missing).
  - 제안: The top-level action items should only reflect actions for the 'Android skills' article. Remove action items related to 'SM8550 DTS JPEG 인코더 패치 동향' and 'V4L2 v4l2_release KASAN slab-use-after-free 버그 패치'.
  - 출처: https://lore.kernel.org/linux-media/178144969601.60470.9256616923389083658@gmail.com/

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

The main article for 'Android CLI 및 GitHub에 CameraX 마이그레이션 등 17개 이상의 신규 'Android 스킬' 추가' is well-structured, factual, and adheres to the editorial policy. However, the overall newsletter summary, briefing, and top-level action items incorrectly include content from two hard-blocked articles (lore.kernel.org mailing list items). These hard-blocked articles require primary confirmation and are not allowed as main content, even in briefing or top-level action items, as per the `main_article_source_allowed=false` and `cross_check_required_but_missing` status. This needs to be fixed before publication.
