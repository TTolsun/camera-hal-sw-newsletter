# LLM cost report - 2026-06-02

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 101084
- Output tokens: 11853
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 112937
- Estimated cost USD: 0.176392

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14292 | 1120 | 0 | 0 | 0 | 0 | no | 0.007088 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14219 | 723 | 0 | 0 | 0 | 0 | no | 0.006073 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19947 | 4734 | 0 | 512 | 512 | 0 | no | 0.072526 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3317 | 141 | 0 | 0 | 0 | 0 | no | 0.000388 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24381 | 93 | 0 | 0 | 0 | 0 | no | 0.007547 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 24928 | 5042 | 0 | 0 | 0 | 0 | no | 0.082770 |

## Warnings

- Estimated LLM cost 0.1763922 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
