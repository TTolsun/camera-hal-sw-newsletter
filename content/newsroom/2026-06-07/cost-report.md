# LLM cost report - 2026-06-07

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 98973
- Output tokens: 13169
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 112142
- Estimated cost USD: 0.178205

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 25203 | 2944 | 0 | 0 | 0 | 0 | no | 0.014921 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21482 | 2095 | 0 | 0 | 0 | 0 | no | 0.011682 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27623 | 3974 | 0 | 512 | 512 | 0 | no | 0.077201 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 24665 | 4156 | 0 | 0 | 0 | 0 | no | 0.074401 |

## Warnings

- Estimated LLM cost 0.178205 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
