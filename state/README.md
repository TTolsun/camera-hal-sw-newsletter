# state

이 폴더는 파이프라인 운영 state(실행 중에 쌓이는 상태 파일)를 둡니다. 읽기 전용 source registry(`src/shared/data/`)나 서빙되는 site data(`articles/data/`)와는 구분되는 곳입니다. JSON key와 enum-like 값은 machine contract(기계가 읽는 계약 값)이므로 번역하지 않습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `source-monitor-registry.json` | source snapshot monitor 계약(`schemaVersion`, `source_id`, `url_patterns`, `date_extractors`, bounded fetch 값 등)입니다. |
| `source-snapshots/**` | bounded fetch로 관찰한 source snapshot의 reviewable generated state입니다. public newsletter renderer 입력이 아닙니다. |
| `article-exposure-history.json` | homepage headline 등 노출 이력을 추적하는 forward-only state입니다. 서빙되지 않습니다. |
| `AGENTS.md` | state 변경 시 지켜야 하는 JSON 계약과 검증 규칙입니다. |

## 편집 규칙

이 README는 폴더 개요만 제공합니다. state 파일을 수정할 때 지켜야 하는 상세 규칙(계약-bearing 값 번역 금지, reviewable generated state 대량 수정 금지, `processed_source_event_ids`·`processed_evidence_ids` 같은 내부 state의 public output 비노출 등)의 정본은 [AGENTS.md](AGENTS.md)입니다.

## 검증

```powershell
npm.cmd run validate:config
npm.cmd run validate:localization
npm.cmd run validate
```
