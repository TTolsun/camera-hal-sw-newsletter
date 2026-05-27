# LLM cost report - 2026-05-27

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 108394
- Output tokens: 17594
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 125988
- Estimated cost USD: 0.238692

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23773 | 1827 | 0 | 0 | 0 | 0 | no | 0.011699 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash-lite | fallback | gemini-2.5-flash-lite | gemini-2.5-flash-lite | 1 | 23462 | 1046 | 0 | 0 | 0 | 0 | no | 0.002765 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28759 | 7360 | 0 | 512 | 512 | 0 | no | 0.109379 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 32400 | 7361 | 0 | 0 | 0 | 0 | no | 0.114849 |

## Warnings

- Estimated LLM cost 0.2386915 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
