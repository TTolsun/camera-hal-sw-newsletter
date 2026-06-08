# LLM cost report - 2026-06-08

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 75521
- Output tokens: 15513
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 91034
- Estimated cost USD: 0.193040

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 18935 | 1647 | 0 | 0 | 0 | 0 | no | 0.009798 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14876 | 1320 | 0 | 0 | 0 | 0 | no | 0.007763 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20944 | 6273 | 0 | 512 | 512 | 0 | no | 0.087873 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20766 | 6273 | 0 | 0 | 0 | 0 | no | 0.087606 |

## Warnings

- Estimated LLM cost 0.1930398 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
