const assert = require('node:assert/strict');
const test = require('node:test');

const { evidenceSourceKey } = require('../../../collect/source-intelligence-utils');

function candidate(url) {
  return { url };
}

// 근거 수집 cap 12칸은 "서로 다른 출처를 몇 개 확인할 것인가"를 센다. roundup 게시글 안의
// 섹션 앵커처럼 같은 문서를 가리키는 판본이 칸을 따로 먹으면 그 정의가 흐려진다.
// 기사 identity(normalizeArticleUrl)는 이미 allowlist 밖 앵커를 지우고 한 건으로 세므로,
// 근거 수집도 같은 판단을 써야 두 모듈이 같은 문서를 같은 수로 센다.
test('release allowlist 밖 섹션 앵커는 같은 근거 출처로 묶인다', () => {
  const base = 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html';

  assert.equal(
    evidenceSourceKey(candidate(`${base}#roundup-child-3-start-building-today`)),
    evidenceSourceKey(candidate(base))
  );
  assert.equal(evidenceSourceKey(candidate(base)), base);
});

// 반대로 릴리스 노트는 앵커가 릴리스를 가른다. 여기서 앵커를 지우면 알파 판본 두 개가 한
// 출처가 되어 서로 다른 릴리스를 한 번만 확인하고 넘어간다.
test('release allowlist 안 릴리스 앵커는 서로 다른 근거 출처로 남는다', () => {
  const releases = 'https://developer.android.com/jetpack/androidx/releases/camera';
  const alpha03 = evidenceSourceKey(candidate(`${releases}#1.7.0-alpha03`));
  const alpha02 = evidenceSourceKey(candidate(`${releases}#1.7.0-alpha02`));

  assert.equal(alpha03, `${releases}#1.7.0-alpha03`);
  assert.notEqual(alpha03, alpha02);
});

// 앵커 판단은 host를 정규화한 뒤에 해야 한다. google.cn 판본을 그대로 두고 판단하면
// allowlist host와 달라 릴리스 앵커가 지워지고, 서로 다른 릴리스가 한 출처로 합쳐진다.
test('google.cn 판본도 host 정규화 뒤에 릴리스 앵커를 지킨다', () => {
  const key = evidenceSourceKey(candidate(
    'https://developer.android.google.cn/jetpack/androidx/releases/camera?hl=ko#1.7.0-alpha03'
  ));

  assert.equal(key, 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03');
});
