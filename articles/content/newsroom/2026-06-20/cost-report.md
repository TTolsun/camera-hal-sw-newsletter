# LLM cost report - 2026-06-20

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 10
- Prompt tokens: 228559
- Output tokens: 85603
- Thinking tokens: 43552
- Cached tokens: 14006
- Total tokens: 357714
- Estimated cost USD: 1.247493

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24687 | 1808 | 464 | 512 | 512 | 0 | no | 0.013086 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 18696 | 1054 | 0 | 0 | 0 | 0 | no | 0.008244 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 24231 | 9522 | 15568 | 1024 | 1024 | 0 | no | 0.262157 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29243 | 9658 | 5470 | 1024 | 1024 | 0 | no | 0.180016 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9254 | 338 | 764 | 1024 | 1024 | 0 | no | 0.001366 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39905 | 765 | 2046 | 2048 | 2048 | 0 | no | 0.018999 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 6103 | 238 | 701 | 1024 | 1024 | 0 | no | 0.000986 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38822 | 547 | 1508 | 2048 | 2048 | 0 | no | 0.016784 |
| gemini | editor completion attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18809 | 58780 | 6740 | 1024 | 1024 | 0 | no | 0.617893 |
| gemini | editor completion attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 2 | 18809 | 2893 | 10291 | 1024 | 1024 | 14006 | no | 0.127961 |

## Warnings

- Estimated LLM cost 1.247493 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 1.247493 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
