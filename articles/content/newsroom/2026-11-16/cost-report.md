# LLM cost report - 2026-11-16

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 40
- Prompt tokens: 1682896
- Output tokens: 97716
- Thinking tokens: 85813
- Cached tokens: 66234
- Total tokens: 1866425
- Estimated cost USD: 1.443125

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 113436 | 3673 | 511 | 512 | 512 | 0 | no | 0.044491 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 64769 | 1472 | 0 | 0 | 0 | 0 | no | 0.023111 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 117089 | 10253 | 713 | 1024 | 1024 | 0 | no | 0.062542 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 87034 | 1468 | 883 | 1024 | 1024 | 0 | no | 0.031988 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 88331 | 20481 | 0 | 1024 | MEDIUM | 0 | no | 0.143052 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 22501 | 543 | 802 | 1024 | 1024 | 0 | no | 0.002788 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 100680 | 1762 | 5392 | 2048 | MEDIUM | 0 | no | 0.102337 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9096 | 910 | 1081 | 2048 | MEDIUM | 0 | no | 0.014288 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7755 | 899 | 2032 | 2048 | MEDIUM | 0 | no | 0.016807 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 23177 | 1126 | 4021 | 2048 | MEDIUM | 0 | no | 0.036684 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6779 | 1195 | 4324 | 2048 | MEDIUM | 0 | no | 0.025781 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9066 | 977 | 3892 | 2048 | MEDIUM | 0 | no | 0.025058 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 88748 | 774 | 30544 | 1024 | MEDIUM | 0 | no | 0.184003 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 22535 | 543 | 918 | 1024 | 1024 | 0 | no | 0.002838 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 150015 | 2060 | 3922 | 2048 | MEDIUM | 0 | no | 0.134944 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9096 | 930 | 1116 | 2048 | MEDIUM | 7333 | no | 0.009545 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7797 | 1045 | 2365 | 2048 | MEDIUM | 0 | no | 0.018635 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 23177 | 865 | 0 | 2048 | MEDIUM | 0 | no | 0.020626 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6779 | 898 | 1345 | 2048 | MEDIUM | 5098 | no | 0.010054 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9066 | 1036 | 2474 | 2048 | MEDIUM | 0 | no | 0.019962 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 114892 | 3460 | 508 | 512 | 512 | 0 | no | 0.044388 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 65172 | 1568 | 0 | 0 | 0 | 0 | no | 0.023472 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 117492 | 10760 | 971 | 1024 | 1024 | 0 | no | 0.064575 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 87908 | 1080 | 922 | 1024 | 1024 | 0 | no | 0.031377 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 85361 | 15747 | 2221 | 1024 | MEDIUM | 0 | no | 0.131401 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 20844 | 541 | 820 | 1024 | 1024 | 0 | no | 0.002629 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 97661 | 1755 | 2943 | 2048 | MEDIUM | 0 | no | 0.090863 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9096 | 1088 | 1059 | 2048 | MEDIUM | 7333 | no | 0.009923 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9022 | 918 | 1077 | 2048 | MEDIUM | 0 | no | 0.014248 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7557 | 970 | 2020 | 2048 | MEDIUM | 0 | no | 0.016880 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 23019 | 1014 | 0 | 2048 | MEDIUM | 0 | no | 0.021067 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6611 | 874 | 1000 | 2048 | MEDIUM | 0 | no | 0.011986 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9096 | 944 | 1982 | 2048 | MEDIUM | 7337 | no | 0.012842 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9022 | 836 | 560 | 2048 | MEDIUM | 7261 | no | 0.007100 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 7557 | 914 | 1073 | 2048 | MEDIUM | 5844 | no | 0.009174 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 23019 | 1064 | 0 | 2048 | MEDIUM | 21090 | no | 0.007019 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6611 | 961 | 1200 | 2048 | MEDIUM | 4938 | no | 0.009729 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1364 | 182 | 0 | 0 | 0 | 0 | no | 0.000864 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1369 | 19 | 338 | 2048 | MEDIUM | 0 | no | 0.002365 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 13297 | 111 | 784 | 1024 | 1024 | 0 | no | 0.001688 |

## Warnings

- Estimated LLM cost 1.44312486 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.44312486 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
