# LLM cost report - 2026-06-16

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 4
- Prompt tokens: 112877
- Output tokens: 23765
- Thinking tokens: 25130
- Cached tokens: 0
- Total tokens: 161772
- Estimated cost USD: 0.526672

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29738 | 1918 | 0 | 0 | 0 | 0 | no | 0.013716 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22467 | 1167 | 0 | 0 | 0 | 0 | no | 0.009658 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27986 | 9596 | 12560 | 1024 | 1024 | 0 | no | 0.241383 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 32686 | 11084 | 12570 | 1024 | 1024 | 0 | no | 0.261915 |

## Warnings

- Estimated LLM cost 0.526672 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.526672 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
