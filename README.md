# Camera HAL SW Newsletter

Camera HAL, Android Camera, C++, AI 개발 생산성 관련 소식을 정리하는 정적 뉴스레터 사이트입니다.

## File Tree

```text
.
├── index.html
├── css/
│   ├── styles.css
│   └── hero-override.css
├── data/
│   └── newsletters.json
├── docs/
│   └── sources.md
├── newsletters/
│   └── YYYY-MM-DD/
│       ├── index.html
│       └── newsletter.md
└── .github/
    └── workflows/
        ├── weekly-newsletter-issue.yml
        └── validate-site.yml
```

## Structure

- `index.html`: 메인 랜딩 페이지입니다. `data/newsletters.json`을 읽어 최신호와 아카이브 목록을 렌더링합니다.
- `css/styles.css`: 사이트 공통 레이아웃, 카드, 버튼, 반응형 스타일입니다.
- `css/hero-override.css`: 메인 hero 비주얼을 카메라/센서 대시보드 형태로 조정하는 스타일입니다.
- `data/newsletters.json`: 메인 페이지가 사용하는 뉴스레터 메타데이터 목록입니다.
- `docs/sources.md`: 매주 뉴스 후보를 찾을 때 확인할 공식 문서와 신뢰 가능한 출처 목록입니다.
- `newsletters/YYYY-MM-DD/index.html`: 개별 뉴스레터 HTML 페이지입니다.
- `newsletters/YYYY-MM-DD/newsletter.md`: 개별 뉴스레터 Markdown 원본입니다.
- `.github/workflows/weekly-newsletter-issue.yml`: 매주 뉴스레터 작성 이슈를 생성하는 GitHub Actions 워크플로입니다.
- `.github/workflows/validate-site.yml`: `newsletters.json`, 링크 파일 존재 여부, TODO 문자열, 중복 날짜를 검증하는 워크플로입니다.

## Current Operation Mode

현재는 **수동 작성 + Issue 자동 생성 + 배포 전 검증** 방식으로 운영합니다.

- 사용: `weekly-newsletter-issue.yml`
- 사용: `validate-site.yml`
- 사용하지 않음: main 브랜치에 TODO 뉴스레터를 자동 생성하는 workflow

뉴스레터 파일을 자동으로 main에 생성하는 방식은 사용하지 않습니다. 자동화가 필요해지면 draft branch 또는 PR 생성 방식으로 바꿉니다.

## Add a Newsletter

1. `newsletters/YYYY-MM-DD/` 디렉터리를 만듭니다.
2. `newsletter.md`에 원본 내용을 작성합니다.
3. `index.html`에 웹 페이지용 내용을 작성합니다.
4. `data/newsletters.json`에 새 항목을 추가합니다.
5. 각 뉴스 항목에 `Sources`를 붙이고, 마지막 `References`에 전체 링크를 모읍니다.

## Newsletter Sections

| 카테고리 | 역할 |
|---|---|
| 이번 주 3줄 브리핑 | 핵심만 빠르게 요약 |
| AOSP Camera Watch | Android Camera 최신 흐름 |
| Tech Trend Radar | Camera / AI / Mobile / C++ 기술 동향 |
| 이번 주 C++ / AI 실전 팁 | 개발자가 바로 흥미를 느낄 실전 팁 |

각 주요 항목에는 `배경지식`과 `Camera HAL에서 확인해볼 아이템`을 반드시 포함합니다. 확인 아이템은 capability, request/result, stream/buffer, metadata, 로그/테스트 영향처럼 실제로 점검 가능한 단위로 나눕니다.

가능하면 기사에는 그림이나 block diagram을 포함합니다. HTML 페이지에는 CSS 기반 `.diagram-block`을 우선 사용하고, Markdown 원본에는 간단한 텍스트 다이어그램을 함께 남깁니다.

```json
{
  "date": "YYYY-MM-DD",
  "title": "Camera HAL SW Newsletter - YYYY-MM-DD",
  "summary": "이번 호 요약",
  "html": "newsletters/YYYY-MM-DD/index.html",
  "md": "newsletters/YYYY-MM-DD/newsletter.md",
  "tags": ["Camera HAL", "Android", "C++", "AI"]
}
```

## Local Preview

`fetch()`로 JSON을 읽기 때문에 브라우저에서 파일을 직접 여는 대신 로컬 HTTP 서버로 확인하는 편이 안전합니다.

```powershell
npx serve .
```
