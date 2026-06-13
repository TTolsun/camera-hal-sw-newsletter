# LLM cost report - 2026-06-13

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 193864
- Output tokens: 69108
- Thinking tokens: 25226
- Cached tokens: 37229
- Total tokens: 288198
- Estimated cost USD: 0.944226

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22961 | 1885 | 0 | 0 | 0 | 0 | no | 0.011601 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22361 | 1435 | 0 | 0 | 0 | 0 | no | 0.010296 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28549 | 3524 | 6985 | 1024 | 1024 | 0 | no | 0.137405 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3003 | 130 | 401 | 512 | 512 | 0 | no | 0.000513 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32884 | 1205 | 2044 | 2048 | 2048 | 0 | no | 0.017988 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 42053 | 57876 | 7645 | 1024 | 1024 | 0 | no | 0.652768 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 2 | 42053 | 3053 | 8151 | 1024 | 1024 | 37229 | no | 0.113656 |

## Warnings

- Estimated LLM cost 0.94422635 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.94422635 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
