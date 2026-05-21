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
- Prompt tokens: 94196
- Output tokens: 19276
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 113472
- Estimated cost USD: 0.221562

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 15618 | 4022 | 0 | 0 | 0 | 0 | no | 0.014740 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12815 | 846 | 0 | 0 | 0 | 0 | no | 0.005960 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 16527 | 4530 | 0 | 512 | 512 | 0 | no | 0.065560 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 10421 | 4870 | 0 | 0 | 0 | 0 | no | 0.059462 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21042 | 339 | 0 | 0 | 0 | 0 | no | 0.007160 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 17773 | 4669 | 0 | 0 | 0 | 0 | no | 0.068681 |

## Warnings

- Estimated LLM cost 0.2215625 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
