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
├── newsletters/
│   └── YYYY-MM-DD/
│       ├── index.html
│       └── newsletter.md
└── .github/
    └── workflows/
        └── weekly-newsletter-issue.yml
```

## Structure

- `index.html`: 메인 랜딩 페이지입니다. `data/newsletters.json`을 읽어 최신호와 아카이브 목록을 렌더링합니다.
- `css/styles.css`: 사이트 공통 레이아웃, 카드, 버튼, 반응형 스타일입니다.
- `css/hero-override.css`: 메인 hero 비주얼을 카메라/센서 대시보드 형태로 조정하는 스타일입니다.
- `data/newsletters.json`: 메인 페이지가 사용하는 뉴스레터 메타데이터 목록입니다.
- `newsletters/YYYY-MM-DD/index.html`: 개별 뉴스레터 HTML 페이지입니다.
- `newsletters/YYYY-MM-DD/newsletter.md`: 개별 뉴스레터 Markdown 원본입니다.
- `.github/workflows/weekly-newsletter-issue.yml`: 매주 뉴스레터 작성 이슈를 생성하는 GitHub Actions 워크플로입니다.

## Add a Newsletter

1. `newsletters/YYYY-MM-DD/` 디렉터리를 만듭니다.
2. `newsletter.md`에 원본 내용을 작성합니다.
3. `index.html`에 웹 페이지용 내용을 작성합니다.
4. `data/newsletters.json`에 새 항목을 추가합니다.

## Newsletter Sections

| 카테고리 | 역할 |
|---|---|
| 이번 주 3줄 브리핑 | 핵심만 빠르게 요약 |
| AOSP Camera Watch | Android Camera 최신 흐름 |
| Tech Trend Radar | Camera / AI / Mobile / C++ 기술 동향 |
| 이번 주 C++ / AI 실전 팁 | 개발자가 바로 흥미를 느낄 실전 팁 |

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
