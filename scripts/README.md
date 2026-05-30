# scripts

이 폴더의 root `scripts/*.js` 파일은 npm scripts와 GitHub Actions에서 기존 command path를 유지하기 위한 compatibility wrapper입니다.

실제 newsroom 구현은 `scripts/newsroom/` 아래에 있습니다. root wrapper나 `scripts/lib/**` compatibility shim에는 business logic을 추가하지 마세요. 호환 계층 자체를 바꾸는 작업이 아니라면 구현 변경은 `scripts/newsroom/`에서 시작합니다.

`scripts/newsroom/`의 실제 하위 폴더는 `cli`, `collect`, `common`, `evidence`, `generate`, `llm`, `metrics`, `render`, `sources`, `validate`입니다. 새 구현 위치를 고를 때는 먼저 [scripts/newsroom/README.md](newsroom/README.md)의 module map을 확인합니다.

## Wrapper 예시

현재 root wrapper는 `scripts/newsroom/cli/run-wrapper.js`를 통해 실제 CLI entrypoint로 위임합니다.

| Wrapper | 실제 구현 |
| --- | --- |
| `scripts/collect-news-candidates.js` | `scripts/newsroom/cli/collect-news-candidates.js` |
| `scripts/build-raw-candidate-pr-body.js` | `scripts/newsroom/cli/build-raw-candidate-pr-body.js` |
| `scripts/gemini-newsroom-newsletter.js` | `scripts/newsroom/cli/gemini-newsroom-newsletter.js` |
| `scripts/audit-historical-newsletters.js` | `scripts/newsroom/cli/audit-historical-newsletters.js` |
| `scripts/gemini-source-discovery-boundary.js` | `scripts/newsroom/cli/gemini-source-discovery-boundary.js` |
| `scripts/validate-archive.js` | `scripts/newsroom/cli/validate-archive.js` |
| `scripts/validate-newsroom-budget.js` | `scripts/newsroom/cli/validate-newsroom-budget.js` |
| `scripts/validate-quality.js` | `scripts/newsroom/cli/validate-quality.js` |
| `scripts/write-artifact-manifest.js` | `scripts/newsroom/cli/write-artifact-manifest.js` |

## 편집 시 주의사항

- Root `scripts/*.js` 파일은 command compatibility surface로 유지합니다.
- `scripts/lib/**`는 과거 import path를 위한 compatibility shim으로 유지합니다.
- Collector, generator, renderer, validator, runtime config 변경은 `scripts/newsroom/` 아래 실제 구현에서 처리합니다.
- Wrapper 동작이나 command contract를 바꾸면 관련 tests, workflow, docs를 함께 갱신합니다.

## 검증

Wrapper, shim, command contract를 수정한 뒤에는 아래 명령을 우선 확인합니다.

```powershell
npm.cmd run test
npm.cmd run validate
```
