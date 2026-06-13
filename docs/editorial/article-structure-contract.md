# Article Structure Contract

이 문서는 최종 public article(공개 기사)이 어떤 section 구조를 가져야 하는지를 정의하는 source of truth다. 여기서 정하는 것은 최종 article section 구조와 renderer가 출력하는 결과(renderer-visible output)뿐이다. Source crawling, linked evidence resolving, Event Bundle construction은 이 문서의 책임이 아니다(각각 다른 계약이 소유한다).

## New Generation Contract

`editor`, `repair`, `completion`이 새로 만드는 main article은 `article_sections` object를 포함해야 한다.

필수 key (다섯 개):

- `verified_facts`
- `background_context`
- `hal_driver_impact`
- `action_items`
- `team_share_points`

선택 key:

- `known_limitations`
- `watch_items`
- `do_not_claim`

`complete=true` 여부는 필수 5개 key만 보고 판정한다. 선택 key가 없어도 통과한다. 반대로 위 목록에 없는 알 수 없는 key가 들어오면 semantic validation 실패다.

선택 key의 타입은 새 생성물 schema에서 array다. Normalizer는 레거시/수동 입력과의 호환을 위해 string 또는 array를 둘 다 받아들이지만, 정규화 후 출력은 항상 string array로 고정한다.

## Public Rendering

Public heading order는 고정이다.

```md
### 확인한 사실 / 릴리스 요약
### 배경지식 / 왜 AOSP Camera 팀이 볼 만한가
### Camera HAL/Driver 관점 / 적용 가능 지점
### 실행 항목 / PoC 제안 및 검증 기준
### 팀 공유 포인트 / 결론
```

선택 public block:

- `known_limitations` -> `제한 / 주의`
- `watch_items` -> `추적 항목`

`do_not_claim`은 claim validation, quality report, editor brief의 guardrail(과장 방지 장치)로만 쓴다. raw `do_not_claim` text 자체는 public article의 Markdown/HTML에 직접 렌더링하지 않는다.

### Limitation visibility

선택 limitation/watch/guardrail signal이 어떤 상태인지를 나타내는 값이다.

- `none`: 선택 limitation/watch/guardrail signal 없음
- `present`: `watch_items`만 존재하며 public limitation block은 없음
- `guardrail-only`: `do_not_claim`이 존재하지만 raw text를 public output에 직접 렌더링하지 않음
- `public-limitation`: `known_limitations`가 존재하며 public limitation으로 노출 가능

## Evidence Mapping

`compact_evidence`는 final article structure를 만드는 입력으로만 쓴다. Stage 3은 seed URL을 다시 crawling하지 않는다. 아래는 어떤 evidence가 어떤 section으로 들어가는지를 보여 주는 매핑이다.

```text
compact_evidence.primary_facts -> article_sections.verified_facts
compact_evidence.linked_context -> article_sections.background_context or known_limitations
candidate.hal_impact_axes + editorial interpretation -> article_sections.hal_driver_impact
candidate.validation_targets / compact evidence hints -> article_sections.action_items
compact_evidence.do_not_claim -> article_sections.do_not_claim or known_limitations
```

`verified_facts`에는 출처로 확인된 사실(source-confirmed facts)만 넣는다. HAL interpretation(HAL 관점 해석), recommendation(권고), guardrail text는 `verified_facts`에 넣지 않는다.

`hal_driver_impact`에는 editorial interpretation(편집 관점 해석)을 써도 된다. 다만 HAL/API/runtime/driver의 실제 동작을 단정하는 표현은 이를 뒷받침하는 source evidence가 있을 때만 허용한다.

## Claim Binding Compatibility

Claim binding은 `article_sections.verified_facts`를 fact coverage(사실 검증) 대상으로 본다. 새 main article의 fact claim은 item 단위 evidence id와 source URL을 둘 다 가져야 한다. `evidence_pack_ids` 하나만으로는 신규 생성물의 fact claim 근거로 충분하지 않다.

세 field의 역할은 다음과 같이 구분한다.

- `article_sections.do_not_claim`: 강력한 guardrail이다.
- `article_sections.known_limitations`: HAL/API/runtime/driver에 대한 직접적인 제한 표현이 있을 때 overclaim(과장) 방지 guardrail로 쓴다.
- `watch_items`: guardrail이 아니라, report/rendering에 쓰는 후속 추적 신호다.

## Responsibility Boundary

어떤 일을 누가 책임지는지를 정한다.

- Seed evidence: seed URL fetch, linked evidence expansion, Evidence Pack, `compact_evidence` 생성을 소유한다.
- Source adapters: source별 extraction schema를 소유한다. Source adapter는 public article heading을 직접 생성하지 않는다.
- Event Bundle: evidence enrichment를 소유한다. Event Bundle은 article structure를 정의하지 않는다.
- Claim binding: `claims[]`, claim -> evidence id/source URL binding, HAL overclaim validation을 소유한다.
- Article structure: 정규화된 article section key, public section 순서, renderer-visible structure, section completeness report shape를 소유한다.

## Historical Compatibility

과거 기사를 다시 쓰는 작업(rewrite)은 별도의 archive cleanup contract에서 처리한다. 이 Article structure contract를 구현하더라도 기존 `articles/content/newsroom/**`, `articles/content/collected-news/**`, `articles/newsletters/**` artifact는 재생성하지 않는다.

과거 cleanup 규칙:

- seed evidence workflow 이전 article에 가짜 seed evidence provenance를 추가하지 않는다.
- source에 없는 technical claim을 추가하지 않는다.
- structure normalization은 source 지원이 있을 때만 한다.
- 선택 provenance/rewrite field는 historical archive cleanup contract에서 정의하고 처리한다.
