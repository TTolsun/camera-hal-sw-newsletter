# docs

이 폴더에는 지금 운영에 쓰는 문서만 둡니다. 운영 문서, 설정 문서, source guide(소스 안내), evidence contract(근거 계약), prompt input 예시가 여기에 있습니다. 작업 도중에 생긴 중간 산출물은 저장소 문서로 남기지 않습니다.

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

- 사용자-facing 문서는 한국어로 작성합니다.
- 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문 그대로 둡니다.
- 과거 handoff, dated baseline(날짜 박힌 기준 문서), one-off audit(일회성 점검), refactoring worklog(리팩터링 작업 기록)는 `docs/**`에 남기지 않습니다.
- root `README.md`에는 긴 운영 설명을 중복하지 말고, 정본 문서(canonical docs)로 연결만 합니다.
- 작업 중 계획, 설계 초안, 디버그 baseline, 리팩터링 worklog는 저장소 문서로 남기지 않습니다. 필요한 내용은 현재 코드와 맞는 정본 문서에 직접 반영합니다.

## 검증

```powershell
npm.cmd run validate:localization
npm.cmd run check:policy-docs
npm.cmd run validate
```
