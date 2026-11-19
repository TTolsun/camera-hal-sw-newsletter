'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MASS_REFACTOR_QUIRK_FILE_COUNT,
  buildQuirkLedgerReport,
  detectExynos,
  extractDeviceIdentifiers,
  renderQuirkLedgerMarkdown
} = require('../../diagnostics/quirk-ledger');
const {
  QUIRK_FILE_PATTERN,
  listQueryUrl
} = require('../../../shared/collect/androidx-quirk-gerrit-changes');
const {
  fakeGerritFetch,
  gerritChange,
  quirkPath,
  QUIRK_DIR
} = require('../../../shared/test/helpers/androidx-gerrit-builders');

const WINDOW = { start_date: '2026-11-10', end_date: '2026-11-16', source: 'explicit' };
const NOW = new Date('2026-11-20T00:00:00Z');

function build(changes, diffs = {}) {
  return buildQuirkLedgerReport({ date: '2026-11-16', window: WINDOW, fetchTextImpl: fakeGerritFetch({ changes, diffs }), now: NOW });
}

function quirkChange(overrides = {}) {
  return gerritChange({
    number: 4000001,
    subject: 'Disable ZSL on Samsung SM-F971',
    submitted: '2026-11-12 04:01:50.000000000',
    files: { [quirkPath('ZslDisablerQuirk')]: {} },
    ...overrides
  });
}

test('목록 조회는 서버 정규식 질의 없이 dir:camera로 좁히고 파일·커밋 옵션을 모두 요청한다', () => {
  const decoded = decodeURIComponent(listQueryUrl('2026-11-10'));
  assert.match(decoded, /project:platform\/frameworks\/support status:merged after:2026-11-09 dir:camera/);
  assert.match(decoded, /n=500/);
  for (const option of ['CURRENT_REVISION', 'CURRENT_FILES', 'CURRENT_COMMIT']) {
    assert.ok(decoded.includes(`o=${option}`), `${option} 옵션이 빠졌다`);
  }
  assert.ok(!decoded.includes('file:'), '이 호스트는 file:^ 정규식 질의를 지원하지 않는다');
});

test('쿼크 파일 판정은 /quirk/<이름>Quirk.kt|java만 인정한다', () => {
  assert.ok(QUIRK_FILE_PATTERN.test(quirkPath('ZslDisablerQuirk')));
  assert.ok(QUIRK_FILE_PATTERN.test(quirkPath('HdrRepeatingRequestFailureQuirk', 'java')));
  for (const notQuirk of [
    quirkPath('ZslDisablerQuirkTest'),
    `${QUIRK_DIR}/Quirks.kt`,
    'camera/camera-camera2/src/main/java/androidx/camera/camera2/ZslDisablerQuirk.kt',
    `${QUIRK_DIR}/ZslDisablerQuirk.md`
  ]) {
    assert.ok(!QUIRK_FILE_PATTERN.test(notQuirk), notQuirk);
  }
});

test('쿼크 파일을 건드리지 않은 변경은 장부에도 제외 목록에도 세지 않는다', async () => {
  const report = await build([
    gerritChange({ number: 1, subject: 'Fix PreviewView', submitted: '2026-11-12 01:00:00.000000000', files: { 'camera/Foo.kt': {} } })
  ]);
  assert.equal(report.status, 'ok');
  assert.equal(report.counts.listed_changes, 1);
  assert.equal(report.counts.quirk_file_changes, 0);
  assert.deepEqual(report.entries, []);
  assert.deepEqual(report.excluded, []);
});

test('잡음 제목 다섯 종류는 제외하고 비슷한 제목은 남긴다', async () => {
  const subjects = [
    'Merge empty history for androidx-main',
    'Snap for 12345 from abc to androidx-snap',
    'Run ktfmt on camera',
    'Format all code in camera',
    'Migrate to JSpecify nullness'
  ];
  const changes = subjects.map((subject, index) => quirkChange({ number: 100 + index, subject }));
  changes.push(quirkChange({ number: 200, subject: 'Disable ZSL on Samsung SM-F971' }));
  const report = await build(changes);
  assert.deepEqual(report.excluded.map(item => item.reason), subjects.map(() => 'noise_subject'));
  assert.deepEqual(report.entries.map(entry => entry.change_number), [200]);
});

test('제출일이 주간 창 밖이면 갱신일이 창 안이어도 제외하고, 창 양끝 날짜는 포함한다', async () => {
  const report = await build([
    quirkChange({ number: 1, submitted: '2025-03-04 10:00:00.000000000', updated: '2026-11-12 10:00:00.000000000' }),
    quirkChange({ number: 2, submitted: '2026-11-09 23:59:59.000000000' }),
    quirkChange({ number: 3, submitted: '2026-11-10 00:00:00.000000000' }),
    quirkChange({ number: 4, submitted: '2026-11-16 23:59:59.000000000' }),
    quirkChange({ number: 5, submitted: '2026-11-17 00:00:00.000000000' }),
    quirkChange({ number: 6, submitted: undefined })
  ]);
  assert.deepEqual(report.entries.map(entry => entry.change_number), [3, 4]);
  assert.deepEqual(report.excluded.map(item => [item.change_number, item.reason]), [
    [1, 'outside_window'], [2, 'outside_window'], [5, 'outside_window'], [6, 'outside_window']
  ]);
});

test('쿼크 파일을 12개 이상 바꾼 변경은 기계적 리팩터링으로 제외하고 11개는 남긴다', async () => {
  const filesOf = count => Object.fromEntries(
    Array.from({ length: count }, (_, index) => [quirkPath(`Device${index}Quirk`), {}])
  );
  assert.equal(MASS_REFACTOR_QUIRK_FILE_COUNT, 12);
  const report = await build([
    quirkChange({ number: 1, files: filesOf(12), subject: 'Rename quirk package' }),
    quirkChange({ number: 2, files: filesOf(11), subject: 'Touch eleven quirks' })
  ]);
  assert.deepEqual(report.excluded.map(item => [item.change_number, item.reason]), [[1, 'mass_refactor']]);
  assert.deepEqual(report.entries.map(entry => entry.change_number), [2]);
  assert.equal(report.entries[0].quirk_classes.length, 11);
});

test('우회 클래스는 파일 상태로 추가·수정·삭제를 구분한다', async () => {
  const report = await build([
    quirkChange({
      files: {
        [quirkPath('NewQuirk')]: { status: 'A' },
        [quirkPath('ZslDisablerQuirk')]: {},
        [quirkPath('GoneQuirk')]: { status: 'D' }
      }
    })
  ]);
  const byName = Object.fromEntries(report.entries[0].quirk_classes.map(item => [item.name, item.change]));
  assert.deepEqual(byName, { NewQuirk: 'added', ZslDisablerQuirk: 'modified', GoneQuirk: 'deleted' });
});

test('기기 식별자는 쿼크 코드의 모델·코드명과 커밋 메시지에서 뽑고 카메라 ID와 SoC 이름은 뽑지 않는다', () => {
  const devices = extractDeviceIdentifiers({
    commitMessage: 'Disable abortCaptures on Samsung Galaxy A54 5G (Exynos s5e8835, Build.DEVICE "a54x" / Build.MODEL "SM-A546*").\nTest: on SM-A546E',
    addedLines: [
      '  * - Device(s): Samsung Galaxy A54 5G (a54x / SM-A546), Poco X3 Pro (M2102J20SG)',
      '        Device.isSamsungDevice() && "d2q".equals(Build.DEVICE, ignoreCase = true)',
      '                "PHT110" to setOf("2", "3"), // OPPO Find N3 Flip',
      '    private const val SOC_MODEL_SNAPDRAGON_8_GEN_2 = "SM8550"',
      '@SuppressLint("CameraXQuirksClassDetector")',
      '        "samsung".equals(Build.BRAND, ignoreCase = true)'
    ]
  });
  const bySource = source => devices.filter(device => device.source === source).map(device => device.identifier);
  assert.deepEqual(bySource('diff_code'), ['d2q', 'PHT110']);
  assert.deepEqual(bySource('diff_comment'), ['SM-A546']);
  assert.deepEqual(bySource('commit_message'), ['a54x', 'SM-A546E']);
  const all = devices.map(device => device.identifier);
  for (const rejected of ['2', '3', 'SM8550', 'samsung', 'CameraXQuirksClassDetector']) {
    assert.ok(!all.includes(rejected), `${rejected}는 기기 식별자가 아니다`);
  }
});

test('같은 식별자는 대소문자만 달라도 하나로 합치고 가장 강한 근거(코드 > 주석 > 커밋 메시지)를 남긴다', () => {
  const devices = extractDeviceIdentifiers({
    commitMessage: 'Test: ZslDeviceTest on sm-f971u1 and sm-f971',
    addedLines: ['  * - Device(s): Samsung Fold4, SM-F971, SM-F971U1', '                "SM-F971U1",']
  });
  assert.deepEqual(devices, [
    { identifier: 'SM-F971', source: 'diff_comment' },
    { identifier: 'SM-F971U1', source: 'diff_code' }
  ]);
});

test('기존 기기 줄을 다시 쓰면서 기기 하나를 추가한 diff에서는 새 기기만 남는다', () => {
  const devices = extractDeviceIdentifiers({
    commitMessage: 'Add Galaxy A54 5G',
    removedLines: [
      '        private val isSamsungNote10PlusDevice: Boolean',
      '            get() = Device.isSamsungDevice() && "d2q".equals(Build.DEVICE, ignoreCase = true)',
      '  * - Device(s): Samsung Galaxy Note 10+ (SM-N975)'
    ],
    addedLines: [
      '        private val isSamsungNote10PlusDevice: Boolean',
      '            get() = Device.isSamsungDevice() && "d2q".equals(Build.DEVICE, ignoreCase = true)',
      '                Build.MODEL.startsWith("SM-A546", ignoreCase = true)',
      '  * - Device(s): Samsung Galaxy Note 10+ (SM-N975), Galaxy A54 5G (SM-A546)'
    ]
  });
  assert.deepEqual(devices, [{ identifier: 'SM-A546', source: 'diff_code' }]);
});

test('삭제 줄에 있던 기기는 커밋 메시지에 다시 나와도 살아나지 않는다', () => {
  const devices = extractDeviceIdentifiers({
    commitMessage: 'Add SM-A546.\nAlready handled: Build.DEVICE "d2q", tested on sm-n975 and SM-A546E',
    removedLines: ['    get() = "d2q".equals(Build.DEVICE)', '  * - Device(s): Note 10+ (SM-N975)'],
    addedLines: ['    get() = "d2q".equals(Build.DEVICE) || "a54x".equals(Build.DEVICE)']
  });
  assert.deepEqual(devices.map(device => device.identifier), ['a54x', 'SM-A546', 'SM-A546E']);
  assert.ok(!devices.some(device => ['d2q', 'SM-N975'].includes(device.identifier)));
});

test('식별자가 하나도 없는 항목은 제외하지 않고 no_device를 붙이며 Markdown에도 표시한다', async () => {
  const report = await build([
    quirkChange({ number: 1, subject: 'Add fast session switch', files: { [quirkPath('FastSessionSwitchDisablerQuirk')]: { status: 'A' } } }),
    quirkChange({ number: 2 })
  ], { 1: ['public class FastSessionSwitchDisablerQuirk implements Quirk {'], 2: ['                "SM-F971",'] });
  const [withoutDevice, withDevice] = report.entries;
  assert.equal(withoutDevice.no_device, true);
  assert.equal(withDevice.no_device, false);
  assert.match(renderQuirkLedgerMarkdown(report), /Add fast session switch | (식별자 없음, no_device)/);
});

test('근거가 없으면 기기 식별자는 빈 배열이고 추측하지 않는다', () => {
  assert.deepEqual(extractDeviceIdentifiers({ commitMessage: 'Extend quirk to API 35+\n\nBug: 582678736', addedLines: ['    get() = isSamsungDevice()'] }), []);
  assert.deepEqual(extractDeviceIdentifiers(), []);
});

test('Exynos 표시는 exynos 또는 s5e 숫자가 텍스트에 있을 때만 붙고 근거 문자열을 남긴다', () => {
  assert.deepEqual(detectExynos({ commitMessage: 'On Samsung Galaxy A54 5G (Exynos s5e8835)' }), {
    exynos: true, exynos_evidence: ['exynos', 's5e8835']
  });
  assert.deepEqual(detectExynos({ addedLines: ['camera.S5E9945.so'] }), { exynos: true, exynos_evidence: ['s5e9945'] });
  for (const text of ['Samsung Galaxy S26 (SM-S942U1)', 'Snapdragon 8 Gen 2 (SM8550)', 's5 e8835']) {
    assert.deepEqual(detectExynos({ commitMessage: text }), { exynos: false, exynos_evidence: [] }, text);
  }
});

test('항목은 diff 추가 줄과 커밋 메시지에서 식별자와 Exynos 표시를 가져오고 제출일 순으로 정렬된다', async () => {
  const report = await build([
    quirkChange({
      number: 4430441,
      subject: 'Disable abortCaptures on stop for Galaxy A54 5G',
      submitted: '2026-11-12 04:36:39.000000000',
      files: { [quirkPath('DisableAbortCapturesOnStopQuirk')]: {} },
      message: 'Disable abortCaptures on stop for Galaxy A54 5G\n\nOn Samsung Galaxy A54 5G (Exynos s5e8835, Build.DEVICE "a54x").\n'
    }),
    quirkChange({
      number: 4440995,
      subject: 'Exclude OPPO PHT110 physical camera IDs 2 and 3',
      submitted: '2026-11-11 03:10:08.000000000',
      files: { [quirkPath('ExcludePhysicalCameraIdQuirk')]: {} }
    })
  ], {
    4430441: ['        Device.isSamsungDevice() && "a54x".equals(Build.DEVICE, ignoreCase = true)'],
    4440995: ['                "PHT110" to setOf("2", "3"), // OPPO Find N3 Flip']
  });

  assert.deepEqual(report.entries.map(entry => entry.change_number), [4440995, 4430441]);
  const [oppo, samsung] = report.entries;
  assert.deepEqual(oppo.devices, [{ identifier: 'PHT110', source: 'diff_code' }]);
  assert.equal(oppo.exynos, false);
  assert.equal(oppo.url, 'https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995');
  assert.equal(oppo.submitted_date, '2026-11-11');
  assert.deepEqual(samsung.devices, [{ identifier: 'a54x', source: 'diff_code' }]);
  assert.deepEqual(samsung.exynos_evidence, ['exynos', 's5e8835']);
  assert.equal(samsung.exynos, true);
});

test('목록 조회가 실패하면 던지지 않고 failed 보고서와 진단만 남긴다', async () => {
  const report = await buildQuirkLedgerReport({
    date: '2026-11-16',
    window: WINDOW,
    fetchTextImpl: fakeGerritFetch({ listError: new Error('503 Service Unavailable') }),
    now: NOW
  });
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.entries, []);
  assert.equal(report.diagnostics[0].kind, 'list_fetch_failed');
  assert.match(report.diagnostics[0].message, /503/);
});

test('목록이 JSON 배열이 아니면 failed 보고서가 된다', async () => {
  const report = await buildQuirkLedgerReport({
    date: '2026-11-16',
    window: WINDOW,
    fetchTextImpl: fakeGerritFetch({ listText: '<html>Anubis</html>' }),
    now: NOW
  });
  assert.equal(report.status, 'failed');
  assert.equal(report.diagnostics[0].kind, 'list_fetch_failed');
});

test('응답 항목을 해석하다 실패하면 일부 결과를 비우고 failed로 끝낸다', async () => {
  // 예상 밖 응답 모양: 파일 항목이 객체가 아니라 null이다.
  const broken = quirkChange({ number: 2, files: { [quirkPath('ZslDisablerQuirk')]: null } });
  const report = await build([quirkChange({ number: 1 }), broken]);
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.entries, []);
  assert.equal(report.diagnostics.at(-1).kind, 'build_failed');
});

test('diff 하나를 못 읽어도 커밋 메시지 근거로 항목을 만들고 진단을 남긴다', async () => {
  const report = await build([
    quirkChange({ number: 7, message: 'Disable ZSL\n\nTest: ZslDeviceTest on sm-f971u1\n' })
  ]);
  assert.equal(report.status, 'ok');
  assert.deepEqual(report.entries[0].devices, [{ identifier: 'SM-F971U1', source: 'commit_message' }]);
  assert.deepEqual(report.diagnostics.map(item => [item.kind, item.change_number]), [['diff_fetch_failed', 7]]);
});

test('목록이 n 상한에 걸리면 잘렸다는 진단을 남긴다', async () => {
  const report = await build([quirkChange({ number: 1, moreChanges: true })], { 1: [] });
  assert.equal(report.list_truncated, true);
  assert.equal(report.diagnostics[0].kind, 'list_truncated');
});

test('제외된 변경은 diff를 조회하지 않는다', async () => {
  const fetchTextImpl = fakeGerritFetch({ changes: [quirkChange({ number: 1, subject: 'Run ktfmt' })] });
  await buildQuirkLedgerReport({ date: '2026-11-16', window: WINDOW, fetchTextImpl, now: NOW });
  assert.equal(fetchTextImpl.calls.filter(url => url.includes('/diff')).length, 0);
});

test('Markdown은 항목 표와 제외·진단 목록을 한국어 머리글로 낸다', async () => {
  const report = await build([
    quirkChange({ number: 1, subject: 'Disable ZSL | on SM-F971' }),
    quirkChange({ number: 2, subject: 'Run ktfmt' })
  ], { 1: ['                "SM-F971",'] });
  const markdown = renderQuirkLedgerMarkdown(report);
  assert.match(markdown, /^# 기기 우회 장부/);
  assert.match(markdown, /\| 2026-11-12 \| \[1\]\(https:\/\/android-review\.googlesource\.com\/c\/platform\/frameworks\/support\/\+\/1\) \| Disable ZSL \\\| on SM-F971 \| 코드: SM-F971 \| ZslDisablerQuirk\(modified\) \| - \|/);
  assert.match(markdown, /- 2 \(noise_subject\): Run ktfmt/);
  assert.ok(markdown.endsWith('\n') && !markdown.endsWith('\n\n'));
});
