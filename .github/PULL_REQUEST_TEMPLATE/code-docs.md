## 코드 / 문서 / 리팩토링 PR

### 작성 원칙

- [ ] PR body는 한글로 작성했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] `final_publish_ready`, `artifact_final_publish_ready` 같은 영어 식별자는 한국어 설명을 함께 적었다.

### 범위 (Scope)

- [ ] PR 하나에 한 관심사만 담았다.
- [ ] 뉴스레터 generated artifact를 불필요하게 수정하지 않았다.
- [ ] public newsletter content 변경이 있으면 이유를 설명했다.
- [ ] unrelated cleanup을 섞지 않았다.
- [ ] 임시 Markdown, notes/checkpoint 문서, one-off script가 PR에 남아 있지 않다.

### 코드 안전 (Code safety)

- [ ] quality gate, hard blocker, source binding, image fallback 정책을 약화하지 않았다.
- [ ] `qualityGatePolicy.threshold` 변경이 있으면 PR 본문에 이유와 검증 결과를 명시했다.
- [ ] `qualityGatePolicy.hardFailConditions` 변경이 있으면 condition별 regression test와 문서 갱신을 포함했다.
- [ ] `publish-ready` 판단에 영향을 주는 변경이 있으면 `final_publish_ready` / `artifact_final_publish_ready` 검증을 포함했다.
- [ ] workflow 동작 변경이 있으면 테스트를 추가했다.
- [ ] compatibility wrapper/shim을 명시적 이유 없이 제거하지 않았다.
- [ ] generated artifact path를 바꿨다면 workflow, docs, tests를 함께 갱신했다.

### 문서 (Docs)

- [ ] 문서는 가능한 한 한국어로 설명했다.
- [ ] 파일명, 명령어, 코드 식별자, JSON key, enum 값, URL, 외부 제품명은 원문을 유지했다.
- [ ] README / AGENTS / docs 간 설명이 충돌하지 않는다.
- [ ] archive 문서를 current guidance처럼 보이게 만들지 않았다.
- [ ] 새 문서나 스크립트는 정식 산출물 또는 유지보수 가능한 도구로 설명 가능하다.

### 검증 (Validation)

- [ ] `npm run test`
- [ ] `npm run validate`
- [ ] 관련 targeted test를 실행했다.
