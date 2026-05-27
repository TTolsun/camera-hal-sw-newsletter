# RAW-to-Generate Artifact Contract

## 목적

이 문서는 newsroom workflow를 RAW 수집, Optional Gemini Source Discovery boundary, Final Gemini Generation으로 분리하고 artifact replay boundary를 고정하는 현재 계약입니다. Gemini source intelligence는 Stage 2 boundary 안에서만 동작합니다.

## Stage 1 RAW Collection

### Collection Intent Approval Boundary

Stage 1의 `workflow_dispatch` seed input은 `manual_source_urls`입니다. `;`로 구분한 http/https URL list만 받아 first-seen dedupe 후 stable `seed_id`를 부여하고, 승인된 intent는 canonical `content/collected-news/<date>/collection-intent.json`로 normalize됩니다. newline이나 비-http(s) URL은 fail-fast로 거절합니다. `manual_source_urls`가 비어 있으면 기존 canonical `collection-intent.json`이 있을 때만 사용하고, seed input이 없으면 empty intent file을 만들지 않습니다.

`raw-candidate-manifest.json`은 승인된 intent가 있을 때만 다음 필드를 기록합니다.

```json
{
  "collection_intent": "content/collected-news/YYYY-MM-DD/collection-intent.json",
  "collection_intent_hash": "...",
  "collection_intent_status": "approved",
  "seed_url_count": 2,
  "keyword_hint_count": 7
}
```

Stage 2는 manifest에 기록된 approved path/hash와 실제 `collection-intent.json` hash가 일치할 때만 seed expansion을 수행합니다. Manifest에 없는 canonical intent file이나 hash mismatch는 unapproved input으로 처리하고 seed expansion을 중단합니다. `keyword_hints`는 discovery hint이며 source-backed fact가 될 수 없습니다.

- canonical candidate artifact: `content/collected-news/<date>/manual-candidates.json`
- transition compatibility artifact: `content/collected-news/<date>/candidates.json`
- provenance manifest: `content/collected-news/<date>/raw-candidate-manifest.json`
- Stage 1은 `collect`만 실행합니다.
- Stage 1은 Gemini/API secret을 사용하지 않습니다.
- Stage 1은 `llm_used=false`를 manifest에 기록합니다.
- Stage 1이 만든 RAW artifact는 merge 후 immutable input입니다.

`manual-candidates.json`과 `candidates.json`은 v1 transition 동안 같은 payload를 가져야 합니다. 기존 selector/generator 호환성을 위해 `candidates.json`은 남기지만, 새 workflow 계약에서 canonical input은 `manual-candidates.json`입니다.

## Stage 2 Optional Gemini Source Discovery Boundary

### Seed Evidence Expansion

Approved `collection-intent.json`이 있으면 Stage 2는 Gemini credential 여부와 무관하게 deterministic seed evidence expansion을 먼저 실행합니다. Gemini disabled mode에서도 seed expansion은 `merged-candidates.json`을 생성할 수 있습니다.

Seed evidence artifacts:

- `content/collected-news/<date>/seed-candidates.json`
- `content/collected-news/<date>/seed-evidence-pack.json`
- `content/newsroom/<date>/seed-fetch-report.json`
- `content/newsroom/<date>/seed-fetch-report.md`
- `content/newsroom/<date>/seed-evidence-pack.md`
- `content/newsroom/<date>/seed-merge-report.json`
- `content/newsroom/<date>/seed-merge-report.md`

`merge_mode` 값은 다음 중 하나입니다.

```text
disabled_pass_through
seed_evidence_expansion
gemini_source_discovery
seed_evidence_plus_gemini_discovery
```

Stage 2 manifest/report는 seed 사용 시 다음 필드를 기록합니다.

```json
{
  "seed_used": true,
  "seed_candidate_artifact": "content/collected-news/YYYY-MM-DD/seed-candidates.json",
  "seed_candidate_artifact_hash": "...",
  "seed_evidence_pack": "content/collected-news/YYYY-MM-DD/seed-evidence-pack.json",
  "seed_evidence_pack_hash": "...",
  "seed_candidate_count": 1,
  "seed_new_unique_url_count": 1,
  "seed_enriched_duplicate_count": 0,
  "seed_publishable_candidate_count": 1,
  "seed_blocked_url_count": 0,
  "seed_fetch_failed_count": 0,
  "seed_primary_evidence_count": 1
}
```

Seed fetch는 public `https` URL만 허용합니다. `http`, `file`, `ftp`, embedded credentials, localhost, loopback, private IP range, link-local, metadata endpoint, internal host, redirect-to-private target은 fetch하지 않습니다. Redirect 후 final URL도 같은 public `https` validation을 다시 통과해야 합니다.

Duplicate merge precedence는 field-level로 고정합니다. Manual candidate의 `title`, `headline`, `editor_note`, manual `priority`, `source_id`, user tags, intended bucket은 seed/Gemini가 override하지 않습니다. Seed evidence는 `source_extraction`, `evidence_ids`, `seed_evidence_pack_refs`, `extraction_quality`, `linked_evidence_summary`, `do_not_claim`, missing `publishedAt`, missing `version_or_release`만 보강합니다. 충돌은 `content/newsroom/<date>/seed-merge-report.json`과 `.md`에 기록합니다.

- optional output: `content/collected-news/<date>/merged-candidates.json`
- Gemini discovery delta artifact: `content/collected-news/<date>/gemini-candidates.json`
- provenance manifest: `content/collected-news/<date>/merged-candidate-manifest.json`
- report: `content/newsroom/<date>/gemini-source-discovery-report.md`

Stage 2는 v1에서 두 운영 방식을 허용합니다.

### Stage 2 미실행

Stage 3은 `manual-candidates.json`을 직접 사용합니다. `merged-candidates.json`이 없어도 정상입니다. transition fallback으로 `candidates.json`도 허용합니다.

### Disabled Pass-through 실행

`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=false`이면 Stage 2는 `manual-candidates.json`과 동일한 payload로 `merged-candidates.json`을 생성합니다. 이때 `merged-candidate-manifest.json`과 `gemini-source-discovery-report.md`를 함께 생성하고 report에는 다음 값을 기록합니다.

- `disabled_pass_through=true`
- `llm_used=false`
- `gemini_candidate_count=0`
- `gemini_candidate_artifact=content/collected-news/<date>/gemini-candidates.json`
- `merge_mode=disabled_pass_through`

Disabled pass-through는 `gemini-candidates.json`을 정확히 empty array `[]`로 씁니다. 이 파일은 Stage 2 boundary artifact이며 Stage 3 generation input이 아닙니다.

### Enabled Gemini Source Discovery

`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=true`이면 Stage 2는 artifact mutation 전에 selected LLM provider credential preflight를 수행합니다. Credential preflight가 실패하면 가능하면 `gemini-source-discovery-report.md`에 failure status를 남기고 candidate artifact는 수정하지 않습니다.

- Gemini response는 `content/newsroom/<date>/gemini-source-proposals.json` proposal artifact로 저장합니다.
- Proposal은 candidate가 아니며, deterministic fetch / normalize / schema validation을 통과한 URL만 `gemini-candidates.json`으로 promotion합니다.
- `gemini-candidates.json`에는 promoted candidate만 저장합니다.
- `merged-candidates.json`은 manual candidates를 보존하고 schema-valid Gemini candidates만 추가합니다.
- v2 `merged-candidate-manifest.json`은 usage, proposal validation, quality, cluster, evidence report path를 포함합니다.
- manual candidates는 어떤 경우에도 silently drop하지 않습니다.

## Stage 3 Final Generation

Stage 3은 seed URL crawling/fetch를 다시 수행하지 않습니다. Seed-derived claim은 candidate의 `evidence_pack_ids`, `primary_evidence_ids`, `linked_evidence_ids`, `source_extraction_ref`로 Evidence Pack을 추적하고, Gemini prompt에는 full pack이 아니라 candidate별 `compact_evidence` capsule만 전달합니다. Missing evidence id가 있으면 traceability를 invent하지 않고 claim을 demote해야 합니다.

Stage 3은 artifact input mode로 approved candidate artifact만 읽습니다.

- `NEWSROOM_CANDIDATE_INPUT_MODE=artifact`
- `NEWSROOM_CANDIDATE_INPUT_PATH=<repo-relative-candidate-json>`은 선택 입력입니다. Explicit path는 해당 날짜의 approved `manual-candidates.json` 또는 `merged-candidates.json`만 허용합니다. Legacy `candidates.json`는 explicit path로 지정하지 않고 explicit path가 비어 있을 때 automatic transition fallback으로만 허용합니다.

입력 우선순위는 다음입니다.

1. valid `merged-candidates.json` with valid `merged-candidate-manifest.json`
2. otherwise `manual-candidates.json` with valid `raw-candidate-manifest.json`
3. otherwise transition fallback `candidates.json`

failed Stage 2 diagnostics report alone is never a valid generation input.

Stage 3은 RAW artifact를 수정하지 않고 `collect`를 재실행하지 않습니다. manifest hash mismatch, missing artifact, `llm_used` 위반은 `FAILED_RAW_ARTIFACT_VALIDATION`으로 중단합니다.

## Manual Candidate Edit Policy

v1에서는 수동 candidate edit를 허용하지 않습니다. RAW PR은 candidate review와 provenance 확인을 위한 PR이며, candidate payload를 사람이 수정해 Final Generation input으로 쓰는 절차는 별도 schema, review, approval 계약을 먼저 정의한 뒤 도입합니다.

## Schedule Cutover

현재 `Newsroom 01 - Manual Source Collection PR` (`.github/workflows/01-newsroom-manual-source-collect-pr.yml`) workflow가 scheduled RAW collection entrypoint입니다.

- Stage 1은 daily schedule과 `workflow_dispatch`를 모두 지원합니다.
- legacy all-in-one weekly workflow는 제거되어야 합니다.
- Stage 2와 Stage 3은 계속 `workflow_dispatch` only입니다.
- 전환 이후에도 all-in-one schedule과 Stage 1 schedule을 동시에 활성화하지 않습니다.

Workflow branch는 date-based naming을 사용해 같은 날짜 PR 중복 생성을 막습니다.

- Stage 1: `newsroom-raw/<YYYY-MM-DD>`
- Stage 3: `newsroom-final/<YYYY-MM-DD>`
