# LLM cost report - 2026-05-27

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 112789
- Output tokens: 22991
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 135780
- Estimated cost USD: 0.296164

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23773 | 2308 | 0 | 0 | 0 | 0 | no | 0.012902 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24052 | 1161 | 0 | 0 | 0 | 0 | no | 0.010118 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29413 | 9761 | 0 | 512 | 512 | 0 | no | 0.131968 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 35551 | 9761 | 0 | 0 | 0 | 0 | no | 0.141176 |

## Warnings

- Estimated LLM cost 0.296164 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.296164 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
