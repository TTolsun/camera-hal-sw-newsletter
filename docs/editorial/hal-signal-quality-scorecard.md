# HAL Signal Quality Scorecard

이 문서는 #65의 HAL engineer signal quality 기준을 고정합니다. 목표는 새 source/parser를 늘리는 것이 아니라, 이미 생성된 Stage 3 artifact에서 main article이 HAL 독자에게 실제로 검토 가치가 있는지 측정하고 publish gate에 반영하는 것입니다.

## Scope

- 적용 대상: #65 merge 이후 생성되는 신규 Stage 3 `editor-draft.json`, `quality-report.json`, `hal-signal-quality-report.json/md`.
- 비대상: 기존 public archive rewrite, 과거 generated artifact golden fixture, #55/#57 source expansion, #108 historical cleanup.
- 기존 field shape는 유지합니다. `selection_shortage_hints[]`와 `hal_impact_summary.axes`는 기존 소비자를 위해 제거하거나 구조 변경하지 않습니다.

## Required Article Fields

main article은 다음 additive field를 가져야 합니다.

| field | type | purpose |
| --- | --- | --- |
| `hal_impact_axes[]` | string array | HAL 영향 축 enum. |
| `reader_owners[]` | string array | 독자 측 HAL/framework/driver/test owner. |
| `actionability_level` | enum | `none`, `generic_review`, `concrete_check`, `measurable_test`, `owner_metric_log`. |
| `effective_actionability_level` | enum | 원본 `actionability_level`을 보존한 뒤 gate 판정에 쓰는 effective level. |
| `actionability_upgrade_reason` | string | `generic_review`가 concrete signal 2개 이상으로 재분류된 이유. |
| `signal_quality_status` | enum | `strong_signal`, `usable_signal`, `weak_signal`, `watchlist_only`, `blocked_source_gap`. |
| `do_not_overstate[]` | string array | 과장 금지 claim. |
| `fallback_promotion_allowed` | boolean | fallback/SoC article의 main promotion 허용 여부. |
| `fallback_promotion_reason` | string | promotion 근거. |
| `fallback_guard_notes[]` | string array | fallback article guardrail. |
| `soc_signal_type` | string | SoC/platform signal subtype. |
| `soc_signal_source_allowed` | boolean | SoC source가 camera pipeline signal로 허용되는지. |
| `camera_pipeline_link` | string | SoC/tooling signal과 camera workload 연결 근거. |
| `hal_signal_capsule` | object | reader-facing capsule. |

## HAL Signal Capsule

`hal_signal_capsule`은 renderer가 합성하지 않습니다. 누락은 validation에서 잡습니다.

필수 key:

- `why_now`
- `reader_owners`
- `check_within_2_weeks`
- `impact_axes`
- `do_not_overstate`

## Metrics

| metric | warning | failure |
| --- | ---: | ---: |
| `article_count_without_hal_signal_capsule` | `> 0` | `> 0` for new Stage 3 main article |
| `generic_signal_hard_blocker_count` | `> 0` | `> 0` |
| `watchlist_only_count` | `> 0` | if article remains main |
| `blocked_source_gap_count` | `> 0` | `> 0` |
| `main_articles_with_concrete_action` | `< main_article_count` | any main article has `actionability_level=none` |
| `strong_signal_count + usable_signal_count` | `< main_article_count` | all main articles are weak/watchlist |

## Gate Boundary

- Quality validation records HAL signal deductions and hard blockers.
- Publish gate blocks final publication when quality status is not `PASS`.
- Review artifacts, diagnostics, debug artifacts, and PR context remain preserved.
- Optional report inputs missing from `hal-signal-quality-report` are recorded as `input_unavailable`, and optional-only partial reports use `status=WARN` with `input_completeness=partial`.

## Baseline Builder

Read-only baseline:

```powershell
node scripts/newsroom/cli/build-hal-signal-quality-scorecard.js --dates 2026-05-15,2026-05-16,2026-05-17
```

Write a local/debug baseline explicitly:

```powershell
node scripts/newsroom/cli/build-hal-signal-quality-scorecard.js --dates 2026-05-15,2026-05-16,2026-05-17 --output docs/debug/2026-05-17-hal-signal-quality-baseline.md
```

`--output`이 없으면 파일을 쓰지 않습니다. PR 1 baseline 값은 one-time snapshot이며 validation source of truth가 아닙니다. 자동 산출 source of truth는 Stage 3의 `hal-signal-quality-report.json/md`입니다.
