# data 작업 지침

`data/news-sources.json`은 machine-readable source of truth입니다. 사람이 읽는 설명 문서는 `docs/news-sources.md`와 `docs/config/news-sources-fields.ko.md`를 함께 확인합니다.

## JSON Rules

- JSON keys와 enum-like values는 영어로 유지합니다.
- `usageHint`처럼 사람이 읽는 값은 한국어를 사용할 수 있습니다.
- `id`, `category`, `priority`, `reliability`, `collectionModeHint`, `schemaVersion` 같은 계약-bearing 값은 번역하지 않습니다.
- source entry에 `section`을 추가하지 마세요. section은 `sectionMap`에서 파생합니다.

## Source Policy

- `candidateOnly`, `requiresCrossCheck`, `enabled`, `priority`는 보수적으로 설정합니다.
- media/community/paywall source를 cross-check 없이 final reliable source로 표시하지 마세요.
- watch/reference page는 dated evidence와 article-level change가 없으면 main article 후보로 승격하지 않습니다.
- source registry 변경은 deterministic selection, source binding, quality gate에 영향을 줄 수 있으므로 좁게 검토합니다.

## Required Validation

source entry를 추가하거나 바꾼 뒤에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:config
npm.cmd run test
npm.cmd run validate
```
