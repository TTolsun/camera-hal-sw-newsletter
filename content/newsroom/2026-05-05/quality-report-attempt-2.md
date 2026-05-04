# 뉴스레터 품질 리포트 - 2026-05-05

## Gate Result

- Quality score: 68
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 68, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 4
- Briefing count: 3
- Camera article count: 1
- AI article count: 1
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 6
- Source-gap count: 1
- Source integrity violation count: 0
- Blocking deduction count: 3
- Blocking deduction categories: hal-relevance, source-integrity
- Hard fail count: 3
- Soft deduction count: 3

## Article Gate Results

| # | Result | Repair action | Headline | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선 | Fact-check must_fix item mentions this section.; Source gap or ineligible source evidence mentions this section. | none |
| 2 | FAIL | repair-section | Android용 하이브리드 추론 및 새로운 Gemini 모델 지원 | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 3 | FAIL | repair-section | GCC 16.1 컴파일러 출시: 성능 향상 및 C++ 네이티브 코드에 대한 시사점 | Fact-check must_fix item mentions this section. | none |
| 4 | FAIL | repair-section | FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향 | Fact-check must_fix item mentions this section. | actionability: Article action item is not concrete enough for a HAL engineering team.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [hal-relevance] Expected at least 2 Camera HAL / Android Camera articles, found 1.
- 15 pt [source-integrity] Fact checker returned 6 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).

## Soft Deductions

- 1 pt [image-fallback] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article image uses a local fallback visual.
- 4 pt [actionability] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article action item is not concrete enough for a HAL engineering team.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (2)
- source-integrity (2)
- actionability (1)
- hal-relevance (1)

## Candidate Exclusion Summary

- none

## Deductions

- 8 pt [hal-relevance] Expected at least 2 Camera HAL / Android Camera articles, found 1.
- 1 pt [image-fallback] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article image uses a local fallback visual.
- 4 pt [actionability] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article action item is not concrete enough for a HAL engineering team.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 6 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).
