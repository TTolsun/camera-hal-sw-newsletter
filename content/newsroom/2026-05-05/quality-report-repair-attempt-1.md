# 뉴스레터 품질 리포트 - 2026-05-05

## Gate Result

- Quality score: 75
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 75, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 4
- Briefing count: 3
- Camera article count: 2
- AI article count: 1
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 2
- Source-gap count: 2
- Source integrity violation count: 0
- Blocking deduction count: 4
- Blocking deduction categories: evidence-specificity, source-integrity
- Hard fail count: 4
- Soft deduction count: 0

## Article Gate Results

| # | Result | Repair action | Headline | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선 | none | none |
| 2 | FAIL | replace-or-demote | Linux 커널 7.1-rc2 출시: 카메라 드라이버 안정성 관련 잠재적 영향 | Fact-check must_fix item mentions this section.; Source gap or ineligible source evidence mentions this section. | none |
| 3 | FAIL | repair-section | GCC 16.1 컴파일러 출시: C++ 네이티브 코드 성능 최적화 인사이트 | Fact-check must_fix item mentions this section. | none |
| 4 | FAIL | repair-section | Android용 하이브리드 추론 및 새로운 Gemini 모델 지원 | Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change. | none |

## Hard Fails

- 5 pt [evidence-specificity] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.
- 4 pt [evidence-specificity] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).
- 6 pt [source-integrity] Fact checker reported 2 source gap(s).

## Soft Deductions

- none

## Top Deduction Categories

- evidence-specificity (2)
- source-integrity (2)

## Candidate Exclusion Summary

- none

## Deductions

- 5 pt [evidence-specificity] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.
- 4 pt [evidence-specificity] Android용 하이브리드 추론 및 새로운 Gemini 모델 지원: Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).
- 6 pt [source-integrity] Fact checker reported 2 source gap(s).
