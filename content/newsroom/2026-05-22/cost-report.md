# LLM cost report - 2026-05-22

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 6
- Prompt tokens: 102051
- Output tokens: 147215
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 249266
- Estimated cost USD: 0.502188

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20710 | 65526 | 0 | 0 | 0 | 0 | no | 0.170028 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 20710 | 65526 | 0 | 0 | 0 | 0 | no | 0.170028 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 3 | 20710 | 4469 | 0 | 0 | 0 | 0 | no | 0.017386 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12857 | 762 | 0 | 0 | 0 | 0 | no | 0.005762 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 16551 | 5430 | 0 | 512 | 512 | 0 | no | 0.073696 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 10513 | 5502 | 0 | 0 | 0 | 0 | no | 0.065287 |

## Warnings

- Estimated LLM cost 0.5021876 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.5021876 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
