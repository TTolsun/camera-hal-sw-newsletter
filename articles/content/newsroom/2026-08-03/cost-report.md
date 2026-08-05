# LLM cost report - 2026-08-03

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 180381
- Output tokens: 20029
- Thinking tokens: 20332
- Cached tokens: 0
- Total tokens: 220742
- Estimated cost USD: 0.361609

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 37091 | 2723 | 509 | 512 | 512 | 0 | no | 0.019207 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23129 | 1871 | 0 | 0 | 0 | 0 | no | 0.011616 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 38865 | 3029 | 966 | 1024 | 1024 | 0 | no | 0.021647 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28600 | 11288 | 15990 | 1024 | 1024 | 0 | no | 0.288402 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 11901 | 444 | 820 | 1024 | 1024 | 0 | no | 0.001696 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 40795 | 674 | 2047 | 2048 | 2048 | 0 | no | 0.019041 |

## Warnings

- none
