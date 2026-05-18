# Article Structure Contract

이 문서는 issue `#56`의 final public article structure source of truth다. Source crawling, linked evidence resolving, Event Bundle construction은 소유하지 않고, 최종 article section 구조와 renderer-visible output만 정의한다.

## New Generation Contract

새 `editor`, `repair`, `completion` output의 main article은 `article_sections` object를 포함해야 한다.

Required keys:

- `verified_facts`
- `background_context`
- `hal_driver_impact`
- `action_items`
- `team_share_points`

Optional keys:

- `known_limitations`
- `watch_items`
- `do_not_claim`

`complete=true`는 required 5개 key만 기준으로 계산한다. Optional key가 없어도 pass다. Unknown key는 semantic validation fail이다.

Optional key type은 새 생성물 schema에서 array다. Normalizer는 legacy/manual input compatibility를 위해 string 또는 array를 받을 수 있지만, normalized output은 string array로 고정한다.

## Public Rendering

Public heading order는 고정이다.

```md
### 확인한 사실 / 릴리스 요약
### 배경지식 / 왜 AOSP Camera 팀이 볼 만한가
### Camera HAL/Driver 관점 / 적용 가능 지점
### 실행 항목 / PoC 제안 및 검증 기준
### 팀 공유 포인트 / 결론
```

Optional public blocks:

- `known_limitations` -> `제한 / 주의`
- `watch_items` -> `추적 항목`

`do_not_claim`은 claim validation, quality report, editor brief guardrail로 사용한다. Raw `do_not_claim` text는 public article Markdown/HTML에 직접 렌더링하지 않는다.

### Limitation visibility

- `none`: optional limitation/watch/guardrail signal 없음
- `present`: `watch_items`만 존재하며 public limitation block은 없음
- `guardrail-only`: `do_not_claim`이 존재하지만 raw text를 public output에 직접 렌더링하지 않음
- `public-limitation`: `known_limitations`가 존재하며 public limitation으로 노출 가능

## Evidence Mapping

#185 `compact_evidence`는 final article structure의 input으로만 사용한다. Stage 3은 seed URL crawling을 다시 수행하지 않는다.

```text
compact_evidence.primary_facts -> article_sections.verified_facts
compact_evidence.linked_context -> article_sections.background_context or known_limitations
candidate.hal_impact_axes + editorial interpretation -> article_sections.hal_driver_impact
candidate.validation_targets / compact evidence hints -> article_sections.action_items
compact_evidence.do_not_claim -> article_sections.do_not_claim or known_limitations
```

`verified_facts`는 source-confirmed facts만 포함한다. HAL interpretation, recommendation, guardrail text는 `verified_facts`에 넣지 않는다.

`hal_driver_impact`는 editorial interpretation을 허용하지만, direct HAL/API/runtime/driver behavior는 source evidence가 있을 때만 단정할 수 있다.

## Claim Binding Compatibility

#125 claim binding은 `article_sections.verified_facts`를 fact coverage 대상으로 본다. New main article의 fact claim은 item-level evidence id와 source URL을 가져야 한다. `evidence_pack_ids` 단독 support는 신규 생성물의 fact claim support로 충분하지 않다.

`article_sections.do_not_claim`은 strong guardrail이다. `article_sections.known_limitations`는 direct HAL/API/runtime/driver limitation wording이 있을 때 overclaim guardrail로 사용한다. `watch_items`는 guardrail이 아니라 report/rendering 중심의 follow-up signal이다.

## Cross-Issue Boundary

- `#185`: seed URL fetch, linked evidence expansion, Evidence Pack, `compact_evidence` 생성 소유.
- `#111`: source-specific extraction schema 소유. Source adapter는 public article heading을 직접 생성하지 않는다.
- `#89`: Event Bundle evidence enrichment 소유. Event Bundle은 article structure를 정의하지 않는다.
- `#125`: `claims[]`, claim -> evidence id/source URL binding, HAL overclaim validation 소유.
- `#56`: normalized article section keys, public section order, renderer-visible structure, section completeness report shape 소유.

## Historical Compatibility

#108 historical rewrite는 별도 이슈에서 처리한다. #56 contract 구현은 기존 `content/newsroom/**`, `content/collected-news/**`, `newsletters/**` artifact를 재생성하지 않는다.

Historical cleanup rule:

- pre-#185 article에 fake seed evidence provenance를 추가하지 않는다.
- source에 없는 technical claim을 추가하지 않는다.
- structure normalization은 source support가 있을 때만 한다.
- optional provenance/rewrite fields는 #108에서 정의하고 처리한다.
