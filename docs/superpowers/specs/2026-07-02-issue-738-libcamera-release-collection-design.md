# #738 libcamera 릴리스 수집 복구 — 설계

## 문제

W26 발행에서 libcamera 릴리스 신호(`v0.7.1+rpt20260609`)를 놓쳤다. `articles/content/newsroom/2026-06-24/source-quality-diagnosis.json`에서 libcamera 소스가 `raw_count:0`이었고, 수집기는 릴리스 본문 대신 아카이브 네비게이션 텍스트(`The libcamera-devel Archives`, `[ Thread ]`, `[ Gzip'd Text 841 KB ]`)만 후보로 만들었다.

## 라이브 확인으로 드러난 진짜 원인 (2026-07-02)

1. `libcamera-release-announcements`의 sourceUrl(`lists.libcamera.org/pipermail/libcamera-devel/`)은 **개발 리스트**라 릴리스 공지가 구조적으로 0건이다. 전용 리졸버 `resolveLibcameraReleaseAnnouncementItems`는 정상 동작하며 릴리스를 못 찾으면 `[]`를 반환한다.
2. 놓친 신호 `v0.7.1+rpt20260609`는 **Raspberry Pi 다운스트림 libcamera GitHub Releases**였다. `github.com/raspberrypi/libcamera/releases.atom`은 유효한 dated atom 피드이고 ~월 1회 릴리스한다(라이브 확인: v0.7.1+rpt20260609=2026-06-09, +rpt20260429=2026-05-01 ...).
3. 네비게이션 쓰레기의 origin은 [collect-news-candidates.js:1373](../../../src/shared/cli/collect-news-candidates.js#L1373)의 폴백이다: `const sourceSpecificItems = followedItems.length > 0 ? followedItems : indexItems;` — 리졸버가 `[]`를 반환하면 제너릭 파싱한 인덱스 나비링크(`indexItems`)로 폴백해 쓰레기를 후보로 만든다. index-only 소스(pipermail·security bulletin index)에서 이 폴백은 절대 유용하지 않다.

## 결정

- **방향**: upstream 릴리스 채널(git.libcamera.org)은 anti-bot 403이고 devel 리스트엔 릴리스가 없으므로, **RPi 다운스트림 릴리스 atom**을 신뢰할 수 있는 dated 저노이즈 소스로 추가한다(#738이 놓쳤다고 한 바로 그 신호).
- **①**: atom 피드의 패키징 태그(`pios/...`·`upstream/...`) 노이즈를 거르려 **릴리스 태그 필터 리졸버**를 OCP 레지스트리에 등록한다(제목이 `v\d+\.\d+`인 릴리스만).
- **②**: 나비 쓰레기의 origin 수정 — **리졸버가 등록된 소스는 리졸버가 `[]`여도 `indexItems`로 폴백하지 않는다**(회피성 disable이 아니라 원인 수정). `libcamera-release-announcements`와 `android-security-bulletin` 둘 다 나비 쓰레기가 사라지고, 소스는 enabled로 유지된다.

## 설계

### 조각 1 — 신규 소스 `raspberrypi-libcamera-releases`

`src/shared/data/news-sources.json`에 추가(atom 소스라 코드 없이 수집됨, lore 패턴):

- `rssUrl: https://github.com/raspberrypi/libcamera/releases.atom`
- `sourceUrl: https://github.com/raspberrypi/libcamera/releases`
- `collectionModeHint: release-note-watch`, `category: linux-camera`, `priority: high`, `reliability: project-official`
- `requiresCrossCheck: false`, `mainArticlePolicy: allowed`(공식 dated 릴리스 → 근거 충족 시 main 승격 가능)
- `keywords`: libcamera, Raspberry Pi, camera, pipeline, ISP, image sensor

### 조각 2 — 릴리스 태그 필터 리졸버 (①)

- 신규 `src/shared/collect/raspberrypi-libcamera-releases.js`: `resolveRaspberryPiLibcameraReleaseItems(indexItems)` — 제너릭 atom 파싱 결과(`indexItems`)에서 제목이 `/^v\d+\.\d+/`(예: `v0.7.1+rpt20260609`)인 릴리스만 남기고 `pios/`·`upstream/` 접두 태그를 버린다.
- `src/shared/collect/followed-source-item-resolvers.js` 레지스트리에 `id: 'raspberrypi-libcamera-releases'`로 등록(OCP — 디스패치 코드 무수정).

### 조각 3 — 폴백 origin 수정 (②)

- [collect-news-candidates.js:1372-1373](../../../src/shared/cli/collect-news-candidates.js#L1372-L1373)에서, `source.id`가 등록된 리졸버(`followedSourceResolverIds()`)에 속하면 `followedItems`를 그대로 쓰고(빈 배열이어도) `indexItems` 폴백을 하지 않는다. 미등록 소스는 기존 폴백 유지.

## 검증 (비협상)

- **단위(TDD)**: (a) 필터 리졸버가 `v*` 릴리스만 남기고 `pios/`·`upstream/`를 버린다, (b) 등록 리졸버 소스는 리졸버 `[]`일 때 `indexItems` 폴백을 하지 않는다(libcamera·security-bulletin 회귀 방지), (c) 미등록 소스는 폴백을 유지한다.
- **라이브**: RPi atom을 실제 fetch해 릴리스 후보 ≥1건(`v0.7.1+rpt20260609`)을 취득함을 실증(PR #734 교훈: fixture 통과 ≠ 라이브 동작).
- **게이트**: `npm.cmd run test` + `npm.cmd run validate:config`(소스 레지스트리 스키마) 통과.
- **발행 안전 불변**: quality 게이트·threshold·selection 로직 변경 없음. 신규 소스는 dated 공식 릴리스라 결정론 selection이 근거로 판단.

## 범위 밖 (follow-up)

- patchwork.libcamera.org patch-review 모니터링(고노이즈, JSON API, #744 분류기 필터 선행 필요) — 별도 작업으로 남긴다(#738 코멘트 참조).
