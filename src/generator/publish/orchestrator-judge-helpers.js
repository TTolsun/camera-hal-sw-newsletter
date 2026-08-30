// Orchestrator public-article judge helpers.
//
// Single responsibility: pure shaping/validation transforms for the public
// article semantic judge stage — building judge input, normalizing the judge
// report, deriving blocking issues, and constructing the judge error. Pure on
// their arguments only — no generationRunState, no fs, no module globals — and
// no LLM calls (the async runPublicArticleJudge / repair flow lives in
// orchestrator-public-article-judge.js). Extracted verbatim from gemini-newsroom-newsletter.js.

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  normalizeUrl
} = require('../select/newsroom-selection');
const {
  sectionUrls
} = require('../../shared/common/section-identity');
const {
  EditorSemanticValidationError
} = require('../editor/editor-output-contract');
const {
  numberOrDefault,
  stringOrEmpty
} = require('./orchestrator-shared-helpers');

// #725: desk-review 4축. issue의 field가 desk_* 이면 advisory로 다룬다 — severity 라벨과
// 무관하다. 비차단 보증은 LLM 규율(프롬프트의 "P3")이 아니라 코드 불변식이다:
// publicArticleJudgeBlockingIssues가 desk_* field를 차단 목록에서 제외하고, deskAdvisoryIssues가
// 그것들을 advisory로 모은다. field는 free string이라 schema 변경은 불필요.
const DESK_ADVISORY_FIELDS = new Set([
  'desk_target_explanation',
  'desk_layer_distinction',
  'desk_source_limitations',
  'desk_subject_attribution'
]);

function isDeskAdvisoryField(field) {
  return DESK_ADVISORY_FIELDS.has(stringOrEmpty(field));
}

function deskAdvisoryIssues(report = {}) {
  const issues = [];
  for (const section of ensureArray(report.sections)) {
    for (const issue of ensureArray(section.issues)) {
      if (isDeskAdvisoryField(issue.field)) {
        issues.push({ headline: section.headline, ...issue });
      }
    }
  }
  return issues;
}

function sourceCandidateForJudgeSection(section = {}, reporter = {}) {
  const sectionHash = stringOrEmpty(section.source_candidate_hash || section.url_hash || section.normalized_url_hash);
  const sectionUrlKeys = new Set(sectionUrls(section).map(normalizeUrl).filter(Boolean));
  return ensureArray(reporter?.candidates).find(candidate => {
    const candidateHash = stringOrEmpty(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash);
    if (sectionHash && candidateHash && sectionHash === candidateHash) return true;
    const candidateUrl = normalizeUrl(candidate.url || candidate.article_url || candidate.articleUrl);
    return candidateUrl && sectionUrlKeys.has(candidateUrl);
  }) || null;
}

function publicArticleJudgeInput(date, editor = {}, reporter = {}) {
  return {
    date,
    audience: 'AOSP Camera / Camera HAL / Camera Driver / SoC Platform / C++ engineer',
    instruction: 'Judge semantic quality only. Do not rewrite article prose.',
    sections: ensureArray(editor.sections).map((section, index) => {
      const candidate = sourceCandidateForJudgeSection(section, reporter) || {};
      return {
        section_index: index + 1,
        headline: section.headline || section.category || `article ${index + 1}`,
        relevance_bucket: section.relevance_bucket || candidate.relevance_bucket || '',
        source_candidate_url: section.source_candidate_url || candidate.url || candidate.article_url || '',
        source_candidate_hash: section.source_candidate_hash || candidate.source_candidate_hash || candidate.url_hash || '',
        source_quality_status: section.source_quality_status || candidate.source_quality_status || candidate.source_quality?.source_quality_status || '',
        source_quality_notes: ensureArray(candidate.source_quality_notes || candidate.source_quality?.source_quality_notes),
        reporter_evidence: {
          version_or_release: candidate.version_or_release || '',
          api_or_component: candidate.api_or_component || '',
          behavior_change: candidate.behavior_change || '',
          evidence_notes: ensureArray(candidate.evidence_notes),
          relevance_reason: candidate.relevance_reason || '',
          do_not_overstate: ensureArray(candidate.do_not_overstate)
        },
        sources: ensureArray(section.sources).map(source => ({
          title: source?.title || '',
          url: source?.url || ''
        })),
        public_article: section.public_article || {},
        article_sections: section.article_sections || {},
        hal_signal_capsule: section.hal_signal_capsule || {},
        claims: ensureArray(section.claims).map(claim => ({
          text: claim?.text || '',
          claim_type: claim?.claim_type || '',
          impact_level: claim?.impact_level || '',
          overclaim_risk: claim?.overclaim_risk || ''
        })),
        do_not_overstate: ensureArray(section.do_not_overstate),
        do_not_claim: ensureArray(section.do_not_claim || section.article_sections?.do_not_claim)
      };
    })
  };
}

function normalizePublicArticleJudgeReport(value = {}, editor = {}, date = '') {
  const editorSections = ensureArray(editor.sections);
  const sections = ensureArray(value.sections).map((section, index) => ({
    section_index: numberOrDefault(section?.section_index, index + 1),
    headline: stringOrEmpty(section?.headline) || editorSections[index]?.headline || `article ${index + 1}`,
    public_article_pass: section?.public_article_pass === true,
    reader_checkpoints_pass: section?.reader_checkpoints_pass === true,
    source_boundary_pass: section?.source_boundary_pass === true,
    public_prose_pass: section?.public_prose_pass === true,
    issues: ensureArray(section?.issues).map(issue => ({
      section_index: numberOrDefault(issue?.section_index, numberOrDefault(section?.section_index, index + 1)),
      field: stringOrEmpty(issue?.field) || 'public_article',
      severity: stringOrEmpty(issue?.severity).toUpperCase() || 'P2',
      reason: stringOrEmpty(issue?.reason) || 'Public article judge reported an issue without a reason.',
      suggested_fix: stringOrEmpty(issue?.suggested_fix)
    }))
  }));
  return {
    date: stringOrEmpty(value.date) || date || editor.date || '',
    overall_pass: value.overall_pass === true,
    section_count_expected: editorSections.length,
    section_count_actual: sections.length,
    sections
  };
}

function publicArticleJudgeBlockingIssues(report = {}) {
  const issues = [];
  if (report.section_count_actual !== report.section_count_expected) {
    issues.push({
      section_index: 0,
      field: 'sections',
      severity: 'P1',
      reason: `Judge returned ${report.section_count_actual} section verdict(s), expected ${report.section_count_expected}.`,
      suggested_fix: 'Return one verdict per editor section.'
    });
  }
  const expectedSectionCount = numberOrDefault(report.section_count_expected, 0);
  if (Number.isInteger(expectedSectionCount) && expectedSectionCount > 0) {
    const indexCounts = new Map();
    const invalidIndices = [];
    for (const section of ensureArray(report.sections)) {
      const sectionIndex = section?.section_index;
      if (!Number.isInteger(sectionIndex) || sectionIndex < 1 || sectionIndex > expectedSectionCount) {
        invalidIndices.push(sectionIndex);
        continue;
      }
      indexCounts.set(sectionIndex, (indexCounts.get(sectionIndex) || 0) + 1);
    }
    const missingIndices = [];
    const duplicateIndices = [];
    for (let index = 1; index <= expectedSectionCount; index += 1) {
      const count = indexCounts.get(index) || 0;
      if (count === 0) missingIndices.push(index);
      if (count > 1) duplicateIndices.push(index);
    }
    if (invalidIndices.length > 0 || missingIndices.length > 0 || duplicateIndices.length > 0) {
      issues.push({
        section_index: 0,
        field: 'sections.section_index',
        severity: 'P1',
        reason: [
          duplicateIndices.length > 0 ? `duplicate section_index: ${duplicateIndices.join(', ')}` : '',
          missingIndices.length > 0 ? `missing section_index: ${missingIndices.join(', ')}` : '',
          invalidIndices.length > 0 ? `invalid section_index: ${invalidIndices.join(', ')}` : ''
        ].filter(Boolean).join('; '),
        suggested_fix: `Return section_index values 1..${expectedSectionCount} exactly once.`
      });
    }
  }
  for (const section of ensureArray(report.sections)) {
    for (const [field, passed] of Object.entries({
      public_article_pass: section.public_article_pass,
      reader_checkpoints_pass: section.reader_checkpoints_pass,
      source_boundary_pass: section.source_boundary_pass,
      public_prose_pass: section.public_prose_pass
    })) {
      if (passed !== true) {
        issues.push({
          section_index: section.section_index,
          headline: section.headline,
          field,
          severity: 'P1',
          reason: `${field} is false.`,
          suggested_fix: `Repair ${field.replace(/_pass$/, '')} for this section.`
        });
      }
    }
    issues.push(...ensureArray(section.issues)
      // desk-review 축(#725)은 advisory라 severity 라벨과 무관하게 차단에서 제외한다.
      .filter(issue => /^(P1|P2)$/i.test(issue.severity) && !isDeskAdvisoryField(issue.field))
      .map(issue => ({
        headline: section.headline,
        ...issue
      })));
  }
  if (report.overall_pass !== true && issues.length === 0) {
    issues.push({
      section_index: 0,
      field: 'overall_pass',
      severity: 'P1',
      reason: 'Judge returned overall_pass=false without a section issue.',
      suggested_fix: 'Repair the public article fields or return explicit section issues.'
    });
  }
  return issues;
}

function buildJudgeError(report, stage, attempt, phase, issues) {
  const error = new EditorSemanticValidationError(
    'Editor output failed public article semantic judge validation.',
    {
      field: 'sections.public_article',
      judge_stage: stage,
      judge_phase: phase,
      actualCount: issues.length,
      sectionCount: report.section_count_actual,
      expectedSectionCount: report.section_count_expected,
      issues,
      judge_report: report
    }
  );
  error.stage = stage;
  error.attempt = attempt;
  error.editorPublicArticleJudge = report;
  return error;
}

function publicArticleJudgeError(report, stage, attempt, phase = 'attempt') {
  return buildJudgeError(report, stage, attempt, phase, publicArticleJudgeBlockingIssues(report));
}

// #725: repair에 넘길 error는 차단 issue와 desk advisory issue를 함께 담는다. repair가 둘 다
// 한 번에 고치게 하면서, desk 단독(차단 없음) 트리거에서도 고칠 목록을 제공한다.
function judgeRepairError(report, stage, attempt, phase = 'attempt') {
  const issues = [
    ...publicArticleJudgeBlockingIssues(report),
    ...deskAdvisoryIssues(report)
  ];
  return buildJudgeError(report, stage, attempt, phase, issues);
}

// 판정 artifact 파일명 scope. 아티팩트 파일명 정책은 generator가 소유하므로 이 표는 여기 둔다
// (shared stage catalog는 정체성만 소유한다). 부모 stage id별로 한 항목씩이다(#981).
const ARTIFACT_SCOPE_BY_STAGE_ID = Object.freeze({
  'editor.public_article_judge': 'editor',
  'editor.public_article_judge_repair': 'editor',
  'editor.repair.public_article_judge': 'targeted-repair',
  'editor.repair.public_article_judge_repair': 'targeted-repair',
  'editor.completion.public_article_judge': 'completion',
  'editor.completion.public_article_judge_repair': 'completion'
});

function publicArticleJudgeArtifactScope(stageId = '') {
  return ARTIFACT_SCOPE_BY_STAGE_ID[stageId] || 'editor';
}

module.exports = {
  // 테스트 전용 노출(#1002 3번). production 호출자는 publicArticleJudgeArtifactScope만 쓴다.
  //
  // 이 표는 catalog의 판정 stage id를 손으로 복제한다. 표를 그대로 노출해 두 집합을 직접
  // 대조하는 쪽을 택했다 -- 이슈가 요구한 계약이 "두 집합이 같다"이고, 그 문장을 그대로
  // 단언하는 것이 가장 덜 에두른 표현이기 때문이다.
  //
  // 노출 없이도 해로운 방향(catalog에 있는데 표에 없음)은 잡을 수 있다. 미등록 stage는
  // 기본값 'editor'로 떨어져 다른 부모와 scope를 공유하게 되므로, 부모 stage id -> scope가
  // 단사인지 보면 드러난다. 노출이 추가로 잡는 것은 반대 방향, 즉 표에만 남은 죽은 키다.
  // 죽은 키는 런타임에 무해하지만(조회는 stage id로만 들어온다) 다음 사람이 catalog에
  // 있다고 오해할 근거가 된다.
  ARTIFACT_SCOPE_BY_STAGE_ID,
  DESK_ADVISORY_FIELDS,
  deskAdvisoryIssues,
  sourceCandidateForJudgeSection,
  publicArticleJudgeInput,
  normalizePublicArticleJudgeReport,
  publicArticleJudgeBlockingIssues,
  publicArticleJudgeError,
  judgeRepairError,
  publicArticleJudgeArtifactScope
};
