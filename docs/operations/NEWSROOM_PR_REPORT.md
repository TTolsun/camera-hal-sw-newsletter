# Newsroom PR Report 읽는 법

이 문서는 newsroom workflow가 만든 PR body를 검토할 때 어떤 순서로 볼지 정리합니다. 자세한 gate(검증 관문) 계약은 `docs/NEWSROOM_WORKFLOW.md`를 기준으로 확인하세요.

## 먼저 볼 것

모든 newsroom PR은 상단의 `최종 판단`, `이번 PR 요약`, `반드시 확인할 항목`, `주요 결과`를 먼저 봅니다. `상세 report`는 원본 로그를 붙이는 칸이 아닙니다. 필요한 artifact 경로와 최소한의 원인만 안내하는 칸입니다.

## 01 PR 읽는 순서

1. `최종 판단`에서 RAW 후보 수집 성공 여부와 `02` 진행 가능 여부를 확인합니다.
2. `주요 결과`에서 후보 수, source 수, direct Camera/HAL 후보 수, generic/watch 후보 수를 봅니다.
3. `반드시 확인할 항목`에서 private/internal URL fetch, `source_gap_risk` 우회, quality threshold 변경, `03` re-crawl 금지 항목을 확인합니다.
4. `상세 report`에서 RAW candidate artifact와 source change event artifact 경로를 확인합니다. source snapshot 원문은 PR body가 아니라 artifact에서 확인합니다.

## 02 PR 읽는 순서

1. `최종 판단`에서 Gemini discovery가 새 publishable 후보를 찾았는지 확인합니다.
2. `주요 결과`에서 manual/Gemini/신규/publishable/중복 후보 수를 봅니다.
3. parser/source/taxonomy gap 요약을 보고 source 보강 또는 parser fixture 보완이 필요한지 판단합니다.
4. 원본 rejected proposal 목록은 PR body에 붙이지 않습니다. `proposal_validation_report`와 `source_discovery_feedback_report` artifact에서 필요한 경우만 확인합니다.

## 03 PR 읽는 순서

1. `최종 판단`에서 `AI 자동 발행 가능`, `편집장 승인 시 공개 가능(단, publish-ready 아님)`, `진단 전용`, `수정 필요/실패` 중 어떤 상태인지 확인합니다.
2. `발행 상태 요약`에서 `final_publish_ready`, `review_publication_ready`, `diagnostics_only`, `homepage_visible_after_merge`를 확인합니다.
3. `생성 상태`에서 quality/fact-check/stale claim, `must_fix_count`, `source_gap_count`, `validate_ok`, compact `선택/구성 요약`을 확인합니다.
4. `편집자 기사 판단 요약`과 `후보 기사 추적`에서 HAL 관련성, source 근거, 과장 claim 위험을 확인합니다.

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

`score`는 편집 판단을 대신하지 못합니다. 그래서 `편집자 기사 판단 요약` table에는 표시하지 않습니다. 점수와 세부 diagnostics는 PR body에 전부 펼치지 않고, `quality-report`, `evidence-pack-summary.json`, `hal-signal-quality-report` 같은 artifact에서 확인합니다.

## 주의할 경고

- `source_gap_risk=true`인 article은 자동 선택됐더라도 `메인(Main)`으로 보지 않습니다.
- `fallback/supporting` article이 많으면 Camera HAL newsletter다운 정체성이 약해질 수 있습니다.
- selected count mismatch warning은 section마다 artifact count가 다르게 보인다는 뜻입니다. 1차 PR에서는 경고(warning)일 뿐 hard fail은 아닙니다.
- `review-only`는 editor review(편집자 검토)가 필요하다는 신호입니다. `publish-ready` label과 같은 뜻이 아닙니다.
