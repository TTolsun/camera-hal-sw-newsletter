# LLM cost report - 2026-06-06

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 152641
- Output tokens: 14384
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 167025
- Estimated cost USD: 0.217566

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24345 | 2605 | 0 | 0 | 0 | 0 | no | 0.013816 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21081 | 1936 | 0 | 0 | 0 | 0 | no | 0.011164 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27137 | 4702 | 0 | 512 | 512 | 0 | no | 0.083024 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3242 | 136 | 0 | 0 | 0 | 0 | no | 0.000379 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32944 | 1782 | 0 | 0 | 0 | 0 | no | 0.014338 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 43892 | 3223 | 0 | 0 | 0 | 0 | no | 0.094845 |

## Warnings

- Estimated LLM cost 0.2175656 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
