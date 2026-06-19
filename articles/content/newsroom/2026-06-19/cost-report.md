# LLM cost report - 2026-06-19

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 181881
- Output tokens: 29806
- Thinking tokens: 25666
- Cached tokens: 0
- Total tokens: 237353
- Estimated cost USD: 0.583005

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 41695 | 2151 | 0 | 0 | 0 | 0 | no | 0.017886 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22346 | 1245 | 0 | 0 | 0 | 0 | no | 0.009816 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26542 | 11229 | 12903 | 1024 | 1024 | 0 | no | 0.257001 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 35178 | 14328 | 10709 | 1024 | 1024 | 0 | no | 0.278100 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 11678 | 342 | 404 | 512 | 512 | 0 | no | 0.001466 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 44442 | 511 | 1650 | 2048 | 2048 | 0 | no | 0.018735 |

## Warnings

- Estimated LLM cost 0.5830046 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.5830046 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
