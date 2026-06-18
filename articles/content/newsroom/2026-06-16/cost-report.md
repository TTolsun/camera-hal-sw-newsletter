# LLM cost report - 2026-06-16

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro policy: disabled
- Request count: 6
- Prompt tokens: 148882
- Output tokens: 30852
- Thinking tokens: 3789
- Cached tokens: 0
- Total tokens: 183523
- Estimated cost USD: 0.127604

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | none | gemini-2.5-flash | 1 | 23306 | 1593 | 0 | 0 | 0 | 0 | no | 0.010974 |
| gemini | background-context attempt 1/2 | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | none | gemini-2.5-flash | 1 | 18517 | 1125 | 0 | 0 | 0 | 0 | no | 0.008368 |
| gemini | editor attempt 1/2 | editor | gemini-2.5-flash | gemini-2.5-flash | NEWSROOM_EDITOR_MODEL | none | gemini-2.5-flash | 1 | 24190 | 13658 | 815 | 1024 | 1024 | 0 | no | 0.043439 |
| gemini | editor attempt 1/2 semantic repair | repair | gemini-2.5-flash | gemini-2.5-flash | NEWSROOM_REPAIR_MODEL | none | gemini-2.5-flash | 1 | 31572 | 13671 | 747 | 1024 | 1024 | 0 | no | 0.045517 |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | none | gemini-2.5-flash-lite | 1 | 10545 | 325 | 415 | 512 | 512 | 0 | no | 0.001350 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-2.5-flash | gemini-2.5-flash | code_default | none | gemini-2.5-flash | 1 | 40752 | 480 | 1812 | 2048 | 2048 | 0 | no | 0.017956 |

## Warnings

- none
