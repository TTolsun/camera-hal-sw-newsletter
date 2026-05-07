# generated artifact audit

기록일: 2026-05-05

## 감사 기준

public archive 삭제는 hard blocker가 명확한 경우로 제한합니다. `quality-report.json`이 없다는 이유만으로 자동 삭제하지 않습니다. legacy issue는 먼저 `newsletter.md`와 `index.html`을 현재 editorial policy 기준으로 수동 감사하고, hard blocker가 명확하지 않으면 삭제하지 않고 legacy warning으로 기록합니다.

아래 항목은 current editorial policy와 quality gate의 hard blocker로 판단합니다.

- main article에 source gap이 남아 있음.
- fact-check `must_fix`가 남아 있음.
- unsupported release claim 또는 stale claim이 남아 있음.
- `watchlist`, `reference_only`, `exclude` 후보가 main article로 발행됨.
- `hasDatedEvidence=false` 또는 `source_gap_risk=true` 후보가 main article로 사용됨.
- generic AI 또는 일반 IT 기사인데 Camera HAL, Android Camera, camera workflow, frame, stream, buffer, metadata, NPU/GPU/ISP resource management와 구체적으로 연결되지 않음.
- 필수 section/source/reference 계약 위반이 있음.
- 단일 기사 제거 후 main article 수가 configured Article Composition Policy 범위를 만족하지 못해 quality gate를 통과할 수 없음.

삭제 또는 기사 제거 후에는 현재 산출물 기준으로 `quality-report.json`과 `quality-report.md`를 재계산 또는 재생성합니다. 숫자만 수동으로 맞추는 방식은 금지합니다. 삭제 기준을 맞추기 위해 quality threshold, hard blocker, validator를 완화하지 않습니다.

## 날짜별 판단

### 2026-05-05

- Source candidate binding hardening (2026-05-05): 당시 gate 기준으로 모든 main article의 `source_candidate_url`/`source_candidate_hash`를 bound shortlist/reporter candidate에서 복구했습니다. 제거, `DEMOTE`, `FAIL` 처리된 section은 없으며, AI/C++/tooling article은 `cpp_ai_tooling_fallback` 또는 `soc_platform_signal` fallback bucket으로만 계산되고 `direct_aosp_camera_count`를 올리지 않습니다. `quality-report.json`/`.md`, `editor-draft.md`, `newsletter.md`, `index.html`은 `editor-draft.json`에서 재계산했습니다. Recompute result는 당시 quality threshold를 통과했고 source integrity violation은 없었습니다. Final validation: `npm.cmd run validate` PASS.

- 판단: public issue 유지.
- 조치: FreeBSD 15.1 Beta article 제거 후 당시 Article Composition Policy 기준으로 `newsletter.md`, `index.html`, `editor-draft.*`, `quality-report.*`를 재생성했습니다.
- 이유: source registry의 `Phoronix Linux Camera / Media` label과 generic `Linux camera / V4L2` metadata가 FreeBSD OS release를 main article PASS 경로로 끌어올린 regression입니다. 기사 본문은 current policy 기준의 구체적인 Camera HAL / Android Camera / frame / stream / buffer / metadata / NPU/GPU/ISP resource connection을 충분히 증명하지 못합니다.
- 보존: 전체 발행물은 fixture로 복사하지 않고, 최소 candidate/section sample만 `tests/fixtures/quality/bad/freebsd-source-label-regression.json`에 보존했습니다.

### 2026-05-04

- 판단: public archive에서 제거.
- 이유: `fact-check-report.json`에 unresolved `must_fix`가 있고 `quality-report.json`이 `NEEDS_FIX`입니다. hard blocker가 명확합니다.

### 2026-05-03

- 판단: public archive에서 제거.
- 이유: main article count가 configured Article Composition Policy 범위에 미달하고 `shortlisted-candidates.json`의 `publish_ready=false`, `underfilled=true` 상태입니다. 단일 기사 제거/보존으로 현재 gate를 통과할 수 없는 underfilled issue입니다.

### 2026-05-02

- 판단: public archive에서 제거.
- 이유: `fact-check-report.json`의 `source_gap_count`가 6개이고, AOSP/CameraX/CDD 같은 watch/reference page 기반 article이 main article로 발행되었습니다.

### 2026-05-01

- 판단: public archive에서 제거.
- 수동 감사: `newsletter.md`와 `index.html`을 현재 editorial policy 기준으로 확인했습니다.
- 이유: AOSP Camera documentation, AOSP What's New, CameraX release notes 같은 watch/reference-only page가 “AOSP Camera 프레임워크 및 CameraX 최신 동향 주시” main article의 핵심 source로 발행되었습니다. “Android 15 Camera HAL 개발자를 위한 잠재적 변경 사항 및 고려 사항” article은 공식 변경 사항이 공개되지 않았다고 쓰면서도 Android 15 camera 변경 가능성을 main article action item으로 제시해 unsupported/stale claim risk가 명확합니다. 따라서 quality artifact 부재가 아니라 source integrity와 unsupported claim hard blocker 때문에 제거합니다.

### 2026-04-30

- 판단: public issue 유지.
- 수동 감사: `newsletter.md`와 `index.html`을 현재 editorial policy 기준으로 확인했습니다.
- legacy warning: current `editor-draft.json`, `fact-check-report.json`, `quality-report.json` 계약으로 자동 검증할 수 없는 legacy issue입니다. 다만 `newsletter.md` 기준으로 CameraX 1.6, Android 17 Beta 4, Android CLI/Skills, hybrid inference, C++ concurrency 항목이 source/reference와 Camera HAL action item을 포함하고 있어 hard blocker가 명확하지 않습니다. 삭제하지 않고 legacy warning으로 보존합니다.

## dangling reference 방지

제거 대상 날짜는 `data/newsletters.json`에서 함께 제거하고, 해당 `newsletters/YYYY-MM-DD/`와 `content/newsroom/YYYY-MM-DD/` directory를 제거합니다. 유지 대상 날짜는 `data/newsletters.json`, `newsletters/YYYY-MM-DD/`, `content/newsroom/YYYY-MM-DD/` 사이의 reference를 유지합니다. `content/collected-news/**`는 raw collection evidence이며 public archive reference가 아니므로 이번 정리에서 삭제하지 않습니다.
