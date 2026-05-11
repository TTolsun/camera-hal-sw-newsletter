# HAL 실행 중심 Article Structure Baseline

## 목적

#56 작업은 기존 article field를 제거하지 않고, renderer / validator / report / PR body가 같은 article section contract를 읽게 만드는 migration입니다.

현재 generated editor draft는 이미 아래 legacy field로 5-section에 가까운 구조를 갖고 있습니다.

| Normalized key | Legacy source | Public role |
| --- | --- | --- |
| `verified_facts` | `confirmed_facts` 또는 `what_changed` | 출처가 확인한 사실과 릴리스 요약 |
| `background_context` | `background` | Camera HAL 엔지니어가 이해해야 할 배경 |
| `hal_driver_impact` | `camera_hal_perspective` 또는 `why_it_matters` | HAL / Driver / Stream / Buffer / Metadata 관점 영향 |
| `action_items` | `action_items` 또는 `action_hints` | 1-2주 안에 확인할 test / log / metric / owner 작업 |
| `team_share_points` | `team_summary` | 팀 회의나 리뷰에서 공유할 결론 |

## Normalized Contract

`article_sections`는 optional입니다. 단, 존재할 경우 아래 5개 key를 모두 포함해야 합니다.

```json
{
  "article_sections": {
    "verified_facts": ["..."],
    "background_context": "...",
    "hal_driver_impact": "...",
    "action_items": ["..."],
    "team_share_points": "..."
  }
}
```

`normalizeArticleSections()`는 input을 유연하게 받아도 output은 항상 같은 shape로 반환합니다.

```json
{
  "verified_facts": ["..."],
  "background_context": "...",
  "hal_driver_impact": "...",
  "action_items": ["..."],
  "team_share_points": "...",
  "diagnostics": {
    "article_sections_present": true,
    "missing_article_section_keys": [],
    "fallbacks_used": [],
    "conflicts": [],
    "warnings": [],
    "complete": true,
    "missing_keys": []
  }
}
```

## Migration Rules

- `article_sections`가 있으면 normalized output은 `article_sections`를 우선 사용합니다.
- Legacy field는 backward compatibility와 fallback 용도로 유지합니다.
- Renderer, quality, report, PR body는 legacy field를 직접 읽지 않고 normalize layer를 사용합니다.
- Conflict detection은 deterministic text mismatch만 사용합니다. LLM semantic judgment는 사용하지 않습니다.
- `team_share_points`가 `why_it_matters` fallback을 사용하면 diagnostics에 warning을 남깁니다.
- Historical artifact에는 section contract hard fail을 즉시 적용하지 않습니다.

## Validation Direction

초기 적용은 diagnostics와 report visibility를 우선합니다.

- Structural check: 5개 normalized key가 non-empty인지 확인합니다.
- Risk check: weak `hal_driver_impact`, generic `action_items`, source-backed fact 부족을 deduction 후보로 표시합니다.
- Hard fail 승격은 신규 generated article 기준으로 후속 PR에서 검토합니다.
