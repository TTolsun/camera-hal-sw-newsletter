# LLM cost report - 2026-05-31

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 10
- Prompt tokens: 155875
- Output tokens: 26730
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 182605
- Estimated cost USD: 0.343660

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14068 | 1106 | 0 | 0 | 0 | 0 | no | 0.006985 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13946 | 667 | 0 | 0 | 0 | 0 | no | 0.005851 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 19437 | 4627 | 0 | 512 | 512 | 0 | no | 0.070799 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18741 | 4846 | 0 | 0 | 0 | 0 | no | 0.071725 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 3304 | 145 | 0 | 0 | 0 | 0 | no | 0.000388 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 24731 | 496 | 0 | 0 | 0 | 0 | no | 0.008659 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 15132 | 1085 | 0 | 0 | 0 | 0 | no | 0.007252 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 14222 | 697 | 0 | 0 | 0 | 0 | no | 0.006009 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 15749 | 6311 | 0 | 512 | 512 | 0 | no | 0.080422 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 16545 | 6750 | 0 | 0 | 0 | 0 | no | 0.085568 |

## Warnings

- Estimated LLM cost 0.3436596 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.3436596 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
