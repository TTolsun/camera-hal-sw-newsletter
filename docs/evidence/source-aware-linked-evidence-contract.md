# Source-Aware Linked Evidence Contract

## Seed Evidence Extension

Seed evidence expansion(씨앗 근거 확장)은 이 linked-evidence 경계를 Stage 2에서만 재사용합니다. Stage 1은 `collection-intent.json`을 승인하고, Stage 2는 승인된 seed URL과 허용된 linked evidence를 가져오며, Stage 3은 승인된 candidate artifact와 `compact_evidence`만 소비합니다.

추가 seed 전용 규칙:

- Seed fetch는 공개 `https` URL만 허용하며 redirect 대상도 다시 검증합니다.
- `keyword_hints`는 발굴 힌트 전용이며 source-backed 사실이 되어서는 안 됩니다.
- 실패, 차단, noise, 미지원, 건너뛴 linked evidence는 기사 사실로 사용하지 않습니다.
- Candidate와 Evidence Pack 매핑은 `evidence_pack_ids`, `primary_evidence_ids`, `linked_evidence_ids`, `source_extraction_ref`로 합니다. URL 문자열 매칭은 계약이 아닙니다.
- Stage 3은 seed URL을 다시 크롤링하거나 가져오지 않습니다.
- 전체 `seed-evidence-pack.json`은 검증/디버그 artifact이며, Gemini prompt는 candidate 수준 `compact_evidence`만 전달받습니다.

이 문서는 source page, RSS article, release note row 안의 linked evidence를 보존하고 분류하는 현재 계약을 설명합니다. 목표는 evidence traceability를 높이되, 발행 안전성과 기존 article structure 계약을 약화하지 않는 것입니다.

## 책임 경계

| 영역 | 구현 위치 | 계약 |
| --- | --- | --- |
| Source extraction | `src/shared/sources/adapters/**`, `src/shared/cli/collect-news-candidates.js` | Source page에서 release/version/date/component/source facts를 추출한다. Public article section을 직접 만들지 않는다. |
| Linked evidence | `src/shared/evidence/**` | `outgoing_links[]`를 보존하고 source-aware policy로 role을 분류한다. 필요한 경우 linked evidence를 resolve하고 Event Bundle로 묶는다. |
| Public article structure | `docs/newsletter-template.md`, `src/generator/render/**` | 최종 newsletter article section order와 renderer-visible shape의 source of truth다. Linked evidence는 새 public article structure를 정의하지 않는다. |
| Source and signal quality | `src/collector/**`, `src/shared/collect/**`, `src/generator/quality/**`, `src/generator/validate/**` | Source quality, prompt quality, HAL-facing signal metric을 정의한다. Linked evidence는 이 metric에 traceable evidence를 제공한다. |

## Data 책임

| 필드 | 생산자 | 소비자 | 비고 |
| --- | --- | --- | --- |
| `source_extraction` | Source adapter | Candidate normalization, prompt/report diagnostics | Source-confirmed facts만 담는다. Editorial hints는 별도 field에 둔다. |
| `outgoing_links[]` | Collector/parser preservation slice | Role classifier | Optional이다. Link 누락이 collection failure가 되면 안 된다. |
| `linked_evidence[]` | Existing extractor/resolver | Diagnostics, impact classifier | 명시적으로 요약되지 않은 resolved evidence는 report-only로 유지한다. |
| `event_bundles[]` | Event Bundle builder | Diagnostics, conservative selection/report integration | Optional이다. Bundle 부재가 fallback article 승격 이유가 되면 안 된다. |

## `outgoing_links[]` Contract

보존 단계에서는 evidence 가치 판단 없이 link record만 추가합니다.

```json
{
  "url": "https://developer.android.com/jetpack/androidx/releases/camera#1.6.1",
  "text": "CameraX release notes",
  "source_field": "rss.description",
  "extraction_method": "html_anchor",
  "evidence_role": "unclassified"
}
```

규칙:

- `evidence_role`은 보존 단계에서 `unclassified`가 기본값입니다.
- 기존 `summary` 평문은 하위 호환을 유지합니다.
- 상대 경로 링크는 가능한 경우 source 또는 article URL 기준으로 resolve합니다.
- Link 보존은 best-effort이며 치명적 실패가 아닙니다.

## Evidence Role Classification 경계

Classifier는 보존된 links를 입력으로 소비하되 보존 semantics를 바꾸지 않습니다.

허용 role:

```text
unclassified
primary_evidence
secondary_context
noise
unsupported
blocked_or_deferred
```

규칙:

- `privacy`, `subscribe`, `share`, `rss`, `profile`, `terms` 등 유틸리티 링크는 `noise`가 됩니다.
- official release note/docs/Gerrit/IssueTracker/GitHub release/commit/PR 링크는 source policy가 허용할 때만 `primary_evidence`가 될 수 있습니다.
- anchor text가 무시 키워드와 일치하면 허용 도메인만으로는 충분하지 않습니다.

## Resolver 안전 제한

네트워크 resolve는 기본적으로 비활성화입니다.

```text
NEWSROOM_LINKED_EVIDENCE_MODE=extract_only
NEWSROOM_LINKED_EVIDENCE_MODE=resolve_allowed_official_links
NEWSROOM_LINKED_EVIDENCE_MODE=offline_fixture_test
NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE=8
NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN=40
NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS=5000
NEWSROOM_LINKED_EVIDENCE_MAX_BYTES=200000
```

네트워크 resolve 활성화 전 필수 제한:

- `https` 전용.
- 링크당 timeout.
- 응답당 최대 bytes.
- 기사당 최대 링크 수.
- 실행당 최대 링크 수 합계.
- `extract_only`는 링크를 보존하고 분류하되 네트워크 콘텐츠를 가져오지 않습니다.
- `resolve_allowed_official_links`는 source policy가 허용하는 `primary_evidence` 링크만 가져올 수 있습니다.
- `offline_fixture_test`는 주입된 fixture fetch client를 통해서만 resolve할 수 있습니다.
- `noise`, `unsupported`, `blocked_or_deferred`, `secondary_context`, `http`, 비-URL 링크는 절대 가져오지 않습니다.
- Redirect `Location`과 최종 `response.url`도 `https` 및 source policy 허용 `primary_evidence` 조건을 다시 통과해야 합니다.
- Raw HTML 전체 본문은 artifact로 저장하지 않습니다.
- Timeout, 과대 응답, 차단된 HTTP 상태, fetch 실패는 진단 전용이며 치명적 실패가 아닙니다.

## Event Bundle 계약

Event Bundle은 linked evidence를 진단과 trace summary로 묶는 optional artifact입니다. selection/scoring 통합과 HAL runtime/API 추론은 별도 보수적 통합이 명시되기 전까지 범위 밖입니다.
Dedupe fallback order는 다음 순서를 따른다.

```text
canonical_release_note_url
source_id + release.version
source_id + release.date + component
android_gerrit_change_id
github_owner_repo + release_tag
github_owner_repo + issue_or_pr_number
cve_id
normalized_primary_url
```

Minimum schema:

```json
{
  "event_id": "event_...",
  "primary_candidate_id": "candidate_...",
  "event_key": "source_id:CameraX 1.6.1",
  "event_type": "release_note",
  "primary_url": "https://developer.android.com/jetpack/androidx/releases/camera#1.6.1",
  "evidence_urls": [],
  "dedupe_reason": "source_id + release.version",
  "release": {
    "version": "CameraX 1.6.1",
    "date": "2026-05-06"
  },
  "component": "CameraX / androidx.camera",
  "impact_axes": [],
  "confidence": "medium",
  "warnings": []
}
```

Builder 규칙:

- `event_bundles[]` 부재는 fallback article 승격 사유가 될 수 없다.
- 보존 전용 `unclassified`, `noise`, `unsupported`, `blocked_or_deferred`, `secondary_context` 링크는 Event Bundle evidence URL이 아니다.
- 실패, 차단, 건너뜀, 미지원 resolved evidence는 `evidence_urls`에서 제외한다.
- Event Bundle key는 deterministic해야 하며, explicit scoring 통합 전까지 diagnostic 전용으로 취급한다.
- PR body에는 primary article -> followed evidence -> Event Bundle trace summary만 표시한다.
- Event Bundle trace는 selection/scoring 가산점을 의미하지 않는다.

## Scoring 및 발행 안전성

- 실패, 차단, 과대, 미지원, noise evidence는 점수를 높이지 않습니다.
- Event Bundle evidence는 미래의 보수적 통합에서만, source-confirmed release/date/version/API/behavior 사실을 추가할 때만 선정에 기여할 수 있습니다.
- source가 명시하지 않은 HAL runtime/API/driver 동작을 evidence로 추론해서는 안 됩니다.
- quality threshold, hard fail 조건, source binding, article count 정책은 변경하지 않습니다.
