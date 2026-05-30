# Fallback Audit — Issue #60+#85 Cleanup Epic PR 12

본 문서는 issue #60+#85 cleanup epic의 PR 12 산출물이며, 코드 변경 없이 dirty fallback branch의 보호 목적과 다음 조치를 분류한다.

---

## Fallback 목록 (14건)

| 위치 | 카테고리 | 조치 |
|---|---|---|
| `scripts/newsroom/collect/linked-release-note-evidence.js:100` `used_empty_evidence_fallback` | source integrity | 보존 + 로깅 강화 검토 |
| `scripts/newsroom/collect/extract-source-facts.js:38` metadataFallback 캐스케이드 | publish safety | 보존(confidence 강등이 contract) |
| `scripts/newsroom/collect/extract-source-facts.js:41` camera_relevance 0 fallback | needs-evidence | 명시 플래그 필요성 audit |
| `scripts/newsroom/collect/seed-evidence.js:308` summary/behavior_change fallback | source integrity | 보존 |
| `scripts/newsroom/collect/source-intelligence-utils.js:185-187` numeric() 0 기본 | quality gate safety | 보존, 로깅 옵션 검토 |
| `scripts/newsroom/validate/claim-source-binding.js:207-209` evidence_status `allowed` 기본 | publish safety | **고위험 — deprecation plan 우선항목** (헬퍼 위치; 위험 호출자: 226, 311-312) |
| `scripts/newsroom/validate/claim-source-binding.js:310-312` role-based fallback | needs-evidence | primary 의도 audit |
| `scripts/newsroom/validate/newsletter-quality.js:871-886` `section_text_fallback` | publish safety | **고위험 — 회귀 테스트 추가 후 deprecate** |
| `scripts/newsroom/validate/newsletter-quality.js:1182` CPP/AI bucket 자동 fallback | needs-evidence | override 의도 검증 |
| `scripts/newsroom/validate/claim-source-binding.js:635-636,658-659` seed_evidence_pack_*_fallback_rejected | publish safety | advisory↔blocking 결정 필요 |
| `scripts/newsroom/collect/source-item-parsers.js:122` componentFromText 빈 fallback | source integrity | parse 실패 로깅 검토 |
| `scripts/newsroom/collect/gemini-source-discovery.js:297-298` url variant fallback | old schema compatibility | 보존 + 변형 warning 검토 |
| `scripts/newsroom/collect/gemini-source-discovery.js:144-146` titleFromHtml 기본값 | old schema compatibility | 보존 |
| `scripts/newsroom/collect/seed-evidence.js:212` maxRedirects ?? | old schema compatibility | 보존 |

---

## 고위험 항목 (2건)

다음 2건은 publish safety 분류이며 `docs/refactor/deprecation-plan.md`에서 우선항목으로 기록된다.

### 1. `validate/claim-source-binding.js:207-209` evidence_status `allowed` 기본

`fetch_status` 필드가 누락된 경우 evidence_status를 `allowed`로 기본 처리한다. 누락된 fetch 결과가 PASS로 통과될 위험이 있다. source binding 정책 변경은 publish gate에 직접 영향을 주므로 정책 검토 + 회귀 테스트 동반 없이 수정할 수 없다.

### 2. `validate/newsletter-quality.js:871-886` `section_text_fallback`

section 메타데이터가 누락된 경우 section_text를 evidence 소스로 fallback 처리한다. newsletter rendering 흐름과 강결합되어 있어 변경 시 publish 영향이 크다. 회귀 테스트 추가 후 deprecate 검토.

---

## 카테고리별 처리 원칙

| 카테고리 | 처리 원칙 |
|---|---|
| `source integrity` | 보호 목적 명확 → 보존하되 로깅·문서 강화 검토 |
| `publish safety` | 보호 목적 명확 → 보존하되 로깅·문서 강화 검토. 고위험 2건은 deprecation-plan 우선항목. |
| `quality gate safety` | 보호 목적 명확 → 보존하되 로깅 옵션 검토 |
| `old schema compatibility` | 보존(기존 데이터 호환을 위함) |
| `needs-evidence` | 추가 audit 필요(설계 의도 확인 후 처리 방향 결정) |
