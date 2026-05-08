# LLM cost report - 2026-05-09

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 4
- Prompt tokens: 64259
- Output tokens: 15053
- Thinking tokens: 484
- Cached tokens: 0
- Total tokens: 79796
- Estimated cost USD: 0.058120

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash | 1 | 15902 | 6322 | 0 | 0 | 0 | 0 | no | 0.020576 |
| gemini | editor attempt 1/2 | gemini-2.5-flash | 1 | 11831 | 7129 | 484 | 512 | 512 | 0 | no | 0.022582 |
| gemini | fact-checker attempt 1/2 | gemini-2.5-flash | 1 | 20680 | 99 | 0 | 0 | 0 | 0 | no | 0.006451 |
| gemini | editor repair attempt 1/2 | gemini-2.5-flash | 1 | 15846 | 1503 | 0 | 0 | 0 | 0 | no | 0.008511 |

## Warnings

- none
