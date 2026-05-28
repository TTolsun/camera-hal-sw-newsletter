# LLM cost report - 2026-05-28

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 106769
- Output tokens: 21001
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 127770
- Estimated cost USD: 0.227351

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13786 | 1054 | 0 | 0 | 0 | 0 | no | 0.006771 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13565 | 725 | 0 | 0 | 0 | 0 | no | 0.005882 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18867 | 10078 | 0 | 512 | 512 | 0 | no | 0.119002 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 6787 | 244 | 0 | 0 | 0 | 0 | no | 0.000776 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 30204 | 4551 | 0 | 0 | 0 | 0 | no | 0.020439 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 23560 | 4349 | 0 | 0 | 0 | 0 | no | 0.074481 |

## Warnings

- Estimated LLM cost 0.2273513 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
