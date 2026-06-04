# LLM cost report - 2026-06-04

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 177411
- Output tokens: 25841
- Thinking tokens: 0
- Cached tokens: 14102
- Total tokens: 203252
- Estimated cost USD: 0.307087

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 25371 | 1874 | 0 | 0 | 0 | 0 | no | 0.012296 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24245 | 1352 | 0 | 0 | 0 | 0 | no | 0.010653 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 30134 | 14122 | 0 | 512 | 512 | 14102 | no | 0.153261 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 10067 | 369 | 0 | 0 | 0 | 0 | no | 0.001154 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 47355 | 2763 | 0 | 0 | 0 | 0 | no | 0.021114 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 40239 | 5361 | 0 | 0 | 0 | 0 | no | 0.108607 |

## Warnings

- Estimated LLM cost 0.3070869 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.3070869 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
