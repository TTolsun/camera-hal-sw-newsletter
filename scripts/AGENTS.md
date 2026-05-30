# scripts/ AGENTS.md

이 디렉터리의 안전 규칙. 실제 구현은 `scripts/newsroom/`에 있고, root는 thin wrapper만 유지한다.

---

## Root wrapper rule

- `scripts/*.js` 파일은 delegate-only thin wrapper다. 비즈니스 로직 추가 금지.
- 신규 root wrapper는 `cli/run-wrapper.js` 위임 한 줄 패턴을 따른다.

## scripts/lib shim rule

- `scripts/lib/*.js`는 과거 import 경로 호환을 위한 re-export shim이다. 신규 caller는 `scripts/newsroom/<dir>/<module>` 직접 경로를 사용한다.
- shim 파일 자체는 외부 caller(package.json·workflows) 보호 책임이 있어 임의로 삭제하지 않는다. 삭제는 cleanup epic의 PR 10에서 caller-less 확인 후 수행한다.

## Reference

전수 inventory와 PR 매핑은 `docs/refactor/legacy-compatibility-inventory.md` 참조.
