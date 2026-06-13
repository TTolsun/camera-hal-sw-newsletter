# docs

이 폴더는 현재 운영 문서, 설정 문서, source guide, evidence contract, prompt input 예시를 둡니다. 과거 작업 중간 산출물은 repository 문서로 남기지 않습니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `START_HERE.md` | 처음 보는 운영자와 agent를 위한 진입 문서입니다. |
| `glossary.md` | newsroom, artifact, gate, field 이름의 의미를 설명합니다. |
| `newsroom-workflow.md` | 후보 수집부터 PR 생성까지의 운영 흐름입니다. |
| `config/` | GitHub Actions variable, source registry field, runtime config 설명입니다. |
| `workflows/` | workflow input, generated artifact, LLM/domain boundary 같은 실행 계약 문서입니다. |
| `operations/` | 수동 실행, PR review, release, artifact review 절차입니다. |
| `evidence/` | linked evidence와 source-aware artifact contract 설명입니다. |
| `golden-examples/` | generator prompt에 들어가는 수동 품질 예시입니다. |
| `AGENTS.md` | docs folder 수정 시 현재 운영 문서 기준과 링크 유지 규칙입니다. |

## 작업 규칙

- 사용자-facing 문서는 한국어를 기본으로 작성합니다.
- 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지합니다.
- 과거 handoff, dated baseline, one-off audit, refactoring worklog는 `docs/**`에 보존하지 않습니다.
- root `README.md`에는 긴 운영 설명을 중복하지 않고 canonical docs로 연결합니다.
- 작업 중 계획, 설계 초안, 디버그 baseline, 리팩터링 worklog는 repository 문서로 남기지 않습니다. 필요한 내용은 현재 코드와 맞는 canonical 문서에 직접 반영합니다.

## 검증

```powershell
npm.cmd run validate:localization
npm.cmd run check:policy-docs
npm.cmd run validate
```
