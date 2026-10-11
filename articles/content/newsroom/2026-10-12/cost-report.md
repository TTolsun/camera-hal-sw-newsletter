# LLM cost report - 2026-10-12

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 16
- Prompt tokens: 496646
- Output tokens: 30672
- Thinking tokens: 21822
- Cached tokens: 9345
- Total tokens: 549140
- Estimated cost USD: 0.497806

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

## Warnings

- none
