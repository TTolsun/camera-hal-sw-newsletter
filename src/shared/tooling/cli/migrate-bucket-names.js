'use strict';

// 커밋된 아티팩트와 state 파일에 남은 옛 버킷 이름을 새 이름으로 옮긴다.
//
// 옛 7단계 사다리의 Android 계열 셋이 android 하나로 합쳐졌다
// (src/shared/domain/aosp-camera-scope.js). 읽기 경로에는 canonicalBucket 이 있어 옛 값도
// 동작하지만, 저장된 값이 두 가지로 남아 있으면 같은 것을 두 이름으로 세는 실수가 생긴다.
//
// **값만 바꾼다.** soc_platform_relevance / android_multimedia_camera_output_count 같은
// 필드 이름은 그대로 둔다 — 그 신호는 사라지지 않았고 버킷 이름만 합쳐졌다.
//
// 사용법:
//   node src/shared/tooling/cli/migrate-bucket-names.js --dry-run
//   node src/shared/tooling/cli/migrate-bucket-names.js --apply

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCAN_DIRS = ['articles', 'state'];

const LEGACY_TO_NEW = new Map([
  ['android_platform_camera_adjacent', 'android'],
  ['android_multimedia_camera_output', 'android'],
  ['soc_platform_signal', 'android']
]);

// 버킷 값을 담는 키만 바꾼다. 목록을 좁게 유지하는 것이 이 스크립트의 안전장치다 —
// 넓히면 relevance 점수 필드나 산문 안의 같은 단어까지 건드리게 된다.
const BUCKET_KEYS = new Set([
  'relevance_bucket',
  'relevanceBucket',
  'bucket',
  'aosp_camera_stack_bucket',
  'aospCameraStackBucket',
  'relevanceBucketHint',
  'relevance_bucket_hint',
  'usageHint',
  'source_usage_hint'
]);

function migrateValue(node, key) {
  if (typeof node === 'string' && BUCKET_KEYS.has(key)) {
    return LEGACY_TO_NEW.get(node) ?? node;
  }
  return node;
}

/** @returns {{value: unknown, changed: number}} */
function walk(node, key = '') {
  if (Array.isArray(node)) {
    let changed = 0;
    const value = node.map(item => {
      const result = walk(item, key);
      changed += result.changed;
      return result.value;
    });
    return { value, changed };
  }
  if (node && typeof node === 'object') {
    let changed = 0;
    const value = {};
    for (const [childKey, childValue] of Object.entries(node)) {
      const result = walk(childValue, childKey);
      changed += result.changed;
      value[childKey] = result.value;
    }
    return { value, changed };
  }
  const migrated = migrateValue(node, key);
  return { value: migrated, changed: migrated === node ? 0 : 1 };
}

function jsonFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  }
  return out;
}

function main() {
  const apply = process.argv.includes('--apply');
  if (!apply && !process.argv.includes('--dry-run')) {
    throw new Error('--dry-run 또는 --apply 를 지정하세요');
  }

  let scanned = 0;
  let touched = 0;
  let replacements = 0;
  const samples = [];

  for (const dir of SCAN_DIRS) {
    for (const file of jsonFiles(path.join(REPO_ROOT, dir))) {
      scanned += 1;
      const raw = fs.readFileSync(file, 'utf8');
      // 옛 이름이 없으면 파싱조차 하지 않는다. 482개 파일을 전부 다시 쓰면 diff 가 무의미해진다.
      if (![...LEGACY_TO_NEW.keys()].some(name => raw.includes(name))) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.error(`파싱 실패, 건너뜀: ${path.relative(REPO_ROOT, file)} — ${error.message}`);
        continue;
      }

      const { value, changed } = walk(parsed);
      if (changed === 0) continue;

      touched += 1;
      replacements += changed;
      if (samples.length < 5) samples.push(`${path.relative(REPO_ROOT, file)} (${changed}건)`);
      // 원본이 개행으로 끝나면 그대로 유지한다.
      if (apply) fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}${raw.endsWith('\n') ? '\n' : ''}`, 'utf8');
    }
  }

  console.log(`${apply ? '적용' : '점검'}: JSON ${scanned}개 중 ${touched}개 파일, 값 ${replacements}건`);
  for (const sample of samples) console.log(`  ${sample}`);
  if (!apply && touched > 0) console.log('\n--apply 로 실제 적용합니다.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { walk, BUCKET_KEYS, LEGACY_TO_NEW };
