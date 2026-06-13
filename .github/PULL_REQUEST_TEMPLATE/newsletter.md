## 뉴스레터 발행 PR

### 작성 원칙

- [ ] PR body는 한글로 작성했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] `final_publish_ready` 같은 영어 식별자는 한국어 설명을 함께 적었다.

### Public artifact

- [ ] `articles/newsletters/YYYY-MM-DD/newsletter.md`를 작성했다.
- [ ] `articles/newsletters/YYYY-MM-DD/index.html`을 작성했다.
- [ ] `articles/data/newsletters.json`을 업데이트했다.
- [ ] HTML에서 Archive 링크가 동작한다.
- [ ] HTML에서 Markdown 원본 링크가 동작한다.

### Editorial quality

- [ ] 주요 기사 구성이 `src/shared/config/newsletter-policy.json`을 따른다.
- [ ] 3줄 브리핑은 정확히 3줄이다.
- [ ] 각 주요 기사에 `확인한 사실`이 있다.
- [ ] 각 주요 기사에 `배경지식`이 있다.
- [ ] 각 주요 기사에 `Camera HAL 관점`, `Camera HAL / Driver 관점`, 또는 이에 준하는 실무 연결 설명이 있다.
- [ ] 각 주요 기사에 `실행 항목`이 있다.
- [ ] 각 주요 기사에 `팀 공유 포인트`가 있다.
- [ ] 추정은 추정이라고 표시했다.
- [ ] `TODO`가 남아 있지 않다.
- [ ] 임시 Markdown, notes/checkpoint 문서, one-off script가 PR에 남아 있지 않다.

### Source / fact-check

- [ ] 각 주요 기사에 `Sources` 또는 `출처`가 있다.
- [ ] 마지막에 `References` 또는 `참고자료`가 있다.
- [ ] 출처가 본문 주장과 직접 연결된다.
- [ ] source gap이 없다.
- [ ] fact-check must_fix가 없다.
- [ ] watch/reference page가 dated evidence 없이 main article로 승격되지 않았다.
- [ ] AI/C++ 기사가 포함된 경우 Camera HAL workflow, camera input path, Android Camera pipeline, native HAL tooling 중 하나와 연결된다.

### Validation

- [ ] `npm run test`
- [ ] `npm run validate`
- [ ] 필요한 targeted test를 실행했다.
