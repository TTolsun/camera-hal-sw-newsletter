# 처음 보는 사람은 여기부터

이 저장소는 Camera HAL, Android Camera, C++, AI 개발 생산성과 관련된 소식을 수집하고, Gemini 기반 newsroom 자동화로 검토 가능한 정적 뉴스레터를 만드는 프로젝트입니다.

발행은 자동으로 `main`에 직접 들어가지 않습니다. 후보 수집, Gemini 생성, 검증, 편집자 검토 PR을 거쳐 사람이 확인한 뒤 merge하면 GitHub Pages가 발행합니다.

## 발행 흐름

```text
후보 수집 -> Gemini 뉴스레터 생성 -> 사이트/이미지/품질/한글화 검증 -> 검토 PR 생성 -> 편집자 검토 -> Merge -> GitHub Pages 발행
```

## 처음 볼 파일

| 경로 | 역할 |
| --- | --- |
| `.github/workflows/` | 후보 수집, Gemini 생성, 검증, PR 생성, Pages 검증 workflow를 둡니다. |
| `data/` | `newsletters.json`과 기계 판독용 source registry인 `news-sources.json`을 둡니다. |
| `docs/` | 운영 정책, 출처 editorial view, 뉴스룸 흐름, 템플릿, 온보딩 문서를 둡니다. |
| `collected-news/` | 날짜별 raw candidate output인 `YYYY-MM-DD/candidates.json`을 둡니다. |
| `newsroom/` | 날짜별 reporter 후보, editor draft, fact-check, quality report, retry history, QA report를 둡니다. |
| `newsletters/` | 발행될 날짜별 `newsletter.md`와 `index.html`을 둡니다. |
| `scripts/` | 수집, Gemini 생성, 렌더링, 이미지 해석, validation 로직을 둡니다. |
| `templates/` | 뉴스레터 구조나 생성 프롬프트가 참조하는 템플릿을 둘 때 사용하는 위치입니다. |
| `tests/` | Node test runner 기반 검증 파일을 둘 때 사용하는 위치입니다. 현재 별도 unit test suite는 없고 `npm run test`가 Node test runner를 실행합니다. |
| `assets/` | 사이트 이미지와 article-image fallback asset을 둡니다. |
| `css/` | 정적 사이트 공통 스타일을 둡니다. UI 작업이 아니면 layout churn을 피합니다. |

## 안전한 수정 순서

1. 이 문서와 [README.md](../README.md)를 먼저 읽습니다.
2. PR 하나에는 한 관심사만 담습니다. 문서, workflow, collector, renderer, generated artifact를 불필요하게 섞지 않습니다.
3. 변경 후 `npm run test`를 실행합니다. Windows PowerShell에서는 `npm.cmd run test`를 사용할 수 있습니다.
4. 변경 후 `npm run validate`를 실행합니다. Windows PowerShell에서는 `npm.cmd run validate`를 사용할 수 있습니다.
5. generated artifact가 생겼다면 `collected-news/`, `newsroom/`, `newsletters/`, `data/newsletters.json` 변경을 직접 확인합니다.

## 관련 문서

- [GitHub Actions Secret과 Variable](config/action-variables.ko.md)
- [news-sources.json 필드 안내](config/news-sources-fields.ko.md)
- [출처 editorial view](news-sources.md)
- [Newsroom workflow](newsroom-workflow.md)
