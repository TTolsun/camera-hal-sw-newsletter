# LLM cost report - 2026-06-15

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 10
- Prompt tokens: 194235
- Output tokens: 21863
- Thinking tokens: 29901
- Cached tokens: 0
- Total tokens: 245999
- Estimated cost USD: 0.557541

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24690 | 1573 | 0 | 0 | 0 | 0 | no | 0.011340 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16994 | 1249 | 0 | 0 | 0 | 0 | no | 0.008221 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 22440 | 4508 | 6966 | 1024 | 1024 | 0 | no | 0.136926 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20859 | 4062 | 5391 | 1024 | 1024 | 0 | no | 0.116365 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3489 | 140 | 389 | 512 | 512 | 0 | no | 0.000561 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 27571 | 904 | 2045 | 2048 | 2048 | 0 | no | 0.015644 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26454 | 1658 | 0 | 0 | 0 | 0 | no | 0.012081 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16994 | 1034 | 0 | 0 | 0 | 0 | no | 0.007683 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18891 | 3101 | 10135 | 1024 | 1024 | 0 | no | 0.147460 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 15853 | 3634 | 4975 | 1024 | 1024 | 0 | no | 0.101261 |

## Warnings

- Estimated LLM cost 0.5575414 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.5575414 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
