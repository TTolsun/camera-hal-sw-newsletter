# RAW-to-Generate Artifact Contract

## 목적

이 문서는 newsroom workflow를 세 단계로 나누고, 각 단계 사이의 artifact 경계(replay boundary)를 고정하는 계약입니다. 세 단계는 RAW 수집, Optional Gemini Source Discovery(선택적 Gemini 출처 발굴) boundary, Final Gemini Generation(최종 생성)입니다. 중요한 원칙은 Gemini의 source intelligence(출처 판단)가 오직 Stage 2 경계 안에서만 동작한다는 점입니다.

## Stage 1 RAW Collection

### Collection Intent Approval Boundary

Stage 1의 `workflow_dispatch` seed input은 `manual_source_urls` 하나입니다. 처리 방식은 다음과 같습니다.

- `;`로 구분한 http/https URL list만 받습니다.
- first-seen 기준으로 dedupe(중복 제거)한 뒤 각 URL에 안정적인 `seed_id`를 부여합니다.
- 승인된 intent는 canonical 파일 `articles/content/collected-news/<date>/collection-intent.json`로 normalize됩니다.
- newline이나 http(s)가 아닌 URL은 fail-fast로 거절합니다.
- `manual_source_urls`가 비어 있으면, 기존 canonical `collection-intent.json`이 있을 때만 그것을 씁니다. seed input이 전혀 없으면 빈 intent file을 새로 만들지 않습니다.

`raw-candidate-manifest.json`은 승인된 intent가 있을 때만 다음 필드를 기록합니다.

```json
{
  "collection_intent": "articles/content/collected-news/YYYY-MM-DD/collection-intent.json",
  "collection_intent_hash": "...",
  "collection_intent_status": "approved",
  "seed_url_count": 2,
  "keyword_hint_count": 7
}
```

Stage 2는 manifest에 기록된 approved path/hash가 실제 `collection-intent.json`의 hash와 일치할 때만 seed expansion을 수행합니다. manifest에 없는 canonical intent file이거나 hash가 어긋나면(mismatch), 승인되지 않은 입력(unapproved input)으로 보고 seed expansion을 중단합니다. `keyword_hints`는 발굴용 hint일 뿐이며 출처가 뒷받침하는 사실(source-backed fact)이 될 수 없습니다.

Stage 1이 만드는 산출물과 동작 규칙은 다음과 같습니다.

- canonical candidate artifact: `articles/content/collected-news/<date>/manual-candidates.json`
- transition compatibility artifact: `articles/content/collected-news/<date>/candidates.json`
- provenance manifest: `articles/content/collected-news/<date>/raw-candidate-manifest.json`
- Stage 1은 `collect`만 실행합니다.
- Stage 1은 Gemini/API secret을 사용하지 않습니다.
- Stage 1은 `llm_used=false`를 manifest에 기록합니다.
- Stage 1이 만든 RAW artifact는 merge 후에는 바꿀 수 없는(immutable) 입력입니다.

v1 transition(전환) 기간에는 `manual-candidates.json`과 `candidates.json`이 같은 payload를 가져야 합니다. `candidates.json`은 기존 selector/generator와의 호환을 위해 남겨 둔 것이고, 새 workflow 계약에서 canonical(정본) input은 `manual-candidates.json`입니다.

## Stage 2 Optional Gemini Source Discovery Boundary

### Seed Evidence Expansion

승인된 `collection-intent.json`이 있으면, Stage 2는 Gemini credential(자격 증명) 유무와 상관없이 deterministic seed evidence expansion(결정론적 씨앗 근거 확장)을 먼저 실행합니다. 즉 Gemini가 꺼져 있어도 seed expansion만으로 `merged-candidates.json`을 만들 수 있습니다.

Seed evidence가 만드는 artifact 목록:

- `articles/content/collected-news/<date>/seed-candidates.json`
- `articles/content/collected-news/<date>/seed-evidence-pack.json`
- `articles/content/newsroom/<date>/seed-fetch-report.json`
- `articles/content/newsroom/<date>/seed-fetch-report.md`
- `articles/content/newsroom/<date>/seed-evidence-pack.md`
- `articles/content/newsroom/<date>/seed-merge-report.json`
- `articles/content/newsroom/<date>/seed-merge-report.md`

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
  "seed_candidate_artifact": "articles/content/collected-news/YYYY-MM-DD/seed-candidates.json",
  "seed_candidate_artifact_hash": "...",
  "seed_evidence_pack": "articles/content/collected-news/YYYY-MM-DD/seed-evidence-pack.json",
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

Seed fetch는 public `https` URL만 허용합니다. 다음 대상은 가져오지 않습니다: `http`, `file`, `ftp`, embedded credentials(URL에 끼워 넣은 인증정보), localhost, loopback, private IP range, link-local, metadata endpoint, internal host, redirect-to-private target(내부로 향하는 redirect). Redirect를 따라간 final URL도 같은 public `https` 검증을 다시 통과해야 합니다.

Duplicate merge precedence(중복 병합 우선순위)는 field 단위로 고정합니다. 즉 어느 field를 누가 덮어쓸 수 있는지가 정해져 있습니다.

- Manual candidate의 다음 field는 seed/Gemini가 override(덮어쓰기)하지 못합니다: `title`, `headline`, `editor_note`, manual `priority`, `source_id`, user tags, intended bucket.
- Seed evidence는 다음만 보강(추가)할 수 있습니다: `source_extraction`, `evidence_ids`, `seed_evidence_pack_refs`, `extraction_quality`, `linked_evidence_summary`, `do_not_claim`, 비어 있는 `publishedAt`, 비어 있는 `version_or_release`.
- 충돌이 생기면 `articles/content/newsroom/<date>/seed-merge-report.json`과 `.md`에 기록합니다.

- optional output: `articles/content/collected-news/<date>/merged-candidates.json`
- Gemini discovery delta artifact: `articles/content/collected-news/<date>/gemini-candidates.json`
- provenance manifest: `articles/content/collected-news/<date>/merged-candidate-manifest.json`
- report: `articles/content/newsroom/<date>/gemini-source-discovery-report.md`

Stage 2는 v1에서 두 가지 운영 방식을 허용합니다(아래 두 절).

### Stage 2 미실행

Stage 2를 실행하지 않는 경우입니다. 이때 Stage 3은 `manual-candidates.json`을 그대로 사용하며, `merged-candidates.json`이 없어도 정상입니다. 전환 fallback으로 `candidates.json`도 허용합니다.

### Disabled Pass-through 실행

`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=false`이면 Gemini discovery를 끈 채로, Stage 2는 `manual-candidates.json`과 똑같은 payload로 `merged-candidates.json`을 만듭니다. 이때 `merged-candidate-manifest.json`과 `gemini-source-discovery-report.md`도 함께 만들고, report에는 다음 값을 기록합니다.

- `disabled_pass_through=true`
- `llm_used=false`
- `gemini_candidate_count=0`
- `gemini_candidate_artifact=articles/content/collected-news/<date>/gemini-candidates.json`
- `merge_mode=disabled_pass_through`

disabled pass-through는 `gemini-candidates.json`을 정확히 빈 배열 `[]`로 씁니다. 이 파일은 Stage 2 boundary artifact일 뿐, Stage 3 generation의 input이 아닙니다.

### Enabled Gemini Source Discovery

`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=true`이면 Stage 2는 artifact를 바꾸기(mutation) 전에, 선택된 LLM provider의 credential preflight(자격 증명 사전 점검)를 먼저 수행합니다. preflight가 실패하면 가능한 한 `gemini-source-discovery-report.md`에 실패 상태를 남기고, candidate artifact는 건드리지 않습니다.

성공한 경우의 처리 순서:

- Gemini의 응답은 `articles/content/newsroom/<date>/gemini-source-proposals.json` proposal artifact로 저장합니다.
- proposal은 아직 candidate가 아닙니다. deterministic fetch / normalize / schema validation을 모두 통과한 URL만 `gemini-candidates.json`으로 승격합니다.
- `gemini-candidates.json`에는 승격된 candidate만 담습니다.
- `merged-candidates.json`은 manual candidates를 그대로 보존하고, schema가 유효한 Gemini candidates만 추가합니다.
- v2 `merged-candidate-manifest.json`은 usage, proposal validation, quality, cluster, evidence report의 path를 포함합니다.
- manual candidates는 어떤 경우에도 자동으로 제외하지 않습니다.

## Stage 3 Final Generation

Stage 3은 seed URL을 다시 crawling/fetch하지 않습니다. seed 기반 claim(주장)은 candidate의 `evidence_pack_ids`, `primary_evidence_ids`, `linked_evidence_ids`, `source_extraction_ref`로 Evidence Pack을 추적합니다. Gemini prompt에는 full pack 전체가 아니라 candidate별 `compact_evidence` capsule만 전달합니다. evidence id가 없으면 추적성(traceability)을 억지로 만들지 않고, 해당 claim을 demote(강등)해야 합니다.

Stage 3은 artifact input mode로 동작하며, 승인된 candidate artifact만 읽습니다.

- `NEWSROOM_CANDIDATE_INPUT_MODE=artifact`
- `NEWSROOM_CANDIDATE_INPUT_PATH=<repo-relative-candidate-json>`은 선택 입력입니다. 명시(explicit) path로는 해당 날짜의 approved `manual-candidates.json` 또는 `merged-candidates.json`만 허용합니다. legacy `candidates.json`는 explicit path로 직접 지정할 수 없고, explicit path가 비어 있을 때 자동 전환 fallback으로만 쓰입니다.

입력을 고르는 우선순위는 다음과 같습니다(위에서부터 먼저 맞는 것을 사용).

1. 유효한 `merged-candidates.json`과 유효한 `merged-candidate-manifest.json`
2. 없으면 `manual-candidates.json`과 유효한 `raw-candidate-manifest.json`
3. 없으면 전환 fallback `candidates.json`

실패한 Stage 2 진단 report만 있는 경우는 유효한 generation input이 아닙니다.

Stage 3은 RAW artifact를 수정하지 않으며 `collect`도 다시 실행하지 않습니다. manifest hash mismatch, artifact 누락, `llm_used` 위반이 있으면 `FAILED_RAW_ARTIFACT_VALIDATION`으로 중단합니다.

## Manual Candidate Edit Policy

v1에서는 candidate를 사람이 손으로 편집하는 것을 허용하지 않습니다. RAW PR은 candidate를 검토(review)하고 출처 내력(provenance)을 확인하기 위한 PR입니다. candidate payload를 사람이 직접 고쳐서 Final Generation input으로 쓰는 절차는, 별도의 schema·review·approval 계약을 먼저 정의한 뒤에야 도입합니다.

## Schedule Cutover

현재 예약(schedule)된 RAW collection 진입점은 `Newsletters 01 - Source Collection PR` (`.github/workflows/newsletters-01-source-collect-pr.yml`) workflow입니다.

- Stage 1은 daily schedule과 `workflow_dispatch`를 모두 지원합니다.
- 레거시 all-in-one 주간 workflow는 제거해야 합니다.
- Stage 2와 Stage 3은 계속 `workflow_dispatch`로만 실행합니다.
- 전환 이후에도 all-in-one schedule과 Stage 1 schedule을 동시에 켜 두지 않습니다.

workflow branch는 날짜 기반 이름을 써서 같은 날짜에 PR이 중복 생성되는 것을 막습니다.

- Stage 1: `newsroom-raw/<YYYY-MM-DD>`
- Stage 3: `newsroom-final/<YYYY-MM-DD>`
