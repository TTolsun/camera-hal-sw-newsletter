# LLM cost report - 2026-06-26

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 194742
- Output tokens: 28449
- Thinking tokens: 15638
- Cached tokens: 0
- Total tokens: 238829
- Estimated cost USD: 0.452058

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 34945 | 2193 | 509 | 512 | 512 | 0 | no | 0.017239 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22476 | 1067 | 0 | 0 | 0 | 0 | no | 0.009410 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21097 | 2122 | 1020 | 1024 | 1024 | 0 | no | 0.014184 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29456 | 10484 | 6495 | 1024 | 1024 | 0 | no | 0.196995 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 31426 | 10692 | 4692 | 1024 | 1024 | 0 | no | 0.185595 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash | fallback | gemini-2.5-flash | gemini-2.5-flash | 1 | 9905 | 442 | 876 | 1024 | 1024 | 0 | no | 0.006267 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 45437 | 1449 | 2046 | 2048 | 2048 | 0 | no | 0.022369 |

## Warnings

- Estimated LLM cost 0.452058 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.452058 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
