# LLM cost report - 2026-05-27

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 112124
- Output tokens: 21462
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 133586
- Estimated cost USD: 0.282213

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23773 | 2299 | 0 | 0 | 0 | 0 | no | 0.012879 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24105 | 1036 | 0 | 0 | 0 | 0 | no | 0.009822 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29341 | 9064 | 0 | 512 | 512 | 0 | no | 0.125587 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 34905 | 9063 | 0 | 0 | 0 | 0 | no | 0.133925 |

## Warnings

- Estimated LLM cost 0.2822129 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.2822129 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
