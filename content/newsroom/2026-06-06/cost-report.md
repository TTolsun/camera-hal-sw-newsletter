# LLM cost report - 2026-06-06

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 160200
- Output tokens: 16059
- Thinking tokens: 0
- Cached tokens: 13995
- Total tokens: 176259
- Estimated cost USD: 0.220969

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26190 | 2888 | 0 | 0 | 0 | 0 | no | 0.015077 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22232 | 2206 | 0 | 0 | 0 | 0 | no | 0.012185 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28561 | 5672 | 0 | 512 | 512 | 13995 | no | 0.074996 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3586 | 144 | 0 | 0 | 0 | 0 | no | 0.000416 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 34718 | 897 | 0 | 0 | 0 | 0 | no | 0.012658 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 44913 | 4252 | 0 | 0 | 0 | 0 | no | 0.105637 |

## Warnings

- Estimated LLM cost 0.22096945 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
