# LLM cost report - 2026-09-28

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 9
- Prompt tokens: 287888
- Output tokens: 40293
- Thinking tokens: 31028
- Cached tokens: 0
- Total tokens: 359209
- Estimated cost USD: 0.718049

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 47184 | 2880 | 438 | 512 | 512 | 0 | no | 0.022450 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 28400 | 1353 | 0 | 0 | 0 | 0 | no | 0.011902 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50460 | 3432 | 1021 | 1024 | 1024 | 0 | no | 0.026270 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 37760 | 15280 | 13782 | 1024 | MEDIUM | 0 | no | 0.318198 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 41993 | 15307 | 12065 | 1024 | MEDIUM | 0 | no | 0.309337 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 13530 | 512 | 882 | 1024 | 1024 | 0 | no | 0.001911 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 59891 | 1242 | 2046 | 2048 | 2048 | 0 | no | 0.026187 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 544 | 183 | 0 | 0 | 0 | 0 | no | 0.000621 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8126 | 104 | 794 | 1024 | 1024 | 0 | no | 0.001172 |

## Warnings

- Estimated LLM cost 0.7180491 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 0.7180491 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
