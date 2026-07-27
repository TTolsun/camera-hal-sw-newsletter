# LLM cost report - 2026-07-27

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 10
- Prompt tokens: 372979
- Output tokens: 40525
- Thinking tokens: 35426
- Cached tokens: 0
- Total tokens: 448930
- Estimated cost USD: 0.803814

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 34900 | 3021 | 478 | 512 | 512 | 0 | no | 0.019217 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29595 | 1899 | 0 | 0 | 0 | 0 | no | 0.013626 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 36684 | 2665 | 1017 | 1024 | 1024 | 0 | no | 0.020210 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 38383 | 12994 | 18178 | 1024 | 1024 | 0 | no | 0.338122 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 45053 | 14090 | 7442 | 1024 | 1024 | 0 | no | 0.261367 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 15248 | 555 | 798 | 1024 | 1024 | 0 | no | 0.002066 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 56845 | 3172 | 1578 | 2048 | 2048 | 0 | no | 0.028928 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 38389 | 791 | 3071 | 1024 | 1024 | 0 | no | 0.092342 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 15238 | 555 | 820 | 1024 | 1024 | 0 | no | 0.002074 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 62644 | 783 | 2044 | 2048 | 2048 | 0 | no | 0.025861 |

## Warnings

- Estimated LLM cost 0.8038142 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.8038142 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
