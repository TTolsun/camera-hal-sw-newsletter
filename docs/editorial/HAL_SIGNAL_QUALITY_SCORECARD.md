# HAL Signal Quality Scorecard

이 문서는 "기사가 HAL 엔지니어에게 실제로 읽을 가치가 있는가"를 어떻게 측정하는지(signal quality 기준)를 고정합니다. 목표는 새 source/parser를 늘리는 것이 아닙니다. 이미 만들어진 Stage 3 artifact를 대상으로, main article이 HAL 독자에게 검토 가치가 있는지를 측정해 publish gate(발행 게이트)에 반영하는 것입니다.

## 범위

- 적용 대상: 신규 Stage 3의 `editor-draft.json`, `quality-report.json`, `hal-signal-quality-report.json/md`.
- 비대상: 기존 public archive rewrite, 과거 generated artifact golden fixture, source expansion, historical cleanup. (즉 과거 산출물은 건드리지 않습니다.)
- 기존 field shape는 그대로 둡니다. 특히 `selection_shortage_hints[]`와 `hal_impact_summary.axes`는 기존 소비자가 쓰고 있으므로 제거하거나 구조를 바꾸지 않습니다.

## 필수 기사 필드

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

`hal_signal_capsule`은 editor가 직접 채워야 하며 renderer가 대신 합성하지 않습니다. 따라서 누락되면 validation에서 실패로 잡힙니다.

필수 키:

- `why_now`
- `reader_owners`
- `check_within_2_weeks`
- `impact_axes`
- `do_not_overstate`

## 지표

| 지표 | 경고 | 실패 |
| --- | ---: | ---: |
| `article_count_without_hal_signal_capsule` | `> 0` | `> 0` for new Stage 3 main article |
| `generic_signal_hard_blocker_count` | `> 0` | `> 0` |
| `watchlist_only_count` | `> 0` | if article remains main |
| `blocked_source_gap_count` | `> 0` | `> 0` |
| `main_articles_with_concrete_action` | `< main_article_count` | any main article has `actionability_level=none` |
| `strong_signal_count + usable_signal_count` | `< main_article_count` | all main articles are weak/watchlist |

## 게이트 경계

이 점수가 발행 판정에 미치는 영향의 경계는 다음과 같습니다.

- HAL signal 검사는 관측(observability) 전용입니다. quality validation은 검사 결과(`hal_signal_quality_summary`, `main_article_signal_checks`)를 기록만 하고, 품질 상태 판정에는 쓰지 않습니다.
- `hal_signal_capsule` 강제는 editor output contract(`validateHalSignalCapsules`)가 담당합니다. capsule이 없거나 필수 키가 빠지면 editor 출력 검증이 실패합니다.
- 품질 상태가 `PASS`가 아니면 publish gate가 최종 발행을 차단합니다.
- 리뷰 산출물(artifact), 진단, 디버그 artifact, PR 컨텍스트는 모두 보존됩니다.
- `hal-signal-quality-report`에서 선택적(optional) report 입력이 누락되면 그 부분을 `input_unavailable`로 기록합니다. 선택적 입력만 있는 부분 report는 `status=WARN`과 `input_completeness=partial`로 표시합니다.

## Baseline Builder

기준선(baseline)을 만드는 도구입니다.

읽기 전용 baseline 생성:

```powershell
node src/shared/tooling/cli/build-hal-signal-quality-scorecard.js --dates 2026-05-15,2026-05-16,2026-05-17
```

로컬/디버그 baseline을 파일로 명시 기록:

```powershell
node src/shared/tooling/cli/build-hal-signal-quality-scorecard.js --dates 2026-05-15,2026-05-16,2026-05-17 --output .tmp/hal-signal-quality-baseline.md
```

`--output`을 주지 않으면 파일을 쓰지 않습니다. 수동으로 만든 baseline은 local debug용 자료일 뿐, validation의 source of truth가 아닙니다. validation이 따르는 자동 산출 source of truth는 Stage 3의 `hal-signal-quality-report.json/md`입니다.
