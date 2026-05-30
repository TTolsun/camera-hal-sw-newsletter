# Legacy Compatibility Inventory — Issue #85 Canonical Path Contract

이 문서는 GitHub issue **#85** (legacy shim / root wrapper / compatibility surface)의 처리 대상 전수 inventory이다. 선행 이슈 **#185** (seed evidence workflow migration)는 **CLOSED**되어 차단 조건이 해소되었다. 본 문서는 PR 4에서 신규 작성되며, root wrapper와 `scripts/lib` shim의 캐노니컬 처리 방향을 확정한다.

---

## Section 1: Root command wrappers (`scripts/*.js`)

총 41개 root wrapper가 존재하며, 전부 `package.json` 또는 `.github/workflows/*`에서 외부 사용 중이다. 모두 **keep + thin only**로 분류한다. 신규 명령은 `scripts/newsroom/cli/`에 두고 root에는 `cli/run-wrapper.js` 위임 한 줄만 추가한다.

검증 명령: `git ls-files "scripts/*.js" | grep -v lib/ | grep -v newsroom/ | wc -l` 결과 41.

---

## Section 2: Library shims (`scripts/lib/*.js`)

| Path | Internal callers | Decision | Migration PR | Notes |
|---|---|---|---|---|
| `scripts/lib/article-image-resolver.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/common.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/gemini-client.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/image-candidates.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/newsletter-renderer.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/newsletter-schema.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/selection-diagnostics.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/source-monitor.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/source-monitor-registry-validator.js` | 0건 | `delete` | PR 10 | caller-less 최종 확인 후 삭제 |
| `scripts/lib/newsletter-policy.js` | 8건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/common/newsletter-policy`로 교체 |
| `scripts/lib/newsroom-selection.js` | 3건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/generate/newsroom-selection`으로 교체 |
| `scripts/lib/source-item-parsers.js` | 4건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/collect/source-item-parsers`로 교체 |
| `scripts/lib/newsletter-quality.js` | 4건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/validate/newsletter-quality`로 교체 |
| `scripts/lib/aosp-camera-scope.js` | 2건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/common/aosp-camera-scope`로 교체 |
| `scripts/lib/news-source-section-resolver.js` | 1건 | `migrate` | PR 9 | 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/news-sources-config-validator.js` | 1건 | `migrate` | PR 9 | 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/news-summary-cache.js` | 1건 | `migrate` | PR 9 | 내부 caller를 newsroom 직접 경로로 교체 |
| `scripts/lib/runtime-config.js` | 1건 | `migrate` | PR 9 | 내부 caller를 `scripts/newsroom/common/runtime-config`로 교체 |
| `scripts/lib/stale-claims.js` | 1건 | `migrate` | PR 9 | 내부 caller를 newsroom 직접 경로로 교체 |

---

## Section 3: Canonical path contract

- root `scripts/*.js`는 delegate-only다. 비즈니스 로직을 추가하지 않는다. 모든 root wrapper는 `cli/run-wrapper.js`를 통해 `scripts/newsroom/cli/<command>.js`로 위임한다.
- 신규 내부 require는 `scripts/lib/*`이 아니라 `scripts/newsroom/<dir>/<module>` 직접 경로를 사용한다. PR 9가 기존 내부 caller를 직접 경로로 이전한다.
- `scripts/lib` shim 파일 자체는 외부 caller(package.json·workflows) 보호를 위해 PR 9에서 삭제하지 않는다. PR 10에서 caller-less 확인 후 별도로 삭제한다.
- 본 contract 위반은 PR 13의 cleanup regression guard 테스트가 자동 감지한다(예: newsroom 내부 코드가 `scripts/lib/*`를 require하면 차단).

---

## Section 4: Hard limits

- `config/newsletter-policy.json`, `data/news-sources.json`은 본 PR 시리즈에서 수정하지 않는다.
- `.github/workflows/*` 명령 타겟·secret 처리·publication-state 라벨은 수정하지 않는다.
- public newsletter artifact(`newsletters/**`)와 generated artifact(`content/newsroom/**`, `content/collected-news/**`)는 대량 수정하지 않는다.
- quality gate threshold·hard-fail·source binding·publish gate 정책은 본 cleanup으로 약화되지 않는다.

---

## PR 14 — Final status

- root wrapper 41: keep + thin only (변경 없음)
- caller-있는 shim 10: migrated (내부 caller 이전, shim 보존)
- caller-less shim 9: deleted (PR 10)
