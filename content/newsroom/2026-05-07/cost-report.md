# LLM cost report - 2026-05-07

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 4
- Prompt tokens: 70752
- Output tokens: 24602
- Thinking tokens: 503
- Cached tokens: 0
- Total tokens: 95857
- Estimated cost USD: 0.083988

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash | 1 | 15431 | 7597 | 0 | 0 | 0 | 0 | no | 0.023622 |
| gemini | editor attempt 1/2 | gemini-2.5-flash | 1 | 12021 | 9246 | 503 | 512 | 512 | 0 | no | 0.027979 |
| gemini | fact-checker attempt 1/2 | gemini-2.5-flash | 1 | 20361 | 5788 | 0 | 0 | 0 | 0 | no | 0.020578 |
| gemini | editor repair attempt 1/2 | gemini-2.5-flash | 1 | 22939 | 1971 | 0 | 0 | 0 | 0 | no | 0.011809 |

## Warnings

- none
