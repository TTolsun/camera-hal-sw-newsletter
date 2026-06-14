# state 작업 지침

`state/`는 파이프라인 운영 state(source snapshot monitor, article exposure history)를 둡니다. 읽기 전용 source registry는 `src/shared/data/news-sources.json`, 서빙되는 site data는 `articles/data/`로 분리되어 있으므로 혼동하지 마세요. source registry(`news-sources.json`) 편집 규칙은 그 파일을 소유하는 [src/AGENTS.md](../src/AGENTS.md)에 있습니다. source registry의 사람이 읽는 설명 문서는 `docs/NEWS_SOURCES.md`와 `docs/config/NEWS_SOURCES_FIELDS.md`를 함께 확인합니다.

## JSON 규칙 (JSON Rules)

- `state/` JSON 파일의 JSON keys와 enum-like values는 영어로 유지합니다.
- `schemaVersion`, `source_id` 같은 계약-bearing 값은 번역하지 않습니다.

## Source Monitor Registry (소스 모니터 레지스트리)

- `state/source-monitor-registry.json`은 source snapshot monitor 계약입니다. `schemaVersion`, `source_id`, `url_patterns`, `date_extractors`, bounded fetch 값, boolean policy flag를 validator와 함께 갱신하세요.
- `state/source-snapshots/**`는 reviewable generated state이며 public newsletter renderer 입력이 아닙니다.
- `processed_source_event_ids`, `processed_evidence_ids` 같은 내부 state를 public output에 노출하지 않습니다.

## 필수 검증 (Required Validation)

state JSON 계약이나 표시값을 바꾼 뒤에는 아래 명령을 실행합니다.

```powershell
npm.cmd run validate:config
npm.cmd run validate:localization
npm.cmd run validate
```
