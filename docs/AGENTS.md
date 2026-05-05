# docs 작업 지침

이 폴더는 현재 운영 문서, 설정 문서, source guide, testing 기록, 계획 문서, archive note를 둡니다.

## Documentation Rules

- 사용자-facing 문서는 한국어를 기본으로 작성합니다.
- Code identifiers, JSON keys, enum values, file names, commands, URLs, product names are kept in English.
- Current guidance와 archived note를 혼동하지 마세요.
- `docs/archive/**` 문서는 현재 운영 기준으로 링크하지 않습니다.
- README에는 긴 내용을 중복하지 말고 canonical docs로 연결합니다.
- 문서를 이동하거나 이름을 바꾸면 `README.md`, `docs/START_HERE.ko.md`, 관련 docs 링크를 함께 갱신합니다.
- `docs/plans/**`는 계획 또는 완료된 작업 기록입니다. 현재 운영 절차는 `docs/START_HERE.ko.md`, `docs/newsroom-workflow.md`, `docs/operations/README.ko.md`를 우선합니다.

## Validation

문서 변경 후에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:localization
npm.cmd run validate
```
