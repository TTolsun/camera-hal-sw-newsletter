# LLM cost report - 2026-06-05

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 162966
- Output tokens: 21627
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 184593
- Estimated cost USD: 0.293598

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 22711 | 1684 | 0 | 0 | 0 | 0 | no | 0.011023 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21364 | 1141 | 0 | 0 | 0 | 0 | no | 0.009262 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27060 | 13952 | 0 | 512 | 512 | 0 | no | 0.166158 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 9487 | 351 | 0 | 0 | 0 | 0 | no | 0.001089 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 44021 | 787 | 0 | 0 | 0 | 0 | no | 0.015174 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 38323 | 3712 | 0 | 0 | 0 | 0 | no | 0.090893 |

## Warnings

- Estimated LLM cost 0.2935984 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.2935984 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
