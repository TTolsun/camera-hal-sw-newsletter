# 뉴스레터 품질 리포트 - 2026-05-05

## Gate Result

- Quality score: 89
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 89, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 5
- Briefing count: 3
- Camera article count: 4
- AI article count: 2
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Source integrity violation count: 0
- Blocking deduction count: 2
- Blocking deduction categories: evidence-specificity
- Hard fail count: 2
- Soft deduction count: 2

## Article Gate Results

| # | Result | Repair action | Headline | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대 | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향 | none | none |
| 3 | PASS | preserve | FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점 | none | image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수 | none | none |
| 5 | FAIL | repair-section | Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원 | Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change. | none |

## Hard Fails

- 5 pt [evidence-specificity] Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원: Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.
- 4 pt [evidence-specificity] Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원: Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.

## Soft Deductions

- 1 pt [image-fallback] C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대: Article image uses a local fallback visual.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점: Article image uses a local fallback visual.

## Top Deduction Categories

- evidence-specificity (2)
- image-fallback (2)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [image-fallback] C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대: Article image uses a local fallback visual.
- 1 pt [image-fallback] FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점: Article image uses a local fallback visual.
- 5 pt [evidence-specificity] Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원: Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.
- 4 pt [evidence-specificity] Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원: Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.
