# LLM cost report - 2026-06-21

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 131786
- Output tokens: 21385
- Thinking tokens: 21158
- Cached tokens: 0
- Total tokens: 174329
- Estimated cost USD: 0.427132

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 25592 | 1916 | 458 | 512 | 512 | 0 | no | 0.013613 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 15554 | 994 | 0 | 0 | 0 | 0 | no | 0.007151 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20654 | 8591 | 13947 | 1024 | 1024 | 0 | no | 0.233823 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25056 | 9057 | 3893 | 1024 | 1024 | 0 | no | 0.154134 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9322 | 340 | 813 | 1024 | 1024 | 0 | no | 0.001393 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 35608 | 487 | 2047 | 2048 | 2048 | 0 | no | 0.017017 |

## Warnings

- Estimated LLM cost 0.4271316 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.4271316 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
