# content 작업 지침

이 폴더는 generated/review artifact를 둡니다. 일반 리팩토링에서 대량 수정하지 마세요.

## Artifact Roles

- `content/collected-news/YYYY-MM-DD/`는 raw candidate evidence입니다.
- `content/newsroom/YYYY-MM-DD/`는 reporter, editor, fact-check, quality, retry, QA review artifact입니다.
- Public newsletter output은 `newsletters/YYYY-MM-DD/`에 있습니다.

## Preservation Rules

- Final review artifacts는 보존합니다.
- Intermediate attempt markdown은 cleanup 대상일 수 있습니다.
- Attempt JSON은 debug evidence로 보존합니다.
- Generated artifact를 `tests/fixtures/**/good` 또는 golden fixture로 그대로 복사하지 마세요.
- 명시 요청 없이 `content/newsroom/**`, `content/collected-news/**`를 대량 수정하지 마세요.

## Cleanup Rules

삭제 가능 후보:

- `editor-draft-attempt-*.md`
- `editor-repair-attempt-*.md`
- `fact-check-report-attempt-*.md`
- `fact-check-repair-attempt-*.md`
- `quality-report-attempt-*.md`
- `quality-report-repair-attempt-*.md`

보존 대상:

- `editor-draft.md`
- `fact-check-report.md`
- `quality-report.md`
- `retry-history.md`
- `editor-in-chief-brief.md`
- `release-qa-report.md`
- `cost-report.md`
- `summary-cache-report.md`
- `article-capsules.json`
- `shortlisted-candidates.json`
- all attempt JSON files
