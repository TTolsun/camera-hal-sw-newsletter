# LLM cost report - 2026-10-12

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 26
- Prompt tokens: 732018
- Output tokens: 41308
- Thinking tokens: 35030
- Cached tokens: 36344
- Total tokens: 808356
- Estimated cost USD: 0.609967

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 68035 | 1708 | 508 | 512 | 512 | 0 | no | 0.025951 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26869 | 1132 | 0 | 0 | 0 | 0 | no | 0.010891 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 69108 | 1964 | 1020 | 1024 | 1024 | 0 | no | 0.028192 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 35695 | 8513 | 3168 | 1024 | MEDIUM | 0 | no | 0.158671 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8516 | 336 | 838 | 1024 | 1024 | 0 | no | 0.001321 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 45681 | 1372 | 1878 | 2048 | 2048 | 0 | no | 0.021829 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 7745 | 851 | 1637 | 2048 | 2048 | 0 | no | 0.008544 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 69553 | 1721 | 506 | 512 | 512 | 2018 | no | 0.025889 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 27279 | 1193 | 0 | 0 | 0 | 0 | no | 0.011166 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 69518 | 2054 | 1020 | 1024 | 1024 | 0 | no | 0.028540 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20961 | 7148 | 6150 | 1024 | MEDIUM | 0 | no | 0.151123 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 7706 | 336 | 771 | 1024 | 1024 | 0 | no | 0.001213 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29137 | 1389 | 2046 | 2048 | 2048 | 0 | no | 0.017329 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 7745 | 782 | 1582 | 2048 | 2048 | 7327 | no | 0.006255 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 252 | 87 | 0 | 0 | 0 | 0 | no | 0.000293 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 2846 | 86 | 698 | 1024 | 1024 | 0 | no | 0.000598 |
| gemini | editor attempt 3/3 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8580 | 336 | 796 | 1024 | 1024 | 0 | no | 0.001311 |
| gemini | fact-checker attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50297 | 1170 | 2046 | 2048 | 2048 | 0 | no | 0.023129 |
| gemini | article-source-review attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19423 | 905 | 1712 | 2048 | 2048 | 0 | no | 0.012369 |
| gemini | editor attempt 3/3 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8580 | 336 | 801 | 1024 | 1024 | 8418 | no | 0.000555 |
| gemini | fact-checker attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50365 | 3824 | 2044 | 2048 | 2048 | 0 | no | 0.029780 |
| gemini | article-source-review attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19423 | 1032 | 1519 | 2048 | 2048 | 0 | no | 0.012204 |
| gemini | editor attempt 3/3 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8552 | 336 | 797 | 1024 | 1024 | 0 | no | 0.001308 |
| gemini | fact-checker attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50346 | 1129 | 2044 | 2048 | 2048 | 0 | no | 0.023036 |
| gemini | article-source-review attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19423 | 1403 | 1449 | 2048 | 2048 | 18581 | no | 0.007940 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 383 | 165 | 0 | 0 | 0 | 0 | no | 0.000527 |

## Warnings

- Estimated LLM cost 0.60996676 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
