# docs 작업 지침

이 폴더는 현재 운영 문서, 설정 문서, source guide, evidence contract, prompt input 예시를 둡니다.

## Documentation Rules

- 사용자-facing 문서는 한국어를 기본으로 작성합니다.
- 코드 식별자, JSON 키, enum 값, 파일 이름, 명령어, URL, 제품 이름은 원문을 유지합니다.
- 현재 운영 지침과 과거 작업 중간 산출물을 혼동하지 마세요.
- 과거 handoff, dated baseline, 일회성 audit, 리팩터링 worklog는 `docs/**`에 보존하지 않습니다.
- memory, notes, checkpoint, TODO 정리, 임시 보고서처럼 작업 중간 산출물인 Markdown은 `docs/**`에 보존하지 않습니다.
- README에는 긴 내용을 중복하지 말고 canonical docs로 연결합니다.
- 문서를 이동하거나 이름을 바꾸면 `README.md`, `docs/START_HERE.ko.md`, 관련 docs 링크를 함께 갱신합니다.
- 작업 중 계획, 설계 초안, 디버그 baseline, 리팩터링 worklog는 repository 문서로 남기지 않습니다.
- 영구 문서가 필요한 경우에는 현재 운영 계약을 설명하는 canonical docs에 통합하고, 임시 분석 메모를 별도 문서로 추가하지 않습니다.
- 코드 동작이나 운영 절차를 설명해야 할 내용은 `docs/newsroom-workflow.md`, `docs/operations/**`, `docs/config/**`, `docs/evidence/**` 같은 canonical 문서에 현재형으로 통합합니다.

## Validation

문서 변경 후에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:localization
npm.cmd run validate
```
