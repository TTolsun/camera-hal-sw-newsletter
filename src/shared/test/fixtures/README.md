# Fixture 개요

`src/shared/test/fixtures`는 두 종류의 fixture를 분리해서 둡니다. 하나는 사람이 검수한 curated fixture(직접 만들거나 골라낸 신뢰 sample)이고, 다른 하나는 generated artifact에서 최소 입력만 축약한 bad/regression fixture입니다.

## 디렉터리 배치

- `quality/good/`, `quality/bad/`
- `selection/good/`, `selection/bad/`
- `seed-evidence/good/`, `seed-evidence/bad/`, `seed-evidence/workflow-shapes/`

`good/`에는 사람이 검수한 curated PASS sample을, `bad/`에는 regression용 축약 sample을 둡니다. `seed-evidence/workflow-shapes/`는 generated artifact 사본이 아니라 merge output contract를 최소 synthetic input으로 표현하는 위치입니다.

## metadata / ledger 예시

JSON fixture는 가능하면 아래 형태의 metadata를 두고, `fixture-ledger.json`(schemaVersion 2)에 대응 entry를 남깁니다.

```json
{
  "metadata": {
    "generated": false,
    "source": "curated"
  },
  "policyFlags": {
    "source_gap_risk": false,
    "reference_only": false,
    "finalSelectionEligibility": "main",
    "hasDatedEvidence": true,
    "generic_ai_without_hal_connection": false
  },
  "expected": {
    "status": "PASS"
  }
}
```

## 추가/변경 방법

fixture를 추가하거나 변경하면 같은 변경에서 `fixture-ledger.json`을 갱신하고 `npm.cmd run check:fixtures`를 실행합니다. 커밋된 fixture 파일 안에는 `content/newsroom/YYYY-MM-DD`, `content/collected-news/YYYY-MM-DD`, `newsletters/YYYY-MM-DD` 같은 generated artifact 경로를 포함하지 않습니다.

---

이 README는 폴더 개요만 제공합니다. fixture 신뢰 계약의 정본은 [src/AGENTS.md](../../../AGENTS.md)입니다.
