# docs 작업 지침

이 폴더에는 지금 운영에 쓰는 문서만 둡니다. 운영 문서, 설정 문서, source guide(소스 안내), evidence contract(근거 계약), prompt input 예시가 여기에 있습니다.

## 문서 작성 규칙

- 사용자-facing 문서는 한국어로 작성합니다.
- 코드 식별자, JSON 키, enum 값, 파일 이름, 명령어, URL, 제품 이름은 원문 그대로 둡니다.
- 지금 쓰는 운영 지침과, 작업 도중 생긴 중간 산출물을 섞지 마세요.
- 과거 handoff, dated baseline(날짜 박힌 기준 문서), 일회성 audit(점검), 리팩터링 worklog(작업 기록)는 `docs/**`에 남기지 않습니다.
- memory, notes, checkpoint, TODO 정리, 임시 보고서처럼 작업 중간 산출물인 Markdown도 `docs/**`에 남기지 않습니다.
- README에는 긴 내용을 중복하지 말고 정본 문서(canonical docs)로 연결합니다.
- 문서를 옮기거나 이름을 바꾸면 `README.md`, `docs/START_HERE.md`, 관련 docs의 링크도 함께 갱신합니다.
- 작업 중 계획, 설계 초안, 디버그 baseline, 리팩터링 worklog는 저장소 문서로 남기지 않습니다.
- 영구 문서가 필요하면, 임시 분석 메모를 따로 추가하지 말고 현재 운영 계약을 설명하는 정본 문서에 합칩니다.
- 코드 동작이나 운영 절차를 설명할 내용은 `docs/newsroom-workflow.md`, `docs/operations/**`, `docs/config/**`, `docs/evidence/**` 같은 정본 문서에 현재형으로 통합합니다.

## 검증

문서를 바꾼 뒤에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:localization
npm.cmd run validate
```
