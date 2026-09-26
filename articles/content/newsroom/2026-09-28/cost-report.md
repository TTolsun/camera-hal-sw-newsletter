# LLM cost report - 2026-09-28

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 14
- Prompt tokens: 573928
- Output tokens: 59719
- Thinking tokens: 57947
- Cached tokens: 0
- Total tokens: 691594
- Estimated cost USD: 1.196633

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 45245 | 3860 | 511 | 512 | 512 | 0 | no | 0.024501 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 32300 | 1543 | 0 | 0 | 0 | 0 | no | 0.013548 |
| gemini | editorial-plan attempt 1/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48625 | 4302 | 1020 | 1024 | 1024 | 0 | no | 0.027893 |
| gemini | editor attempt 1/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 42464 | 16519 | 32135 | 1024 | 1024 | 0 | no | 0.501582 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 16861 | 555 | 848 | 1024 | 1024 | 0 | no | 0.002247 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 62303 | 774 | 2044 | 2048 | 2048 | 0 | no | 0.025736 |
| gemini | editor repair attempt 1/2 | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 40283 | 717 | 4501 | 1024 | 1024 | 0 | no | 0.107386 |
| gemini | editor repair attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 16989 | 555 | 747 | 1024 | 1024 | 0 | no | 0.002220 |
| gemini | fact-checker repair attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 78346 | 747 | 2047 | 2048 | 2048 | 0 | no | 0.030489 |
| gemini | reporter attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 50248 | 3751 | 479 | 512 | 512 | 0 | no | 0.025649 |
| gemini | background-context attempt 2/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 31963 | 1334 | 0 | 0 | 0 | 0 | no | 0.012924 |
| gemini | editorial-plan attempt 2/2 | editorialPlan | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 48288 | 3616 | 1021 | 1024 | 1024 | 0 | no | 0.026079 |
| gemini | editor attempt 2/2 | editor | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 30227 | 9727 | 8004 | 1024 | 1024 | 0 | no | 0.204920 |
| gemini | editor attempt 2/2 semantic repair | repair | gemini-3.5-flash | gemini-3.5-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.5-flash | 1 | 29786 | 11719 | 4590 | 1024 | 1024 | 0 | no | 0.191460 |

## Warnings

- Estimated LLM cost 1.1966329 USD reached NEWSROOM_WARN_COST_USD 0.5 USD.
- Estimated LLM cost 1.1966329 USD reached NEWSROOM_MAX_COST_USD 0.7 USD. This PR is warning-only.
