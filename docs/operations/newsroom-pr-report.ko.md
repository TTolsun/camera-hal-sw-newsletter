# Newsroom PR Report 읽는 법

이 문서는 weekly newsroom PR body를 검토할 때 먼저 볼 순서를 정리합니다. 자세한 gate 계약은 `docs/newsroom-workflow.md`를 기준으로 확인하세요.

## 먼저 볼 것

1. `Diagnostics-only Status`: `diagnostics_only=true`이면 public newsletter files가 없어 merge해도 홈페이지에 표시되지 않습니다.
2. `발행 상태 요약`: `review_publication_ready`, `homepage_visible_after_merge`, `final_publish_ready`를 확인합니다.
3. `편집자 기사 판단 요약`: 후보 article을 `메인(Main)`, `보조(Supporting)`, `짧은 소식(Short)`, `관찰(Watch)`, `보류(Hold)`, `제외(Exclude)`로 봅니다.
4. `편집자 결론`: 발행 권고, 가장 좋은 main article, fallback dominance, count mismatch warning을 확인합니다.

## 판단 Label 의미

- `메인(Main)`: Camera HAL / driver / image pipeline 직접성이 충분한 article입니다.
- `보조(Supporting)`: HAL 개발 workflow에는 유용하지만 Camera 직접성은 약한 article입니다.
- `짧은 소식(Short)`: 짧게 언급할 수 있으나 main article로는 약합니다.
- `관찰(Watch)`: 참고만 하고 본문 승격은 보류할 article입니다.
- `보류(Hold)`: source/parser/evidence 보완 후 재검토할 article입니다.
- `제외(Exclude)`: newsletter 본문에 넣지 않을 article입니다.

## Pipeline 상태 의미

- `자동 선택(final_selected)`: deterministic pipeline이 selected article로 골랐다는 뜻입니다. editorial approval은 아닙니다.
- `reserve`: 후보 pool에는 있지만 main으로 쓰기 전 추가 검토가 필요합니다.
- `excluded`: 현재 기준으로 본문 승격 대상이 아닙니다.
- `parser/source 보류`: official/high source지만 parser 또는 source extraction 보완이 먼저 필요합니다.
- `report-only`: 품질/팩트체크 report 연결용으로만 표시된 항목입니다.
- `merged`: 같은 source/event cluster로 병합되어 별도 main article로 다루지 않는 후보입니다.

`score`는 편집 판단을 대체하지 않으므로 `편집자 기사 판단 요약` table에는 표시하지 않습니다. 점수와 세부 diagnostics는 기존 `Evidence Pack 요약`, 품질 report, `후보 기사 추적` section에서 확인합니다.

## 주의할 경고

- `source_gap_risk=true` article은 자동 선택됐더라도 `메인(Main)`으로 보지 않습니다.
- `fallback/supporting` article이 많으면 Camera HAL newsletter 정체성이 약해질 수 있습니다.
- selected count mismatch warning은 section마다 다른 artifact count가 보인다는 뜻입니다. 1차 PR에서는 warning이며 hard fail은 아닙니다.
- `review-only`는 editor review가 필요하다는 신호입니다. `publish-ready` label과 같은 뜻이 아닙니다.
