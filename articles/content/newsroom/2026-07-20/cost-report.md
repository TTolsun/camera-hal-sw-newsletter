# LLM cost report - 2026-07-20

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 142367
- Output tokens: 7916
- Thinking tokens: 10802
- Cached tokens: 0
- Total tokens: 161085
- Estimated cost USD: 0.173576

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39896 | 1398 | 484 | 512 | 512 | 0 | no | 0.016674 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19975 | 1089 | 0 | 0 | 0 | 0 | no | 0.008715 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 40216 | 1465 | 793 | 1024 | 1024 | 0 | no | 0.017710 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 17652 | 3285 | 6811 | 1024 | 1024 | 0 | no | 0.117342 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 3786 | 133 | 809 | 1024 | 1024 | 0 | no | 0.000755 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20842 | 546 | 1905 | 2048 | 2048 | 0 | no | 0.012380 |

## Warnings

- Estimated LLM cost 0.1735761 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
