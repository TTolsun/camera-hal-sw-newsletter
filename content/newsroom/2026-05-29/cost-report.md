# LLM cost report - 2026-05-29

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 106881
- Output tokens: 22147
- Thinking tokens: 0
- Cached tokens: 0
- Total tokens: 129028
- Estimated cost USD: 0.265504

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13786 | 993 | 0 | 0 | 0 | 0 | no | 0.006618 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13501 | 757 | 0 | 0 | 0 | 0 | no | 0.005943 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18827 | 9593 | 0 | 512 | 512 | 0 | no | 0.114577 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 23781 | 10223 | 0 | 0 | 0 | 0 | no | 0.127679 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 6693 | 249 | 0 | 0 | 0 | 0 | no | 0.000769 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 3 | 30293 | 332 | 0 | 0 | 0 | 0 | no | 0.009918 |

## Warnings

- Estimated LLM cost 0.2655039 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.2655039 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
