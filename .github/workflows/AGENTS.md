# .github/workflows 작업 지침

이 폴더는 newsroom PR workflow와 validation workflow를 담습니다. workflow 변경은 발행 안전성과 secret 노출 위험을 먼저 검토하세요.

## Safety Rules

- `GEMINI_API_KEY`와 `INTERNAL_LLM_API_KEY`는 workflow input으로 받지 말고 GitHub Secrets에서만 읽습니다.
- scheduled run은 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` repo variable을 읽지 않고 code default를 따라야 합니다.
- `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS`는 `workflow_dispatch` 수동 실행에서만 runtime env로 전달합니다.

- workflow gate에서 `npm run test`를 제거하지 마세요.
- workflow gate에서 `npm run validate`를 제거하지 마세요.
- Secret을 log, artifact, PR body에 노출하지 마세요.
- scheduled run은 정책에서 명시적으로 허용하지 않는 한 Pro 모델을 자동 사용하지 않습니다.
- PR 기반 발행 모델을 유지합니다.
- generated newsletter를 `main`에 직접 push하지 마세요.
- failed/reviewable run의 artifact upload를 보존합니다.
- workflow가 사용하는 path를 바꾸면 scripts, docs, tests를 함께 갱신합니다.

## Review Checklist

- `GEMINI_API_KEY` 값이 출력되지 않는지 확인합니다.
- failed generation에서도 review 가능한 diagnostics가 보존되는지 확인합니다.
- `publish-ready`와 PR 생성 성공을 같은 의미로 취급하지 않습니다.
- GitHub Pages 발행은 merge된 `main` 기준이어야 합니다.
