# LLM cost report - 2026-06-02

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 109252
- Output tokens: 17048
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 126300
- Estimated cost USD: 0.199135

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19147 | 2306 | 0 | 0 | 0 | 0 | no | 0.011509 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14576 | 685 | 0 | 0 | 0 | 0 | no | 0.006085 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19708 | 7865 | 0 | 512 | 512 | 0 | no | 0.100347 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5991 | 237 | 0 | 0 | 0 | 0 | no | 0.000694 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 27874 | 2214 | 0 | 0 | 0 | 0 | no | 0.013897 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 21956 | 3741 | 0 | 0 | 0 | 0 | no | 0.066603 |

## Warnings

- Estimated LLM cost 0.1991355 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
