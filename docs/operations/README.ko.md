# 운영 안내

이 문서는 반복 운영 흐름만 짧게 정리합니다. 전체 pipeline과 gate 계약은 [newsroom-workflow.md](../newsroom-workflow.md)를 기준으로 확인하세요.

## Manual High-Quality Run

- GitHub Actions에서 `Newsroom 03 - Gemini Final Newsletter PR` (`.github/workflows/03-newsroom-final-pr.yml`)을 선택하고 `Run workflow`를 실행합니다.
- `newsletter_date`를 입력하고, 필요하면 승인된 `manual-candidates.json` 또는 `merged-candidates.json` artifact path를 `candidate_input_path`에 입력합니다.
- Pro 계열 모델이 꼭 필요하고 비용 증가를 승인한 경우에만 `allow_pro=true`를 선택합니다.
- 실행 후 `cost-report.md`, `summary-cache-report.md`, `retry-history.md`를 확인해 비용과 retry 범위를 봅니다.

## PR Review Flow

- PR body의 새 editor-facing 요약은 [Newsroom PR Report 읽는 법](./newsroom-pr-report.ko.md)을 기준으로 확인합니다.
- `final_publish_ready=false`는 AI 자동 발행 기준 미충족을 뜻합니다. `review_publication_ready=true`이고 `homepage_visible_after_merge=true`인 PR은 편집장 merge로 공개 승인할 수 있습니다.
- `diagnostics_only=true`인 PR은 public newsletter files가 없으므로 merge해도 홈페이지에 표시되지 않습니다. PR body의 missing public files reason을 먼저 확인합니다.
- `Validate Site and Images` (`.github/workflows/validate-site.yml`)는 quality/fact-check 문제를 non-blocking annotation으로 보고하고, structural validation만 blocking으로 처리합니다.

- PR body에서 `final_publish_ready`, `review_publication_ready`, `diagnostics_only`, article count, labels, selection diagnostics를 먼저 확인합니다.
- `editor-in-chief-brief.md`로 핵심 메시지와 review order를 확인합니다.
- `fact-check-report.md`에 unresolved `must_fix`가 있으면 발행 가능한 PR로 보지 않습니다.
- `quality-report.md`에서 hard blocker와 soft deduction을 분리해 봅니다.
- source gap, duplicate source URL, missing action item, weak Camera HAL perspective는 발행 전 수정 대상입니다.

## Release Flow

- `publish-ready`는 `has_ai_publish_ready=true`인 AI 자동 발행 가능 상태만 뜻합니다.
- `review-only`는 AI 자동 발행 기준 미달로 editor review가 필요한 넓은 상태 신호입니다.
- `review-only-publication`은 public files가 있지만 편집장 검토가 필요한 상태입니다.
- `diagnostics-only`는 public files가 없어 공개 승인 대상이 아닌 상태입니다.

- 자동 발행 가능 PR은 `publish-ready` 상태와 PR body의 `final_publish_ready=true`를 확인합니다.
- `needs-fix`와 `review-only-publication`이 함께 있는 PR은 quality/fact-check annotation과 review artifact를 검토한 뒤 편집장 merge로 공개 승인합니다.
- `npm.cmd run test`와 `npm.cmd run validate`가 통과한 PR만 merge합니다.
- merge 후 GitHub Pages가 `main` 기준 public newsletter를 반영합니다.
- workflow가 generated issue를 `main`에 직접 push하거나 auto-merge하지 않습니다.

## Publication Quality Annotation

- `node scripts/annotate-publication-quality.js --date YYYY-MM-DD`는 해당 public issue만 검사합니다.
- changed public issue date가 public issue와 매칭되면 `--latest`가 있어도 해당 date만 검사합니다.
- changed public issue가 없을 때 latest public issue 1개를 검사하려면 `node scripts/annotate-publication-quality.js --latest`를 명시합니다.
- 명시 target이나 changed public issue가 없으면 조용히 latest로 fallback하지 않고 실패합니다.
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
