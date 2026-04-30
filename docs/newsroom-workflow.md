# Camera HAL SW Newsletter Newsroom Workflow

이 문서는 Camera HAL SW Newsletter를 사람이 깊게 이해하고 작성한 것처럼 만들기 위한 역할 기반 workflow입니다.

## Goal

단순히 날짜별 newsletter 파일을 자동 생성하는 것이 아니라, 아래 흐름을 통해 최신 뉴스를 수집하고 Camera HAL 엔지니어 관점으로 해석한 초안을 만듭니다.

```text
기자
  ↓
편집자
  ↓
1차 검수자
  ↓
편집장: 김경환
  ↓
업데이터
  ↓
최종 검수자
  ↓
GitHub Pages 발행
```

## Role 1. 기자

### Responsibility

- Android Camera, CameraX, AOSP Camera, C++, LLVM/Clang, AI Agent 관련 최신 뉴스 후보 수집
- 공식 문서와 신뢰 가능한 출처 우선 확인
- Camera HAL 관련도 점수화
- request/result, metadata, stream, buffer lifecycle, performance, test, debugging 영향 영역 분류

### Output

- `newsroom/YYYY-MM-DD/news-candidates.md`

## Role 2. 편집자

### Responsibility

- 기자가 수집한 후보 중 이번 호에 들어갈 뉴스 선정
- 단순 요약이 아니라 Camera HAL 실무 관점으로 재해석
- 초보자도 이해 가능한 배경지식 추가
- 팀원이 바로 확인해볼 수 있는 action item 작성

### Output

- `newsroom/YYYY-MM-DD/editor-draft.md`

## Role 3. 1차 검수자

### Responsibility

- 주요 주장에 출처가 있는지 확인
- 출처가 실제 주장을 뒷받침하는지 확인
- Android / CameraX / AOSP / C++ / AI 관련 명칭 오류 확인
- 추측과 사실이 섞인 문장 표시
- 과장된 표현 제거

### Output

- `newsroom/YYYY-MM-DD/fact-check-report.md`

## Role 4. 편집장: 김경환

### Responsibility

편집장은 직접 모든 기사를 쓰는 사람이 아니라, 이번 호의 방향성과 발행 여부를 판단하는 사람입니다.

- 이번 호 메인 메시지 판단
- 팀원들이 읽을 이유가 있는지 확인
- 너무 업무적이거나 너무 일반 IT 뉴스 같은 항목 제거 지시
- 최종 발행 승인

### Approval Comment

PR에서 아래 중 하나로 승인합니다.

```text
/approve-newsletter
```

수정이 필요하면 아래처럼 댓글을 남깁니다.

```text
/request-change
- AOSP Camera Watch를 더 쉽게 풀어줘
- C++ 팁에 callback lifetime 예시를 추가해줘
- 제목을 더 흥미롭게 바꿔줘
```

## Role 5. 업데이터

### Responsibility

- 편집장 검토용 초안을 GitHub Pages 파일로 변환
- `newsletters/YYYY-MM-DD/newsletter.md` 생성
- `newsletters/YYYY-MM-DD/index.html` 생성
- `data/newsletters.json` 업데이트
- PR 생성

### Output

- `newsletters/YYYY-MM-DD/newsletter.md`
- `newsletters/YYYY-MM-DD/index.html`
- `data/newsletters.json`

## Role 6. 최종 검수자

### Responsibility

- `data/newsletters.json` 형식 확인
- 날짜 중복 확인
- HTML / MD 파일 존재 여부 확인
- Archive 링크, MD 원본 보기 링크 확인
- References 링크 확인
- TODO 문자열 확인
- 필수 섹션 확인

### Output

- `newsroom/YYYY-MM-DD/release-qa-report.md`

## GitHub Actions Operation

### Scheduled Draft PR

`Weekly Newsletter Newsroom` workflow가 매주 월요일 오전 6시 30분 KST에 실행됩니다.

```text
KST Monday 06:30 = UTC Sunday 21:30
```

이 workflow는 main에 바로 push하지 않고 draft branch와 PR을 생성합니다.

```text
weekly-newsletter/YYYY-MM-DD
```

### Editor-in-Chief Review

김경환 편집장은 PR에서 아래만 확인하면 됩니다.

- 이번 호 핵심 메시지가 명확한가?
- Camera HAL 엔지니어가 읽을 이유가 있는가?
- 단순 요약이 아니라 HAL 관점 해석이 있는가?
- 출처와 사실 검증 결과가 충분한가?
- 팀 공유용으로 발행해도 되는가?

### Release

편집장이 승인하면 PR을 merge합니다. GitHub Pages는 main 기준으로 반영됩니다.

## Required Secret

AI 기반 뉴스 수집과 초안 생성을 위해 GitHub Repository Secret에 아래 값을 등록해야 합니다.

```text
OPENAI_API_KEY
```

등록 위치:

```text
Repository Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

선택적으로 모델을 바꾸고 싶으면 workflow env에서 `OPENAI_MODEL` 값을 변경합니다.

기본값:

```text
OPENAI_MODEL=gpt-5-mini
```
