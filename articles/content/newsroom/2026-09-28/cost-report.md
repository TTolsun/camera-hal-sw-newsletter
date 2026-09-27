# LLM cost report - 2026-09-28

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 199202
- Output tokens: 19306
- Thinking tokens: 22528
- Cached tokens: 0
- Total tokens: 241036
- Estimated cost USD: 0.394049

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 39733 | 2372 | 472 | 512 | 512 | 0 | no | 0.019030 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24056 | 1259 | 0 | 0 | 0 | 0 | no | 0.010364 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 43368 | 3001 | 821 | 1024 | 1024 | 0 | no | 0.022565 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 32680 | 11571 | 18485 | 1024 | 1024 | 0 | no | 0.319524 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 11532 | 447 | 777 | 1024 | 1024 | 0 | no | 0.001643 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 47833 | 656 | 1973 | 2048 | 2048 | 0 | no | 0.020922 |

## Warnings

- none
