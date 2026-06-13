# LLM cost report - 2026-06-03

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 5
- Prompt tokens: 117065
- Output tokens: 15003
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 132068
- Estimated cost USD: 0.170062

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24308 | 2877 | 0 | 0 | 0 | 0 | no | 0.014485 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21515 | 1584 | 0 | 0 | 0 | 0 | no | 0.010415 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27852 | 10073 | 0 | 512 | 512 | 0 | no | 0.132435 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5670 | 156 | 0 | 0 | 0 | 0 | no | 0.000629 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 37720 | 313 | 0 | 0 | 0 | 0 | no | 0.012098 |

## Warnings

- Estimated LLM cost 0.1700623 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
