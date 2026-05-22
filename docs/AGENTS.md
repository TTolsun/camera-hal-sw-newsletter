# docs 작업 지침

이 폴더는 현재 운영 문서, 설정 문서, source guide, testing 기록, archive note를 둡니다.

## Documentation Rules

- 사용자-facing 문서는 한국어를 기본으로 작성합니다.
- Code identifiers, JSON keys, enum values, file names, commands, URLs, product names are kept in English.
- Current guidance와 archived note를 혼동하지 마세요.
- `docs/archive/**` 문서는 현재 운영 기준으로 링크하지 않습니다.
- README에는 긴 내용을 중복하지 말고 canonical docs로 연결합니다.
- 문서를 이동하거나 이름을 바꾸면 `README.md`, `docs/START_HERE.ko.md`, 관련 docs 링크를 함께 갱신합니다.
- 작업 중 계획, 설계 초안, 디버그 baseline, 리팩터링 worklog는 repository 문서로 남기지 않습니다.
- 코드 동작이나 운영 절차를 설명해야 할 내용은 `docs/newsroom-workflow.md`, `docs/operations/**`, `docs/config/**`, `docs/testing/**`, `docs/evidence/**` 같은 canonical 문서에 현재형으로 통합합니다.

## Validation

문서 변경 후에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:localization
npm.cmd run validate
```
