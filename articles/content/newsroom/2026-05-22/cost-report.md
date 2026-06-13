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
- Prompt tokens: 81098
- Output tokens: 77940
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 159038
- Estimated cost USD: 0.303840

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20710 | 65526 | 0 | 0 | 0 | 0 | no | 0.170028 |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 20710 | 3590 | 0 | 0 | 0 | 0 | no | 0.015188 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12775 | 766 | 0 | 0 | 0 | 0 | no | 0.005748 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 17015 | 4029 | 0 | 512 | 512 | 0 | no | 0.061783 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 9888 | 4029 | 0 | 0 | 0 | 0 | no | 0.051093 |

## Warnings

- Estimated LLM cost 0.30384 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.30384 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
