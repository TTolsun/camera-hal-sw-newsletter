# LLM cost report - 2026-05-24

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 7
- Prompt tokens: 122412
- Output tokens: 210025
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 332437
- Estimated cost USD: 0.643041

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20708 | 65526 | 0 | 0 | 0 | 0 | no | 0.170027 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 20708 | 65526 | 0 | 0 | 0 | 0 | no | 0.170027 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 3 | 20708 | 65526 | 0 | 0 | 0 | 0 | no | 0.170027 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash-lite | fallback | gemini-2.5-flash-lite | gemini-2.5-flash-lite | 1 | 20708 | 3389 | 0 | 0 | 0 | 0 | no | 0.003426 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12714 | 785 | 0 | 0 | 0 | 0 | no | 0.005777 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 16691 | 4616 | 0 | 512 | 512 | 0 | no | 0.066581 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 10175 | 4657 | 0 | 0 | 0 | 0 | no | 0.057175 |

## Warnings

- Estimated LLM cost 0.6430413 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.6430413 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
