# LLM cost report - 2026-05-24

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 5
- Prompt tokens: 82069
- Output tokens: 120935
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 203004
- Estimated cost USD: 0.422834

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20708 | 65526 | 0 | 0 | 0 | 0 | no | 0.170027 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 20708 | 44998 | 0 | 0 | 0 | 0 | no | 0.118707 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12870 | 790 | 0 | 0 | 0 | 0 | no | 0.005836 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 17134 | 4794 | 0 | 512 | 512 | 0 | no | 0.068847 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 10649 | 4827 | 0 | 0 | 0 | 0 | no | 0.059416 |

## Warnings

- Estimated LLM cost 0.4228343 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.4228343 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
