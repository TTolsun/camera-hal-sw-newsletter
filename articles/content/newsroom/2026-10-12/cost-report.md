# LLM cost report - 2026-10-12

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 1
- Pro policy: n/a
- Request count: 18
- Prompt tokens: 449264
- Output tokens: 38877
- Thinking tokens: 36153
- Cached tokens: 0
- Total tokens: 524294
- Estimated cost USD: 0.691386

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 28476 | 2173 | 509 | 512 | 512 | 0 | no | 0.015248 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 28739 | 1249 | 0 | 0 | 0 | 0 | no | 0.011744 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30707 | 1899 | 901 | 1024 | 1024 | 0 | no | 0.016212 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 39774 | 8123 | 11236 | 1024 | MEDIUM | 0 | no | 0.233892 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8595 | 332 | 786 | 1024 | 1024 | 0 | no | 0.001307 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48056 | 1185 | 1822 | 2048 | 2048 | 0 | no | 0.021934 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 6475 | 233 | 770 | 1024 | 1024 | 0 | no | 0.001049 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 43136 | 2292 | 2047 | 2048 | 2048 | 0 | no | 0.023788 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 8664 | 1128 | 2046 | 2048 | 2048 | 0 | no | 0.010534 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30096 | 2234 | 501 | 512 | 512 | 0 | no | 0.015866 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29426 | 1179 | 0 | 0 | 0 | 0 | no | 0.011775 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31394 | 1928 | 852 | 1024 | 1024 | 0 | no | 0.016368 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28842 | 6521 | 6826 | 1024 | MEDIUM | 0 | no | 0.163386 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 24491 | 5606 | 3093 | 1024 | MEDIUM | 0 | no | 0.115028 |
| gemini | editor attempt 3/3 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 8691 | 326 | 923 | 1024 | 1024 | 0 | no | 0.001369 |
| gemini | fact-checker attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 42389 | 1100 | 1904 | 2048 | 2048 | 0 | no | 0.020227 |
| gemini | article-source-review attempt 3/3 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 10917 | 1222 | 1937 | 2048 | 2048 | 0 | no | 0.011173 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 396 | 147 | 0 | 0 | 0 | 0 | no | 0.000486 |

## Warnings

- Estimated LLM cost 0.6913859 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
