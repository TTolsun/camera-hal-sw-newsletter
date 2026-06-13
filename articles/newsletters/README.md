# newsletters

이 폴더는 public newsletter issue output(발행된 뉴스레터 결과물)을 날짜별로 둡니다. GitHub Pages에 표시되는 public state의 기준은, merge된 `main`의 이 폴더와 `articles/data/newsletters.json` entry입니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `articles/newsletters/YYYY-MM-DD/newsletter.md` | 날짜별 public newsletter Markdown output입니다. |
| `articles/newsletters/YYYY-MM-DD/index.html` | 날짜별 public newsletter HTML output입니다. |
| `articles/data/newsletters.json` | homepage와 archive가 읽는 newsletter index입니다. |

## 작업 규칙

- 기존 날짜별 newsletter를 명시 요청 없이 대량 rewrite하지 않습니다.
- Public newsletter output은 renderer와 validator를 통과한 결과로 취급합니다. 임의 편집으로 source gap이나 quality issue를 숨기지 않습니다.
- `articles/newsletters/**`만 있어도 archive에 자동 표시되는 것은 아닙니다. `articles/data/newsletters.json` entry와 merge된 `main` 상태를 함께 봅니다.
- Generated public artifact를 `src/shared/test/fixtures/**/good` 또는 golden fixture로 그대로 사용하지 않습니다.

## 검증

```powershell
npm.cmd run validate:public
npm.cmd run validate:site
npm.cmd run validate
```
