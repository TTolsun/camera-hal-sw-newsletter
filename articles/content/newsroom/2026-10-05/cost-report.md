# LLM cost report - 2026-10-05

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 29
- Prompt tokens: 746042
- Output tokens: 59024
- Thinking tokens: 62140
- Cached tokens: 14411
- Total tokens: 867206
- Estimated cost USD: 1.134158

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29799 | 1882 | 508 | 512 | 512 | 0 | no | 0.014915 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30915 | 893 | 0 | 0 | 0 | 0 | no | 0.011507 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 33089 | 1583 | 943 | 1024 | 1024 | 0 | no | 0.016242 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 41491 | 10429 | 8907 | 1024 | MEDIUM | 0 | no | 0.236261 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9401 | 3073 | 778 | 1024 | 1024 | 0 | no | 0.002481 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 24332 | 10676 | 7546 | 1024 | MEDIUM | 0 | no | 0.200496 |
| gemini | editor attempt 1/2 public article judge repair | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9311 | 237 | 823 | 1024 | 1024 | 0 | no | 0.001355 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 52012 | 872 | 1874 | 2048 | 2048 | 0 | no | 0.022469 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 5545 | 133 | 739 | 1024 | 1024 | 0 | no | 0.000903 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 45321 | 1769 | 2044 | 2048 | 2048 | 0 | no | 0.023129 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 4810 | 605 | 1672 | 2048 | 2048 | 0 | no | 0.007136 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31745 | 2257 | 445 | 512 | 512 | 0 | no | 0.016279 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31124 | 807 | 0 | 0 | 0 | 0 | no | 0.011355 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 33298 | 1359 | 848 | 1024 | 1024 | 0 | no | 0.015507 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25353 | 4976 | 10832 | 1024 | MEDIUM | 14411 | no | 0.160847 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 21016 | 5050 | 3191 | 1024 | MEDIUM | 0 | no | 0.105693 |
| gemini | fact-checker attempt 4/4 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 57394 | 1466 | 2044 | 2048 | 2048 | 0 | no | 0.025993 |
| gemini | article-source-review attempt 4/4 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16099 | 885 | 1528 | 2048 | 2048 | 0 | no | 0.010862 |
| gemini | fact-checker attempt 5/5 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 57678 | 1197 | 2044 | 2048 | 2048 | 0 | no | 0.025406 |
| gemini | article-source-review attempt 5/5 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16315 | 882 | 1515 | 2048 | 2048 | 0 | no | 0.010887 |
| gemini | editor attempt 6/6 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 19467 | 225 | 781 | 1024 | 1024 | 0 | no | 0.002349 |
| gemini | fact-checker attempt 6/6 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32063 | 1551 | 1539 | 2048 | 2048 | 0 | no | 0.017344 |
| gemini | article-source-review attempt 6/6 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16306 | 929 | 1805 | 2048 | 2048 | 0 | no | 0.011727 |
| gemini | fact-checker attempt 7/7 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32117 | 2855 | 1567 | 2048 | 2048 | 0 | no | 0.020690 |
| gemini | article-source-review attempt 7/7 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16442 | 824 | 1846 | 2048 | 2048 | 0 | no | 0.011608 |
| gemini | fact-checker attempt 8/8 | factcheck | gemini-3.5-flash | gemini-3.5-flash | NEWSROOM_FACTCHECK_MODEL | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 31270 | 576 | 2139 | 2048 | MEDIUM | 0 | no | 0.071340 |
| gemini | article-source-review attempt 8/8 | factcheck | gemini-3.5-flash | gemini-3.5-flash | NEWSROOM_FACTCHECK_MODEL | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 16298 | 694 | 2753 | 2048 | MEDIUM | 0 | no | 0.055470 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 337 | 99 | 0 | 0 | 0 | 0 | no | 0.000349 |
| gemini | post-generation public quality judge | judge | gemini-3.5-flash | gemini-3.5-flash | NEWSROOM_JUDGE_MODEL | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 5694 | 240 | 1429 | 1024 | MEDIUM | 0 | no | 0.023562 |

## Warnings

- Estimated LLM cost 1.13415785 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.13415785 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.

일부 초기 수동 검토와 번역 호출은 이 계측에 포함되지 않아 실제 총비용은 표시된 추정액보다 높습니다.
