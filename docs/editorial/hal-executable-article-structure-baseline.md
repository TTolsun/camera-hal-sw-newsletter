# HAL 실행 중심 Article Structure Baseline

## 목적

#56은 새 `editor`, `repair`, `completion` output이 동일한 `article_sections` contract를 제공하도록 고정한다. Legacy field는 기존 artifact와 다른 pipeline 호환을 위해 schema에 남길 수 있지만, 이 contract는 legacy field를 읽지 않는다.

## Normalized Contract

새로 생성되는 main article은 반드시 `article_sections`를 포함해야 한다.

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

`article_sections`는 정확히 아래 5개 key만 가진다.

- `verified_facts`
- `background_context`
- `hal_driver_impact`
- `action_items`
- `team_share_points`

`normalizeArticleSections()`는 `section.article_sections`만 읽는다. `confirmed_facts`, `what_changed`, `background`, `why_it_matters`, `camera_hal_perspective`, `action_hints`, `team_summary` 같은 legacy field로 fallback하지 않는다.

## Diagnostics

정규화 결과는 항상 strict shape를 반환한다.

```json
{
  "verified_facts": [],
  "background_context": "",
  "hal_driver_impact": "",
  "action_items": [],
  "team_share_points": "",
  "diagnostics": {
    "article_sections_present": false,
    "missing_keys": [
      "verified_facts",
      "background_context",
      "hal_driver_impact",
      "action_items",
      "team_share_points"
    ],
    "complete": false
  }
}
```

`article_sections`가 없거나 비어 있거나 불완전하면 missing key diagnostics를 남긴다. Editor contract와 quality validation은 이 diagnostics를 기준으로 fail 또는 deduction을 적용한다.

## Consumer Rule

Renderer, quality report, editor brief, PR body는 legacy article field를 직접 읽지 않고 `normalizeArticleSections()` 결과만 읽는다. Public HTML card 구조, CSS hook, archive route는 유지한다.
