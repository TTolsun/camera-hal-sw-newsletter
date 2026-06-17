# LLM cost report - 2026-06-17

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 8
- Prompt tokens: 199765
- Output tokens: 18740
- Thinking tokens: 31511
- Cached tokens: 0
- Total tokens: 250016
- Estimated cost USD: 0.497876

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 33776 | 1631 | 0 | 0 | 0 | 0 | no | 0.014210 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21400 | 1068 | 0 | 0 | 0 | 0 | no | 0.009090 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26349 | 10285 | 16524 | 1024 | 1024 | 0 | no | 0.280805 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9531 | 358 | 416 | 512 | 512 | 0 | no | 0.001263 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 40579 | 729 | 1767 | 2048 | 2048 | 0 | no | 0.018414 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 7066 | 260 | 397 | 512 | 512 | 0 | no | 0.000969 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 41880 | 962 | 2047 | 2048 | 2048 | 0 | no | 0.020087 |
| gemini | editor completion attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19184 | 3447 | 10360 | 1024 | 1024 | 0 | no | 0.153039 |

## Warnings

- Estimated LLM cost 0.4978761 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.4978761 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
