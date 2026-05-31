# 사실 검증 보고서 - 2026-05-31

## 상태

NEEDS_FIX

## 반드시 수정할 항목

- 위치: sections[0].public_article.decision_metadata.impact
  - 문제: decision_metadata 필드는 deterministic builder가 생성/덮어쓰는 내부 메타데이터이므로 fact-checker가 수정해서는 안 됩니다. enum 위반은 deterministic validator가 담당합니다.
  - 제안: decision_metadata 필드를 제거하거나 수정하지 마세요.
  - 출처: N/A
- 위치: sections[0].public_article.decision_metadata.scope
  - 문제: decision_metadata 필드는 deterministic builder가 생성/덮어쓰는 내부 메타데이터이므로 fact-checker가 수정해서는 안 됩니다. enum 위반은 deterministic validator가 담당합니다.
  - 제안: decision_metadata 필드를 제거하거나 수정하지 마세요.
  - 출처: N/A
- 위치: sections[0].public_article.decision_metadata.action
  - 문제: decision_metadata 필드는 deterministic builder가 생성/덮어쓰는 내부 메타데이터이므로 fact-checker가 수정해서는 안 됩니다. enum 위반은 deterministic validator가 담당합니다.
  - 제안: decision_metadata 필드를 제거하거나 수정하지 마세요.
  - 출처: N/A
- 위치: sections[0].public_article.decision_metadata.overclaim_risk
  - 문제: decision_metadata 필드는 deterministic builder가 생성/덮어쓰는 내부 메타데이터이므로 fact-checker가 수정해서는 안 됩니다. enum 위반은 deterministic validator가 담당합니다.
  - 제안: decision_metadata 필드를 제거하거나 수정하지 마세요.
  - 출처: N/A

## 권장 수정

- 없음

## 출처 공백

- 없음

## 최종 의견

decision_metadata 필드는 내부 필드이므로 수정하지 않아야 합니다. 이 외에는 전반적으로 잘 작성되었습니다.
