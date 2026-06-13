# LLM cost report - 2026-05-11

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 4
- Prompt tokens: 66862
- Output tokens: 15861
- Thinking tokens: 495
- Cached tokens: 0
- Total tokens: 83218
- Estimated cost USD: 0.060949

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash | 2 | 16096 | 7467 | 0 | 0 | 0 | 0 | no | 0.023496 |
| gemini | editor attempt 1/2 | gemini-2.5-flash | 2 | 12152 | 6354 | 495 | 512 | 512 | 0 | no | 0.020768 |
| gemini | fact-checker attempt 1/2 | gemini-2.5-flash | 2 | 21023 | 463 | 0 | 0 | 0 | 0 | no | 0.007464 |
| gemini | editor repair attempt 1/2 | gemini-2.5-flash | 1 | 17591 | 1577 | 0 | 0 | 0 | 0 | no | 0.009220 |

## Warnings

- none
