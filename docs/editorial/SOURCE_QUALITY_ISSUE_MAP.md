# Source Quality Issue Map

Source quality(출처 품질)는 "출처 URL과 prompt의 품질이 들쭉날쭉한 문제"를, 실행 가능한 파이프라인 계약으로 바꿔서 해결합니다. 단, source별 parser 재구현, linked evidence 추출, final article selection, HAL signal 분류는 이 문서의 범위가 아닙니다.

## 범위

각 field가 무엇이고 무엇을 책임지는지 정리합니다.

- `src/shared/data/news-sources.json`: 실행 가능한 source registry입니다.
- `docs/NEWS_SOURCES.md`와 `docs/config/NEWS_SOURCES_FIELDS.md`: 사람이 읽고 검토하는 surface입니다.
- `source_quality`: 신규 artifact가 쓰는 정식 표현입니다.
- `source_url_quality`, `main_article_source_allowed` 같은 flat field: 호환성을 위한 mirror(거울 값)일 뿐입니다.
- `main_article_source_allowed`: source/evidence 정책 전용 field입니다. `finalSelectionEligibility`, score, final selection 결과, HAL signal 출력에 의존하면 안 됩니다.
- `main_article_readiness`: source readiness, HAL signal readiness, `selection_input_ready`를 합쳐서 final main article로 승격할지를 판정합니다.
- `selection_ready`: `selection_input_ready`의 deprecated 호환 alias입니다(과거 호환 목적으로만 유지).

## 정책 필드

| 필드 | 소유자 | 목적 |
| --- | --- | --- |
| `sourceRole` | `src/shared/data/news-sources.json` | 분류기가 사용하는 source role. |
| `sourceUrlQualityHint` | `src/shared/data/news-sources.json` | source 후보의 기본 URL 품질 힌트. |
| `mainArticlePolicy` | `src/shared/data/news-sources.json` | 기본 main article source 정책. |
| `requiresCrossCheckDefault` | `src/shared/data/news-sources.json` | 기본 cross-check 요구 여부. |
| `evidenceGranularityHint` | `src/shared/data/news-sources.json` | 기대하는 evidence 세분화 수준. |
| `sourceQualityNotes` | `src/shared/data/news-sources.json` | 사람이 검토하는 노트. |

## 정책 매핑

| `mainArticlePolicy` | 기본 `source_quality_status` | 기본 `main_article_source_allowed` | 비고 |
| --- | --- | ---: | --- |
| `allowed` | `allowed` | `true` | URL/evidence 검증은 여전히 필요. |
| `conditional` | `conditional` | `false` | source evidence와 required primary confirmation/cross-check가 충족될 때만 source-ready가 됨. HAL/native workflow readiness는 별도로 결합. |
| `watchlist_only` | `blocked` | `false` | Watchlist/컨텍스트 전용. |
| `reference_only` | `blocked` | `false` | 배경 지원 전용, dated event evidence 아님. |
| `blocked` | `blocked` | `false` | main source가 될 수 없음. |

## 차단 조건

main article 승격을 막는 blocker 코드(기계가 읽는 식별자)는 다음과 같습니다.

- `missing_url`
- `undated_reference_page`
- `source_gap_risk`
- `reference_only`
- `generic_trend_without_hal_workflow_link`
- `cross_check_required_but_missing`
- `candidate_only_without_primary_confirmation`
- `fallback_without_concrete_source_fact`
- `unknown_source_quality`
- `linked_evidence_blocked`
- `linked_evidence_failed`

`source_url_quality=unknown` 상태는 그 자체로는 항상 main article 부적격입니다. registry 정책과 구체적인 날짜 근거(concrete dated evidence)로 source를 분류할 수 있다면, 분류기(classifier)는 Stage 3에 들어가기 전에 이를 `unknown`이 아닌 품질로 바꿔 두어야 합니다. 그래도 해결되지 않고 남은 `source_url_quality=unknown`이 신규 main article에 있으면 Stage 3는 반드시 실패 처리합니다.

## 소유권

어떤 정책을 어느 계층이 책임지는지 구분합니다.

- Source quality: source URL/evidence 정책을 소유합니다.
- HAL signal quality: `hal_impact_axes`, `signal_quality_status`, HAL hard blocker를 소유합니다.
- Capsule build: source quality blocker, linked evidence의 blocked/failed 상태, HAL signal blocker, fact-check 제한을 모아 `do_not_claim[]`을 조립합니다.
- Stage 3 generation: `source_quality`를 소비(읽기)만 합니다. 누락된 source quality를 추론하거나 임의로 수정해서는 안 됩니다.
