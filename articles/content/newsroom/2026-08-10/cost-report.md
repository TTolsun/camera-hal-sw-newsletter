# LLM cost report - 2026-08-10

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 9
- Prompt tokens: 244384
- Output tokens: 22894
- Thinking tokens: 26827
- Cached tokens: 917
- Total tokens: 294105
- Estimated cost USD: 0.471158

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 35178 | 2681 | 509 | 512 | 512 | 0 | no | 0.018528 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23829 | 2240 | 0 | 0 | 0 | 0 | no | 0.012749 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 37150 | 2522 | 982 | 1024 | 1024 | 0 | no | 0.019905 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25857 | 9918 | 7957 | 1024 | 1024 | 0 | no | 0.199660 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 10110 | 346 | 738 | 1024 | 1024 | 0 | no | 0.001445 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 36331 | 547 | 2046 | 2048 | 2048 | 0 | no | 0.017382 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 7033 | 246 | 792 | 1024 | 1024 | 917 | no | 0.001036 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 41800 | 622 | 1917 | 2048 | 2048 | 0 | no | 0.018888 |
| gemini | editor completion attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27096 | 3772 | 11886 | 1024 | 1024 | 0 | no | 0.181566 |

## Warnings

- none
