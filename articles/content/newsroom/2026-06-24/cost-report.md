# LLM cost report - 2026-06-24

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 96005
- Output tokens: 9047
- Thinking tokens: 12787
- Cached tokens: 0
- Total tokens: 117839
- Estimated cost USD: 0.201318

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 16520 | 1001 | 510 | 512 | 512 | 0 | no | 0.008733 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 2 | 13162 | 815 | 0 | 0 | 0 | 0 | no | 0.005986 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 13332 | 1062 | 973 | 1024 | 1024 | 0 | no | 0.009087 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 20590 | 5443 | 8899 | 1024 | 1024 | 0 | no | 0.159963 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash | fallback | gemini-2.5-flash | gemini-2.5-flash | 1 | 5808 | 234 | 847 | 1024 | 1024 | 0 | no | 0.004445 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 26593 | 492 | 1558 | 2048 | 2048 | 0 | no | 0.013103 |

## Warnings

- Estimated LLM cost 0.2013175 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
