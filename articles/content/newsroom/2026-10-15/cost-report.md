# LLM cost report - 2026-10-15

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 31
- Prompt tokens: 815265
- Output tokens: 53006
- Thinking tokens: 44039
- Cached tokens: 99729
- Total tokens: 912310
- Estimated cost USD: 0.143927

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38037 | 2647 | 473 | 512 | 512 | 0 | no | 0.019211 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38547 | 1032 | 0 | 0 | 0 | 0 | no | 0.014144 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 41649 | 2936 | 1023 | 1024 | 1024 | 0 | no | 0.022392 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29538 | 458 | 848 | 1024 | 1024 | 0 | no | 0.012126 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 55281 | 12002 | 0 | 1024 | MEDIUM | 0 | no | 0.000000 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 16132 | 329 | 1022 | 1024 | 1024 | 0 | no | 0.002154 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 62719 | 1012 | 3253 | 2048 | MEDIUM | 9652 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10638 | 966 | 1236 | 2048 | MEDIUM | 0 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11960 | 1082 | 2228 | 2048 | MEDIUM | 0 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8245 | 894 | 5672 | 2048 | MEDIUM | 0 | no | 0.000000 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 61506 | 1511 | 7075 | 1024 | MEDIUM | 0 | no | 0.000000 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 16307 | 330 | 889 | 1024 | 1024 | 10729 | no | 0.001153 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 61353 | 910 | 0 | 2048 | MEDIUM | 9090 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10638 | 936 | 1046 | 2048 | MEDIUM | 8842 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 12256 | 919 | 0 | 2048 | MEDIUM | 0 | no | 0.000000 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8245 | 1104 | 3432 | 2048 | MEDIUM | 6512 | no | 0.000000 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39882 | 2459 | 510 | 512 | 512 | 0 | no | 0.019387 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38696 | 1237 | 0 | 0 | 0 | 0 | no | 0.014701 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 41798 | 2608 | 911 | 1024 | 1024 | 0 | no | 0.021337 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29347 | 400 | 864 | 1024 | 1024 | 0 | no | 0.011964 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 37927 | 8883 | 3136 | 1024 | MEDIUM | 0 | no | 0.000000 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 16109 | 332 | 1023 | 1024 | 1024 | 0 | no | 0.002153 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 63057 | 1244 | 3495 | 2048 | MEDIUM | 9653 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10638 | 991 | 1338 | 2048 | MEDIUM | 8842 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 12256 | 988 | 1292 | 2048 | MEDIUM | 10430 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8447 | 901 | 1021 | 2048 | MEDIUM | 0 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10638 | 979 | 1022 | 2048 | MEDIUM | 8842 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 12256 | 1043 | 0 | 2048 | MEDIUM | 10430 | no | 0.000000 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8447 | 917 | 1230 | 2048 | MEDIUM | 6707 | no | 0.000000 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1358 | 572 | 0 | 0 | 0 | 0 | no | 0.001837 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1358 | 384 | 0 | 0 | 0 | 0 | no | 0.001367 |

## Warnings

- No local Gemini pricing entry for model gemini-3.8-flash.
