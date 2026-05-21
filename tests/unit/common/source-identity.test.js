const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeSourceUrl,
  normalizedContentHash,
  sourceIdentityKey
} = require('../../../scripts/newsroom/common/source-identity');

test('tracking parameters collapse while meaningful release anchors are preserved', () => {
  const left = normalizeSourceUrl('https://developer.android.com/jetpack/androidx/releases/camera?utm_source=x&gclid=y#camera-1.6.1');
  const right = normalizeSourceUrl('https://developer.android.com/jetpack/androidx/releases/camera#camera-1.6.1');
  assert.equal(left, right);
  assert.ok(left.endsWith('#camera-1.6.1'));
});

test('source identity key collapses URL tracking variants', () => {
  const left = sourceIdentityKey({
    sourceId: 'aosp-camera-docs',
    url: 'https://source.android.com/docs/core/camera?utm_campaign=test'
  });
  const right = sourceIdentityKey({
    sourceId: 'aosp-camera-docs',
    url: 'https://source.android.com/docs/core/camera'
  });
  assert.equal(left, right);
});

test('normalized content hash ignores noisy navigation and footer changes', () => {
  const base = '<html><body><nav>old</nav><main><h1>Camera HAL</h1><p>Stream metadata behavior changed.</p></main><footer>old</footer></body></html>';
  const changedNoise = '<html><body><nav>new</nav><main><h1>Camera HAL</h1><p>Stream metadata behavior changed.</p></main><footer>new</footer></body></html>';
  assert.equal(normalizedContentHash(base), normalizedContentHash(changedNoise));
});
