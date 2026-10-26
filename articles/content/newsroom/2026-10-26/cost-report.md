# LLM cost report - 2026-10-26

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 38
- Prompt tokens: 1114385
- Output tokens: 90966
- Thinking tokens: 58092
- Cached tokens: 84573
- Total tokens: 1263443
- Estimated cost USD: 1.051568

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 56425 | 4142 | 493 | 512 | 512 | 0 | no | 0.028515 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 60143 | 1882 | 0 | 0 | 0 | 0 | no | 0.022748 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 62774 | 4482 | 847 | 1024 | 1024 | 0 | no | 0.032155 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48483 | 517 | 911 | 1024 | 1024 | 0 | no | 0.018115 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 79269 | 16554 | 0 | 1024 | MEDIUM | 0 | no | 0.121529 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 103377 | 16958 | 6473 | 1024 | MEDIUM | 0 | no | 0.165399 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 21055 | 557 | 1021 | 1024 | 1024 | 0 | no | 0.002737 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 91248 | 1610 | 4283 | 2048 | MEDIUM | 0 | no | 0.090535 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8122 | 869 | 1154 | 2048 | MEDIUM | 0 | no | 0.013678 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13887 | 948 | 1310 | 2048 | MEDIUM | 0 | no | 0.018883 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10663 | 897 | 1117 | 2048 | MEDIUM | 0 | no | 0.015550 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9301 | 928 | 1214 | 2048 | MEDIUM | 0 | no | 0.015008 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6934 | 877 | 2767 | 2048 | MEDIUM | 0 | no | 0.018866 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8122 | 907 | 722 | 2048 | MEDIUM | 6389 | no | 0.007888 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13887 | 876 | 1220 | 2048 | MEDIUM | 0 | no | 0.018275 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10663 | 968 | 0 | 2048 | MEDIUM | 8862 | no | 0.005645 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9301 | 1015 | 1604 | 2048 | MEDIUM | 7533 | no | 0.011712 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6934 | 833 | 4839 | 2048 | MEDIUM | 5246 | no | 0.022929 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 59918 | 3785 | 508 | 512 | 512 | 0 | no | 0.028708 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 59913 | 1617 | 0 | 0 | 0 | 0 | no | 0.022016 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 62544 | 4402 | 895 | 1024 | 1024 | 0 | no | 0.032006 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48135 | 667 | 860 | 1024 | 1024 | 0 | no | 0.018258 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 40948 | 12875 | 2254 | 1024 | MEDIUM | 0 | no | 0.087445 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 21040 | 555 | 744 | 1024 | 1024 | 0 | no | 0.002624 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 90814 | 1865 | 3927 | 2048 | MEDIUM | 0 | no | 0.089830 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8122 | 709 | 1514 | 2048 | MEDIUM | 6389 | no | 0.010115 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13887 | 882 | 941 | 2048 | MEDIUM | 0 | no | 0.017251 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10663 | 1031 | 1610 | 2048 | MEDIUM | 8862 | no | 0.011919 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9301 | 948 | 1173 | 2048 | MEDIUM | 7533 | no | 0.009845 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7019 | 937 | 5268 | 2048 | MEDIUM | 0 | no | 0.028533 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8122 | 866 | 779 | 2048 | MEDIUM | 0 | no | 0.012260 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13887 | 885 | 973 | 2048 | MEDIUM | 12033 | no | 0.009260 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10663 | 947 | 989 | 2048 | MEDIUM | 8862 | no | 0.009275 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9301 | 997 | 915 | 2048 | MEDIUM | 7537 | no | 0.009058 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7019 | 897 | 3560 | 2048 | MEDIUM | 5327 | no | 0.018382 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1120 | 180 | 0 | 0 | 0 | 0 | no | 0.000786 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1123 | 11 | 418 | 2048 | MEDIUM | 0 | no | 0.002451 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 10258 | 90 | 789 | 1024 | 1024 | 0 | no | 0.001377 |

## Warnings

- Estimated LLM cost 1.05156768 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.05156768 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
