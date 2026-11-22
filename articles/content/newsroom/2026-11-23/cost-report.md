# LLM cost report - 2026-11-23

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 25
- Prompt tokens: 1373004
- Output tokens: 106607
- Thinking tokens: 86338
- Cached tokens: 37136
- Total tokens: 1565949
- Estimated cost USD: 1.341596

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 96224 | 4936 | 508 | 512 | 512 | 0 | no | 0.042477 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 56986 | 2133 | 0 | 0 | 0 | 0 | no | 0.022428 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 100460 | 4271 | 1020 | 1024 | 1024 | 0 | no | 0.043366 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 42669 | 868 | 943 | 1024 | 1024 | 0 | no | 0.017328 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 76241 | 23735 | 3091 | 1024 | MEDIUM | 0 | no | 0.157778 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 26204 | 508 | 1021 | 1024 | 1024 | 0 | no | 0.003232 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 98337 | 2063 | 8643 | 2048 | MEDIUM | 0 | no | 0.113900 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7396 | 1229 | 2186 | 2048 | MEDIUM | 0 | no | 0.018353 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7228 | 1284 | 6366 | 2048 | MEDIUM | 0 | no | 0.034108 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11588 | 1227 | 0 | 2048 | MEDIUM | 0 | no | 0.013292 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11741 | 1324 | 0 | 2048 | MEDIUM | 0 | no | 0.013771 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 85627 | 261 | 5614 | 1024 | MEDIUM | 0 | no | 0.086251 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 26269 | 557 | 1014 | 1024 | 1024 | 11919 | no | 0.002183 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 138002 | 2204 | 10236 | 2048 | MEDIUM | 0 | no | 0.150151 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7526 | 1005 | 1086 | 2048 | MEDIUM | 0 | no | 0.013486 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7228 | 1145 | 4181 | 2048 | MEDIUM | 5528 | no | 0.021662 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11588 | 1228 | 2238 | 2048 | MEDIUM | 9769 | no | 0.015094 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11741 | 1088 | 0 | 2048 | MEDIUM | 9920 | no | 0.006190 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 98375 | 4523 | 509 | 512 | 512 | 0 | no | 0.042092 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 56801 | 4892 | 0 | 0 | 0 | 0 | no | 0.029270 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 100275 | 10174 | 1023 | 1024 | 1024 | 0 | no | 0.058075 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 76495 | 1355 | 868 | 1024 | 1024 | 0 | no | 0.028506 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 91526 | 16464 | 8681 | 1024 | MEDIUM | 0 | no | 0.162938 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 104222 | 17577 | 26355 | 1024 | MEDIUM | 0 | no | 0.242912 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 22255 | 556 | 755 | 1024 | 1024 | 0 | no | 0.002750 |

## Warnings

- Estimated LLM cost 1.34159551 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.34159551 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
