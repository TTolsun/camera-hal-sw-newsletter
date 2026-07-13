# LLM cost report - 2026-07-13

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 178698
- Output tokens: 21943
- Thinking tokens: 19869
- Cached tokens: 21418
- Total tokens: 220510
- Estimated cost USD: 0.395326

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32052 | 1729 | 465 | 512 | 512 | 0 | no | 0.015101 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 17343 | 1166 | 0 | 0 | 0 | 0 | no | 0.008118 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32876 | 2176 | 806 | 1024 | 1024 | 0 | no | 0.017318 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25454 | 7870 | 10889 | 1024 | 1024 | 21418 | no | 0.178098 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26316 | 8137 | 5139 | 1024 | 1024 | 0 | no | 0.158958 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 2 | 8917 | 345 | 830 | 1024 | 1024 | 0 | no | 0.001362 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 35740 | 520 | 1740 | 2048 | 2048 | 0 | no | 0.016372 |

## Warnings

- Estimated LLM cost 0.3953257 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.3953257 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
