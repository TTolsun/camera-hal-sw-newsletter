# LLM cost report - 2026-07-06

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 194265
- Output tokens: 22429
- Thinking tokens: 22097
- Cached tokens: 23601
- Total tokens: 238791
- Estimated cost USD: 0.451196

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash-lite | fallback | gemini-2.5-flash-lite | gemini-2.5-flash-lite | 1 | 28232 | 1880 | 406 | 512 | 512 | 0 | no | 0.003738 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash-lite | fallback | gemini-2.5-flash-lite | gemini-2.5-flash-lite | 1 | 24139 | 925 | 0 | 0 | 0 | 0 | no | 0.002784 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 23877 | 1825 | 892 | 1024 | 1024 | 23601 | no | 0.007583 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 31871 | 8388 | 8394 | 1024 | 1024 | 0 | no | 0.198845 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 33722 | 8532 | 9529 | 1024 | 1024 | 0 | no | 0.213132 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash | fallback | gemini-2.5-flash | gemini-2.5-flash | 1 | 9443 | 344 | 831 | 1024 | 1024 | 0 | no | 0.005770 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 42981 | 535 | 2045 | 2048 | 2048 | 0 | no | 0.019344 |

## Warnings

- Estimated LLM cost 0.45119603 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.45119603 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
