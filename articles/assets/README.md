# assets

이 폴더는 정적 사이트 image와 article image fallback asset을 둡니다. Public page에서 직접 참조될 수 있으므로 path 변경은 site validation과 image validation에 영향을 줍니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `assets/images/` | homepage, archive, newsletter page에서 사용할 수 있는 image asset입니다. |
| `assets/images/fallback/` | article image resolver가 외부 image를 사용할 수 없을 때 쓰는 fallback(대체) image입니다. |
| `assets/images/brand/` | brand(브랜드) asset입니다. |
| `assets/js/` | homepage와 archive에서 쓰는 client script입니다. |

## 작업 규칙

- image file을 바꾸면 public HTML, Markdown output, `articles/data/newsletters.json`에서 참조하는 path를 함께 확인합니다.
- 외부 기사 이미지의 임의 URL 대체 금지, image resolver/fallback 계약, `selectedImage` 취급, generated artifact를 fixture로 복사 금지 같은 발행 안전성 규칙의 정본은 root [AGENTS.md](../../AGENTS.md)입니다.

## 검증

```powershell
npm.cmd run validate:images
npm.cmd run validate:site
npm.cmd run validate
```
