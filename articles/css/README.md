# css

이 폴더는 정적 사이트 공통 stylesheet를 둡니다. Homepage, archive, generated newsletter HTML이 같은 public surface 안에서 보이므로 style 변경은 site 전체 표시를 기준으로 확인합니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `styles.css` | 정적 사이트와 newsletter page의 기본 style입니다. |
| `hero-override.css` | homepage hero 영역의 override(덮어쓰기) style입니다. |

## 작업 규칙

- CSS 변경은 renderer schema나 newsletter content 구조 변경과 섞지 않습니다.
- Public path를 바꾸지 말고, HTML template이나 `index.html`에서 참조하는 stylesheet path를 함께 확인합니다.
- Text가 button, card, navigation 영역에서 겹치지 않는지 desktop/mobile 화면을 확인합니다.

## 검증

```powershell
npm.cmd run validate:site
npm.cmd run validate
```
