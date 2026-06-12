# LLM cost report - 2026-06-12

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 105886
- Output tokens: 14610
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 120496
- Estimated cost USD: 0.198057

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30534 | 2527 | 0 | 0 | 0 | 0 | no | 0.015478 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21857 | 1995 | 0 | 0 | 0 | 0 | no | 0.011545 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27524 | 5050 | 0 | 512 | 512 | 0 | no | 0.086736 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25971 | 5038 | 0 | 0 | 0 | 0 | no | 0.084298 |

## Warnings

- Estimated LLM cost 0.1980568 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
