# LLM cost report - 2026-06-02

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 106312
- Output tokens: 14393
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 120705
- Estimated cost USD: 0.186679

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 19147 | 2234 | 0 | 0 | 0 | 0 | no | 0.011329 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14372 | 773 | 0 | 0 | 0 | 0 | no | 0.006244 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19557 | 7067 | 0 | 512 | 512 | 0 | no | 0.092938 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 5551 | 235 | 0 | 0 | 0 | 0 | no | 0.000649 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26920 | 71 | 0 | 0 | 0 | 0 | no | 0.008254 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20765 | 4013 | 0 | 0 | 0 | 0 | no | 0.067265 |

## Warnings

- Estimated LLM cost 0.1866788 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
