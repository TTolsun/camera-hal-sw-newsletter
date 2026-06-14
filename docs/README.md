# docs

이 폴더에는 지금 운영에 쓰는 문서만 둡니다. 운영 문서, 설정 문서, source guide(소스 안내), evidence contract(근거 계약), prompt input 예시가 여기에 있습니다. 작업 도중에 생긴 중간 산출물은 저장소 문서로 남기지 않습니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `START_HERE.md` | 처음 보는 운영자와 agent를 위한 진입 문서입니다. |
| `GLOSSARY.md` | newsroom, artifact, gate, field 이름의 의미를 설명합니다. |
| `NEWSROOM_WORKFLOW.md` | 후보 수집부터 PR 생성까지의 운영 흐름입니다. |
| `config/` | GitHub Actions variable, source registry field, runtime config 설명입니다. |
| `workflows/` | workflow input, generated artifact, LLM/domain boundary 같은 실행 계약 문서입니다. |
| `operations/` | 수동 실행, PR review, release, artifact review 절차입니다. |
| `evidence/` | linked evidence와 source-aware artifact contract 설명입니다. |
| `editorial/` | article structure, HAL signal quality, source quality 계약 문서(3개)입니다. |
| `golden-examples/` | generator prompt에 들어가는 수동 품질 예시입니다. |
| `AGENTS.md` | docs folder 수정 시 현재 운영 문서 기준과 링크 유지 규칙입니다. |

## 작업 규칙

문서 한글화, 현재 운영 문서 기준, worklog/audit 금지, 링크 유지 같은 구속력 있는 규칙의 정본은 [docs/AGENTS.md](AGENTS.md)입니다. docs를 수정하기 전에 먼저 읽으세요.

## 검증

```powershell
npm.cmd run validate:localization
npm.cmd run check:policy-docs
npm.cmd run validate
```
