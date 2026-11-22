# LLM cost report - 2026-11-23

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.5
- Max threshold USD: 0.7
- Pro policy: disabled
- Request count: 13
- Prompt tokens: 192671
- Output tokens: 10011
- Thinking tokens: 14968
- Cached tokens: 36307
- Total tokens: 217650
- Estimated cost USD: 0.189960

## Calls

| Provider | Stage | Group | Primary | Attempt Model | Resolved By | Fallbacks | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | editor attempt 1/2 public article judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 20449 | 503 | 922 | 1024 | 1024 | 7878 | no | 0.001906 |
| gemini | fact-checker attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 89366 | 1631 | 6281 | 2048 | MEDIUM | 0 | no | 0.096695 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13600 | 946 | 0 | 2048 | MEDIUM | 0 | no | 0.013747 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6832 | 1110 | 0 | 2048 | MEDIUM | 0 | no | 0.009286 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6752 | 881 | 1486 | 2048 | MEDIUM | 0 | no | 0.013940 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8195 | 1005 | 1064 | 2048 | MEDIUM | 0 | no | 0.013905 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 13600 | 883 | 0 | 2048 | MEDIUM | 11750 | no | 0.005580 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6832 | 1039 | 1692 | 2048 | MEDIUM | 5148 | no | 0.011890 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 6752 | 896 | 1213 | 2048 | MEDIUM | 5072 | no | 0.009549 |
| gemini | article-source-review attempt 1/2 | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 8195 | 888 | 1236 | 2048 | MEDIUM | 6459 | no | 0.009751 |
| gemini | intro-letter | reporter | gemini-2.5-flash | gemini-2.5-flash | code_default | gemini-2.5-flash-lite | gemini-2.5-flash | 1 | 958 | 123 | 0 | 0 | 0 | 0 | no | 0.000595 |
| gemini | intro-letter-review | factcheck | gemini-3.8-flash | gemini-3.8-flash | code_default | gemini-2.5-flash, gemini-2.5-flash-lite | gemini-3.8-flash | 1 | 904 | 19 | 262 | 2048 | MEDIUM | 0 | no | 0.001732 |
| gemini | post-generation public quality judge | judge | gemini-2.5-flash-lite | gemini-2.5-flash-lite | code_default | gemini-2.5-flash | gemini-2.5-flash-lite | 1 | 10236 | 87 | 812 | 1024 | 1024 | 0 | no | 0.001383 |

## Warnings

- none
