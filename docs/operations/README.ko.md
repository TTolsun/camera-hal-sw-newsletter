# 운영 안내

이 문서는 반복 운영 흐름만 짧게 정리합니다. 전체 pipeline과 gate 계약은 [newsroom-workflow.md](../newsroom-workflow.md)를 기준으로 확인하세요.

## Manual High-Quality Run

- GitHub Actions에서 `01 - Weekly Gemini Newsroom PR`을 선택하고 `Run workflow`를 실행합니다.
- 필요하면 `newsletter_date`, `lookback_days`를 입력합니다.
- Pro 계열 모델이 꼭 필요하고 비용 증가를 승인한 경우에만 `allow_pro=true`를 선택합니다.
- 실행 후 `cost-report.md`, `summary-cache-report.md`, `retry-history.md`를 확인해 비용과 retry 범위를 봅니다.

## PR Review Flow

- `final_publish_ready=false`는 AI 자동 발행 기준 미충족을 뜻합니다. public artifact가 포함된 PR은 편집장 merge로 공개 승인할 수 있습니다.
- `02-validate-site.yml`은 quality/fact-check 문제를 non-blocking annotation으로 보고하고, structural validation만 blocking으로 처리합니다.

- PR body에서 `final_publish_ready`, article count, labels, selection diagnostics를 먼저 확인합니다.
- `editor-in-chief-brief.md`로 핵심 메시지와 review order를 확인합니다.
- `fact-check-report.md`에 unresolved `must_fix`가 있으면 발행 가능한 PR로 보지 않습니다.
- `quality-report.md`에서 hard blocker와 soft deduction을 분리해 봅니다.
- source gap, duplicate source URL, missing action item, weak Camera HAL perspective는 발행 전 수정 대상입니다.

## Release Flow

- `publish-ready`는 `has_ai_publish_ready=true`인 AI 자동 발행 가능 상태만 뜻합니다.
- `needs-fix`라도 `has_public_artifacts=true`이면 편집장 main merge를 사이트 공개 승인으로 봅니다.

- 자동 발행 가능 PR은 `publish-ready` 상태와 PR body의 `final_publish_ready=true`를 확인합니다.
- `needs-fix`와 public artifact가 함께 있는 PR은 quality/fact-check annotation과 review artifact를 검토한 뒤 편집장 merge로 공개 승인합니다.
- `npm.cmd run test`와 `npm.cmd run validate`가 통과한 PR만 merge합니다.
- merge 후 GitHub Pages가 `main` 기준 public newsletter를 반영합니다.
- workflow가 generated issue를 `main`에 직접 push하거나 auto-merge하지 않습니다.

## Publication Quality Annotation

- `node scripts/annotate-publication-quality.js --date YYYY-MM-DD`는 해당 public issue만 검사합니다.
- changed newsletter date가 public issue와 매칭되면 해당 date만 검사합니다.
- changed public issue가 없으면 latest public issue 1개만 검사합니다.
- 전체 과거 issue 검사는 `node scripts/annotate-publication-quality.js --all`에서만 수행합니다.

## Artifact Review Order

1. PR body와 labels
2. `content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`
3. `content/newsroom/YYYY-MM-DD/fact-check-report.md`
4. `content/newsroom/YYYY-MM-DD/quality-report.md`
5. `content/newsroom/YYYY-MM-DD/retry-history.md`
6. `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`
7. `content/newsroom/YYYY-MM-DD/article-capsules.json`
8. `newsletters/YYYY-MM-DD/newsletter.md`
