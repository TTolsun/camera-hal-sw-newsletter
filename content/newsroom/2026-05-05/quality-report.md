# 뉴스레터 품질 리포트 - 2026-05-05

## Gate Result

- Quality score: 72
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 72, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 3
- Briefing count: 3
- Camera article count: 0
- AI article count: 1
- Underfilled/composition failure: only 3 main articles were generated; expected at least 4.

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 2
- Source-gap count: 0
- Source integrity violation count: 0
- Blocking deduction count: 3
- Blocking deduction categories: composition, hal-relevance, source-integrity
- Hard fail count: 3
- Soft deduction count: 3

## Article Gate Results

| # | Result | Repair action | Headline | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Android용 하이브리드 추론 및 새로운 Gemini 모델 지원 | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | GCC 16.1 컴파일러 출시: 성능 향상 및 C++ 네이티브 코드에 대한 시사점 | none | none |
| 3 | PASS | preserve | FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향 | none | actionability: Article action item is not concrete enough for a HAL engineering team.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 4 pt [composition] Expected 4-5 main articles, found 3.
- 8 pt [hal-relevance] Expected at least 2 Camera HAL / Android Camera articles, found 0.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).

## Soft Deductions

- 1 pt [image-fallback] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article image uses a local fallback visual.
- 4 pt [actionability] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article action item is not concrete enough for a HAL engineering team.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (2)
- actionability (1)
- composition (1)
- hal-relevance (1)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 4 pt [composition] Expected 4-5 main articles, found 3.
- 8 pt [hal-relevance] Expected at least 2 Camera HAL / Android Camera articles, found 0.
- 1 pt [image-fallback] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article image uses a local fallback visual.
- 4 pt [actionability] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article action item is not concrete enough for a HAL engineering team.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향: Article image uses a local fallback visual.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).
