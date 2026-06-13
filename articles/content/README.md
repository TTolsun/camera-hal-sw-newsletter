# content

이 폴더는 수집 후보, newsroom review artifact(리뷰용 산출물), 감사 산출물을 둡니다. 대부분 generated(자동 생성) 또는 review용 artifact이므로 명시 요청 없이 대량 수정하지 않습니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `articles/content/collected-news/YYYY-MM-DD/` | raw candidate, manual candidate, seed intent, merged candidate 같은 수집 단계 산출물입니다. |
| `articles/content/newsroom/YYYY-MM-DD/` | reporter, editor, fact-check, quality, retry, QA review artifact입니다. |
| `articles/content/audit/` | artifact audit와 historical review 기록입니다. |
| `articles/content/AGENTS.md` | generated/review artifact 보존 기준과 cleanup 금지선을 설명합니다. |

## 작업 규칙

- `articles/content/collected-news/**`와 `articles/content/newsroom/**`는 실제 source of truth가 아니라 review evidence와 generated artifact입니다.
- Final review artifact는 보존합니다. Intermediate attempt markdown만 cleanup 후보가 될 수 있습니다.
- Attempt JSON은 debug evidence로 보존합니다.
- Generated artifact를 `src/shared/test/fixtures/**/good` 또는 golden fixture로 그대로 복사하지 않습니다.
- 기존 날짜별 artifact를 정리할 때는 public output인 `articles/newsletters/**`와 혼동하지 않습니다.

## 검증

artifact를 수정한 경우 변경 성격에 맞춰 아래 명령을 확인합니다.

```powershell
npm.cmd run validate:public
npm.cmd run validate:quality
npm.cmd run validate
```
