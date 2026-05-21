# templates

이 폴더는 newsletter Markdown/HTML output을 만들 때 사용하는 template을 둡니다. Template 변경은 renderer와 public output 구조에 영향을 줄 수 있습니다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `newsletter.md` | newsletter Markdown output의 기본 template입니다. |
| `newsletter.html` | newsletter HTML output의 기본 template입니다. |

## 작업 규칙

- Template은 renderer 입력 surface입니다. Schema, validation, source binding 변경과 섞어서 수정하지 않습니다.
- Newsletter Policy block은 `config/newsletter-policy.json`에서 생성되는 정책과 충돌하면 안 됩니다.
- HTML template 변경은 `css/`, `assets/`, `scripts/newsroom/render/`, `scripts/newsroom/validate/`와 함께 확인합니다.
- Public output path는 `newsletters/YYYY-MM-DD/` 계약을 유지합니다.

## 검증

```powershell
npm.cmd run validate:site
npm.cmd run validate:public
npm.cmd run validate
```
