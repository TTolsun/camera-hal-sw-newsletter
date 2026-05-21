# assets

이 폴더는 정적 사이트 image와 article image fallback asset을 둡니다. Public page에서 직접 참조될 수 있으므로 path 변경은 site validation과 image validation에 영향을 줍니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `assets/images/` | homepage, archive, newsletter page에서 사용할 수 있는 image asset입니다. |
| `assets/images/fallback/` | article image resolver가 외부 image를 사용할 수 없을 때 쓰는 fallback image입니다. |

## 작업 규칙

- 외부 기사 이미지를 임의 URL로 대체하지 않습니다. 기존 image resolver와 fallback 계약을 따릅니다.
- `selectedImage`는 최종 발행 가능한 image path로 취급합니다.
- image file을 바꾸면 public HTML, Markdown output, `data/newsletters.json`에서 참조하는 path를 함께 확인합니다.
- generated newsletter artifact를 image fixture처럼 복사하지 않습니다.

## 검증

```powershell
npm.cmd run validate:images
npm.cmd run validate:site
npm.cmd run validate
```
