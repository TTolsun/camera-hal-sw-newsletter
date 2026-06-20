# GitHub Actions Secret과 Variable

설정 위치는 `GitHub repository -> Settings -> Secrets and variables -> Actions`입니다.

Secret과 Variable은 따로 관리합니다. Secret은 로그, commit, PR 본문, GitHub Variables 어디에도 넣지 않습니다.

## Secret

| 이름 | 필수 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | 필수 | Gemini newsroom pipeline이 Gemini API를 호출할 때 쓰는 API key입니다. | key를 rotate하거나 권한이 다른 key로 교체할 때만 변경합니다. | 절대 commit, workflow log, artifact, GitHub Variables에 남기지 않습니다. 노출되면 즉시 폐기하고 새 key를 발급합니다. |

## LLM provider 설정

기본 provider는 `gemini`입니다. 지금 예약 실행되는 workflow는 `Newsletters 01 - Source Collection PR` (`.github/workflows/01-newsletters-source-collect-pr.yml`)뿐이고, RAW candidate collection(원시 후보 수집)만 합니다. 이 Stage 1 workflow는 LLM credential, provider/model 설정, `npm run generate`를 쓰지 않습니다.

LLM provider/model 설정은 LLM을 실제로 호출하는 수동 workflow에서만 적용됩니다.

- `Newsletters 02 - Source Discovery PR` (`.github/workflows/02-newsletters-source-discovery-pr.yml`): optional source discovery가 켜졌을 때 provider를 씁니다.
- `Newsletters 03 - Editor PR` (`.github/workflows/03-newsletters-editor-pr.yml`): final generation에서 provider를 씁니다.

Stage 2/3 manual 입력의 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS`가 비어 있으면 `src/shared/common/runtime-config.js`의 `DEFAULT_RUNTIME_CONFIG`를 따릅니다. 기본 provider/model을 바꾸려면 GitHub variable이 아니라 code default를 고쳐야 합니다.

기존 `GEMINI_MODEL`과 `GEMINI_FALLBACK_MODELS`는 runtime 호환용 alias(compatibility alias)로 남아 있습니다. 다만 Stage 3 manual final generation의 provider/model 기본값을 정하는 곳은 이제 GitHub repo variable이 아니라 code default입니다.

stage별 primary model은 각각 따로 override할 수 있습니다 — `NEWSROOM_REPORTER_MODEL`, `NEWSROOM_EDITOR_MODEL`, `NEWSROOM_FACTCHECK_MODEL`, `NEWSROOM_REPAIR_MODEL`, `NEWSROOM_JUDGE_MODEL`. 단, `LLM_MODEL` 또는 `GEMINI_MODEL`을 지정하면 그 값이 stage별 설정보다 우선해서 모든 stage의 primary model을 덮어씁니다. fallback chain은 `LLM_FALLBACK_MODELS`(또는 호환 alias `GEMINI_FALLBACK_MODELS`)가 모든 stage primary 뒤에 붙습니다.

token은 workflow input, log, artifact, PR body에 출력하지 않습니다.

| input | 기본값 | runtime env | 설명 |
| --- | --- | --- | --- |
| `llm_provider` | `default` | `LLM_PROVIDER` | `default` 또는 빈 값은 code default provider로 normalize됩니다. 선택값은 `gemini`, `openapi`, `internal`입니다. `openapi`는 reserved provider enum이며 전용 구현 전에는 `provider_not_implemented`로 fail-fast합니다. |
| `llm_model` | 빈 값 | `LLM_MODEL` | 수동 실행에서만 primary model을 override합니다. |
| `llm_fallback_models` | 빈 값 | `LLM_FALLBACK_MODELS` | 수동 실행에서만 fallback model 목록을 comma-separated string으로 override합니다. |

기본값은 `LLM_PROVIDER=gemini`입니다. `LLM_PROVIDER=openapi`는 전용 구현 PR이 나오기 전까지 `provider_not_implemented`로 즉시 실패(fail-fast)합니다.

Gemini Pro 계열 모델명은 쓰지 않습니다. 다음 변수 중 어디에든 Gemini Pro 계열 모델명이 들어오면 provider와 상관없이 `doctor:config` / runtime validation이 실패합니다 — `LLM_MODEL`, `GEMINI_MODEL`, `LLM_FALLBACK_MODELS`, `GEMINI_FALLBACK_MODELS`, `NEWSROOM_REPORTER_MODEL`, `NEWSROOM_EDITOR_MODEL`, `NEWSROOM_FACTCHECK_MODEL`, `NEWSROOM_REPAIR_MODEL`, `NEWSROOM_JUDGE_MODEL`.

## Variable

아래 값은 runtime config가 읽는 운영 설정입니다. provider/model 기본값은 GitHub Variables가 아니라 `DEFAULT_RUNTIME_CONFIG`에서 정해집니다.
Stage 1 workflow는 후보 수집 전에 `npm run doctor:config -- --no-llm-credentials`로 secret 없이 사전 점검(preflight)을 합니다. Stage 3 final generation은 LLM 생성 전에 `npm run doctor:config`로 runtime 설정을 검증합니다. 이 명령은 API key 값을 출력하지 않고, 설정이 됐는지 여부만 보여줍니다.

영어 변수명은 GitHub Actions와 코드가 읽는 계약이라 바꾸지 않습니다. 대신 뜻을 알아두면 됩니다. 예를 들어 `fallback model`은 기본 모델이 실패했을 때 쓰는 대체 모델, `quality gate`는 발행 안전 기준, `cost report`는 LLM 비용 리포트, `manual high-quality run`은 사람이 비용 증가를 승인하고 직접 시작하는 수동 고품질 실행을 뜻합니다.

| 이름 | 필수 | 현재 기본값 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- | --- |
| `GEMINI_MODEL` | 선택 | `gemini-2.5-flash` | `LLM_MODEL`이 없을 때 유지되는 Gemini model compatibility alias입니다. | 로컬 실행이나 legacy env에서 Gemini 모델을 명시해야 할 때만 사용합니다. 기본값 변경은 code default에서 합니다. | current scheduled Stage 1은 LLM을 실행하지 않으므로 기본 provider/model 변경 경로가 아닙니다. alias나 preview/latest 계열로 무심코 바꾸면 Stage 3 manual final generation의 결과 재현성과 운영 안정성이 떨어질 수 있습니다. |
| `GEMINI_FALLBACK_MODELS` | 선택 | `gemini-2.5-flash-lite` | `LLM_FALLBACK_MODELS`가 없을 때 유지되는 Gemini fallback compatibility alias입니다. | 로컬 실행이나 legacy env에서 Gemini fallback 순서를 명시해야 할 때만 사용합니다. 기본값 변경은 code default에서 합니다. | current scheduled Stage 1은 LLM을 실행하지 않으므로 기본 fallback 변경 경로가 아닙니다. Gemini Pro 계열 모델명은 validation error입니다. 너무 약한 모델은 JSON 품질이나 editorial 품질을 떨어뜨릴 수 있습니다. |
| `NEWSROOM_REPORTER_MODEL` | 선택 | `gemini-2.5-flash` | reporter 및 background-context stage의 primary model override입니다. | reporter JSON tagging이나 배경 설명 품질을 특정 모델로 검증해야 할 때만 변경합니다. | `LLM_MODEL` 또는 `GEMINI_MODEL`이 있으면 이 값은 무시됩니다. Gemini Pro 계열 모델명은 validation error입니다. |
| `NEWSROOM_EDITOR_MODEL` | 선택 | `gemini-3.5-flash` | editor stage의 primary model override입니다. | 최종 기사 표현 품질을 검증하기 위해 editor model만 조정해야 할 때 변경합니다. | editor가 더 좋은 문장을 써도 source binding, source gap, dated evidence, forbidden bucket gate를 우회할 수 없습니다. |
| `NEWSROOM_FACTCHECK_MODEL` | 선택 | `gemini-2.5-flash` | fact-check 및 fact-checker repair/completion stage의 primary model override입니다. | fact-check artifact가 명백한 source/evidence 문제를 놓친 경우에만 조정합니다. | fact-checker는 새 글 작성 stage가 아니라 structured violation detection stage입니다. deterministic validator가 최종 방어선입니다. |
| `NEWSROOM_REPAIR_MODEL` | 선택 | `gemini-3.5-flash` | semantic repair, editor repair, editor completion stage의 primary model override입니다. | repair가 좋은 draft를 보존하면서 실패 section만 보완해야 하는 경우 model을 비교 검증할 때 변경합니다. | repair는 source gap을 사실로 만들거나 품질 gate를 우회하는 단계가 아닙니다. 실패 artifact를 보존해야 합니다. |
| `NEWSROOM_JUDGE_MODEL` | 선택 | `gemini-2.5-flash-lite` | public article judge stage의 primary model override입니다. | `reader_checkpoints`와 public article prose가 source-bound이고 실행 가능한지 semantic judge model을 비교해야 할 때만 변경합니다. | judge는 글을 다시 쓰지 않고 판정만 합니다. deterministic source binding, source gap, dated evidence, forbidden bucket gate를 우회할 수 없습니다. |
| `GEMINI_MAX_RETRIES` | 선택 | `2` | retryable API failure 또는 invalid JSON model output에 대해 모델별로 재시도할 횟수입니다. | 일시적인 API 오류가 잦아졌고 artifact를 보며 재시도가 실질적으로 복구에 도움이 된다고 판단할 때 변경합니다. | 값을 높이면 workflow 시간이 길어지고 quota/cost 사용량이 늘어납니다. 품질 실패를 숨기는 용도로 쓰면 안 됩니다. |
| `GEMINI_RETRY_DELAYS_MS` | 선택 | `20000,10000` | Gemini가 retry hint를 주지 않을 때 사용할 fallback retry delay 목록입니다. | 일시 장애가 짧거나 길게 반복되는 패턴을 보고 간격을 조정할 때 변경합니다. | 너무 짧으면 같은 장애를 빠르게 반복하고, 너무 길면 PR 생성이 늦어집니다. |
| `GEMINI_RETRY_MAX_DELAY_MS` | 선택 | `300000` | 서버가 긴 retry hint를 줄 때 허용하는 최대 대기 시간입니다. 300000ms는 5분입니다. | quota pressure가 강하지만 기다리면 복구되는 상황이 반복될 때 변경합니다. | 값을 높이면 workflow가 오래 붙잡힙니다. 값을 낮추면 회복 가능한 API 제한도 실패로 끝날 수 있습니다. |
| `GEMINI_CALL_TIMEOUT_MS` | 선택 | `240000` | 단일 LLM 호출의 wall-clock 상한입니다. 초과하면 그 모델 호출을 포기하고 다음 fallback model로 넘어갑니다. 240000ms는 4분이며 `0`이면 비활성화합니다. | 특정 모델이 응답 없이 멈춰(hang) run 전체가 지연되는 패턴이 보일 때 조정합니다. | 너무 짧으면 정상적인 느린 호출까지 중단시켜 통과율이 떨어집니다. timeout은 호출 상한만 추가할 뿐 품질 gate를 약화하지 않습니다. |
| `GEMINI_THINKING_BUDGET_REPORTER` | 선택 | `0` | reporter stage의 Gemini thinking budget입니다. | reporter JSON tagging 품질에 문제가 있다는 artifact가 있을 때만 조정합니다. | 값을 높이면 thinking token 비용이 늘어납니다. |
| `GEMINI_THINKING_BUDGET_EDITOR` | 선택 | `1024` | editor 및 completion stage의 Gemini thinking budget입니다. | editor 품질 저하가 확인됐고 prompt/capsule 품질 문제가 아닌 경우 추가로 조정할 수 있습니다. | Stage 3 manual final generation 비용을 보려면 먼저 cost report의 thinking tokens를 확인합니다. |
| `GEMINI_THINKING_BUDGET_REPAIR` | 선택 | `0` | section repair stage의 Gemini thinking budget입니다. | repair가 반복적으로 JSON은 맞지만 품질 개선에 실패하는 경우에만 조정합니다. | source gap은 thinking budget을 높여도 rewrite로 통과시키면 안 됩니다. |
| `GEMINI_THINKING_BUDGET_FACTCHECK` | 선택 | `1024` | fact-check stage의 Gemini thinking budget입니다. multi-criteria reasoning이 필요한 사실 검증 단계에서 false negative를 줄이기 위해 기본 활성화됩니다. | 비용 절감이 필요하면 `0`으로 낮출 수 있으나 deterministic quality gate가 최종 방어선임을 확인하고 조정합니다. | 값을 높여도 deterministic quality gate를 대체하지 않습니다. |
| `GEMINI_THINKING_BUDGET_JUDGE` | 선택 | `1024` | public article judge stage의 Gemini thinking budget입니다. publication-ready 판정은 multi-criteria reasoning이 필요해 기본 활성화됩니다. | 비용이 예상을 초과하면 `0`으로 낮춰 env override로 즉시 조정할 수 있습니다. | 기본 judge는 Flash Lite 비용 모델이므로 thinking budget 조정 전 cost report의 thinking_tokens를 먼저 확인합니다. |
| `GEMINI_THINKING_BUDGET_SCORING` | 선택 | `0` | Gemini scoring 성격의 stage가 추가될 때 사용할 기본 thinking budget입니다. 현재 main scoring은 deterministic code가 수행합니다. | 향후 보조 scoring 호출을 도입한 경우에만 조정합니다. | PR6에서는 deterministic scoring 동작을 변경하지 않습니다. |
| `GEMINI_TEMPERATURE_DEFAULT` | 선택 | `0.35` | 매핑되지 않은 stage의 기본 Gemini temperature입니다. | 알려지지 않은 stage에서 temperature를 조정해야 할 때 변경합니다. | 0 이상 2 이하여야 합니다. |
| `GEMINI_TEMPERATURE_SOURCE_DISCOVERY` | 선택 | `0.45` | source discovery stage의 Gemini temperature입니다. | source discovery 제안 다양성을 조정해야 할 때 변경합니다. | 0 이상 2 이하여야 합니다. |
| `GEMINI_TEMPERATURE_REPORTER` | 선택 | `0.30` | reporter stage의 Gemini temperature입니다. | reporter JSON tagging의 표현 일관성이 필요할 때 낮추거나, 다양성이 필요할 때 높입니다. | 0 이상 2 이하여야 합니다. |
| `GEMINI_TEMPERATURE_EDITOR` | 선택 | `0.55` | editor 및 completion stage의 Gemini temperature입니다. | 한국어 newsletter 본문 표현 다양성을 조정해야 할 때 변경합니다. | 0 이상 2 이하여야 합니다. |
| `GEMINI_TEMPERATURE_FACTCHECK` | 선택 | `0.20` | fact-check stage의 Gemini temperature입니다. 낮은 값으로 결정론적 위반 탐지에 집중합니다. | fact-check 탐지 정확도 조정이 필요할 때만 변경합니다. | 0 이상 2 이하여야 합니다. deterministic quality gate가 최종 방어선입니다. |
| `GEMINI_TEMPERATURE_REPAIR` | 선택 | `0.25` | semantic repair stage의 Gemini temperature입니다. | repair가 동일 실패를 반복할 때 소폭 높여볼 수 있습니다. | 0 이상 2 이하여야 합니다. source gap은 repair로 통과시키면 안 됩니다. |
| `GEMINI_TEMPERATURE_JUDGE` | 선택 | `0.20` | public article judge stage의 Gemini temperature입니다. 낮은 값으로 판정 일관성을 높입니다. | semantic judge 판정이 불안정할 때만 조정합니다. | 0 이상 2 이하여야 합니다. deterministic publish gate를 우회할 수 없습니다. |
| `NEWSROOM_MAX_QUALITY_RETRIES` | 선택 | `1` | quality gate(품질 통과 기준)를 통과하지 못한 draft에 대해 Gemini가 다시 작성할 최대 횟수입니다. Gemini quality repair retry는 기본 1회 실행됩니다. | 품질 retry artifact를 검토한 결과 추가 시도가 실제로 source gap이나 composition blocker를 줄인다고 확인됐을 때 변경합니다. | 값을 높여도 source 자체가 부족하면 해결되지 않습니다. Quality threshold는 `src/shared/config/newsletter-policy.json`의 `qualityGatePolicy.threshold`가 source of truth이며 validation을 우회하거나 hard blocker를 통과시키는 방식으로 쓰면 안 됩니다. |
| `NEWSROOM_MAX_SECTION_REPAIRS` | 선택 | `1` | quality retry 한 번에서 repair 또는 replace를 요청할 section 수를 제한합니다. 기본값은 실패 section 1개만 고칩니다. | 특정 주차에서 여러 독립 section이 같은 원인으로 실패했고 artifact 검토 후 추가 repair가 비용 대비 유효하다고 판단될 때 변경합니다. | 값을 높이면 LLM prompt와 비용이 늘어납니다. source gap article은 rewrite로 통과시키지 말고 demote 또는 replace해야 합니다. |
| `NEWSROOM_WARN_COST_USD` | 선택 | `0.15` | Gemini usage metadata 기반 추정 비용이 이 값을 넘으면 workflow log와 cost report(비용 리포트)에 warning을 남깁니다. | 실제 생성 비용을 관찰하면서 알림 기준을 조정할 때 변경합니다. | 현재 운영 기준 warning-only입니다. 값을 낮게 잡아도 생성이나 발행 gate를 실패시키지 않습니다. |
| `NEWSROOM_MAX_COST_USD` | 선택 | `0.25` | Gemini usage metadata 기반 추정 비용의 운영 상한 참고값입니다. | 실제 비용 분포를 보고 hard gate 전환 여부를 검토할 때 변경합니다. | 현재 운영 기준 초과해도 실패하지 않고 warning만 남깁니다. 품질 gate나 publish readiness와 독립입니다. |
| `NEWSROOM_LINKED_EVIDENCE_MODE` | 선택 | `extract_only` | linked evidence resolver mode입니다. `extract_only`, `resolve_allowed_official_links`, `offline_fixture_test`만 허용합니다. | 공식 source link resolve를 제한적으로 실험할 때만 `resolve_allowed_official_links`로 변경합니다. fixture test는 injected fetch client가 있는 테스트에서만 사용합니다. | 기본값은 network-off입니다. 이 값을 바꿔도 Event Bundle, scoring boost, publish gate 우회가 활성화되면 안 됩니다. |
| `NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE` | 선택 | `8` | candidate 하나에서 network resolve를 시도할 최대 linked evidence 수입니다. | 공식 링크가 많은 source에서 diagnostic 비용과 시간을 제한해야 할 때 조정합니다. | 초과 링크는 실패가 아니라 `skipped` diagnostics로 남습니다. 값을 높이면 workflow 시간이 길어질 수 있습니다. |
| `NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN` | 선택 | `40` | newsroom run 전체에서 network resolve를 시도할 최대 linked evidence 수입니다. | 한 주차에 candidate가 많아 resolve 시도가 과도할 때 상한을 조정합니다. | 초과 링크는 fetch하지 않습니다. publication score나 HAL impact를 추정하는 근거로 쓰면 안 됩니다. |
| `NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS` | 선택 | `5000` | linked evidence 한 건의 fetch timeout입니다. | 공식 source가 느리지만 diagnostics 가치가 확인됐을 때만 조정합니다. | timeout은 non-fatal diagnostics입니다. 값을 높이면 CI 대기 시간이 증가합니다. |
| `NEWSROOM_LINKED_EVIDENCE_MAX_BYTES` | 선택 | `200000` | linked evidence response에서 읽고 분석할 최대 byte 수입니다. | 공식 release/docs page가 구조적으로 크고 capped excerpt만으로 부족할 때 조정합니다. | 초과 response는 resolved content로 사용하지 않고 `skipped` diagnostics로만 남깁니다. raw HTML full body를 artifact로 저장하지 않습니다. |
| `NEWSROOM_CANDIDATE_INPUT_MODE` | 선택 | `default` | Final Generation이 candidate를 읽는 mode입니다. 새 Stage 3 workflow에서는 `artifact`로 설정해 approved candidate artifact만 사용합니다. | `Newsletters 03 - Editor PR` (`.github/workflows/03-newsletters-editor-pr.yml`)에서 RAW/merged artifact replay를 실행할 때만 `artifact`를 사용합니다. | `artifact` mode에서는 manifest hash와 `llm_used=false` 계약을 검증합니다. 실패하면 generation을 진행하지 않습니다. |
| `NEWSROOM_CANDIDATE_INPUT_PATH` | 선택 | empty | Stage 3에서 명시적으로 읽을 approved candidate artifact path입니다. 허용 값은 해당 날짜의 `manual-candidates.json` 또는 `merged-candidates.json`뿐입니다. 비워 두면 `merged-candidates.json`, `manual-candidates.json`, legacy `candidates.json` 순서로 선택합니다. | 특정 RAW 또는 merged artifact를 재실행해야 할 때만 internal/backcompat 경로로 지정합니다. Stage 3 workflow input으로는 더 이상 노출하지 않고, 비워 두면 자동 fallback이 동작합니다. Legacy `candidates.json`는 explicit path로 지정하지 않고 automatic transition fallback으로만 사용합니다. | repository 밖 path, 임의 JSON, manifest missing/mismatch는 실패합니다. `manual-candidates.json`은 `llm_used=false`, Stage 2 enabled `merged-candidates.json`은 manifest v2의 `llm_used=true`도 허용합니다. failed Stage 2 report 또는 `gemini-candidates.json`만으로는 generation input이 될 수 없습니다. |
| `NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY` | 선택 | `false` | Stage 2 Optional Gemini Source Discovery engine을 켤지 결정합니다. `false`에서는 LLM credential 없이 disabled pass-through만 실행합니다. | Stage 2 source discovery workflow는 이 값을 `true`로 고정 실행하므로 별도 toggle input이 없습니다. `false` disabled pass-through는 code-level/backcompat 경로로만 남습니다. | `true`에서는 selected LLM provider credential이 필요하며, Gemini proposal은 candidate가 아닙니다. deterministic fetch/normalize/schema validation을 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영합니다. |

## Tradeoff 검토 기준

- 비용: retry 횟수, fallback 모델 수, thinking budget이 늘수록 Stage 3 manual final generation 비용이 커질 수 있습니다. Gemini Pro 계열 모델명은 운영 경로에서 validation error로 차단됩니다.
- 품질: 더 강한 모델이나 quality retry는 품질을 올릴 수 있지만, source gap(근거 부족)이 있는 후보를 사실로 만들 수는 없습니다.
- 시간: retry delay와 retry 횟수가 늘수록 PR 생성 시간이 길어집니다.

검증을 낮춰서 통과시키지 마세요. `npm run validate`는 잘못된 발행(publication risk)을 막는 gate입니다. 실패하면 artifact를 보고 원인을 찾아 source, draft, image fallback, workflow 상태를 고쳐야 합니다.
