# LLM cost report - 2026-05-21

## Summary

- Enforcement: warning-only
- Pricing source: https://ai.google.dev/gemini-api/docs/pricing
- Warning threshold USD: 0.15
- Max threshold USD: 0.25
- Pro escalation: manual
- Pro model configured: yes
- Pro model allowed: yes
- Request count: 5
- Prompt tokens: 70591
- Output tokens: 16854
- Thinking tokens: 12285
- Cached tokens: 0
- Total tokens: 99730
- Estimated cost USD: 0.379629

## Calls

| Provider | Stage | Model | Attempt | Prompt | Output | Thinking | Requested Budget | Applied Budget | Cached | Pro | Estimated USD |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| gemini | reporter attempt 1/2 | gemini-2.5-pro | 1 | 15575 | 4157 | 4491 | 0 | n/a | 0 | yes | 0.105949 |
| gemini | background-context attempt 1/2 | gemini-2.5-pro | 1 | 10660 | 864 | 1775 | 0 | n/a | 0 | yes | 0.039715 |
| gemini | editor attempt 1/2 | gemini-2.5-pro | 1 | 14001 | 5531 | 509 | 512 | 512 | 0 | yes | 0.077901 |
| gemini | editor attempt 1/2 semantic repair | gemini-2.5-pro | 1 | 10769 | 5943 | 2910 | 0 | n/a | 0 | yes | 0.101991 |
| gemini | fact-checker attempt 1/2 | gemini-2.5-pro | 1 | 19586 | 359 | 2600 | 0 | n/a | 0 | yes | 0.054073 |

## Warnings

- Gemini Pro call reporter attempt 1/2 did not apply thinkingBudget=0 because Pro may not support disabling thinking.
- Gemini Pro call background-context attempt 1/2 did not apply thinkingBudget=0 because Pro may not support disabling thinking.
- Gemini Pro call editor attempt 1/2 semantic repair did not apply thinkingBudget=0 because Pro may not support disabling thinking.
- Gemini Pro call fact-checker attempt 1/2 did not apply thinkingBudget=0 because Pro may not support disabling thinking.
- Estimated LLM cost 0.37962875 USD reached NEWSROOM_WARN_COST_USD 0.15 USD.
- Estimated LLM cost 0.37962875 USD reached NEWSROOM_MAX_COST_USD 0.25 USD. This PR is warning-only.
- Gemini Pro was used in 5 call(s); escalation=manual.
