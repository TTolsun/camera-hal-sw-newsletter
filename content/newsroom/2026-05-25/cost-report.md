# LLM cost report - 2026-05-25

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 4
- Prompt tokens: 58758
- Output tokens: 15142
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 73900
- Estimated cost USD: 0.179659

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13719 | 984 | 0 | 0 | 0 | 0 | no | 0.006576 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13421 | 891 | 0 | 0 | 0 | 0 | no | 0.006254 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18582 | 6628 | 0 | 512 | 512 | 0 | no | 0.087525 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 13036 | 6639 | 0 | 0 | 0 | 0 | no | 0.079305 |

## Warnings

- Estimated LLM cost 0.1796595 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
