# LLM cost report - 2026-10-19

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 18
- Prompt tokens: 588204
- Output tokens: 54131
- Thinking tokens: 34672
- Cached tokens: 23426
- Total tokens: 677007
- Estimated cost USD: 0.579777

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 120704 | 3597 | 431 | 512 | 512 | 0 | no | 0.046281 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39642 | 1055 | 0 | 0 | 0 | 0 | no | 0.014530 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 126236 | 8381 | 924 | 1024 | 1024 | 0 | no | 0.061133 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26689 | 952 | 805 | 1024 | 1024 | 0 | no | 0.012399 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 59950 | 15236 | 0 | 1024 | MEDIUM | 0 | no | 0.102097 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 64634 | 15374 | 4004 | 1024 | MEDIUM | 0 | no | 0.121143 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 19017 | 427 | 870 | 1024 | 1024 | 0 | no | 0.002420 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 68698 | 1653 | 5045 | 2048 | MEDIUM | 0 | no | 0.076641 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7053 | 887 | 1477 | 2048 | MEDIUM | 0 | no | 0.014155 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7470 | 1009 | 1429 | 2048 | MEDIUM | 0 | no | 0.014745 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9315 | 922 | 3033 | 2048 | MEDIUM | 0 | no | 0.021818 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6408 | 1001 | 7910 | 2048 | MEDIUM | 0 | no | 0.038222 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7053 | 783 | 1479 | 2048 | MEDIUM | 5364 | no | 0.010152 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7470 | 957 | 1419 | 2048 | MEDIUM | 5764 | no | 0.010622 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9315 | 912 | 1695 | 2048 | MEDIUM | 7550 | no | 0.011666 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6408 | 778 | 3758 | 2048 | MEDIUM | 4748 | no | 0.018611 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1068 | 188 | 0 | 0 | 0 | 0 | no | 0.000790 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1074 | 19 | 393 | 2048 | MEDIUM | 0 | no | 0.002351 |

## Warnings

- Estimated LLM cost 0.5797769 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
