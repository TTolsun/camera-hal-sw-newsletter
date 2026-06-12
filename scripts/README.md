# scripts

이 폴더에는 더 이상 실행 가능한 newsroom 코드가 없습니다. #262 src 재구성으로 모든 구현과 tooling은 `src/` 아래로 이동했고, 과거 root `scripts/*.js` compatibility wrapper와 `scripts/newsroom/cli/run-wrapper.js`는 제거되었습니다.

새 위치는 다음과 같습니다.

| 이전 위치 | 새 위치 |
| --- | --- |
| `scripts/newsroom/{common,domain,evidence,sources}/**` core 모듈 | `src/core/**` |
| `scripts/newsroom/collect/**` (collector) | `src/collector/**`, `src/core/collect/**` |
| `scripts/newsroom/collect`·`evidence` discovery 모듈 | `src/discovery/**` |
| `scripts/newsroom/{generate,llm,render,metrics,validate}/**` generator | `src/generator/**` |
| root `scripts/check-*.js`, `scripts/newsroom/cli/**` tooling | `src/core/tooling/**` |
| `config/newsletter-policy.json` | `src/core/config/newsletter-policy.json` |
| `data/news-sources.json` | `src/core/data/news-sources.json` |

npm scripts와 GitHub Actions는 모두 새 `src/<layer>/<entry>.js` 경로를 직접 호출합니다. 더 이상 wrapper를 거치지 않습니다. 구현 변경은 해당 layer의 `src/` 디렉터리에서 시작합니다. layer 경계와 모듈 배치 규칙은 [src/AGENTS.md](../src/AGENTS.md)와 root [AGENTS.md](../AGENTS.md)를 확인합니다.

남아 있는 문서(`scripts/newsroom/AGENTS.md`, `scripts/newsroom/README.md`, 이 파일)는 과거 경로를 참조하는 독자를 새 `src/` 구조로 안내하기 위한 것입니다.

## 검증

구현이나 command contract를 수정한 뒤에는 아래 명령을 우선 확인합니다.

```powershell
npm.cmd run test
npm.cmd run validate
```
