# LLM cost report - 2026-06-22

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 128877
- Output tokens: 24464
- Thinking tokens: 23315
- Cached tokens: 0
- Total tokens: 176656
- Estimated cost USD: 0.477953

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21159 | 1796 | 458 | 512 | 512 | 0 | no | 0.011983 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 15197 | 1131 | 0 | 0 | 0 | 0 | no | 0.007387 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20834 | 9253 | 14000 | 1024 | 1024 | 0 | no | 0.240528 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26056 | 11216 | 6717 | 1024 | 1024 | 0 | no | 0.200481 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 9493 | 346 | 719 | 1024 | 1024 | 0 | no | 0.001375 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 36138 | 722 | 1421 | 2048 | 2048 | 0 | no | 0.016199 |

## Warnings

- Estimated LLM cost 0.4779525 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.4779525 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
