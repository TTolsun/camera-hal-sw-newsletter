# LLM cost report - 2026-05-23

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 6
- Prompt tokens: 95675
- Output tokens: 143847
- Thinking tokens: 0
- Cached tokens: 30726
- Total tokens: 239522
- Estimated cost USD: 1.332107

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 17839 | 5828 | 0 | 0 | 0 | 17413 | no | 0.015220 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 14589 | 1009 | 0 | 0 | 0 | 0 | no | 0.006899 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 18384 | 65521 | 0 | 512 | 512 | 0 | no | 0.617265 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 2 | 18384 | 65521 | 0 | 512 | 512 | 0 | no | 0.617265 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 3 | 18384 | 2984 | 0 | 512 | 512 | 13313 | no | 0.036459 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 8095 | 2984 | 0 | 0 | 0 | 0 | no | 0.038998 |

## Warnings

- Estimated LLM cost 1.33210734 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 1.33210734 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
