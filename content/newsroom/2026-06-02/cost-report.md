# LLM cost report - 2026-06-02

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 5
- Prompt tokens: 76941
- Output tokens: 7112
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 84053
- Estimated cost USD: 0.096699

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14292 | 1067 | 0 | 0 | 0 | 0 | no | 0.006955 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14217 | 721 | 0 | 0 | 0 | 0 | no | 0.006068 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19889 | 5073 | 0 | 512 | 512 | 0 | no | 0.075491 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3530 | 142 | 0 | 0 | 0 | 0 | no | 0.000410 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 25013 | 109 | 0 | 0 | 0 | 0 | no | 0.007776 |

## Warnings

- none
