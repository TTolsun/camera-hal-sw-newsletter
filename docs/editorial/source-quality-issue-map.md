# Source Quality Issue Map

Issue `#46` closes the remaining source URL / prompt quality gap by turning source policy into executable pipeline contracts. It does not reimplement source-specific parsers, linked evidence extraction, final article selection, or HAL signal classification.

## Scope

- `data/news-sources.json` is the executable source registry.
- `docs/news-sources.md` and `docs/config/news-sources-fields.ko.md` are human review surfaces.
- `source_quality` is canonical for new artifacts.
- Flat fields such as `source_url_quality` and `main_article_source_allowed` are compatibility mirrors only.
- `main_article_source_allowed` is source/evidence-policy-only. It must not depend on `finalSelectionEligibility`, score, final selection result, or HAL signal output.
- `main_article_readiness` combines source readiness, HAL signal readiness, and `selection_input_ready` for final main article promotion.
- `selection_ready` is kept only as a deprecated compatibility alias for `selection_input_ready`.

## Policy Fields

| Field | Owner | Purpose |
| --- | --- | --- |
| `sourceRole` | `data/news-sources.json` | Source role used by the classifier. |
| `sourceUrlQualityHint` | `data/news-sources.json` | Default URL quality hint for source candidates. |
| `mainArticlePolicy` | `data/news-sources.json` | Default main article source policy. |
| `requiresCrossCheckDefault` | `data/news-sources.json` | Default cross-check requirement. |
| `evidenceGranularityHint` | `data/news-sources.json` | Expected evidence granularity. |
| `sourceQualityNotes` | `data/news-sources.json` | Human review notes. |

## Policy Mapping

| `mainArticlePolicy` | Default `source_quality_status` | Default `main_article_source_allowed` | Notes |
| --- | --- | ---: | --- |
| `allowed` | `allowed` | `true` | URL/evidence validation still required. |
| `conditional` | `conditional` | `false` | Becomes source-ready only after source evidence and required primary confirmation/cross-check are satisfied. HAL/native workflow readiness is combined separately. |
| `watchlist_only` | `blocked` | `false` | Watchlist/context only. |
| `reference_only` | `blocked` | `false` | Background support only, not dated event evidence. |
| `blocked` | `blocked` | `false` | Never main source. |

## Blockers

Machine-readable blocker codes:

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

Raw `source_url_quality=unknown` is always main-ineligible. If registry policy and concrete dated evidence can classify the source, the classifier must convert it to a non-unknown quality before Stage 3. Stage 3 must fail any remaining unresolved `source_url_quality=unknown` in a new main article.

## Ownership

- Source quality owns source URL/evidence policy.
- HAL signal quality owns `hal_impact_axes`, `signal_quality_status`, and HAL hard blockers.
- Capsule build assembles `do_not_claim[]` from source quality blockers, linked evidence blocked/failed status, HAL signal blockers, and fact-check restrictions.
- Stage 3 generation consumes `source_quality`; it must not infer or repair missing source quality.
