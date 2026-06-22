const assert = require('node:assert/strict');
const test = require('node:test');

const {
  warnResolvedImageFallbacks,
  pruneResolvedFallbackImageFalsePositives
} = require('../../publish/orchestrator-image-warnings');

// 추출 전 god-file에 인라인으로 있던 이미지 fallback 경고/오탐 정리 헬퍼를 입력→동작으로 고정한다.
// warnResolvedImageFallbacks는 resolvedImage.usedFallback인 섹션마다 stderr 경고를 찍고,
// pruneResolvedFallbackImageFalsePositives는 fact-check가 이미 해소된 fallback 이미지를 잘못
// 잡은 항목을 제거한 fact-check를 돌려준다(제거 로직 자체는 fact-check-repair가 검증한다).

function captureWarn(run) {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(' '));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return lines;
}

test('warnResolvedImageFallbacks: usedFallback 섹션마다 경고를 찍고, 아니면 침묵한다', () => {
  const issue = {
    sections: [
      {
        category: 'ISP',
        headline: 'Mali-C55 CCM tuning',
        resolvedImage: {
          usedFallback: true,
          originalUrl: 'https://example.com/orig.png',
          url: 'assets/images/fallback/isp.png',
          reason: 'unreachable origin'
        }
      },
      {
        category: 'HAL',
        headline: 'no fallback here',
        resolvedImage: { usedFallback: false, url: 'https://example.com/real.png' }
      }
    ]
  };

  const lines = captureWarn(() => warnResolvedImageFallbacks(issue));

  assert.equal(lines.length, 1);
  const text = lines[0];
  assert.match(text, /Warning: article image fallback applied/);
  assert.match(text, /section: ISP/);
  assert.match(text, /article: Mali-C55 CCM tuning/);
  assert.match(text, /original: https:\/\/example\.com\/orig\.png/);
  assert.match(text, /fallback: assets\/images\/fallback\/isp\.png/);
  assert.match(text, /reason: unreachable origin/);
});

test('warnResolvedImageFallbacks: 섹션이 없으면 아무 경고도 찍지 않는다', () => {
  const lines = captureWarn(() => warnResolvedImageFallbacks({}));
  assert.equal(lines.length, 0);
});

test('pruneResolvedFallbackImageFalsePositives: fact-check 객체를 돌려주고 제거 없으면 경고가 없다', () => {
  const factCheck = { status: 'PASS', must_fix: [], verified_facts: [] };
  const editor = { sections: [] };

  let result;
  const lines = captureWarn(() => {
    result = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
  });

  // 제거할 오탐이 없으면 동일 fact-check를 그대로 돌려주고 경고를 찍지 않는다.
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.must_fix, []);
  assert.equal(lines.length, 0);
});
