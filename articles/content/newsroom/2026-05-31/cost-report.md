# LLM cost report - 2026-05-31

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 104955
- Output tokens: 19247
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 124202
- Estimated cost USD: 0.237919

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14068 | 1009 | 0 | 0 | 0 | 0 | no | 0.006743 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13786 | 821 | 0 | 0 | 0 | 0 | no | 0.006188 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19323 | 8238 | 0 | 512 | 512 | 0 | no | 0.103126 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 22436 | 8672 | 0 | 0 | 0 | 0 | no | 0.111702 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5960 | 247 | 0 | 0 | 0 | 0 | no | 0.000695 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29382 | 260 | 0 | 0 | 0 | 0 | no | 0.009465 |

## Warnings

- Estimated LLM cost 0.2379191 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
