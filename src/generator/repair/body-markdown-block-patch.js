// Story Contract v2 repair 가상 블록 포인터 리졸버(#849, Refs #1090, 설계 §4.6).
//
// repair LLM은 v2 본문을 `/public_article/body_markdown/blocks/{i}` 가상 포인터로
// 블록 단위 수리할 수 있다. 이 포인터는 실제 JSON 경로가 아니므로, applyRepairPatches에
// 넘기기 전에 여기서 해석한다: parseBodyBlocks(정본 파서)로 본문을 블록 배열화하고,
// i번째 블록을 patch 값으로 교체한 뒤 재직렬화해 `/public_article/body_markdown` 전체
// 교체 patch로 변환한다. setByPointer·PATCHABLE_SECTION_ROOTS·fail-before-mutate·
// 보호 필드 스냅샷은 전부 기존 repair-patch-contract 그대로다.
//
// 실패 정책: 블록 patch가 해석에 실패하면(인덱스 범위 밖, 타입 불일치, 본문 부재)
// 그 patch는 fail이고 배치 전체가 거부된다. 전체 필드 교체로 자동 폴백하지 않는다 —
// 자동 폴백은 targeted repair가 금지한 identity-drift 형상(전체 재작성)의 재진입이다.
// 전체 필드 교체(`/public_article/body_markdown`)는 repair LLM이 명시적으로 그 경로를
// 쓸 때만 일어나며, 적용 후 lint 재실행(아래 regression guard)이 새 위반을 만들면
// 전체 실패한다. headline·source identity는 기존 protectedSectionSnapshot과
// validateTargetedRepairResult가 계속 가드한다.
//
// Pure transforms only — no IO, no LLM, no shared state.

const { ensureArray } = require('../../shared/common/value-coercion');
const { REPAIR_PATCH_CONTRACT_VIOLATION } = require('./repair-patch-contract');
const {
  SUBHEADING_PREFIX,
  lintBodyMarkdown,
  parseBodyBlocks
} = require('../reporter/public-body-markdown');

const BODY_MARKDOWN_POINTER = 'public_article/body_markdown';
const BODY_MARKDOWN_BLOCK_SEGMENTS = Object.freeze(['public_article', 'body_markdown', 'blocks']);

// repair-patch-contract.splitPointer와 같은 규칙. 그 모듈은 이번 변경에서 무수정으로
// 두기로 했으므로(#849 작업 1) 여기서 같은 3줄을 유지한다.
function splitPointer(path) {
  return String(path || '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);
}

function isBodyMarkdownBlockPointer(segments) {
  return segments.length === BODY_MARKDOWN_BLOCK_SEGMENTS.length + 1 &&
    BODY_MARKDOWN_BLOCK_SEGMENTS.every((segment, index) => segments[index] === segment);
}

// parseBodyBlocks의 역방향. subheading은 `### ` prefix를 되살리고 블록 사이는 빈 줄
// 하나다. normalizeBodyMarkdown(parseBodyBlocks의 입력 정규화)과 왕복 일치한다.
function serializeBodyBlocks(blocks) {
  return blocks
    .map(block => (block.type === 'subheading' ? `${SUBHEADING_PREFIX}${block.text}` : block.text))
    .join('\n\n');
}

function blockPatchViolation(patch, detail, extra = {}) {
  return { reason: REPAIR_PATCH_CONTRACT_VIOLATION, patch, detail, ...extra };
}

// remapRepairPatchSections를 통과한 patch 목록을 받아(모든 patch의 section_index가
// 유효 범위) 블록 포인터 patch만 전체 필드 교체 patch로 변환한다. 하나라도 해석에
// 실패하면 ok:false — 호출부는 base editor를 그대로 유지한다(fail before mutate).
function resolveBodyMarkdownBlockPatches(sections, patches = []) {
  const sectionList = ensureArray(sections);
  const resolved = [];
  const violations = [];

  for (const patch of ensureArray(patches)) {
    const segments = splitPointer(patch && patch.path);
    if (!isBodyMarkdownBlockPointer(segments)) {
      resolved.push(patch);
      continue;
    }
    const section = Number.isInteger(patch.section_index) ? sectionList[patch.section_index] : null;
    if (!section) {
      violations.push(blockPatchViolation(patch, 'section_index_out_of_range'));
      continue;
    }
    const body = section.public_article ? section.public_article.body_markdown : undefined;
    if (typeof body !== 'string' || body.trim() === '') {
      violations.push(blockPatchViolation(patch, 'body_markdown_missing'));
      continue;
    }
    const indexSegment = segments[BODY_MARKDOWN_BLOCK_SEGMENTS.length];
    if (!/^\d+$/.test(indexSegment)) {
      violations.push(blockPatchViolation(patch, 'block_index_invalid', { block_index: indexSegment }));
      continue;
    }
    const blockIndex = Number(indexSegment);
    const blocks = parseBodyBlocks(body);
    if (blockIndex >= blocks.length) {
      violations.push(blockPatchViolation(patch, 'block_index_out_of_range', {
        block_index: blockIndex,
        block_count: blocks.length
      }));
      continue;
    }
    if (typeof patch.value !== 'string') {
      violations.push(blockPatchViolation(patch, 'block_value_not_string'));
      continue;
    }
    // patch 값은 교체할 블록 하나를 markdown 형태 그대로 담는다(소제목이면 `### ` 포함).
    // 정본 파서로 값을 파싱해 "블록 하나, 같은 타입"을 강제한다 — 문단을 소제목으로
    // 바꾸거나 한 patch로 여러 블록을 밀어 넣는 구조 변경은 블록 수리가 아니다.
    const valueBlocks = parseBodyBlocks(patch.value);
    if (valueBlocks.length !== 1) {
      violations.push(blockPatchViolation(patch, 'block_value_not_single_block', {
        block_count: valueBlocks.length
      }));
      continue;
    }
    if (valueBlocks[0].type !== blocks[blockIndex].type) {
      violations.push(blockPatchViolation(patch, 'block_type_mismatch', {
        expected_type: blocks[blockIndex].type,
        actual_type: valueBlocks[0].type
      }));
      continue;
    }
    const nextBlocks = blocks.slice();
    nextBlocks[blockIndex] = valueBlocks[0];
    resolved.push({
      ...patch,
      path: `/${BODY_MARKDOWN_POINTER}`,
      value: serializeBodyBlocks(nextBlocks)
    });
  }

  if (violations.length > 0) {
    return { ok: false, patches: [], violations };
  }
  return { ok: true, patches: resolved, violations: [] };
}

// lint issue를 "같은 종류의 위반" 단위로 접는 키. 블록 index는 patch로 정당하게
// 움직이므로 키에 넣지 않는다.
function lintIssueKey(issue) {
  return [
    issue.type,
    issue.construct || '',
    issue.reserved || '',
    issue.duplicateOfField || '',
    issue.level || ''
  ].join(':');
}

function lintIssueKeyCounts(issues) {
  const counts = new Map();
  for (const issue of issues) {
    const key = lintIssueKey(issue);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sectionSurroundings(section) {
  const publicArticle = (section && section.public_article) || {};
  return { lead: publicArticle.lead, camera_hal_takeaway: publicArticle.camera_hal_takeaway };
}

// 적용 후 lint 재실행 가드. patch가 body_markdown을 바꾼 섹션마다 lint를 다시 돌려,
// 수리 전에 없던 종류의 위반이 새로 생기면(또는 같은 종류가 늘어나면) 전체 실패다.
// 수리 전부터 있던 위반은 재발이 아니므로 통과한다 — 그 위반 자체를 고치는 patch가
// 이 가드에 막히면 안 된다. patch-only 편집은 섹션 개수·순서를 못 바꾸므로(기존
// validateTargetedRepairResult 가드) before/after는 index로 대응한다.
function bodyMarkdownLintRegressionViolations(beforeSections, afterSections) {
  const before = ensureArray(beforeSections);
  const after = ensureArray(afterSections);
  const violations = [];

  after.forEach((afterSection, index) => {
    const beforeSection = before[index];
    const afterBody = afterSection && afterSection.public_article
      ? afterSection.public_article.body_markdown
      : undefined;
    if (typeof afterBody !== 'string') return;
    const beforeBody = beforeSection && beforeSection.public_article
      ? beforeSection.public_article.body_markdown
      : undefined;
    if (afterBody === beforeBody) return;

    const beforeCounts = lintIssueKeyCounts(
      typeof beforeBody === 'string'
        ? lintBodyMarkdown(beforeBody, sectionSurroundings(beforeSection))
        : []
    );
    const afterIssues = lintBodyMarkdown(afterBody, sectionSurroundings(afterSection));
    const remaining = new Map(beforeCounts);
    const newIssues = afterIssues.filter(issue => {
      const key = lintIssueKey(issue);
      const budget = remaining.get(key) || 0;
      if (budget > 0) {
        remaining.set(key, budget - 1);
        return false;
      }
      return true;
    });
    if (newIssues.length > 0) {
      violations.push({
        reason: REPAIR_PATCH_CONTRACT_VIOLATION,
        detail: 'body_markdown_lint_regression',
        section_index: index,
        issues: newIssues
      });
    }
  });

  return violations;
}

module.exports = {
  bodyMarkdownLintRegressionViolations,
  resolveBodyMarkdownBlockPatches,
  serializeBodyBlocks
};
