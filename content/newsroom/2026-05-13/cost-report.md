# LLM cost report - 2026-05-13

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 3
- Prompt tokens: 31534
- Output tokens: 11828
- Thinking tokens: 465
- Cached tokens: 0
- Total tokens: 43827
- Estimated cost USD: 0.032398

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash-lite | 1 | 11399 | 2626 | 0 | 0 | 0 | 0 | no | 0.002190 |
| gemini | background-context attempt 1/2 | gemini-2.5-flash | 2 | 9014 | 1180 | 0 | 0 | 0 | 0 | no | 0.005654 |
| gemini | editor attempt 1/2 | gemini-2.5-flash | 1 | 11121 | 8022 | 465 | 512 | 512 | 0 | no | 0.024554 |

## Warnings

- none
