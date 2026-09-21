# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 지침입니다.

이 파일은 저장소에 커밋되는 공유 파일입니다. worktree에서 작업할 때도 함께 실리도록 추적 대상으로 둡니다.

## 공통 지침의 정본은 AGENTS.md

에이전트 공통 지침(저장소 개요, 발행 안전 원칙, 발행 주기와 정책, encoding/shell 규칙, 디렉터리 구조, llm-wiki 활용, 명령어, 구현 컨벤션, 검증, local scratch, fixture 신뢰, PR scope)은 전부 [AGENTS.md](AGENTS.md)가 정본입니다. 작업 전에 root AGENTS.md를 먼저 읽고, 해당 영역을 수정하기 전에는 폴더별 scoped AGENTS.md([src/AGENTS.md](src/AGENTS.md), [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md), [state/AGENTS.md](state/AGENTS.md), [docs/AGENTS.md](docs/AGENTS.md), [articles/content/AGENTS.md](articles/content/AGENTS.md))를 읽으세요. 이 파일들은 약화하면 안 되는 발행 안전(publish-safety) 계약을 담고 있습니다.

이 파일에는 AGENTS.md에서 유도되지 않는 Claude 전용 사항만 둡니다. AGENTS.md가 이미 담고 있는 내용은 여기 옮겨 적지 않습니다. 개인 메모나 일회성 작업 기록은 이 파일이 아니라 `.tmp/`처럼 `.gitignore`로 보호되는 경로에 둡니다.

## Claude 전용 사항

- **작업 원칙 (Karpathy Guidelines):** 코드를 작성·리뷰·리팩터링할 때는 `andrej-karpathy-skills:karpathy-guidelines` skill을 호출해 따르세요. 핵심: 구현 전에 생각, 단순함 우선, 수술적 변경, 검증 가능한 성공 기준. 이 원칙이 AGENTS.md의 발행 안전 규칙과 충돌하면 항상 AGENTS.md가 우선합니다.
- **secrets:** `GEMINI_API_KEY`/`INTERNAL_LLM_API_KEY`는 GitHub Secrets 이외의 경로에서 읽지 않습니다(정본: [.github/workflows/AGENTS.md](.github/workflows/AGENTS.md)).
