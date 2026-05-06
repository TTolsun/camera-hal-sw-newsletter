# LLM cost report - 2026-05-07

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: no
- Pro model allowed: no
- Request count: 12
- Prompt tokens: 175574
- Output tokens: 38787
- Thinking tokens: 1393
- Cached tokens: 22380
- Total tokens: 215754
- Estimated cost USD: 0.118775

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-flash | 1 | 12827 | 4951 | 0 | 0 | 0 | 0 | no | 0.016226 |
| gemini | editor attempt 1/2 | gemini-2.5-flash-lite | 1 | 10508 | 7301 | 372 | 512 | 512 | 0 | no | 0.004120 |
| gemini | fact-checker attempt 1/2 | gemini-2.5-flash-lite | 1 | 16931 | 427 | 0 | 0 | 0 | 0 | no | 0.001864 |
| gemini | editor repair attempt 1/2 | gemini-2.5-flash-lite | 1 | 13998 | 1432 | 0 | 0 | 0 | 0 | no | 0.001973 |
| gemini | fact-checker repair attempt 1/2 | gemini-2.5-flash | 1 | 16797 | 3183 | 0 | 0 | 0 | 0 | no | 0.012997 |
| gemini | editor completion attempt 1/2 | gemini-2.5-flash | 1 | 7142 | 1717 | 511 | 512 | 512 | 0 | no | 0.007713 |
| gemini | fact-checker completion attempt 1/2 | gemini-2.5-flash | 1 | 19008 | 1160 | 0 | 0 | 0 | 0 | no | 0.008602 |
| gemini | reporter attempt 2/2 | gemini-2.5-flash | 1 | 12867 | 4662 | 0 | 0 | 0 | 0 | no | 0.015515 |
| gemini | editor attempt 2/2 | gemini-2.5-flash | 3 | 10499 | 10977 | 510 | 512 | 512 | 10001 | no | 0.029167 |
| gemini | fact-checker attempt 2/2 | gemini-2.5-flash | 1 | 22469 | 110 | 0 | 0 | 0 | 0 | no | 0.007016 |
| gemini | editor repair attempt 2/2 | gemini-2.5-flash | 2 | 12438 | 1468 | 0 | 0 | 0 | 12379 | no | 0.004059 |
| gemini | fact-checker repair attempt 2/2 | gemini-2.5-flash | 2 | 20090 | 1399 | 0 | 0 | 0 | 0 | no | 0.009524 |

## Warnings

- none
