# GitHub Actions Secret과 Variable

설정 위치는 `GitHub repository -> Settings -> Secrets and variables -> Actions`입니다.

Secret과 Variable은 분리해서 관리합니다. Secret은 로그, commit, PR 본문, GitHub Variables에 넣지 않습니다.

## Secret

| 이름 | 필수 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | 필수 | Gemini newsroom pipeline이 Gemini API를 호출할 때 쓰는 API key입니다. | key를 rotate하거나 권한이 다른 key로 교체할 때만 변경합니다. | 절대 commit, workflow log, artifact, GitHub Variables에 남기지 않습니다. 노출되면 즉시 폐기하고 새 key를 발급합니다. |

## Variable

아래 값은 `.github/workflows/weekly-newsroom-pr.yml`의 현재 기본값입니다. GitHub Variables에 값을 넣지 않으면 workflow가 이 기본값을 사용합니다.
workflow는 후보 수집과 Gemini 생성 전에 `npm run doctor:config`로 runtime 설정을 검증합니다. 이 명령은 `GEMINI_API_KEY` 값을 출력하지 않고 설정 여부만 표시합니다.

| 이름 | 필수 | 현재 기본값 | 의미 | 변경해도 되는 상황 | 위험/주의 |
| --- | --- | --- | --- | --- | --- |
| `GEMINI_MODEL` | 선택 | `gemini-2.5-flash` | 기본 Gemini reporter/editor/fact-checker 호출 모델입니다. | Flash 모델 품질이나 quota 특성이 바뀌어 명시 모델을 바꿔야 할 때 변경합니다. | alias나 preview/latest 계열로 무심코 바꾸면 결과 재현성과 운영 안정성이 떨어질 수 있습니다. |
| `GEMINI_FALLBACK_MODELS` | 선택 | `gemini-2.5-flash-lite,gemini-2.5-pro` | 기본 모델 실패 시 순서대로 시도할 fallback 모델 목록입니다. | quota, 비용, 품질 특성에 맞춰 fallback 순서를 조정할 때 변경합니다. | Pro 계열은 비용과 지연 시간이 커질 수 있고, 너무 약한 모델은 JSON 품질이나 editorial 품질을 떨어뜨릴 수 있습니다. |
| `GEMINI_MAX_RETRIES` | 선택 | `2` | retryable API failure 또는 invalid JSON model output에 대해 모델별로 재시도할 횟수입니다. | 일시적인 API 오류가 잦아졌고 artifact를 보며 재시도가 실질적으로 복구에 도움이 된다고 판단할 때 변경합니다. | 값을 높이면 workflow 시간이 길어지고 quota/cost 사용량이 늘어납니다. 품질 실패를 숨기는 용도로 쓰면 안 됩니다. |
| `GEMINI_RETRY_DELAYS_MS` | 선택 | `20000,10000` | Gemini가 retry hint를 주지 않을 때 사용할 fallback retry delay 목록입니다. | 일시 장애가 짧거나 길게 반복되는 패턴을 보고 간격을 조정할 때 변경합니다. | 너무 짧으면 같은 장애를 빠르게 반복하고, 너무 길면 PR 생성이 늦어집니다. |
| `GEMINI_RETRY_MAX_DELAY_MS` | 선택 | `300000` | 서버가 긴 retry hint를 줄 때 허용하는 최대 대기 시간입니다. 300000ms는 5분입니다. | quota pressure가 강하지만 기다리면 복구되는 상황이 반복될 때 변경합니다. | 값을 높이면 workflow가 오래 붙잡힙니다. 값을 낮추면 회복 가능한 API 제한도 실패로 끝날 수 있습니다. |
| `NEWSROOM_MAX_QUALITY_RETRIES` | 선택 | `1` | quality gate를 통과하지 못한 draft에 대해 Gemini가 다시 작성할 최대 횟수입니다. Gemini quality repair retry는 기본 1회 실행됩니다. | 품질 retry artifact를 검토한 결과 추가 시도가 실제로 source gap이나 composition blocker를 줄인다고 확인됐을 때 변경합니다. | 값을 높여도 source 자체가 부족하면 해결되지 않습니다. Quality threshold: 85는 운영 튜닝이며 validation을 우회하거나 hard blocker를 통과시키는 방식으로 쓰면 안 됩니다. |

## Tradeoff 검토 기준

- 비용: retry 횟수, fallback 모델 수, Pro 계열 모델 사용이 늘수록 비용이 증가할 수 있습니다.
- 품질: 더 강한 모델이나 quality retry는 품질을 올릴 수 있지만, source gap이 있는 후보를 사실로 만들 수는 없습니다.
- 시간: retry delay와 retry 횟수가 늘수록 PR 생성 시간이 길어집니다.

검증을 낮춰 통과시키지 마십시오. `npm run validate`는 publication risk를 막는 gate이며, 실패 원인은 artifact를 보고 source, draft, image fallback, workflow 상태를 고쳐야 합니다.
