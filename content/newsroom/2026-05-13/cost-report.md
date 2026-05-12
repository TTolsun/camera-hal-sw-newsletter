# LLM cost report - 2026-05-13

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 3
- Prompt tokens: 31671
- Output tokens: 11663
- Thinking tokens: 509
- Cached tokens: 0
- Total tokens: 43843
- Estimated cost USD: 0.039931

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash | 1 | 11402 | 2784 | 0 | 0 | 0 | 0 | no | 0.010381 |
| gemini | background-context attempt 1/2 | gemini-2.5-flash | 1 | 9043 | 1309 | 0 | 0 | 0 | 0 | no | 0.005985 |
| gemini | editor attempt 1/2 | gemini-2.5-flash | 1 | 11226 | 7570 | 509 | 512 | 512 | 0 | no | 0.023565 |

## Warnings

- none
