# GitHub Actions Secret과 Variable

설정 위치는 `GitHub repository -> Settings -> Secrets and variables -> Actions`입니다.

Secret과 Variable은 분리해서 관리합니다. Secret은 로그, commit, PR 본문, GitHub Variables에 넣지 않습니다.

## Secret

| 이름 | 필수 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | 필수 | Gemini newsroom pipeline이 Gemini API를 호출할 때 쓰는 API key입니다. | key를 rotate하거나 권한이 다른 key로 교체할 때만 변경합니다. | 절대 commit, workflow log, artifact, GitHub Variables에 남기지 않습니다. 노출되면 즉시 폐기하고 새 key를 발급합니다. |

## Variable

아래 값은 `.github/workflows/01-weekly-newsroom-pr.yml`의 현재 기본값입니다. GitHub Variables에 값을 넣지 않으면 workflow가 이 기본값을 사용합니다.
workflow는 후보 수집과 Gemini 생성 전에 `npm run doctor:config`로 runtime 설정을 검증합니다. 이 명령은 `GEMINI_API_KEY` 값을 출력하지 않고 설정 여부만 표시합니다.

영어 변수명은 GitHub Actions와 코드가 읽는 계약이므로 바꾸지 않습니다. 대신 의미를 함께 읽어야 합니다. 예를 들어 `fallback model`은 기본 모델 실패 시 쓰는 대체 모델, `quality gate`는 발행 안전 기준, `cost report`는 Gemini 비용 리포트, `manual high-quality run`은 사람이 비용 증가를 승인하고 직접 시작하는 수동 고품질 실행을 뜻합니다.

| 이름 | 필수 | 현재 기본값 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- | --- |
| `GEMINI_MODEL` | 선택 | `gemini-2.5-flash` | 기본 Gemini reporter/editor/fact-checker 호출 모델입니다. | Flash 모델 품질이나 quota 특성이 바뀌어 명시 모델을 바꿔야 할 때 변경합니다. | alias나 preview/latest 계열로 무심코 바꾸면 결과 재현성과 운영 안정성이 떨어질 수 있습니다. |
| `GEMINI_FALLBACK_MODELS` | 선택 | `gemini-2.5-flash-lite` | 기본 모델 실패 시 순서대로 시도할 fallback model(대체 모델) 목록입니다. | quota, 비용, 품질 특성에 맞춰 fallback 순서를 조정할 때 변경합니다. | scheduled run(예약 자동 실행)에서는 Pro 계열을 자동 fallback으로 두지 않습니다. Pro는 manual escalation(수동 승격)으로만 허용합니다. 너무 약한 모델은 JSON 품질이나 editorial 품질을 떨어뜨릴 수 있습니다. |
| `GEMINI_MAX_RETRIES` | 선택 | `2` | retryable API failure 또는 invalid JSON model output에 대해 모델별로 재시도할 횟수입니다. | 일시적인 API 오류가 잦아졌고 artifact를 보며 재시도가 실질적으로 복구에 도움이 된다고 판단할 때 변경합니다. | 값을 높이면 workflow 시간이 길어지고 quota/cost 사용량이 늘어납니다. 품질 실패를 숨기는 용도로 쓰면 안 됩니다. |
| `GEMINI_RETRY_DELAYS_MS` | 선택 | `20000,10000` | Gemini가 retry hint를 주지 않을 때 사용할 fallback retry delay 목록입니다. | 일시 장애가 짧거나 길게 반복되는 패턴을 보고 간격을 조정할 때 변경합니다. | 너무 짧으면 같은 장애를 빠르게 반복하고, 너무 길면 PR 생성이 늦어집니다. |
| `GEMINI_RETRY_MAX_DELAY_MS` | 선택 | `300000` | 서버가 긴 retry hint를 줄 때 허용하는 최대 대기 시간입니다. 300000ms는 5분입니다. | quota pressure가 강하지만 기다리면 복구되는 상황이 반복될 때 변경합니다. | 값을 높이면 workflow가 오래 붙잡힙니다. 값을 낮추면 회복 가능한 API 제한도 실패로 끝날 수 있습니다. |
| `GEMINI_THINKING_BUDGET_REPORTER` | 선택 | `0` | reporter stage의 Gemini thinking budget입니다. | reporter JSON tagging 품질에 문제가 있다는 artifact가 있을 때만 조정합니다. | 값을 높이면 thinking token 비용이 늘어납니다. |
| `GEMINI_THINKING_BUDGET_EDITOR` | 선택 | `512` | editor 및 completion stage의 Gemini thinking budget입니다. | editor 품질 저하가 확인됐고 prompt/capsule 품질 문제가 아닌 경우 `1024`까지 실험할 수 있습니다. | scheduled run 기본 비용을 보려면 먼저 cost report의 thinking tokens를 확인합니다. |
| `GEMINI_THINKING_BUDGET_REPAIR` | 선택 | `0` | section repair stage의 Gemini thinking budget입니다. | repair가 반복적으로 JSON은 맞지만 품질 개선에 실패하는 경우에만 조정합니다. | source gap은 thinking budget을 높여도 rewrite로 통과시키면 안 됩니다. |
| `GEMINI_THINKING_BUDGET_FACTCHECK` | 선택 | `0` | fact-check stage의 Gemini thinking budget입니다. | fact-check가 명백한 source/evidence 문제를 놓친 artifact가 있을 때만 조정합니다. | 값을 높여도 deterministic quality gate를 대체하지 않습니다. |
| `GEMINI_THINKING_BUDGET_SCORING` | 선택 | `0` | Gemini scoring 성격의 stage가 추가될 때 사용할 기본 thinking budget입니다. 현재 main scoring은 deterministic code가 수행합니다. | 향후 보조 scoring 호출을 도입한 경우에만 조정합니다. | PR6에서는 deterministic scoring 동작을 변경하지 않습니다. |
| `NEWSROOM_MAX_QUALITY_RETRIES` | 선택 | `1` | quality gate(품질 통과 기준)를 통과하지 못한 draft에 대해 Gemini가 다시 작성할 최대 횟수입니다. Gemini quality repair retry는 기본 1회 실행됩니다. | 품질 retry artifact를 검토한 결과 추가 시도가 실제로 source gap이나 composition blocker를 줄인다고 확인됐을 때 변경합니다. | 값을 높여도 source 자체가 부족하면 해결되지 않습니다. Quality threshold: 85는 운영 튜닝이며 validation을 우회하거나 hard blocker를 통과시키는 방식으로 쓰면 안 됩니다. |
| `NEWSROOM_MAX_SECTION_REPAIRS` | 선택 | `1` | quality retry 한 번에서 repair 또는 replace를 요청할 section 수를 제한합니다. 기본값은 실패 section 1개만 고칩니다. | 특정 주차에서 여러 독립 section이 같은 원인으로 실패했고 artifact 검토 후 추가 repair가 비용 대비 유효하다고 판단될 때 변경합니다. | 값을 높이면 Gemini prompt와 비용이 늘어납니다. source gap article은 rewrite로 통과시키지 말고 demote 또는 replace해야 합니다. |
| `NEWSROOM_WARN_COST_USD` | 선택 | `0.15` | Gemini usage metadata 기반 추정 비용이 이 값을 넘으면 workflow log와 cost report(비용 리포트)에 warning을 남깁니다. | 실제 생성 비용을 관찰하면서 알림 기준을 조정할 때 변경합니다. | 현재 운영 기준 warning-only입니다. 값을 낮게 잡아도 생성이나 발행 gate를 실패시키지 않습니다. |
| `NEWSROOM_MAX_COST_USD` | 선택 | `0.25` | Gemini usage metadata 기반 추정 비용의 운영 상한 참고값입니다. | 실제 비용 분포를 보고 hard gate 전환 여부를 검토할 때 변경합니다. | 현재 운영 기준 초과해도 실패하지 않고 warning만 남깁니다. 품질 gate나 publish readiness와 독립입니다. |
| `NEWSROOM_ALLOW_PRO_ON_SCHEDULE` | 선택 | `false` | scheduled run(예약 자동 실행)에서 Pro 계열 모델 사용을 허용할지 결정합니다. | 긴급 운영 실험이 필요하고 비용 증가를 명시적으로 감수할 때만 변경합니다. | 기본값을 `true`로 두면 scheduled run 비용이 예기치 않게 커질 수 있습니다. |
| `NEWSROOM_ALLOW_PRO_ON_MANUAL` | 선택 | `false` | manual `workflow_dispatch` 실행에서 Pro 계열 모델 사용을 허용할지 결정합니다. workflow 입력 `allow_pro=true`가 이 값을 설정합니다. | 편집자가 manual high-quality run(수동 고품질 실행)에서 Pro 비용을 명시적으로 승인했을 때만 `true`가 됩니다. | manual 실행에서도 명시 허용 없이는 Pro를 사용할 수 없습니다. |
| `NEWSROOM_PRO_ESCALATION` | 선택 | `manual` | Pro 사용 정책을 cost report와 log에 표시하기 위한 escalation label입니다. | 운영 정책 이름을 문서화해야 할 때 변경합니다. | 정책 표시용 값이며, Pro 허용 여부는 `NEWSROOM_ALLOW_PRO_ON_*` 값과 workflow event로 결정됩니다. |

## Tradeoff 검토 기준

- 비용: retry 횟수, fallback 모델 수, Pro 계열 모델 사용이 늘수록 비용이 증가할 수 있습니다. scheduled run의 기본 fallback은 Flash-Lite까지만 허용합니다.
- 품질: 더 강한 모델이나 quality retry는 품질을 올릴 수 있지만, source gap이 있는 후보를 사실로 만들 수는 없습니다.
- 시간: retry delay와 retry 횟수가 늘수록 PR 생성 시간이 길어집니다.

검증을 낮춰 통과시키지 마십시오. `npm run validate`는 publication risk를 막는 gate이며, 실패 원인은 artifact를 보고 source, draft, image fallback, workflow 상태를 고쳐야 합니다.
