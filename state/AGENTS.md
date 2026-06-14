# state 작업 지침

`state/`는 파이프라인 운영 state(source snapshot monitor, article exposure history)를 둡니다. 읽기 전용 source registry는 `src/shared/data/news-sources.json`, 서빙되는 site data는 `articles/data/`로 분리되어 있으므로 혼동하지 마세요. source registry의 사람이 읽는 설명 문서는 `docs/NEWS_SOURCES.md`와 `docs/config/NEWS_SOURCES_FIELDS.md`를 함께 확인합니다.

## JSON 규칙 (JSON Rules)

- JSON keys와 enum-like values는 영어로 유지합니다.
- `usageHint`처럼 사람이 읽는 값은 한국어를 사용할 수 있습니다.
- `id`, `category`, `priority`, `reliability`, `collectionModeHint`, `schemaVersion` 같은 계약-bearing 값은 번역하지 않습니다.
- source entry에 `section`을 추가하지 마세요. section은 `sectionMap`에서 파생합니다.

## Source 정책 (Source Policy)

- `candidateOnly`, `requiresCrossCheck`, `enabled`, `priority`는 보수적으로 설정합니다.
- media/community/paywall source를 cross-check 없이 final reliable source로 표시하지 마세요.
- watch/reference page는 dated evidence와 article-level change가 없으면 main article 후보로 승격하지 않습니다.
- source registry 변경은 deterministic selection, source binding, quality gate에 영향을 줄 수 있으므로 좁게 검토합니다.

## 필수 검증 (Required Validation)

source entry를 추가하거나 바꾼 뒤에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:config
npm.cmd run test
npm.cmd run validate
```

## Source Monitor Registry (소스 모니터 레지스트리)

- `state/source-monitor-registry.json`은 source snapshot monitor 계약입니다. `schemaVersion`, `source_id`, `url_patterns`, `date_extractors`, bounded fetch 값, boolean policy flag를 validator와 함께 갱신하세요.
- `state/source-snapshots/**`는 reviewable generated state이며 public newsletter renderer 입력이 아닙니다.
- `processed_source_event_ids`, `processed_evidence_ids` 같은 내부 state를 public output에 노출하지 않습니다.
