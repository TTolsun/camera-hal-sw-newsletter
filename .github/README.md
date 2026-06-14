# GitHub 설정과 workflow

이 폴더는 issue/PR template와 GitHub Actions workflow를 둡니다. 뉴스레터 발행은 PR 기반입니다(사람이 PR을 merge할 때만 발행). workflow가 generated newsletter를 `main`에 직접 발행하거나 자동 merge하지 않습니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `.github/workflows/00-newsletters-auto-daily-pr.yml` | 매일 예약 실행되는 1~3단계 orchestrator(전체 자동 실행) workflow입니다. |
| `.github/workflows/01-newsletters-source-collect-pr.yml` | 사람이 지정한 seed URL, keyword hint, 기본 후보 수집을 처리하는 1단계 workflow입니다. |
| `.github/workflows/02-newsletters-source-discovery-pr.yml` | seed evidence 확장과 source discovery 후보 보강을 처리하는 2단계 workflow입니다. |
| `.github/workflows/03-newsletters-editor-pr.yml` | 승인된 후보와 evidence 기반으로 최종 newsletter PR을 만드는 3단계 workflow입니다. |
| `.github/workflows/validate-site.yml` | GitHub Pages site structure와 image validation을 확인하는 workflow입니다. |
| `.github/workflows/pages-deploy.yml` | `_site/`를 조립해 GitHub Pages에 배포하는 workflow입니다. |
| `.github/workflows/AGENTS.md` | workflow 수정 시 따라야 하는 secret, gate, label, artifact 보존 규칙입니다. |
| `.github/pull_request_template.md` | 기본 PR template입니다. |
| `.github/PULL_REQUEST_TEMPLATE/` | 목적별 PR template입니다. |
| `.github/ISSUE_TEMPLATE/` | issue template입니다. |

## 작업 규칙

secret 처리, workflow gate, 발행 상태 label, artifact 보존 같은 구속력 있는 규칙의 정본은 [.github/workflows/AGENTS.md](workflows/AGENTS.md)입니다. workflow를 수정하기 전에 먼저 읽으세요.

## 검증

workflow나 PR template을 수정한 뒤에는 최소한 아래 명령을 확인합니다.

```powershell
npm.cmd run validate:localization
npm.cmd run check:repo-hygiene
npm.cmd run test
npm.cmd run validate
```
