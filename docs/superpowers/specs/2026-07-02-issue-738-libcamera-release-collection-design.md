# #738 libcamera 릴리스 수집 복구 — 설계

## 문제

W26 발행에서 libcamera 릴리스 신호(`v0.7.1+rpt20260609`)를 놓쳤다. `articles/content/newsroom/2026-06-24/source-quality-diagnosis.json`에서 libcamera 소스가 `raw_count:0`이었고, 수집기는 릴리스 본문 대신 아카이브 네비게이션 텍스트(`The libcamera-devel Archives`, `[ Thread ]`, `[ Gzip'd Text 841 KB ]`)만 후보로 만들었다.

## 라이브 확인으로 드러난 진짜 원인 (2026-07-02)

1. `libcamera-release-announcements`의 sourceUrl(`lists.libcamera.org/pipermail/libcamera-devel/`)은 **개발 리스트**라 릴리스 공지가 구조적으로 0건이다. 전용 리졸버 `resolveLibcameraReleaseAnnouncementItems`는 정상 동작하며 릴리스를 못 찾으면 `[]`를 반환한다.
2. 놓친 신호 `v0.7.1+rpt20260609`는 **Raspberry Pi 다운스트림 libcamera GitHub Releases**였다. `github.com/raspberrypi/libcamera/releases.atom`은 유효한 dated atom 피드이고 ~월 1회 릴리스한다(라이브 확인: v0.7.1+rpt20260609=2026-06-09, +rpt20260429=2026-05-01 ...).
3. 네비게이션 쓰레기의 origin은 [collect-news-candidates.js:1377-1379](../../../src/shared/cli/collect-news-candidates.js#L1377-L1379)의 폴백이다: 큐레이션 추출(`parseSourceSpecificItems`의 PARSERS + followed-resolver)이 모두 비면 `parsed = feed ? parseRss(text, source) : parseHtmlPage(text, source)`로 제너릭 스크레이프에 폴백해, pipermail/bulletin 인덱스의 나비링크(`[ Thread ]`, `The libcamera-devel Archives`)를 후보로 만든다. index-only 큐레이션 소스에서 이 폴백은 절대 유용하지 않다(리졸버가 신호가 실제 채널에 없어 `[]`를 낸 것). 참고: RSS/atom 피드는 이 `parseRss`가 파싱한다(`parseSourceSpecificItems`의 PARSERS 테이블에 없는 소스는 여기로 떨어진다 — lore도 그렇다). `parseRss`는 `<item>` 또는 `<entry>` 블록을 처리한다.

## 결정

- **방향**: upstream 릴리스 채널(git.libcamera.org)은 anti-bot 403이고 devel 리스트엔 릴리스가 없으므로, **RPi 다운스트림 릴리스 atom**을 신뢰할 수 있는 dated 저노이즈 소스로 추가한다(#738이 놓쳤다고 한 바로 그 신호).
- **①**: atom 피드에는 진짜 릴리스(`v0.7.1+rpt20260609`, `libcamera v0.7.1`)와 패키징/브랜치 태그(`pios/...`·`upstream/...`, 같은 릴리스의 중복 ref)가 섞여 있다. 노이즈를 거르려 **followed-resolver가 atom `text`를 직접 파싱하고 `pios/`·`upstream/` 접두 태그를 제외**한다(upstream·downstream 릴리스는 둘 다 유지). 라이브 확인: 최신 10개 엔트리 중 접두 제외 시 6개 릴리스가 남는다.
- **②**: 나비 쓰레기의 origin 수정 — **followed-resolver가 등록된 소스는 큐레이션 추출이 비어도 제너릭 `parseRss`/`parseHtmlPage`로 폴백하지 않는다**([collect-news-candidates.js:1377-1379](../../../src/shared/cli/collect-news-candidates.js#L1377-L1379)). 회피성 `enabled:false`가 아니라 폴백 origin 수정이라, `libcamera-release-announcements`·`android-security-bulletin` 둘 다 나비 쓰레기가 사라지고 소스는 enabled로 유지된다. 리졸버 없는 소스(lore 등)는 기존 폴백 유지.

## 설계

### 조각 1 — 신규 소스 `raspberrypi-libcamera-releases`

`src/shared/data/news-sources.json`에 추가(atom 소스라 코드 없이 수집됨, lore 패턴):

- `rssUrl: https://github.com/raspberrypi/libcamera/releases.atom`
- `sourceUrl: https://github.com/raspberrypi/libcamera/releases`
- `collectionModeHint: release-note-watch`, `category: linux-camera`, `priority: high`, `reliability: project-official`
- `requiresCrossCheck: false`, `mainArticlePolicy: allowed`(공식 dated 릴리스 → 근거 충족 시 main 승격 가능)
- `keywords`: libcamera, Raspberry Pi, camera, pipeline, ISP, image sensor

### 조각 2 — 릴리스 파싱·필터 리졸버 (①)

- 신규 `src/shared/collect/raspberrypi-libcamera-releases.js`: `resolveRaspberryPiLibcameraReleaseItems(text, source)` — atom `text`의 `<entry>` 블록에서 `title`/`link href`/`updated`를 뽑고, 제목이 버전 릴리스이면서 `pios/`·`upstream/` 접두가 아닌 것만 남겨 canonical 후보로 반환한다. 후보 shape은 기존 `parseLibcameraReleaseAnnouncement`와 동일: `{ source, title: '<name> - <tag>', url: <tag link>, publishedAt: <updated ISO>, summary, version_or_release: <tag>, api_or_component: 'libcamera / V4L2 camera pipeline', relevanceBucketHint: 'camera_driver_image_pipeline', sourceKind: 'release_note_item', collectionMode: 'release-note-item', parentUrl, parentTitle }`.
- `followed-source-item-resolvers.js` 레지스트리에 `id: 'raspberrypi-libcamera-releases'`로 등록(OCP — `{ text, source }`를 위치 인자로 풀어 넘김).

### 조각 3 — 폴백 origin 수정 (②)

- [collect-news-candidates.js:1377-1379](../../../src/shared/cli/collect-news-candidates.js#L1377-L1379)에서, `source.id`가 등록된 followed-resolver(`followedSourceResolverIds()`)에 속하면 큐레이션 추출이 비었을 때 `parseRss`/`parseHtmlPage` 제너릭 폴백을 하지 않고 `[]`를 쓴다. 미등록 소스는 기존 폴백 유지(lore의 atom 파싱 경로 불변).

## 검증 (비협상)

- **단위(TDD)**: (a) 리졸버가 atom `text`에서 릴리스만 남기고 `pios/`·`upstream/` 접두를 버리며 canonical shape을 낸다, (b) followed-resolver 등록 소스는 큐레이션이 비었을 때 제너릭 `parseRss`/`parseHtmlPage` 폴백을 하지 않는다(나비 쓰레기 제거), (c) 미등록 소스는 폴백을 유지한다(lore 불변).
- **라이브**: RPi atom을 실제 fetch해 릴리스 후보 ≥1건(`v0.7.1+rpt20260609`)을 취득함을 실증(PR #734 교훈: fixture 통과 ≠ 라이브 동작).
- **게이트**: `npm.cmd run test` + `npm.cmd run validate:config`(소스 레지스트리 스키마) 통과.
- **발행 안전 불변**: quality 게이트·threshold·selection 로직 변경 없음. 신규 소스는 dated 공식 릴리스라 결정론 selection이 근거로 판단.

## 범위 밖 (follow-up)

- patchwork.libcamera.org patch-review 모니터링(고노이즈, JSON API, #744 분류기 필터 선행 필요) — 별도 작업으로 남긴다(#738 코멘트 참조).
