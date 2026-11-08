# LLM cost report - 2026-11-09

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 46
- Prompt tokens: 2117828
- Output tokens: 123643
- Thinking tokens: 86851
- Cached tokens: 94103
- Total tokens: 2328322
- Estimated cost USD: 1.806080

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 127081 | 3647 | 508 | 512 | 512 | 0 | no | 0.048512 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 59945 | 2218 | 0 | 0 | 0 | 0 | no | 0.023529 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 131619 | 9986 | 1012 | 1024 | 1024 | 0 | no | 0.066981 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 108241 | 1249 | 876 | 1024 | 1024 | 0 | no | 0.037785 |
| gemini | editor attempt 1/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 83704 | 20567 | 0 | 1024 | MEDIUM | 0 | no | 0.139904 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 103418 | 20561 | 6732 | 1024 | MEDIUM | 0 | no | 0.179912 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 22005 | 551 | 1023 | 1024 | 1024 | 0 | no | 0.002830 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 98838 | 1948 | 3121 | 2048 | MEDIUM | 0 | no | 0.093137 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9977 | 1111 | 0 | 2048 | MEDIUM | 0 | no | 0.011649 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8630 | 986 | 4407 | 2048 | MEDIUM | 0 | no | 0.026696 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10121 | 1106 | 0 | 2048 | MEDIUM | 0 | no | 0.011738 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8405 | 1183 | 5844 | 2048 | MEDIUM | 0 | no | 0.032655 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11583 | 1165 | 0 | 2048 | MEDIUM | 0 | no | 0.013056 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 86653 | 299 | 3665 | 1024 | MEDIUM | 0 | no | 0.079855 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 22047 | 509 | 981 | 1024 | 1024 | 7900 | no | 0.002090 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 166808 | 2004 | 4254 | 2048 | MEDIUM | 0 | no | 0.148573 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10061 | 1014 | 0 | 2048 | MEDIUM | 0 | no | 0.011348 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8630 | 1065 | 3149 | 2048 | MEDIUM | 6881 | no | 0.017630 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10121 | 834 | 0 | 2048 | MEDIUM | 8332 | no | 0.005094 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8405 | 1188 | 10227 | 2048 | MEDIUM | 6662 | no | 0.044613 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11583 | 1310 | 0 | 2048 | MEDIUM | 9765 | no | 0.007008 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 129370 | 4036 | 485 | 512 | 512 | 0 | no | 0.050113 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 59831 | 2017 | 0 | 0 | 0 | 0 | no | 0.022992 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 131505 | 8934 | 993 | 1024 | 1024 | 12177 | no | 0.060981 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 97348 | 1291 | 873 | 1024 | 1024 | 0 | no | 0.034614 |
| gemini | editor attempt 2/2 | editor | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 84097 | 17528 | 1966 | 1024 | MEDIUM | 0 | no | 0.136175 |
| gemini | editor attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 21936 | 551 | 753 | 1024 | 1024 | 0 | no | 0.002715 |
| gemini | fact-checker attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 96526 | 1882 | 3731 | 2048 | MEDIUM | 0 | no | 0.093443 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10061 | 1014 | 0 | 2048 | MEDIUM | 8274 | no | 0.005763 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8888 | 1048 | 18409 | 2048 | MEDIUM | 0 | no | 0.079630 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9899 | 842 | 0 | 2048 | MEDIUM | 0 | no | 0.010582 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8669 | 957 | 1000 | 2048 | MEDIUM | 0 | no | 0.013841 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11737 | 1143 | 86 | 2048 | MEDIUM | 0 | no | 0.013411 |
| gemini | editor repair attempt 2/2 | repair | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 85245 | 404 | 3191 | 1024 | MEDIUM | 0 | no | 0.077415 |
| gemini | editor repair attempt 2/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 21943 | 554 | 905 | 1024 | 1024 | 0 | no | 0.002778 |
| gemini | fact-checker repair attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 164572 | 1911 | 2356 | 2048 | MEDIUM | 0 | no | 0.139430 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 10061 | 760 | 0 | 2048 | MEDIUM | 8274 | no | 0.004811 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8908 | 940 | 1549 | 2048 | MEDIUM | 0 | no | 0.016015 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 9899 | 931 | 0 | 2048 | MEDIUM | 8115 | no | 0.005438 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8669 | 885 | 0 | 2048 | MEDIUM | 6918 | no | 0.005151 |
| gemini | article-source-review attempt 2/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 11737 | 951 | 0 | 2048 | MEDIUM | 9916 | no | 0.005676 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1362 | 180 | 0 | 0 | 0 | 0 | no | 0.000859 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1365 | 92 | 3304 | 2048 | MEDIUM | 0 | no | 0.013759 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 1440 | 178 | 0 | 0 | 0 | 889 | no | 0.000637 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 1363 | 19 | 654 | 2048 | MEDIUM | 0 | no | 0.003546 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 13522 | 94 | 797 | 1024 | 1024 | 0 | no | 0.001709 |

## Warnings

- Estimated LLM cost 1.80607981 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.80607981 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
