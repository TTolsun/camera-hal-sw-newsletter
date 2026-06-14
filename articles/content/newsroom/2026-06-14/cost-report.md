# LLM cost report - 2026-06-14

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 184823
- Output tokens: 17622
- Thinking tokens: 26227
- Cached tokens: 0
- Total tokens: 228672
- Estimated cost USD: 0.520114

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 29571 | 1567 | 0 | 0 | 0 | 0 | no | 0.012789 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 21824 | 1172 | 0 | 0 | 0 | 0 | no | 0.009477 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27217 | 4295 | 8249 | 1024 | 1024 | 0 | no | 0.153722 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 25321 | 4557 | 3494 | 1024 | 1024 | 0 | no | 0.110440 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3183 | 141 | 399 | 512 | 512 | 0 | no | 0.000534 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31913 | 1785 | 2044 | 2048 | 2048 | 0 | no | 0.019146 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 45794 | 4105 | 12041 | 1024 | 1024 | 0 | no | 0.214005 |

## Warnings

- Estimated LLM cost 0.5201137 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.5201137 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
