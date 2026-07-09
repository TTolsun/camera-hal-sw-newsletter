---
version: 1
name: Camera SW Newsroom
description: Camera SW Newsletter 공개 사이트의 디자인 시스템. Apple Newsroom 계열의 조용한 편집(editorial) 룩 — Pretendard 타이포, 흰/파치먼트 캔버스, 단일 blue 액센트(#0066cc), 이미지 앞세운(image-forward) 카드, 평평한 elevation. 장식(그라디언트·과한 셰도우)을 걷어내고 콘텐츠(기사·이미지)가 말하게 한다.
---

## 개요

Camera SW Newsletter 사이트는 **Apple Newsroom 계열의 편집형 룩**을 따른다. 흰색과 파치먼트(#f5f5f7)가 지배하는 캔버스 위에 Pretendard로 조판하고, 상호작용 요소는 전부 하나의 파랑(`#0066cc`)만 쓴다. UI chrome은 물러나고 16:9 이미지와 헤드라인이 전면에 온다. 셰도우는 카드 가독성을 위한 최소한의 저알파 하나와, featured 브랜드 이미지에 얹는 단일 product drop-shadow만 남긴다.

이 문서는 정본(canonical) 디자인 방향이다. 실제 값의 source of truth는 [articles/css/styles.css](articles/css/styles.css)의 `:root` 토큰이며, 홈/아카이브/이슈 페이지의 CSS·HTML 계약은 `src/shared/test/workflow/homepage-archive.test.js`, `.../archive-page.test.js`, `src/generator/test/contract/newsletter-renderer.test.js`, `src/generator/validate/validate-site.js`가 잠근다. 이 문서와 코드가 어긋나면 코드가 우선한다.

## 브랜드

- 워드마크: 헤더는 "Camera SW Newsroom"(‘Newsroom’은 muted), 문서 title·OG·푸터 법적표기는 "Camera SW Newsletter"를 유지한다.
- 마스코트: HALley (`assets/images/brand/HALley.png`) — 이슈 히어로와 홈 브랜드 히어로의 fallback 이미지, OG 이미지.
- 폰트: **Pretendard Variable** (jsdelivr CDN) + 시스템 폴백(`-apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Segoe UI", Roboto, "Noto Sans KR"`). 한글·라틴 모두 Apple SD Gothic Neo에 가까운 조용한 인상을 준다.

## 색

단일 액센트 원칙: 모든 링크·활성 상태·focus 신호는 `--primary`(#0066cc)만 쓴다. 두 번째 브랜드 색은 없다.

- 액센트: `--primary` #0066cc, `--primary-hover` #0052a3, `--focus-ring` rgba(0,102,204,.35).
- 텍스트: `--text` #1f2937(본문 ink), 보조 텍스트 `--muted` #5c6470 — 크림 캔버스에서도 WCAG AA(≥4.5:1)를 유지하도록 조정. 이슈 상세의 편집 텍스트는 #6e6e73/#86868b 계열의 조용한 회색.
- 캔버스: `--surface` #ffffff(지배), `--bg` #f5f5f7(파치먼트: 히어로 미디어 패널·take 박스·푸터·chip 기본), `--surface-soft` #ececf1(썸네일 placeholder 배경).
- 라인: `--line` #dde3ea / #e0e0e0 hairline.
- chip: 기본 #f5f5f7 + #e3e3e8 border, **활성은 ink(#1d1d1f) 채움 + 흰 글자**(파랑이 아니라 검정 — 편집형 필터 grammar).

## 타이포그래피

- 본문: 16–17px, line-height 1.6–1.76, letter-spacing -0.01em. 이슈 prose는 17px/1.68로 읽기 호흡을 준다.
- 헤드라인: weight 600, 음의 letter-spacing(-0.014 ~ -0.022em)으로 "Apple tight" 케이던스. featured 타이틀 `clamp(1.9rem, 3.4vw, 2.9rem)`, 이슈 타이틀 `clamp(1.75rem, 3.55vw, 2.95rem)`.
- kicker/카테고리 라벨: 12px 내외, weight 700, `letter-spacing: .06–.08em`, `text-transform: uppercase`, muted 색.
- 숫자(카운트·meta): `font-variant-numeric: tabular-nums`.

## 레이아웃 & 간격

- 콘텐츠 폭: 홈/아카이브 셸 `min(100% - 28px, 1200px)`, 히어로·이슈 wrap `min(100% - 48px, 1120px)`, featured/브리핑 리딩 블록 ~1000px.
- 라운드: `--radius-lg` 18px(카드 썸네일·featured 패널), `--radius-md` 14px, `--radius-sm` 12px, `--radius-xs` 8px, `--radius-pill` 999px(chip·sort·버튼).
- 그리드: 카드 그리드는 1‑col → 2‑col(≥700px) → 3‑col(≥1000px, 홈 `.latest-grid`·아카이브 `.archive-page .archive-grid`).

## Elevation

- chrome(헤더·카드·버튼)에는 하드 셰도우를 쓰지 않는다. elevation은 (a) 표면색 변화(흰↔파치먼트)와 (b) 헤더의 backdrop-filter blur로 낸다.
- 카드 가독성용 최소 저알파 셰도우(`--shadow-sm/md/lg`) 하나와, featured 브랜드 이미지의 단일 product drop-shadow `drop-shadow(3px 5px 30px rgba(0,0,0,.22))`, 이슈 마스코트 `drop-shadow(0 16px 28px rgba(15,23,42,.11))`만 허용.
- 장식용 그라디언트 배경 금지. 유일한 예외는 페이지 상단의 아주 옅은 파랑 radial glow(`rgba(0,102,204,.09)`)와 이미지 placeholder 패턴.

## 컴포넌트

- **헤더(`.site-header.homepage-site-header`)**: sticky, 반투명 흰 배경 + `backdrop-filter: saturate(180%) blur(20px)`, hairline bottom. 좌측 브랜드, 우측 나브(Home / Archive / GitHub).
- **Featured 히어로(`.featured-hero`)**: 16:9 라운드 미디어 패널(`.featured-thumb`) 위/아래로, 가운데 정렬된 kicker → h1 타이틀 → lead → `date · source` → "기사 읽기 →" 링크. 헤드라인 데이터가 없으면 정적 브랜드 히어로(HALley + 브랜드 카피)가 h1을 유지한다.
- **이미지 카드(`.archive-card`, 공유 `renderArchiveCard`)**: 16:9 썸네일(hover 시 1.045 scale) → uppercase kicker(주제) → 톱 기사 헤드라인(hover underline) → 주(week) meta. 배경·테두리 없는 투명 카드. 홈 "최신 소식" 그리드와 아카이브 그리드가 공유한다.
- **주제 chip(`.keyword`)**: 평평한 pill, 기본 #f5f5f7, 활성 ink 채움. 아카이브 chip은 카운트 뱃지(`.archive-topic-count`)를 곁들인다.
- **정렬(`.nc-sort`)**: pill 셀렉트 + 인라인 chevron. 최신순/오래된순.
- **아카이브 통계행(`.archive-stat-grid`)**: 발행 호수 / 주제 / 정렬 3열.
- **이슈 기사(`.issue-story`)**: 좌측 원형 넘버 뱃지 → 카테고리 → 헤드라인 → **풀폭 16:9 이미지(스택)** → lead → prose → "Camera HAL/Driver 관점" 회색 take 박스(파치먼트 배경 + uppercase 라벨) → 출처 목록.
- **푸터(`.site-footer`)**: hairline top, 법적 표기.

## Do & Don't

- Do: 모든 상호작용에 `#0066cc` 하나만. 헤드라인은 weight 600 + 음의 트래킹. 카드는 이미지 앞세우고, 없으면 `assets/images/fallback/newsletter-default.svg`로 폴백. 활성 chip은 ink 채움.
- Don't: 두 번째 액센트 색 도입, chrome에 하드 셰도우, 장식 그라디언트 배경, 카드에 임의 URL 이미지(리졸버·fallback 계약을 따른다), 본문 weight 500(램프는 400/600/700).

## 반응형

- 3‑col(≥1000px) → 2‑col(≥700px) → 1‑col. 헤더 나브는 좁은 폭에서 wrap. featured/이슈 히어로는 단일 컬럼으로 스택. 이슈 마스코트·글로우는 `@media(max-width:860px|640px)`에서 축소.

## 알려진 갭 / 후속

- **미사용(dead) CSS 정리**: 홈 재구성·이슈 마스코트 제거 이후 `.homepage .site-hero`·`.hero-*`·`.latest-newsletter-card`·`.latest-card-*`·`.headline-*`·`.issue-hero-mascot` 규칙이 미사용이나, 이 클래스들이 살아있는 archive/issue와 공유되는 grouped·test-lock 셀렉터(예: `.site-hero::before, .archive-hero::before, .issue-hero::before` 글로우, `.hero-mascot img, .archive-hero-mascot img, ...`)에 얽혀 있어(파일 전반 40+ 지점, media query 포함) 성급히 걷으면 라이브 스타일이 깨진다. 셀렉터 분리 + CSS-lock 테스트 갱신을 동반하는 신중한 리팩터 증분으로 남긴다. (새 `.featured-hero` CSS 커버리지는 추가됨.)
- **기존 생성 이슈 페이지 재렌더**: 이슈 레이아웃 변경은 렌더러에만 반영(사용자 결정)했으므로, 이미 발행된 이슈 페이지는 다음 주간 생성 때 새 레이아웃으로 재렌더된다. 그전까지 홈/아카이브와 기존 이슈 페이지의 chrome/레이아웃이 일시 불일치.

> 진행 완료(main): 홈 재구성·이미지 카드·아카이브 3-col·Pretendard·이슈 페이지 mockup(760px 좁은 컬럼·마스코트 없는 히어로·"2026 W##" 타이틀·풀폭 이미지·회색 take 박스)·공유 chrome(Newsroom 워드마크+로고+3-컬럼 푸터)·featured-hero 커버리지.
