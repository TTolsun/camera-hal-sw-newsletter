# LLM cost report - 2026-06-06

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 141511
- Output tokens: 15942
- Thinking tokens: 0
- Cached tokens: 13995
- Total tokens: 157453
- Estimated cost USD: 0.196271

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26395 | 3022 | 0 | 0 | 0 | 0 | no | 0.015473 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22520 | 1865 | 0 | 0 | 0 | 0 | no | 0.011418 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 28568 | 5180 | 0 | 512 | 512 | 13995 | no | 0.070579 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26766 | 5187 | 0 | 0 | 0 | 0 | no | 0.086832 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3225 | 136 | 0 | 0 | 0 | 0 | no | 0.000377 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 34037 | 552 | 0 | 0 | 0 | 0 | no | 0.011591 |

## Warnings

- Estimated LLM cost 0.19627075 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
