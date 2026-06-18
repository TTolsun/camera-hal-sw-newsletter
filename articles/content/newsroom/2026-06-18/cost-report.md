# LLM cost report - 2026-06-18

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 5
- Prompt tokens: 132518
- Output tokens: 14591
- Thinking tokens: 19197
- Cached tokens: 0
- Total tokens: 166306
- Estimated cost USD: 0.331334

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31389 | 1766 | 0 | 0 | 0 | 0 | no | 0.013832 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21429 | 1174 | 0 | 0 | 0 | 0 | no | 0.009364 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26797 | 10764 | 16724 | 1024 | 1024 | 0 | no | 0.287587 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 10219 | 370 | 428 | 512 | 512 | 0 | no | 0.001341 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 42684 | 517 | 2045 | 2048 | 2048 | 0 | no | 0.019210 |

## Warnings

- Estimated LLM cost 0.3313342 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.3313342 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
