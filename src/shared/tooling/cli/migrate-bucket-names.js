'use strict';

// 커밋된 아티팩트와 state 파일에 남은 옛 버킷 이름과, 그 이름에서 파생되는
// editorial_priority 를 지금 사다리에 맞춘다.
//
// 옛 7단계 사다리의 Android 계열 셋이 android 하나로 합쳐졌다
// (src/shared/domain/aosp-camera-scope.js). 읽기 경로에는 canonicalBucket 이 있어 옛 값도
// 동작하지만, 저장된 값이 두 가지로 남아 있으면 같은 것을 두 이름으로 세는 실수가 생긴다.
//
// **값만 바꾼다.** soc_platform_relevance / android_multimedia_camera_output_count 같은
// 필드 이름은 그대로 둔다 — 그 신호는 사라지지 않았고 버킷 이름만 합쳐졌다.
//
// editorial_priority 를 함께 옮기는 이유: 그 값은 relevance_bucket 에서 파생되지만 후보에
// 함께 저장되고, newsletter-quality.js 는 저장된 값을 사다리 기본값보다 우선한다
// (`number(value.editorial_priority, BUCKET_PRIORITY[bucket] || 6)`). 그래서 사다리를
// 바꿔도 이미 저장된 후보는 옛 순위를 그대로 들고 다닌다 — 드라이버를 2 에서 5 로 내린 뒤
// 실측하니 2026-08-17/24/31 주의 드라이버 후보 38건이 전부 2 를 쥐고 있었다. 한 실행 안에서
// 저장분과 새로 매긴 분이 서로 다른 사다리로 정렬되므로 값을 맞춰 준다.
//
// 사용법:
//   node src/shared/tooling/cli/migrate-bucket-names.js --dry-run
//   node src/shared/tooling/cli/migrate-bucket-names.js --apply

const fs = require('node:fs');
const path = require('node:path');

const { BUCKET_PRIORITY, canonicalBucket } = require('../../domain/aosp-camera-scope');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SCAN_DIRS = ['articles', 'state'];

// 순위 보정은 **다음 실행의 입력이 되는 파일에만** 한다. carry-forward 가 읽는 것은
// collected-news/*/merged-candidates.json 하나이고, 같은 폴더의 candidates.json 과
// manual-candidates.json 이 그 병합의 재료다.
//
// 나머지는 지난 실행의 기록이다 — newsroom/ 의 quality-report·retry-history 도, 발행된
// newsletters/ 의 issue.json 도 그때의 사다리로 내린 판단을 적어 둔 것이므로, 지금 사다리로
// 덮어쓰면 그때 무엇을 왜 그 순서로 실었는지가 사라진다.
//
// 버킷 **이름** 은 그렇지 않아 모든 폴더에서 바꾼다 — 한 대상이 두 이름으로 남으면 읽는 쪽이
// 같은 것을 둘로 센다.
const CANDIDATE_LANE_PREFIX = path.join('articles', 'content', 'collected-news');

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

/**
 * relevance_bucket 과 editorial_priority 를 함께 들고 있는 객체에서, 순위를 지금 사다리에
 * 맞춘다. 버킷이 없거나 순위가 이미 맞으면 손대지 않는다.
 *
 * @returns {number} 바꾼 값의 개수(0 또는 1)
 */
function alignEditorialPriority(node, allowed = true) {
  if (!allowed) return 0;
  if (!node || typeof node !== 'object' || Array.isArray(node)) return 0;
  if (!Object.hasOwn(node, 'editorial_priority')) return 0;

  const bucket = canonicalBucket(node.relevance_bucket);
  const expected = BUCKET_PRIORITY[bucket];
  // 사다리에 없는 버킷이거나 숫자가 아닌 값은 판단 근거가 없다. 그대로 둔다.
  if (!expected || typeof node.editorial_priority !== 'number') return 0;
  if (node.editorial_priority === expected) return 0;

  node.editorial_priority = expected;
  return 1;
}

function migrateValue(node, key) {
  if (typeof node === 'string' && BUCKET_KEYS.has(key)) {
    return LEGACY_TO_NEW.get(node) ?? node;
  }
  return node;
}

/** @returns {{value: unknown, changed: number}} */
function walk(node, key = '', alignPriority = true) {
  if (Array.isArray(node)) {
    let changed = 0;
    const value = node.map(item => {
      const result = walk(item, key, alignPriority);
      changed += result.changed;
      return result.value;
    });
    return { value, changed };
  }
  if (node && typeof node === 'object') {
    let changed = 0;
    const value = {};
    for (const [childKey, childValue] of Object.entries(node)) {
      const result = walk(childValue, childKey, alignPriority);
      changed += result.changed;
      value[childKey] = result.value;
    }
    // 자식을 먼저 돌았으므로 이 시점의 relevance_bucket 은 이미 새 이름이다.
    changed += alignEditorialPriority(value, alignPriority);
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
      // 고칠 거리가 없으면 파싱조차 하지 않는다. 482개 파일을 전부 다시 쓰면 diff 가 무의미해진다.
      // 옛 버킷 이름이 없어도 editorial_priority 가 옛 사다리에 머물러 있을 수 있다.
      const relative = path.relative(REPO_ROOT, file);
      const alignPriority = relative.startsWith(CANDIDATE_LANE_PREFIX);
      const hasLegacyName = [...LEGACY_TO_NEW.keys()].some(name => raw.includes(name));
      if (!hasLegacyName && !(alignPriority && raw.includes('"editorial_priority"'))) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.error(`파싱 실패, 건너뜀: ${path.relative(REPO_ROOT, file)} — ${error.message}`);
        continue;
      }

      const { value, changed } = walk(parsed, '', alignPriority);
      if (changed === 0) continue;

      touched += 1;
      replacements += changed;
      if (samples.length < 5) samples.push(`${relative} (${changed}건)`);
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

module.exports = { walk, alignEditorialPriority, BUCKET_KEYS, LEGACY_TO_NEW };
