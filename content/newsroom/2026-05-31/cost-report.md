# LLM cost report - 2026-05-31

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 125953
- Output tokens: 24973
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 150926
- Estimated cost USD: 0.307576

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14068 | 1053 | 0 | 0 | 0 | 0 | no | 0.006853 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13917 | 808 | 0 | 0 | 0 | 0 | no | 0.006195 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19294 | 7973 | 0 | 512 | 512 | 0 | no | 0.100698 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 22240 | 8415 | 0 | 0 | 0 | 0 | no | 0.109095 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5680 | 237 | 0 | 0 | 0 | 0 | no | 0.000663 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29024 | 2402 | 0 | 0 | 0 | 0 | no | 0.014712 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 21730 | 4085 | 0 | 0 | 0 | 0 | no | 0.069360 |

## Warnings

- Estimated LLM cost 0.307576 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.307576 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
