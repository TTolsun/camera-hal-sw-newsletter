# Source Quality Issue Map

Source quality는 source URL/프롬프트 품질 격차를 source 정책을 실행 가능한 파이프라인 계약으로 전환하여 해소합니다. source별 파서 재구현, linked evidence 추출, final article selection, HAL signal 분류는 이 문서의 범위가 아닙니다.

## 범위

- `src/shared/data/news-sources.json`은 실행 가능한 source registry입니다.
- `docs/news-sources.md`와 `docs/config/news-sources-fields.md`는 사람이 검토하는 surface입니다.
- `source_quality`는 신규 artifact의 정식 표현입니다.
- `source_url_quality`와 `main_article_source_allowed` 같은 flat field는 호환성 mirror에 불과합니다.
- `main_article_source_allowed`는 source/evidence 정책 전용입니다. `finalSelectionEligibility`, score, final selection 결과, HAL signal 출력에 의존하면 안 됩니다.
- `main_article_readiness`는 source readiness, HAL signal readiness, `selection_input_ready`를 결합하여 final main article 승격 여부를 판정합니다.
- `selection_ready`는 `selection_input_ready`의 deprecated 호환 alias로만 유지됩니다.

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

Machine-readable blocker 코드:

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

원시 `source_url_quality=unknown`은 항상 main 부적격입니다. registry 정책과 concrete dated evidence로 source를 분류할 수 있으면 분류기는 Stage 3 이전에 non-unknown 품질로 변환해야 합니다. Stage 3는 신규 main article에 남은 미해결 `source_url_quality=unknown`을 반드시 실패 처리해야 합니다.

## 소유권

- Source quality는 source URL/evidence 정책을 소유합니다.
- HAL signal quality는 `hal_impact_axes`, `signal_quality_status`, HAL hard blocker를 소유합니다.
- Capsule build는 source quality blocker, linked evidence blocked/failed 상태, HAL signal blocker, fact-check 제한에서 `do_not_claim[]`을 조립합니다.
- Stage 3 generation은 `source_quality`를 소비합니다. 누락된 source quality를 추론하거나 수정해서는 안 됩니다.
