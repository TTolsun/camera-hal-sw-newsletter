# LLM cost report - 2026-11-02

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 36
- Prompt tokens: 953877
- Output tokens: 69910
- Thinking tokens: 59493
- Cached tokens: 77260
- Total tokens: 1083280
- Estimated cost USD: 0.893852

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 47164 | 4958 | 390 | 512 | 512 | 0 | no | 0.027519 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50569 | 1642 | 0 | 0 | 0 | 0 | no | 0.019276 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 53188 | 4968 | 870 | 1024 | 1024 | 0 | no | 0.030551 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39430 | 696 | 906 | 1024 | 1024 | 0 | no | 0.015834 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 61877 | 13057 | 0 | 1024 | MEDIUM | 0 | no | 0.095371 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 18489 | 428 | 871 | 1024 | 1024 | 0 | no | 0.002368 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 68829 | 1450 | 3293 | 2048 | MEDIUM | 0 | no | 0.069408 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7595 | 929 | 1362 | 2048 | MEDIUM | 0 | no | 0.014287 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8557 | 973 | 5181 | 2048 | MEDIUM | 0 | no | 0.029495 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7477 | 1129 | 1721 | 2048 | MEDIUM | 0 | no | 0.016295 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8554 | 998 | 3901 | 2048 | MEDIUM | 0 | no | 0.024787 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 67156 | 529 | 2706 | 1024 | MEDIUM | 0 | no | 0.062498 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 18546 | 428 | 811 | 1024 | 1024 | 13733 | no | 0.001114 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 66669 | 1347 | 4707 | 2048 | MEDIUM | 0 | no | 0.072704 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7595 | 997 | 1777 | 2048 | MEDIUM | 5880 | no | 0.012130 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8557 | 894 | 3440 | 2048 | MEDIUM | 6810 | no | 0.018073 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7551 | 804 | 1105 | 2048 | MEDIUM | 0 | no | 0.012822 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8554 | 1054 | 3216 | 2048 | MEDIUM | 6807 | no | 0.017833 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 49989 | 2898 | 511 | 512 | 512 | 0 | no | 0.023519 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 49927 | 2046 | 0 | 0 | 0 | 0 | no | 0.020093 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 52546 | 4352 | 890 | 1024 | 1024 | 0 | no | 0.028869 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38186 | 716 | 855 | 1024 | 1024 | 0 | no | 0.015383 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 43561 | 13088 | 1364 | 1024 | MEDIUM | 0 | no | 0.086866 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 17823 | 428 | 808 | 1024 | 1024 | 0 | no | 0.002277 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 69243 | 1464 | 3278 | 2048 | MEDIUM | 0 | no | 0.069715 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7595 | 930 | 1431 | 2048 | MEDIUM | 5880 | no | 0.010581 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8557 | 875 | 2967 | 2048 | MEDIUM | 6810 | no | 0.016228 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7551 | 973 | 1183 | 2048 | MEDIUM | 5838 | no | 0.009808 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8714 | 1128 | 3011 | 2048 | MEDIUM | 0 | no | 0.022057 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7595 | 881 | 890 | 2048 | MEDIUM | 5884 | no | 0.008366 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8557 | 928 | 1703 | 2048 | MEDIUM | 6814 | no | 0.011685 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7551 | 918 | 1805 | 2048 | MEDIUM | 5842 | no | 0.011931 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8714 | 737 | 1393 | 2048 | MEDIUM | 6962 | no | 0.009824 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1107 | 159 | 0 | 0 | 0 | 0 | no | 0.000730 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1089 | 19 | 373 | 2048 | MEDIUM | 0 | no | 0.002287 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9215 | 89 | 774 | 1024 | 1024 | 0 | no | 0.001267 |

## Warnings

- Estimated LLM cost 0.89385196 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 0.89385196 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
