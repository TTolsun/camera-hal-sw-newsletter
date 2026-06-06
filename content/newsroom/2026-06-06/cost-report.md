# LLM cost report - 2026-06-06

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 7
- Prompt tokens: 172831
- Output tokens: 26121
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 198952
- Estimated cost USD: 0.365073

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24087 | 1955 | 0 | 0 | 0 | 0 | no | 0.012114 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 20418 | 1237 | 0 | 0 | 0 | 0 | no | 0.009218 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 26396 | 6601 | 0 | 512 | 512 | 0 | no | 0.099003 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 27014 | 7406 | 0 | 0 | 0 | 0 | no | 0.107175 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 4711 | 147 | 0 | 0 | 0 | 0 | no | 0.000530 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 34082 | 977 | 0 | 0 | 0 | 0 | no | 0.012667 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 36123 | 7798 | 0 | 0 | 0 | 0 | no | 0.124367 |

## Warnings

- Estimated LLM cost 0.365073 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.365073 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
