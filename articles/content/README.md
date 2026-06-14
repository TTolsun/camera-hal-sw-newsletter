# content

이 폴더는 수집 후보, newsroom review artifact(리뷰용 산출물), 감사 산출물을 둡니다. 대부분 generated(자동 생성) 또는 review용 artifact이므로 명시 요청 없이 대량 수정하지 않습니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `articles/content/collected-news/YYYY-MM-DD/` | raw candidate, manual candidate, seed intent, merged candidate 같은 수집 단계 산출물입니다. |
| `articles/content/newsroom/YYYY-MM-DD/` | reporter, editor, fact-check, quality, retry, QA review artifact입니다. |
| `articles/content/source-events/YYYY-MM-DD/` | source 변경 이벤트(change-event) 산출물입니다. (`articles/content/AGENTS.md` 적용) |
| `articles/content/audit/` | artifact audit와 historical review 기록입니다. |
| `articles/content/AGENTS.md` | generated/review artifact 보존 기준과 cleanup 금지선을 설명합니다. |

## 편집 규칙

이 README는 폴더 개요만 제공합니다. artifact 보존 등급(`public_source_of_truth` / `review_required_compact` / `debug_heavy` / `transient_attempt`), cleanup 금지선, generated artifact를 fixture로 복사 금지 같은 상세 규칙의 정본은 [AGENTS.md](AGENTS.md)입니다.

## 검증

artifact를 수정한 경우 변경 성격에 맞춰 아래 명령을 확인합니다.

```powershell
npm.cmd run validate:public
npm.cmd run validate:quality
npm.cmd run validate
```
