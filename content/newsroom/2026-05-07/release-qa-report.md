# 릴리스 QA 보고서 - 2026-05-07

## 생성 파일 목록

- content/collected-news/2026-05-07/candidates.json
- content/newsroom/2026-05-07/shortlisted-candidates.json
- content/newsroom/2026-05-07/article-capsules.json
- content/newsroom/2026-05-07/reporter-candidates.json
- content/newsroom/2026-05-07/editor-draft.json
- content/newsroom/2026-05-07/editor-draft.md
- content/newsroom/2026-05-07/fact-check-report.json
- content/newsroom/2026-05-07/fact-check-report.md
- content/newsroom/2026-05-07/quality-report.json
- content/newsroom/2026-05-07/quality-report.md
- content/newsroom/2026-05-07/stale-claim-report.json
- content/newsroom/2026-05-07/stale-claim-report.md
- content/newsroom/2026-05-07/retry-history.json
- content/newsroom/2026-05-07/retry-history.md
- content/newsroom/2026-05-07/cost-report.md
- content/newsroom/2026-05-07/recovery-prompt.md
- content/newsroom/2026-05-07/editor-in-chief-brief.md
- content/newsroom/2026-05-07/release-qa-report.md
- newsletters/2026-05-07/newsletter.md
- newsletters/2026-05-07/index.html
- data/newsletters.json

## npm run validate 실행 결과

> camera-hal-sw-newsletter@1.0.0 validate:site
> node scripts/validate-site.js


- Newsletter 2026-05-07 has unresolved fact-check must_fix items.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 3
- source gap 개수: 0

## 품질 게이트

- 품질 점수: 83/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt image-fallback (libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선); 1pt image-fallback (Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원); 15pt source-integrity
