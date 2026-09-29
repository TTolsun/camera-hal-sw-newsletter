# LLM cost report - 2026-09-28

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 11
- Prompt tokens: 339574
- Output tokens: 26454
- Thinking tokens: 26273
- Cached tokens: 7620
- Total tokens: 392301
- Estimated cost USD: 0.518271

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 46416 | 2984 | 490 | 512 | 512 | 0 | no | 0.022610 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 27453 | 1258 | 0 | 0 | 0 | 0 | no | 0.011381 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 49504 | 3302 | 1015 | 1024 | 1024 | 0 | no | 0.025644 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 36472 | 12099 | 11854 | 1024 | MEDIUM | 0 | no | 0.270285 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 13437 | 546 | 824 | 1024 | 1024 | 0 | no | 0.001892 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 53555 | 715 | 2045 | 2048 | 2048 | 0 | no | 0.022967 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 10850 | 444 | 824 | 1024 | 1024 | 7620 | no | 0.000906 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 62661 | 1928 | 2045 | 2048 | 2048 | 0 | no | 0.028731 |
| gemini | editor completion attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 32234 | 2919 | 6411 | 1024 | MEDIUM | 0 | no | 0.132321 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 462 | 159 | 0 | 0 | 0 | 0 | no | 0.000536 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 6530 | 100 | 765 | 1024 | 1024 | 0 | no | 0.000999 |

## Warnings

- Estimated LLM cost 0.5182709 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
