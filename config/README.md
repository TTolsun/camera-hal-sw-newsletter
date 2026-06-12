# config

이 폴더는 newsroom과 public newsletter 발행 정책의 machine-readable 설정을 둡니다. 문서나 workflow에서 정책 값을 설명할 때는 이 폴더의 JSON을 source of truth로 삼습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `../src/core/config/newsletter-policy.json` | main article count, quality threshold, hard fail condition 같은 newsletter publication policy의 source of truth입니다. (이 폴더가 아니라 `src/core/config/`에 있습니다.) |
| `newsroom-budget.json` | newsroom 실행 budget과 비용 안전 관련 설정입니다. |

## 작업 규칙

- `README.md`의 Newsletter Policy block은 generated block입니다. 직접 손으로 고치지 말고 `src/core/config/newsletter-policy.json`을 수정한 뒤 policy docs sync를 확인합니다.
- quality threshold를 낮추거나 hard blocker를 완화해서 validation을 통과시키지 않습니다.
- config key와 enum-like 값은 계약 값이므로 번역하지 않습니다.
- config 변경은 selection, quality gate, PR body, validation 결과에 영향을 줄 수 있으므로 관련 docs와 tests를 함께 확인합니다.

## 검증

```powershell
npm.cmd run validate:config
npm.cmd run check:policy-docs
npm.cmd run validate
```
