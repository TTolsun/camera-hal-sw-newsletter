# data

이 폴더는 public site index data와 source registry를 둡니다. JSON key와 enum-like 값은 machine contract이므로 번역하지 않습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `../src/core/data/news-sources.json` | 후보 수집 source registry의 machine-readable source of truth입니다. (이 폴더가 아니라 `src/core/data/`에 있습니다.) |
| `newsletters.json` | public archive와 homepage가 읽는 newsletter index data입니다. |
| `AGENTS.md` | source registry 변경 시 지켜야 하는 JSON 계약과 검증 규칙입니다. |

## 작업 규칙

- `src/core/data/news-sources.json`의 `id`, `category`, `priority`, `reliability`, `collectionModeHint`, `schemaVersion` 같은 계약-bearing 값은 번역하지 않습니다.
- `usageHint`처럼 사람이 읽는 값은 한국어 설명을 포함할 수 있습니다.
- `newsletters.json`의 `title`, `summary`는 public 표시값이므로 한국어 localization validation 대상입니다.
- `docs/news-sources.md`는 사람이 검토하는 editorial view이고, machine source of truth는 `src/core/data/news-sources.json`입니다.

## 검증

```powershell
npm.cmd run validate:config
npm.cmd run validate:localization
npm.cmd run validate
```
