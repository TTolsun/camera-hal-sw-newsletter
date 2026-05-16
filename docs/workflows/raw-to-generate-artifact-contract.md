# RAW-to-Generate Artifact Contract

## 목적

`#88`의 범위는 newsroom workflow를 RAW 수집, Optional Gemini Source Discovery boundary, Final Gemini Generation으로 분리하고 artifact replay boundary를 고정하는 것입니다. 실제 Gemini source intelligence는 `#149`에서 구현합니다.

## Stage 1 RAW Collection

- canonical candidate artifact: `content/collected-news/<date>/manual-candidates.json`
- transition compatibility artifact: `content/collected-news/<date>/candidates.json`
- provenance manifest: `content/collected-news/<date>/raw-candidate-manifest.json`
- Stage 1은 `collect`만 실행합니다.
- Stage 1은 Gemini/API secret을 사용하지 않습니다.
- Stage 1은 `llm_used=false`를 manifest에 기록합니다.
- Stage 1이 만든 RAW artifact는 merge 후 immutable input입니다.

`manual-candidates.json`과 `candidates.json`은 v1 transition 동안 같은 payload를 가져야 합니다. 기존 selector/generator 호환성을 위해 `candidates.json`은 남기지만, 새 workflow 계약에서 canonical input은 `manual-candidates.json`입니다.

## Stage 2 Optional Gemini Source Discovery Boundary

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

Disabled pass-through는 `gemini-candidates.json`을 정확히 empty array `[]`로 씁니다. 이 파일은 #88 boundary artifact이며 Stage 3 generation input이 아닙니다.

### Enabled Without #149 Engine

`NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=true`인데 `#149` engine이 아직 없으면 `FAILED_GEMINI_SOURCE_DISCOVERY_NOT_IMPLEMENTED`로 실패합니다.

- 정상 `merged-candidates.json`은 생성하지 않습니다.
- diagnostics 목적의 `gemini-source-discovery-report.md`는 생성할 수 있습니다.
- report는 Gemini discovery engine이 `#88`에서 구현되지 않았고, manual candidates가 수정되지 않았고, Stage 3은 failed Stage 2 output 대신 Stage 1 artifact를 사용해야 한다고 명시해야 합니다.
- manual candidates는 어떤 경우에도 silently drop하지 않습니다.

## Stage 3 Final Generation

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

v1에서는 수동 candidate edit를 허용하지 않습니다. RAW PR은 candidate review와 provenance 확인을 위한 PR이며, candidate payload를 사람이 수정해 Final Generation input으로 쓰는 절차는 별도 이슈에서 schema, review, approval 계약을 먼저 정의한 뒤 도입합니다.

## Schedule Cutover

`#154` cutover 이후 `Newsroom 01 - Manual Source Collection PR` (`.github/workflows/01-newsroom-manual-source-collect-pr.yml`) workflow가 scheduled RAW collection entrypoint입니다.

- Stage 1은 daily schedule과 `workflow_dispatch`를 모두 지원합니다.
- legacy all-in-one weekly workflow는 제거되어야 합니다.
- Stage 2와 Stage 3은 계속 `workflow_dispatch` only입니다.
- 전환 이후에도 all-in-one schedule과 Stage 1 schedule을 동시에 활성화하지 않습니다.

PR branch는 date-based naming을 사용해 같은 날짜 PR 중복 생성을 막습니다.

- Stage 1: `newsroom-raw/<YYYY-MM-DD>`
- Stage 3: `newsroom-final/<YYYY-MM-DD>`
