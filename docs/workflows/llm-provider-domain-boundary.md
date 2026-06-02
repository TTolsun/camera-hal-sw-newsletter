# LLM provider와 Newsletter domain boundary

이 문서는 newsroom 생성 단계에서 외부 LLM provider 응답을 어디까지 허용하고, 내부 `NewsletterIssue` domain model로 언제 변환해야 하는지 설명합니다.

## Provider 선택 계약

Workflow dispatch input 이름은 기존 공개 계약인 `llm_provider`를 유지합니다. 이슈 초안의 `llm_api_provider`는 예시 이름이며, 실제 workflow, docs, tests는 `llm_provider`만 사용합니다.

지원 값은 다음입니다.

| 값 | 의미 |
| --- | --- |
| `default` 또는 빈 값 | code default provider인 `gemini`로 해석합니다. |
| `gemini` | 현재 production provider입니다. |
| `internal` | 사내 LLM provider입니다. |
| `openapi` | 예약 enum입니다. 전용 구현 PR 전에는 `provider_not_implemented`로 fail-fast합니다. |

`openapi`는 이 경계 작업에서 HTTP client를 구현하지 않습니다. `OPENAPI_LLM_API_KEY`, `OPENAPI_LLM_ENDPOINT`, request body schema, retry/backoff, response parser는 별도 provider 구현 PR에서 정의합니다.

## Workflow inventory

- Stage 1 `01-newsletters-source-collect-pr.yml`은 source collection만 수행하므로 `llm_provider` selector를 두지 않습니다.
- Stage 2 `02-newsletters-source-discovery-pr.yml`은 optional LLM source discovery path가 있으므로 `llm_provider` selector를 둡니다.
- Stage 3 `03-newsletters-editor-pr.yml`은 final generation path가 있으므로 `llm_provider` selector를 둡니다.

Workflow YAML은 provider 기본값을 소유하지 않습니다. `default`는 runtime config의 code default로 normalize됩니다.

## Domain model boundary

Provider raw response는 아래 경로 안에서만 읽습니다.

```text
scripts/newsroom/llm/**
scripts/newsroom/adapters/llm/**
tests/**/llm-response/**
docs/workflows/llm-provider-domain-boundary.md
```

그 밖의 renderer, validator, PR body, publication status 코드는 provider raw response shape가 아니라 정규화된 `NewsletterIssue`를 읽어야 합니다.

현재 domain model의 주요 객체는 다음입니다.

- `NewsletterIssue`
- `NewsletterArticle`
- `SourceRef`
- `ArticleActionItem`

`NewsletterArticle`은 #185 seed evidence workflow에서 온 `compactEvidence`, `evidencePackIds`, `primaryEvidenceIds`, `linkedEvidenceIds`, `sourceExtractionRef`, `seedUsed`, `mergeMode`를 수용합니다.

## Editor draft artifact

새 `editor-draft.json`은 도메인 중심 artifact입니다.

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

전환 기간에는 레거시 reader 호환을 위해 최상위 `sections` alias를 함께 보존할 수 있습니다. 하위 코드는 `toLegacyEditorIssue()` 또는 `normalizeNewsletterIssue()`를 통해 읽고, provider raw field를 직접 읽지 않습니다.

## Generation status failure class

`generation-status.json`과 `.tmp/newsletter-generation-status.json`은 기존 `failure_stage`, `failure_reason`, `failure_kind`에 더해 provider/domain boundary 원인을 구분하는 `failure_class`를 가질 수 있습니다.

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

Raw response leak guard는 provider 이름이 아니라 raw shape marker를 검사합니다. 금지 marker는 `candidates[0].content.parts`, `choices[0].message.content`, `output_json`, `rawResponse`, `providerResponse`, `geminiResponse`, `openapiResponse`입니다.
