# LLM cost report - 2026-06-03

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 163007
- Output tokens: 19972
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 182979
- Estimated cost USD: 0.261346

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash-lite | fallback | gemini-2.5-flash-lite | gemini-2.5-flash-lite | 1 | 25374 | 1711 | 0 | 0 | 0 | 0 | no | 0.003222 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 23595 | 1358 | 0 | 0 | 0 | 0 | no | 0.010474 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29490 | 9872 | 0 | 512 | 512 | 0 | no | 0.133083 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 6567 | 252 | 0 | 0 | 0 | 0 | no | 0.000758 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 40201 | 2451 | 0 | 0 | 0 | 0 | no | 0.018188 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 37780 | 4328 | 0 | 0 | 0 | 0 | no | 0.095622 |

## Warnings

- Estimated LLM cost 0.2613456 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.2613456 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
