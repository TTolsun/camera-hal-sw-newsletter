---
version: 1
name: Camera SW Newsroom
description: Camera SW Newsletter 공개 사이트의 디자인 시스템. Apple Newsroom 계열의 조용한 편집(editorial) 룩 — Pretendard 타이포, 흰/파치먼트 캔버스, 단일 blue 액센트(#0066cc), 이미지 앞세운(image-forward) 카드, 평평한 elevation. 장식(그라디언트·과한 셰도우)을 걷어내고 콘텐츠(기사·이미지)가 말하게 한다.
---

## 개요

Camera SW Newsletter 사이트는 **Apple Newsroom 계열의 편집형 룩**을 따른다. 흰색과 파치먼트(#f5f5f7)가 지배하는 캔버스 위에 Pretendard로 조판하고, 상호작용 요소는 전부 하나의 파랑(`#0066cc`)만 쓴다. UI chrome은 물러나고 16:9 이미지와 헤드라인이 전면에 온다. 셰도우는 카드 가독성을 위한 최소한의 저알파 하나와, featured 브랜드 이미지에 얹는 단일 product drop-shadow만 남긴다.

이 문서는 정본(canonical) 디자인 방향이다. 실제 값의 source of truth는 [articles/css/styles.css](articles/css/styles.css)의 `:root` 토큰이며, 홈/아카이브/이슈 페이지의 CSS·HTML 계약은 `src/shared/test/workflow/homepage-archive.test.js`, `.../archive-page.test.js`, `src/generator/test/contract/newsletter-renderer.test.js`, `src/generator/validate/validate-site.js`가 잠근다. 이 문서와 코드가 어긋나면 코드가 우선한다.

## 브랜드

- 워드마크: 헤더는 "Camera SW Newsroom"(‘Newsroom’은 `--text-tertiary`), 문서 title·OG·푸터 법적표기는 "Camera SW Newsletter"를 유지한다.
- 마스코트: HALley (`assets/images/brand/HALley.png`, 헤더 로고 `HALley-logo.png`) — 홈 브랜드 히어로의 fallback 이미지, OG 이미지, 헤더 로고. (이슈·아카이브 히어로에는 쓰지 않는다 — mockup은 카피 중심.) 래스터는 handoff 레퍼런스의 **초록 액센트 일러스트**를 쓴다(단일 blue UI 액센트와 별개인 브랜드 그래픽 — 아래 색 참고).
- 폰트: **Pretendard Variable** (jsdelivr CDN) + 시스템 폴백(`-apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Segoe UI", Roboto, "Noto Sans KR"`). 한글·라틴 모두 Apple SD Gothic Neo에 가까운 조용한 인상을 준다.

## 색

단일 액센트 원칙: 모든 링크·활성 상태·focus 신호는 `--primary`(#0066cc)만 쓴다. 두 번째 UI 액센트 색은 없다. (예외: 마스코트 HALley 일러스트는 자체 **초록** 팔레트를 쓰는 브랜드 그래픽이다 — UI chrome·상호작용 요소는 여전히 blue 하나만. handoff mockup도 초록 마스코트 + blue UI 구성이다.)

- 액센트: `--primary` #0066cc, `--primary-hover` #0052a3, `--focus-ring` rgba(0,102,204,.35).
- 텍스트: `--text` #1d1d1f(본문 ink), 보조 텍스트 `--muted` #6e6e73(흰 배경 5.07:1, 파치먼트 4.65:1로 WCAG AA ≥4.5:1), 3차 메타 `--text-tertiary` #6e6e73(날짜·캡션·법적 표기). handoff 원값 #86868b 는 흰 배경 3.62:1·파치먼트 3.33:1 로 AA 미달이라 쓰지 않는다 — 흰/파치먼트 캔버스에서 AA 를 지키면서 `--muted` 보다 밝은 색은 사실상 없으므로(상한 ≈#707075, 4.52:1) **`--muted` 와의 색 단차는 두지 않고 크기(12–14px)·트래킹·배치로 구분**한다. `--text` 와의 구분은 여전히 색으로 낸다(예: 나브의 GitHub 링크). 두 토큰은 값이 같아도 의미 층이 달라 합치지 않는다.
- 캔버스: `--surface` #ffffff(지배·풀블리드), `--bg` #f5f5f7(파치먼트: 브리핑/take/참고자료 박스·푸터·chip 기본), `--surface-soft` #f5f5f7(썸네일·featured·이미지 placeholder 배경 — handoff 와 동일하게 파치먼트 톤).
- 라인: `--line` #e0e0e0 hairline. 컨트롤(정렬 pill·페이지 버튼·번호 배지) 테두리는 #d2d2d7.
- chip: 기본 #f5f5f7 + #e3e3e8 border, **활성은 ink(#1d1d1f) 채움 + 흰 글자**(파랑이 아니라 검정 — 편집형 필터 grammar).

## 타이포그래피

- 본문: 16–17px, line-height 1.6–1.68, letter-spacing -0.01em, ink(#1d1d1f). 이슈 prose는 17px/1.68로 읽기 호흡을 준다. 이슈 리드만 19px/1.55 weight 500.
- 기사별 소제목(`.article-subheading`, Story Contract v2 본문에서만 나온다): 19px/1.4 weight 600, letter-spacing -0.014em. 리드와 크기는 같고 무게로 갈린다. 640px 이하에서는 리드와 함께 17px로 내려간다.
- 헤드라인: weight 600, 음의 letter-spacing(-0.014 ~ -0.022em)으로 "Apple tight" 케이던스. featured 타이틀 `clamp(1.9rem, 3.4vw, 2.9rem)`, 이슈 타이틀·아카이브 h1 `clamp(2.125rem, 4vw, 3.25rem)`, 기사 h2 `clamp(1.5rem, 2.4vw, 2rem)`.
- kicker/카테고리 라벨: 12–13px, weight 600, `letter-spacing: .04–.08em`, `text-transform: uppercase`, muted 색.
- 숫자(카운트·meta·번호 배지): `font-variant-numeric: tabular-nums`.

## 레이아웃 & 간격

- 콘텐츠 폭: 풀블리드 흰 셸(라운드 프레임 없음) 안에서 홈/아카이브 콘텐츠 `min(100% - 44px, 1036px)`(mockup 1080px에 좌우 22px 거터), 이슈 wrap `min(100% - 44px, 760px)`, featured 리딩 블록 ~1000px.
- 라운드: `--radius-lg` 18px(카드 썸네일·featured 패널), `--radius-md` 14px, `--radius-sm` 12px, `--radius-xs` 8px, `--radius-pill` 999px(chip·sort·버튼).
- 그리드: 카드 그리드는 1‑col → 2‑col(≥700px) → 3‑col(≥1000px, 홈 `.latest-grid`·아카이브 `.archive-page .archive-grid`).

## Elevation

- chrome(헤더·카드·버튼)에는 하드 셰도우를 쓰지 않는다. elevation은 (a) 표면색 변화(흰↔파치먼트)와 (b) 헤더의 backdrop-filter blur로 낸다.
- featured 브랜드 이미지의 단일 product drop-shadow `drop-shadow(3px 5px 30px rgba(0,0,0,.22))`만 허용. 리디자인된 페이지(홈·아카이브·위클리 이슈)의 카드·박스는 전부 flat(무테두리·무셰도우 또는 hairline만).
- 16:9 이미지 패널(`.card-thumb`·`.featured-thumb`)에는 `--line` hairline을 두른다. 실제 기사 이미지는 대부분 흰 배경 소셜 카드라, 테두리가 없으면 흰 캔버스와 경계가 사라져 패널 자체가 안 보인다. 카드 프레임(`.archive-card`)은 그대로 투명·무테두리이고, 경계선은 이미지 컨테이너에만 둔다(`box-sizing: border-box`라 16:9 바깥 크기는 변하지 않는다). 세 가지는 의도한 결정이다:
  - **fallback(브랜드) 패널에도 같은 hairline을 유지한다.** 이미지 유무로 테두리를 켜고 끄면 그리드에서 카드마다 프레임이 나타났다 사라진다. 조건 분기를 만들지 않는다.
  - **이슈 본문 이미지(`figure.article-media`)는 계속 무테두리다.** 읽기 컬럼(760px)에서는 위아래 텍스트와 캡션이 경계를 대신하지만, 카드 그리드에는 그런 문맥이 없다.
  - **hairline은 `--line`(#e0e0e0)을 그대로 쓴다.** 흰 배경 대비 약 1.3:1로 WCAG 1.4.11(3:1) 아래지만, 이건 정보를 전달하는 UI 컨트롤 경계가 아니라 장식 구분선이고(내용은 이미지·헤드라인·meta가 전달한다), 3:1을 만들려면 회색 상자가 돼 hairline 언어 자체가 무너진다.
- 장식용 그라디언트·radial glow 배경 금지. 유일한 예외는 이미지 placeholder 패턴이다(패턴은 하나뿐 — 기사 종류별 variant 색조는 쓰지 않는다).

## 컴포넌트

- **헤더(`.site-header.homepage-site-header`)**: sticky 58px, 반투명 흰 배경(rgba(255,255,255,.82)) + `backdrop-filter: saturate(180%) blur(20px)`, hairline bottom. 좌측 브랜드, 우측 나브(홈 / 아카이브 / GitHub — GitHub만 tertiary 색, 14px/500).
- **Featured 히어로(`.featured-hero`)**: 16:9 라운드 미디어 패널(`.featured-thumb`, hairline) 위/아래로, 가운데 정렬된 kicker → h1 타이틀 → lead → `date · source` → "기사 읽기 →" 링크. `source`는 **발행처 이름**(수집 단계의 `candidate.source`)이지 문서 제목이 아니다 — 발행된 이슈 HTML의 앵커 라벨에서 되읽지 않는다(`headline-render-reconciliation`). featured 이미지는 실제 기사 이미지든 동봉 fallback 그래픽이든 **16:9 풀커버**(`.featured-img`)다. 44% 중앙 + product drop-shadow(`.featured-img.is-brand`)는 **투명 배경 마스코트 전용**이고, 지금 그것을 쓰는 곳은 헤드라인 데이터가 없을 때 나오는 정적 브랜드 히어로(HALley + 브랜드 카피, h1 유지) 하나뿐이다. `assets/images/fallback/`의 카테고리 fallback 4종(`ai`/`android`/`cpp`/`newsletter-default`)은 캔버스를 채우는 불투명 `rect`를 가져서 축소하면 product shot이 아니라 패널 위에 얹힌 사각형으로 읽힌다(#1008). 그 `rect` 색은 카테고리마다 다른 off-palette 흰색이었는데, 풀커버로 바꾸면서 넷 다 `--surface-soft`로 맞췄다 — 이제 그래픽과 패널이 같은 표면이라 경계가 없다. 아카이브 카드(`.card-thumb-img`)도 fallback 여부와 무관하게 풀커버이므로 히어로와 카드가 같은 모양이 된다. 대신 fallback 자리와 실제 기사 이미지가 모양으로는 구분되지 않는다 — 구분은 kicker·meta가 낸다.
- **이미지 카드(`.archive-card`, 공유 `renderArchiveCard`)**: 16:9 썸네일(`.card-thumb` — hairline, hover 시 1.045 scale) → uppercase kicker(주제) → 톱 기사 헤드라인(hover underline) → 주(week) meta. **카드 프레임**은 배경·테두리 없는 투명 카드다(테두리는 썸네일에만). 홈 "최신 소식" 그리드와 아카이브 그리드가 공유한다. 썸네일은 첫 **실제(비-fallback)** 기사 이미지를 우선하고 없을 때만 placeholder를 쓴다(`cardImage`). kicker(주제)와 아카이브 필터 카운트는 그 주 기사 relevance bucket에서 파생한 위클리 topic 태그(첫 값이 kicker)에서 나온다(`weeklyTopicTags`) — 이슈 레벨 기본 태그가 아니다.
- **주제 chip(`.keyword`)**: 평평한 pill, 기본 #f5f5f7, 활성 ink 채움. 아카이브 chip은 카운트 뱃지(`.archive-topic-count`)를 곁들인다.
- **정렬(`.nc-sort`)**: pill 셀렉트 + 인라인 chevron. 최신순/오래된순. chevron 은 data URI 라 `var()` 를 못 쓰므로 3차 메타 색과 같은 값을 리터럴로 박아 둔다 — `--text-tertiary` 를 바꾸면 이 리터럴도 같이 바꾼다.
- **아카이브 헤더·통계행**: kicker "Newsletter Archive" → h1 "아카이브" → **muted 설명 문장**(`.archive-hero-description`, `--muted`). 그 아래 통계행(`.archive-stat-grid`)은 발행 호수(`N호`) / 주제 / 정렬 — hairline으로만 나눈 오픈 밴드(라벨 12px tertiary, 값 30px/600). 세로 리듬은 mockup을 따른다: 헤더 hairline 바로 아래 통계밴드(‌`.homepage .archive-page-section` 세로 패딩·최소 높이 없음), 결과 요약 줄(`.archive-result-summary`)은 sr-only(시각 숨김·스크린리더 유지), 페이지당 12개(`ARCHIVE_PAGE_SIZE`)라 현재 발행분은 한 페이지에 전부 보이고 성장 시에만 페이지네이션이 나타난다.
- **이슈 기사(`.issue-story.issue-section`)**: 카드 프레임 없이 hairline+60px 리듬으로 구분되는 평문 흐름 — 제로패딩 아웃라인 번호(`01`, #d2d2d7 원) + uppercase 카테고리 눈썹 → 헤드라인 → 회색 출처 서브타이틀 → **풀폭 16:9 라운드 이미지 + 평문 캡션**(캡션은 기사 출처에서 가져온 이미지에만 붙는다 — repo fallback 이미지는 어느 출처에서도 오지 않았으므로 캡션 없이 그림만 나온다) → 19px/500 리드 → 17px prose(Story Contract v2 기사는 이 흐름 안에 기사별 소제목 `h3.article-subheading`이 0~4개 섞인다) → "Camera HAL · Driver 관점" 파치먼트 take 박스 → 세로 불릿 출처 목록. 페이지 끝에는 `issue-footer-navigation`("← 뉴스룸으로 · 아카이브 전체 보기 →").
- **푸터(`.site-footer`)**: 파치먼트 배경 + hairline top, 3컬럼(뉴스레터/주제/리소스) + 법적 표기(tertiary).

## Do & Don't

- Do: 모든 상호작용에 `#0066cc` 하나만. 헤드라인은 weight 600 + 음의 트래킹. 카드는 이미지 앞세우고, 없으면 `assets/images/fallback/newsletter-default.svg`로 폴백. 활성 chip은 ink 채움.
- Don't: 두 번째 액센트 색 도입, chrome에 하드 셰도우, 장식 그라디언트 배경, 카드에 임의 URL 이미지(리졸버·fallback 계약을 따른다). weight 램프는 400(본문)/500(리드·나브·chip)/600(헤드라인·라벨)이며 700 이상은 쓰지 않는다.

## 반응형

- 3‑col(≥1000px) → 2‑col(≥700px) → 1‑col. 헤더 나브는 좁은 폭에서 wrap. featured 히어로는 단일 컬럼 스택, 아카이브 스탯 밴드는 `@media(max-width:640px)`에서 세로 스택(가로 hairline)으로 전환.

## 알려진 갭 / 후속

- **미사용(dead) CSS 정리 (완료 — 2라운드)**: 1라운드는 리디자인 직후의 dead 규칙(`.headline-*`, `.latest-newsletter-card`/`.latest-card-*`, `.card-summary`/`.clamp-3`, 홈 tagline 히어로 계열)을 걷어냈다. 2라운드에서 남아 있던 도달 불가 규칙 **358줄(styles.css 2542 → 2192줄)**을 마저 제거했다 — `.diagram-*`(9규칙), `.topbar`/`.navlinks`/`.pill`/`.chiprow`/`.chip`, `.hero-grid`/`.grid-2`/`.grid-3`/`.section-lead`/`.ref-list`/`.brief-card`/`.panel`, `.focus-brief`/`.focus-band`/`.focus-title`, `.archive-heading`/`.archive-controls`, `.section-heading-mark`/`.section-icon-star`/`.section-icon-latest`, `.tag-more`/`.card-actions`/`.hero-actions`/`.actions`, `.site-hero::before`, `.hero-mascot img`, off-palette `.issue-section h3`(#111827). **이미지 placeholder variant 4종만 성격이 다르다** — `.article-placeholder-camera-hal`은 레거시 1페이지(2026-05-21)가 실제로 참조하므로 도달 불가가 아니라 **의도적으로 없앤 라이브 규칙**이다(효과는 아래 레거시 항목 참조). **의도적으로 유지하는 것은 살아있는 규칙 안의 dead 셀렉터뿐**이다: `.newsletter-card`(text-decoration 그룹 — `exactSelectorBlock('.archive-card')`가 image-forward 카드로 해석되도록), `.hero-tags`(`.tag-row`/`.tag` 그룹), `.action-card`(카드 프레임 그룹), `.status-chip`/`.category-label`/`.badge`(`.issue-kicker` 그룹), `#archive`(`#latest` 그룹). 램프 밖 굵기는 이제 0개라 `font-weight` 잠금 기대값도 `[]`다.
- **레거시 daily 페이지 27개**: 재렌더 소스가 없어 구 마크업(`article-feature-row`·카드 프레임·`section-icon-list`·`issue-hero-mascot`) 그대로 남는다. 공유 CSS와 전역 `img { max-width: 100% }` 리셋 덕에 깨지지는 않지만, 리디자인된 위클리와 룩이 다르다(수용된 예외 — #778 전례). 이후 발행분(2026-07-13 이후 daily 5개 + 위클리 15개)은 전부 새 뉴스룸 흐름이다. 이 페이지들의 stale한 `article-placeholder-*` variant 클래스는 대응 CSS가 사라져 베이스 패턴으로 렌더된다(alpha 0.02 차이, 육안 무변화).
- **RSS·편집 정책**: 푸터에 "(지원예정)" 노트로만 존재. 실제 피드/페이지가 생기면 링크로 승격.
- **구형 위클리 분류 데이터**: W19–W22 등 예전 `issue.json`은 section에 relevance bucket이 없어 카드 topic이 baseline(Camera HAL / Android)으로만 파생된다. 최근 주(W23–W28)는 bucket이 있어 Driver·Image Processing·AI 등으로 분류된다. SoC Platform 칩은 현재 발행분에 해당 bucket 기사가 없어 count 0(비활성)이다 — 데이터가 생기면 자동으로 채워진다.

> 진행 완료(main, handoff mockup `Camera SW Newsroom.dc.html` 정렬 — PR #779–#783 + 위클리 재렌더): 풀블리드 흰 셸(라운드 프레임·그라디언트 제거)·58px 반투명 헤더·한글 나브(홈/아카이브)·featured 히어로 mockup 리듬·홈/아카이브 46×28px 카드 그리드·아카이브 오픈 스탯 밴드+단일 필터 행·이슈 페이지 평문 흐름(아웃라인 번호+카테고리 눈썹·파치먼트 박스 언어·하단 내비)·W19–W28 재렌더 발행.

> 진행 완료(handoff `untitled/project` 레퍼런스 재정렬 라운드 2): HALley 마스코트 초록 복원(#785 되돌림)·~~featured fallback 이미지 브랜드 처리(`.featured-img.is-brand`)~~ **(#1008에서 되돌림 — fallback 그래픽은 풀커버, `.is-brand`는 투명 배경 마스코트 전용. 현재 규칙은 위 「컴포넌트 > Featured 히어로」가 정본이다.)**·카드 썸네일 실제 이미지 우선(`cardImage`)·아카이브 설명 muted·아카이브 세로 리듬 정리(헤더↔통계밴드 gap 제거·결과 요약 sr-only·min-height 제거·페이지당 12)·위클리 topic 태그를 기사 relevance bucket에서 파생(`weeklyTopicTags` — Driver/Image Processing/AI 필터 활성화·kicker 다양화·Tooling Watch 노이즈 제거).
