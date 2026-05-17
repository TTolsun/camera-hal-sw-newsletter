# news-sources.json 필드 안내

`data/news-sources.json`은 collector와 newsroom automation이 읽는 기계 판독용 registry입니다. 코드가 읽는 key는 영어 이름 그대로 유지해야 합니다. 한국어 설명을 넣더라도 field name을 번역하거나 임의로 바꾸면 안 됩니다.

`docs/news-sources.md`는 사람이 검토하기 위한 editorial view입니다. JSON registry가 없을 때 fallback으로도 쓰이지만, 운영 기준 source of truth는 `data/news-sources.json`입니다.

## 최상위 필드

| 필드 | 의미 | 주의 |
| --- | --- | --- |
| `schemaVersion` | source registry 구조 버전입니다. | 현재 구조는 `2`입니다. 구조 변경이 있을 때만 올리고, 단순 source 추가로 바꾸지 않습니다. |
| `sectionMap` | `category` 값을 newsletter section 이름으로 매핑합니다. | source entry에는 `section`을 쓰지 않습니다. newsletter section label의 단일 source of truth입니다. |
| `sources` | 개별 source entry 배열입니다. | entry field key는 영어 그대로 유지합니다. |

`sectionMap`에는 예를 들어 아래 매핑이 있습니다. 이것은 전체 category 목록이 아니라 현재 파일에 있는 일부 예시입니다.

```json
{
  "camera-api": "Android / AOSP / Camera",
  "cpp": "C++ / Native / Toolchain",
  "ai": "AI / SW Engineering Trends"
}
```

## 출처 entry 필드

| 필드 | 의미 | 작성 기준 |
| --- | --- | --- |
| `id` | source를 식별하는 안정적인 machine id입니다. | lowercase hyphenated 이름을 사용합니다. 한번 artifact에 쓰인 뒤에는 rename을 신중히 봅니다. |
| `name` | 사람이 읽는 source 이름입니다. | 공식 명칭이나 사이트에서 쓰는 이름을 우선합니다. |
| `sourceUrl` | source의 기본 URL입니다. | 공식 페이지, release note index, feed landing 등 검토 가능한 URL을 넣습니다. |
| `rssUrl` | RSS feed URL입니다. | 신뢰할 수 있는 feed가 없으면 `null`을 사용합니다. |
| `collectionModeHint` | collector가 source를 어떤 방식으로 다룰지 알려주는 hint입니다. | 현재 collector가 지원하는 mode에만 사용합니다. 모르면 생략하거나 기존 패턴을 따릅니다. |
| `category` | `sectionMap`에서 section을 찾기 위한 machine category입니다. | 모든 source entry에 필요합니다. 새 category를 만들 때는 `sectionMap`도 함께 추가합니다. |
| `priority` | 후보 검토 우선순위입니다. | `high`, `medium`, `low` 같은 기존 값을 따르고, official source라도 후보 품질이 낮으면 무조건 high로 올리지 않습니다. |
| `reliability` | source 신뢰도 분류입니다. | `official`, `tech-media`, `project-official`, `conference` 같은 기존 값을 재사용합니다. |
| `enabled` | collector가 기본적으로 사용할지 여부입니다. | 불안정하거나 검토 중인 source는 `false`로 둘 수 있습니다. |
| `candidateOnly` | 최종 기사보다 후보 발굴 lead로 쓰는 source인지 표시합니다. | paywall, community lead, 2차 보도처럼 cross-check가 필요한 source에 보수적으로 사용합니다. |
| `requiresCrossCheck` | 최종 사용 전 다른 source 확인이 필요한지 표시합니다. | 2차 매체, community source, vendor claim 확인이 필요한 경우 `true`로 둡니다. |
| `usageHint` | 편집자가 이 source를 어떤 목적으로 볼지 설명합니다. | 기사 본문 복사가 아니라 후보 발굴, 배경 확인, official confirmation 같은 용도를 씁니다. |
| `keywords` | collector와 relevance 판단에 도움을 주는 keyword 목록입니다. | keyword는 watch/reference page를 main article로 승격시키는 우회로가 아닙니다. |

## category와 sectionMap의 관계

`category`는 source entry가 직접 보관하는 machine key이고, 사람이 읽는 newsletter section label은 `sectionMap[category]`에서만 파생합니다. source entry에 `section`을 직접 쓰면 같은 정보를 두 곳에서 관리하게 되므로 schema v2에서는 허용하지 않습니다.

collector는 런타임 normalized source 객체와 `content/collected-news/YYYY-MM-DD/candidates.json`에는 계속 `section`과 `source_section`을 기록합니다. 다만 이 값은 입력 JSON의 중복 필드가 아니라 resolver가 `sectionMap`에서 계산한 값입니다.

## Source 추가 체크리스트

1. `id`는 lowercase hyphenated 형식으로 정하고, 기존 source와 충돌하지 않는지 확인합니다.
2. `sourceUrl`은 사람이 직접 검토 가능한 안정 URL로 넣고, 신뢰할 수 있는 feed가 있을 때만 `rssUrl`을 넣습니다.
3. `category`는 기존 `sectionMap` key를 우선 사용하고, 새 key가 필요하면 `sectionMap` 추가 영향까지 확인합니다.
4. source entry에는 `section`을 넣지 않습니다. section label이 필요하면 `sectionMap`에 있는 category mapping을 수정합니다.
5. `collectionModeHint`는 collector가 지원하는 경우에만 넣고, unsupported mode를 문서만 보고 invent하지 않습니다.
6. `priority`, `reliability`, `enabled`, `candidateOnly`, `requiresCrossCheck`는 publication risk 기준으로 보수적으로 정합니다.
7. `usageHint`와 `keywords`는 AOSP Camera, Camera Driver, SoC Platform, C++, AI/SW engineering 관점의 후보 발굴 의도를 드러내게 작성합니다. 실제 main article 분류는 source keyword만이 아니라 기사 title/summary/API/component/behavior evidence에서 나온 `relevance_bucket`을 우선합니다.
8. source 추가 후 `npm run collect`, `npm run test`, `npm run validate`를 실행하고, 생성된 candidates에서 watch/reference 후보가 final main article로 올라가지 않는지 확인합니다.

## Source quality contract fields

`data/news-sources.json` is the executable source registry. Source quality docs are review surfaces only; enum values and JSON keys must stay unchanged.

| Field | Meaning | Contract |
| --- | --- | --- |
| `sourceRole` | Source role consumed by `source-quality-classifier.js`. | Required for every enabled source. Valid values are defined in `SOURCE_ROLES`. |
| `sourceUrlQualityHint` | Default URL quality hint for candidates from this source. | Required for every enabled source. `unknown` is main-ineligible unless classifier resolves it before Stage 3. |
| `mainArticlePolicy` | Default main-article source policy. | Required for every enabled source. Valid values: `allowed`, `conditional`, `watchlist_only`, `reference_only`, `blocked`. |
| `requiresCrossCheckDefault` | Whether candidates from this source normally need primary confirmation. | Boolean. Conditional cross-check sources must set this or use an explicit evidence-rule URL quality hint. |
| `evidenceGranularityHint` | Expected evidence granularity. | Human-facing hint; examples: `versioned_release_row`, `article_level_native_hal_workflow_evidence`. |
| `sourceQualityNotes` | Human review notes for source policy. | Array of strings. Notes do not override enum policy. |

### `mainArticlePolicy` mapping

| `mainArticlePolicy` | Default `source_quality_status` | Default `main_article_source_allowed` |
| --- | --- | ---: |
| `allowed` | `allowed` | `true` |
| `conditional` | `conditional` | `false` |
| `watchlist_only` | `blocked` | `false` |
| `reference_only` | `blocked` | `false` |
| `blocked` | `blocked` | `false` |

`source_quality` is canonical in new artifacts. Flat fields are compatibility mirrors only, and drift is reported as `SOURCE_QUALITY_FIELD_DRIFT`.

`requires_cross_check` means primary confirmation/cross-check is required. `requires_conditional_evidence` means the source policy is conditional, and `conditional_evidence_type` records why: `primary_confirmation`, `native_hal_workflow`, `project_release_evidence`, or `source_policy_review`. The source quality classifier does not evaluate HAL/native workflow relevance; that is combined later in `main_article_readiness`.


### Source quality enum values

`validate:config` rejects values outside these lists. Keep this section in sync with code.

#### `sourceRole`

- `official_release_source`
- `official_documentation_reference`
- `project_release_source`
- `project_mailing_list_source`
- `engineering_blog_source`
- `tech_media_lead_source`
- `community_lead_source`
- `generic_trend_source`
- `fallback_context_source`
- `unknown_source`

#### `sourceUrlQualityHint`

- `official_release_note_anchor`
- `official_dated_release`
- `official_site_update_row`
- `official_documentation_reference`
- `project_release`
- `project_mailing_list_release`
- `engineering_blog_with_camera_evidence`
- `tech_media_lead_requires_cross_check`
- `community_lead_requires_cross_check`
- `generic_ai_or_it_trend`
- `undated_reference_page`
- `fallback_context`
- `unknown`

#### `mainArticlePolicy`

- `allowed`
- `conditional`
- `watchlist_only`
- `reference_only`
- `blocked`
