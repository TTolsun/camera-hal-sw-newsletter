# state

이 폴더는 파이프라인 운영 state(실행 중에 쌓이는 상태 파일)를 둡니다. 읽기 전용 source registry(`src/shared/data/`)나 서빙되는 site data(`articles/data/`)와는 구분되는 곳입니다. JSON key와 enum-like 값은 machine contract(기계가 읽는 계약 값)이므로 번역하지 않습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `source-monitor-registry.json` | source snapshot monitor 계약(`schemaVersion`, `source_id`, `url_patterns`, `date_extractors`, bounded fetch 값 등)입니다. |
| `source-snapshots/**` | bounded fetch로 관찰한 source snapshot의 reviewable generated state입니다. public newsletter renderer 입력이 아닙니다. |
| `article-exposure-history.json` | homepage headline 등 노출 이력을 추적하는 forward-only state입니다. 서빙되지 않습니다. |
| `AGENTS.md` | state 변경 시 지켜야 하는 JSON 계약과 검증 규칙입니다. |

## 작업 규칙

- `source-monitor-registry.json`의 계약-bearing 값은 validator와 함께 갱신하고, 번역하지 않습니다.
- `source-snapshots/**`와 `article-exposure-history.json`은 reviewable generated state이므로 임의로 대량 수정하지 않습니다.
- `processed_source_event_ids`, `processed_evidence_ids` 같은 내부 state를 public output에 노출하지 않습니다.

## 검증

```powershell
npm.cmd run validate:config
npm.cmd run validate:localization
npm.cmd run validate
```
