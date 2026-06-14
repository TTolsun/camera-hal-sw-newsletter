# LLM provider와 Newsletter domain boundary

이 문서가 정하는 경계는 한 가지입니다. newsroom 생성 단계에서 외부 LLM provider의 raw 응답을 "어디까지" 코드가 직접 읽어도 되고, "언제" 내부 domain model인 `NewsletterIssue`로 변환해야 하는가입니다. 핵심은 provider 응답 형식이 코드 전반으로 새어 나가지 않도록 막는 것입니다.

## Provider 선택 계약

Workflow dispatch input의 이름은 기존 공개 계약대로 `llm_provider`를 그대로 씁니다. 이슈 초안에 나오는 `llm_api_provider`는 예시 이름일 뿐이며, 실제 workflow, docs, tests는 모두 `llm_provider`만 사용합니다.

`llm_provider`가 받을 수 있는 값은 다음과 같습니다.

| 값 | 의미 |
| --- | --- |
| `default` 또는 빈 값 | code default provider인 `gemini`로 해석합니다. |
| `gemini` | 현재 production provider입니다. |
| `internal` | 사내 LLM provider입니다. |
| `openapi` | 예약 enum입니다. 전용 구현 PR 전에는 `provider_not_implemented`로 fail-fast합니다. |

`openapi`는 이 경계 작업 범위에서는 HTTP client를 구현하지 않습니다. `OPENAPI_LLM_API_KEY`, `OPENAPI_LLM_ENDPOINT`, request body schema, retry/backoff, response parser 같은 세부 사항은 별도의 provider 구현 PR에서 정의합니다.

## Workflow inventory

어느 stage가 `llm_provider` selector를 갖는지 정리합니다.

- Stage 1 `01-newsletters-source-collect-pr.yml`: source collection만 하므로 `llm_provider` selector가 없습니다.
- Stage 2 `02-newsletters-source-discovery-pr.yml`: optional LLM source discovery path가 있으므로 selector를 둡니다.
- Stage 3 `03-newsletters-editor-pr.yml`: final generation path가 있으므로 selector를 둡니다.

Workflow YAML은 provider 기본값을 직접 정하지 않습니다. `default` 값은 runtime config의 code default로 normalize(정규화)됩니다.

## Domain model boundary

provider의 raw response는 아래 경로 안에서만 읽을 수 있습니다. 그 밖의 코드는 절대 raw 응답을 직접 읽지 않습니다.

```text
src/shared/llm/**
src/shared/adapters/llm/**
src/shared/test/**/llm-response/
src/generator/test/**/llm-response/
docs/workflows/llm-provider-domain-boundary.md
```

즉 renderer, validator, PR body, publication status 코드는 provider raw response shape가 아니라, 정규화된 `NewsletterIssue`만 읽어야 합니다.

현재 domain model의 주요 객체는 다음과 같습니다.

- `NewsletterIssue`
- `NewsletterArticle`
- `SourceRef`
- `ArticleActionItem`

`NewsletterArticle`은 #185 seed evidence workflow에서 추가된 다음 field도 수용합니다: `compactEvidence`, `evidencePackIds`, `primaryEvidenceIds`, `linkedEvidenceIds`, `sourceExtractionRef`, `seedUsed`, `mergeMode`.

## Editor draft artifact

새 `editor-draft.json`은 provider 형식이 아니라 domain model을 중심에 둔 artifact입니다.

```json
{
  "schemaVersion": 1,
  "newsletterDate": "YYYY-MM-DD",
  "model": {
    "provider": "gemini",
    "providerModel": "unknown"
  },
  "issue": {
    "schemaVersion": 1,
    "newsletterDate": "YYYY-MM-DD",
    "articles": []
  },
  "adapterDiagnostics": {
    "warnings": [],
    "repairedFields": [],
    "droppedFields": [],
    "rawResponseStored": false
  }
}
```

전환 기간에는 레거시 reader 호환을 위해 최상위 `sections` alias를 함께 둘 수 있습니다. 하위 코드는 `toLegacyEditorIssue()`나 `normalizeNewsletterIssue()`를 거쳐 읽고, provider raw field를 직접 읽지 않습니다.

## Generation status failure class

`generation-status.json`과 `.tmp/newsletter-generation-status.json`은 기존 `failure_stage`, `failure_reason`, `failure_kind`에 더해, 실패 원인이 provider/domain 경계의 어느 쪽인지 구분하는 `failure_class`를 가질 수 있습니다.

| 값 | 의미 |
| --- | --- |
| `provider_failure` | provider 호출, provider 설정, 예약 provider fail-fast 실패입니다. |
| `adapter_failure` | provider 응답을 JSON/domain 입력으로 변환하는 단계의 실패입니다. |
| `domain_validation_failure` | 정규화된 `NewsletterIssue`가 domain validator를 통과하지 못한 실패입니다. |

## Validation severity

| 조건 | 심각도 |
| --- | --- |
| source URL 누락 또는 잘못된 URL | `error` |
| required article field 누락 | `error` |
| optional image 누락 | `warning` |
| 레거시 field repair | `warning` |
| provider raw field drop | `warning` |

Raw response leak guard(누출 감시)는 provider 이름이 아니라 raw shape marker(원시 응답 형태의 흔적)를 검사합니다. 즉 응답이 어느 provider 것인지가 아니라, 정규화되지 않은 형태가 남아 있는지를 봅니다. 금지 marker는 다음과 같습니다: `candidates[0].content.parts`, `choices[0].message.content`, `output_json`, `rawResponse`, `providerResponse`, `geminiResponse`, `openapiResponse`.
