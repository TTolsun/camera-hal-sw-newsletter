# LLM cost report - 2026-05-31

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 103540
- Output tokens: 16980
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 120520
- Estimated cost USD: 0.217816

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14068 | 1138 | 0 | 0 | 0 | 0 | no | 0.007065 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14063 | 736 | 0 | 0 | 0 | 0 | no | 0.006059 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19539 | 7100 | 0 | 512 | 512 | 0 | no | 0.093208 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 21700 | 7731 | 0 | 0 | 0 | 0 | no | 0.102129 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5508 | 230 | 0 | 0 | 0 | 0 | no | 0.000643 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 28662 | 45 | 0 | 0 | 0 | 0 | no | 0.008711 |

## Warnings

- Estimated LLM cost 0.2178157 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
