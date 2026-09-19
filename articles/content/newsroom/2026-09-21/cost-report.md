# LLM cost report - 2026-09-21

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 9
- Prompt tokens: 344863
- Output tokens: 27959
- Thinking tokens: 28929
- Cached tokens: 0
- Total tokens: 401751
- Estimated cost USD: 0.569697

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 47583 | 2449 | 468 | 512 | 512 | 0 | no | 0.021567 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26490 | 1545 | 0 | 0 | 0 | 0 | no | 0.011810 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48704 | 2584 | 884 | 1024 | 1024 | 0 | no | 0.023281 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 34328 | 16039 | 18540 | 1024 | 1024 | 0 | no | 0.362703 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 15142 | 543 | 771 | 1024 | 1024 | 0 | no | 0.002040 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 54911 | 2875 | 1637 | 2048 | 2048 | 0 | no | 0.027753 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 34130 | 573 | 3834 | 1024 | 1024 | 0 | no | 0.090858 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 15207 | 543 | 748 | 1024 | 1024 | 0 | no | 0.002037 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 68368 | 808 | 2047 | 2048 | 2048 | 0 | no | 0.027648 |

## Warnings

- Estimated LLM cost 0.5696972 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
