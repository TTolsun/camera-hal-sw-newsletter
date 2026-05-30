# Deprecation Plan — Issue #60+#85 Cleanup Epic PR 12

본 문서는 issue #60+#85 cleanup epic의 PR 1~11에서 `deprecate / needs-evidence`로 남은 항목별 처리 계획을 담는다.

---

## 고위험 fallback 우선항목 (PR 12 fallback-audit에서 이관)

### A. `validate/claim-source-binding.js:207-209` evidence_status `allowed` 기본

- **현재 동작**: 라인 207-209의 `normalizeEvidenceStatus(value, fallback = 'allowed')`는 일반 normalize 헬퍼다. publish-safety 위험은 fallback override 없이 헬퍼를 호출하는 곳에서 발생한다 — 라인 226(`normalizeEvidenceStatus(item.status)`)과 라인 311-312(`fallbackStatus`가 `role==='primary'`일 때 `allowed`). 268-269 호출자는 `''`을 fallback으로 명시해 누락이 PASS되지 않는다.
- **왜 지금 처리하지 않는가**: source binding 정책 변경은 publish gate 영향. 단순 코드 변경이 아니라 정책 + 회귀 테스트 동반 필요.
- **처리 evidence 조건**:
  - (1) 현재 evidence_status 누락 케이스 빈도 측정(`grep`/로그 분석)
  - (2) 누락 케이스 발생 시 의도된 캐치인지 정책 의도 확인
  - (3) 회귀 테스트 추가(누락 → 명시적 FAIL or WARN)
  - evidence-condition 측정 대상은 헬퍼 자체(207-209)가 아니라 fallback override 없는 호출자(226, 311-312)다.
- **다음 검토 시점**: 다음 release 사이클 + #185 후속 cleanup PR.

### B. `validate/newsletter-quality.js:871-886` `section_text_fallback`

- **현재 동작**: section 메타데이터 누락 시 section_text를 evidence 소스로 fallback 처리.
- **왜 지금 처리하지 않는가**: newsletter rendering 흐름과 강결합. 변경 시 publish 영향 큼.
- **처리 evidence 조건**:
  - (1) section_text_fallback 발생 빈도 측정
  - (2) 회귀 테스트 추가(fallback 발생 시 명시적 WARN/원인 로깅)
  - (3) 정상 메타데이터를 모든 section에서 강제하는 schema 점검 후 fallback 제거 검토
- **다음 검토 시점**: 회귀 테스트 PR 완료 후.

---

## needs-evidence 항목 (fallback-audit에서 4건)

아래 4건은 설계 의도가 불명확하여 추가 audit이 필요하다. 코드 변경 전 각 항목의 원래 의도를 확인해야 한다.

| 위치 | 항목 | 메모 |
|---|---|---|
| `scripts/newsroom/collect/extract-source-facts.js:41` | camera_relevance 0 fallback | camera_relevance 0이 의도된 기본인지 명시 플래그 필요성 audit |
| `scripts/newsroom/validate/claim-source-binding.js:310-312` | role-based fallback | primary 의도 audit — role 누락 시 fallback이 의도된 동작인지 확인 |
| `scripts/newsroom/validate/newsletter-quality.js:1182` | CPP/AI bucket 자동 fallback | override 의도 검증 — 자동 fallback이 섹션 분류를 덮어쓰는 경우 처리 의도 확인 |
| `scripts/newsroom/validate/claim-source-binding.js:635-636,658-659` | seed_evidence_pack_*_fallback_rejected | advisory↔blocking 결정 필요 — 현재 advisory로 처리 중인지 blocking으로 전환해야 하는지 결정 |

---

## PR 1~11 다른 deprecation/needs-evidence 항목

PR 5~6 helper migration 시 시그니처 차이 또는 시맨틱 차이로 보수적으로 skip된 caller 목록:

- PR 5: 12개 `readJsonIfExists` caller가 시그니처 차이로 migrate 보류 → 후속 PR에서 시그니처 통일 결정 필요
- PR 5: 3개 `truncateText` caller가 `maxLength - 3` reserve 시맨틱 차이로 보류
- PR 6: `editor-pr-summary.js`의 `escapeMarkdownCell`/`renderRows` 시맨틱 차이로 보류

---

## 다음 처리 사이클 가이드

우선순위: 고위험 publish safety 2건 > needs-evidence audit > helper migration 마무리

| 우선순위 | 항목 | 선행 조건 |
|---|---|---|
| 1 | `validate/claim-source-binding.js:207-209` evidence_status `allowed` 기본 | 빈도 측정 + 회귀 테스트 |
| 2 | `validate/newsletter-quality.js:871-886` `section_text_fallback` | 빈도 측정 + 회귀 테스트 |
| 3 | needs-evidence 4건 audit | 설계 의도 확인 |
| 4 | helper migration 마무리 (readJsonIfExists, truncateText, escapeMarkdownCell) | 시그니처 통일 결정 |
