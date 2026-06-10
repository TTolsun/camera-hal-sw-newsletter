# LLM cost report - 2026-06-10

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 147363
- Output tokens: 13798
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 161161
- Estimated cost USD: 0.222635

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19465 | 2177 | 0 | 0 | 0 | 0 | no | 0.011282 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19334 | 1388 | 0 | 0 | 0 | 0 | no | 0.009270 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25460 | 3892 | 0 | 512 | 512 | 0 | no | 0.073218 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 23038 | 4451 | 0 | 0 | 0 | 0 | no | 0.074616 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3106 | 139 | 0 | 0 | 0 | 0 | no | 0.000366 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30785 | 1596 | 0 | 0 | 0 | 0 | no | 0.013225 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26175 | 155 | 0 | 0 | 0 | 0 | no | 0.040657 |

## Warnings

- Estimated LLM cost 0.2226354 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
