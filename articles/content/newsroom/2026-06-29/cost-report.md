# LLM cost report - 2026-06-29

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 125099
- Output tokens: 17781
- Thinking tokens: 14153
- Cached tokens: 6403
- Total tokens: 157033
- Estimated cost USD: 0.316371

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 25462 | 1139 | 466 | 512 | 512 | 0 | no | 0.011651 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12932 | 655 | 0 | 0 | 0 | 0 | no | 0.005517 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 12105 | 1157 | 1023 | 1024 | 1024 | 0 | no | 0.009081 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19238 | 6265 | 8815 | 1024 | 1024 | 0 | no | 0.164577 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19587 | 7612 | 1382 | 1024 | 1024 | 0 | no | 0.110326 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 2 | 6806 | 250 | 763 | 1024 | 1024 | 6403 | no | 0.000510 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 28969 | 703 | 1704 | 2048 | 2048 | 0 | no | 0.014708 |

## Warnings

- Estimated LLM cost 0.31637093 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.31637093 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
