# Source-Aware Linked Evidence Baseline - 2026-05-13

## Purpose

이 baseline은 issue `#89` PR 1의 시작 상태를 기록한다. 이번 slice는 contract와 fixture coverage만 추가한다. `outgoing_links[]`, role classification, resolver network mode, Event Bundle artifact, selection scoring 변경, PR body integration은 추가하지 않는다.

## Current Findings

| Surface | Current state | Next slice |
| --- | --- | --- |
| RSS summary/content anchors | raw RSS summary HTML에는 유용한 anchor가 있을 수 있지만 candidate는 아직 `outgoing_links[]`를 노출하지 않는다. | anchor를 `evidence_role=unclassified`인 `outgoing_links[]`로 보존한다. |
| HTML article body anchors | 기존 linked evidence extractor는 raw HTML/text가 있으면 URL evidence를 감지할 수 있다. | classification 전에 `source_field`와 anchor text를 보존한다. |
| Release note row links | 기존 curated fixture는 CameraX release row에서 Gerrit, IssueTracker, docs anchor evidence가 보이는지 확인한다. Primary row URL은 secondary evidence로 중복 처리하지 않는다. Link role은 아직 분류하지 않는다. | preservation을 먼저 추가하고 classifier는 다음 slice에서 추가한다. |
| Resolver mode | 기존 diagnostics는 network disabled 상태로 resolve한다. | `https` only, timeout, max bytes, max links 제한을 가진 `NEWSROOM_LINKED_EVIDENCE_MODE`를 명시한다. |
| Event Bundle | 이 slice에서는 구현하지 않는다. | preservation과 classifier가 안정된 뒤 builder를 추가한다. |

## Baseline Fixtures

- `tests/fixtures/linked-evidence/rss-summary-with-anchor.xml`
- `tests/fixtures/linked-evidence/android-blog-article-links.html`
- `tests/fixtures/linked-evidence/camerax-release-row.html`

이 fixture들은 curated 또는 synthetic input이다. generated newsletter artifact가 아니며 quality golden data로 사용하지 않는다.

## Validation

Targeted baseline validation:

```powershell
node --test tests\unit\evidence\source-aware-linked-evidence-baseline.test.js
node --test tests\unit\evidence\linked-evidence-extractor.test.js
npm.cmd run check:fixtures
```

Full PR validation remains:

```powershell
npm.cmd run test
npm.cmd run validate
```
