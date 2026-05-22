# Source-Aware Linked Evidence Contract

## Seed Evidence Extension

Seed evidence expansion reuses this linked-evidence boundary in Stage 2 only. Stage 1 approves `collection-intent.json`, Stage 2 fetches approved seed URLs and allowed linked evidence, and Stage 3 consumes only the approved candidate artifacts plus `compact_evidence`.

Additional seed-specific rules:

- Seed fetch accepts only public `https` URLs and validates redirect targets again.
- `keyword_hints` are discovery hints only and must never become source-backed facts.
- Failed, blocked, noise, unsupported, or skipped linked evidence must not be used as article facts.
- Candidate to Evidence Pack mapping is by `evidence_pack_ids`, `primary_evidence_ids`, `linked_evidence_ids`, and `source_extraction_ref`; URL string matching is not the contract.
- Stage 3 must not crawl or fetch seed URLs again.
- Full `seed-evidence-pack.json` is a validation/debug artifact; Gemini prompts receive only candidate-level `compact_evidence`.

이 문서는 source page, RSS article, release note row 안의 linked evidence를 보존하고 분류하는 현재 계약을 설명합니다. 목표는 evidence traceability를 높이되, 발행 안전성과 기존 article structure 계약을 약화하지 않는 것입니다.

## 책임 경계

| Area | Implementation source | Contract |
| --- | --- | --- |
| Source extraction | `scripts/newsroom/sources/adapters/**`, `scripts/newsroom/cli/collect-news-candidates.js` | Source page에서 release/version/date/component/source facts를 추출한다. Public article section을 직접 만들지 않는다. |
| Linked evidence | `scripts/newsroom/evidence/**` | `outgoing_links[]`를 보존하고 source-aware policy로 role을 분류한다. 필요한 경우 linked evidence를 resolve하고 Event Bundle로 묶는다. |
| Public article structure | `docs/newsletter-template.md`, `scripts/newsroom/render/**` | 최종 newsletter article section order와 renderer-visible shape의 source of truth다. Linked evidence는 새 public article structure를 정의하지 않는다. |
| Source and signal quality | `scripts/newsroom/collect/**`, `scripts/newsroom/metrics/**`, `scripts/newsroom/validate/**` | Source quality, prompt quality, HAL-facing signal metric을 정의한다. Linked evidence는 이 metric에 traceable evidence를 제공한다. |

## Data 책임

| Field | Producer | Consumer | Notes |
| --- | --- | --- | --- |
| `source_extraction` | Source adapter | Candidate normalization, prompt/report diagnostics | Source-confirmed facts만 담는다. Editorial hints는 별도 field에 둔다. |
| `outgoing_links[]` | Collector/parser preservation slice | Role classifier | Optional이다. Link 누락이 collection failure가 되면 안 된다. |
| `linked_evidence[]` | Existing extractor/resolver | Diagnostics, impact classifier | 명시적으로 요약되지 않은 resolved evidence는 report-only로 유지한다. |
| `event_bundles[]` | Event Bundle builder | Diagnostics, conservative selection/report integration | Optional이다. Bundle 부재가 fallback article 승격 이유가 되면 안 된다. |

## `outgoing_links[]` Contract

Preservation adds link records without deciding evidence value.

```json
{
  "url": "https://developer.android.com/jetpack/androidx/releases/camera#1.6.1",
  "text": "CameraX release notes",
  "source_field": "rss.description",
  "extraction_method": "html_anchor",
  "evidence_role": "unclassified"
}
```

Rules:

- `evidence_role` defaults to `unclassified` in the preservation slice.
- Existing `summary` plain text remains backward compatible.
- Relative links are resolved against the source or article URL when possible.
- Link preservation is best-effort and non-fatal.

## Evidence Role Classification 경계

Classifier는 preserved links를 입력으로 소비하되 preservation semantics를 바꾸지 않는다.

Allowed roles:

```text
unclassified
primary_evidence
secondary_context
noise
unsupported
blocked_or_deferred
```

Rules:

- `privacy`, `subscribe`, `share`, `rss`, `profile`, `terms`, and similar utility links become `noise`.
- Official release note/docs/Gerrit/IssueTracker/GitHub release/commit/PR links may become `primary_evidence` only when source policy allows them.
- Allowed domain alone is not enough if anchor text matches ignored keywords.

## Resolver 안전 제한

Network resolve is disabled by default.

```text
NEWSROOM_LINKED_EVIDENCE_MODE=extract_only
NEWSROOM_LINKED_EVIDENCE_MODE=resolve_allowed_official_links
NEWSROOM_LINKED_EVIDENCE_MODE=offline_fixture_test
NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE=8
NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN=40
NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS=5000
NEWSROOM_LINKED_EVIDENCE_MAX_BYTES=200000
```

Required limits before enabling network resolve:

- `https` only.
- Per-link timeout.
- Max bytes per response.
- Max links per article.
- Max total links per run.
- `extract_only` preserves and classifies links but never fetches network content.
- `resolve_allowed_official_links` may fetch only source-policy-allowed `primary_evidence` links.
- `offline_fixture_test` may resolve only through an injected fixture fetch client.
- `noise`, `unsupported`, `blocked_or_deferred`, `secondary_context`, `http`, and non-URL links are never fetched.
- Redirect `Location` and final `response.url` must also satisfy `https` and source-policy-allowed `primary_evidence`.
- Raw HTML full bodies are never stored as artifacts.
- Timeout, oversized response, blocked HTTP status, and fetch failure are diagnostics only and non-fatal.

## Event Bundle 계약

Event Bundle은 linked evidence를 diagnostics와 trace summary로 묶는 optional artifact입니다. Selection/scoring integration과 HAL runtime/API inference는 별도 보수적 integration이 명시되기 전까지 범위 밖입니다.
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
- Preservation-only `unclassified`, `noise`, `unsupported`, `blocked_or_deferred`, `secondary_context` link는 Event Bundle evidence URL이 아니다.
- Failed, blocked, skipped, unsupported resolved evidence는 `evidence_urls`에서 제외한다.
- Event Bundle key는 deterministic해야 하며, explicit scoring integration 전까지 diagnostic-only로 취급한다.
- PR body에는 primary article -> followed evidence -> Event Bundle trace summary만 표시한다.
- Event Bundle trace는 selection/scoring boost를 의미하지 않는다.

## Scoring 및 발행 안전성

- Failed, blocked, oversized, unsupported, or noise evidence never increases score.
- Event Bundle evidence may support selection only in a future conservative integration and only when it adds source-confirmed release/date/version/API/behavior facts.
- Evidence must not be used to infer HAL runtime/API/driver behavior that the source does not state.
- Quality threshold, hard fail conditions, source binding, and article count policy remain unchanged.
