# LLM cost report - 2026-05-22

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 5
- Prompt tokens: 74728
- Output tokens: 77396
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 152124
- Estimated cost USD: 0.277222

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20590 | 65526 | 0 | 0 | 0 | 0 | no | 0.169992 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 20590 | 5535 | 0 | 0 | 0 | 0 | no | 0.020015 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13020 | 692 | 0 | 0 | 0 | 0 | no | 0.005636 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 12697 | 2822 | 0 | 512 | 512 | 0 | no | 0.044443 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 7831 | 2821 | 0 | 0 | 0 | 0 | no | 0.037136 |

## Warnings

- Estimated LLM cost 0.2772215 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.2772215 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
