// 발행 orchestrator의 terminal publication 헬퍼 모음(#655).
// publish-ready 종착점에서 공개 산출물을 쓰고 그 계약을 단언하는 한 역할로 묶인다:
//  - updateNewsletterData: articles/data/newsletters.json 인덱스에 이번 이슈를 반영(중복 날짜 교체).
//  - persistHeadlineStateArtifacts: 방금 렌더된 공개 이슈에 헤드라인을 reconcile해 homepage-headline
//    state와 article-exposure-history를 영속화하고 exposure coverage를 돌려준다.
//  - assertJsonArtifactsReadable: 기록된 JSON artifact가 다시 읽히는지(파싱 가능) 단언한다.
//  - assertTerminalPublicationContracts: 렌더된 이슈 구조를 검증하고 실패 시 recovery-prompt를
//    남긴 뒤 fail한다.
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import한다: writeRecoveryPrompt는
// orchestrator-recovery-writers, fail은 orchestrator-shared-helpers, issueTags는
// newsletter-renderer, ensureArray는 shared/common/value-coercion, 구조 검증은
// quality/rendered-issue-structure, 헤드라인 reconcile은
// reporter/headline-render-reconciliation·homepage-headline·article-exposure-history에서 가져온다.
// 이 모듈들은 god-file을 import하지 않아 순환이 없다. root와 dataPath는 god-file과 동일하게
// process.cwd() 기준으로 load 시점에 한 번 파생한다.
const fs = require('fs');
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
const { readJson, writeJson } = require('../../shared/common/common');
const {
  issueTags
} = require('../render/newsletter-renderer');
const {
  validateRenderedIssueStructure
} = require('../quality/rendered-issue-structure');
const {
  readExposureHistory,
  recordArticleExposure,
  recordNewsletterArticles,
  writeExposureHistory
} = require('../reporter/article-exposure-history');
const {
  writeHomepageHeadlineState
} = require('../reporter/homepage-headline');
const {
  renderedHeadlineState
} = require('../reporter/headline-render-reconciliation');
const { fail } = require('./orchestrator-shared-helpers');
const {
  writeRecoveryPrompt
} = require('./orchestrator-recovery-writers');

const root = process.cwd();
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
const {
  PUBLIC_CONTRACT_VERSIONS
} = require('../../shared/common/story-contract-version');
// v1은 인덱스에 적지 않는 기본값이다.
const DEFAULT_PUBLIC_CONTRACT_VERSION = PUBLIC_CONTRACT_VERSIONS[0];

// 인덱스에 남길 계약 버전을 정한다. 이 엔트리는 발행 때마다 통째로 교체되므로,
// 규칙을 잘못 잡으면 한 번의 재발행으로 기록이 사라진다.
//
//  - 이슈가 마커를 안 들고 오면 **기존 기록을 보존한다.** 이 파이프라인에서 마커가 빠질 수
//    있다는 건 orchestrator-targeted-repair.js의 `public_contract_version !== undefined`
//    가드가 실증한다. 부재를 v1로 단정하면 재발행 한 번에 story-v2가 조용히 강등된다.
//  - 지원 목록 밖 값은 쓰지 않고 throw한다. 쓰면 같은 저장소의 인덱스 검증기가 자기가 쓴
//    파일을 거부해, 커밋된 newsletters.json이 오염되고 이후 실행마다 전체 엔트리 스캔이
//    실패한다.
//  - 기록된 버전을 더 낮은 버전으로 덮어쓰는 것도 throw한다. 강등은 backfill을 동반한
//    의도적 작업이지 발행의 부산물이 아니다.
function resolveIndexContractVersion(date, issue, previousEntry) {
  const declared = String(issue?.public_contract_version || '').trim();
  const previous = String(previousEntry?.public_contract_version || '').trim();

  if (declared && !PUBLIC_CONTRACT_VERSIONS.includes(declared)) {
    throw new Error(
      `Refusing to index newsletter ${date} with unsupported public_contract_version "${declared}" ` +
      `(supported: ${PUBLIC_CONTRACT_VERSIONS.join(', ')})`
    );
  }
  // 보존값도 지원 목록을 통과해야 한다. 안 그러면 인덱스에 이미 미지원 값이 있을 때
  // 마커 없는 재발행이 그 값을 검증 없이 다시 써서, 자기 validator가 거부할 파일을 만든다.
  // 버전 표에서 값을 뺀 뒤 backfill 하려는 상황에서 재발행이 복구를 방해하기도 한다.
  if (previous && !PUBLIC_CONTRACT_VERSIONS.includes(previous)) {
    throw new Error(
      `Refusing to reindex newsletter ${date}: recorded public_contract_version "${previous}" ` +
      `is not supported (supported: ${PUBLIC_CONTRACT_VERSIONS.join(', ')})`
    );
  }
  if (!declared) return previous;
  if (previous && PUBLIC_CONTRACT_VERSIONS.indexOf(declared) < PUBLIC_CONTRACT_VERSIONS.indexOf(previous)) {
    throw new Error(
      `Refusing to downgrade newsletter ${date} contract version from "${previous}" to "${declared}"`
    );
  }
  return declared;
}

function updateNewsletterData(date, issue) {
  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: issueTags(issue)
  };

  const newsletters = fs.existsSync(dataPath) ? readJson(dataPath) : [];
  const previousEntry = newsletters.find(item => item?.date === date) || null;
  // 계약 버전을 발행 시점에 기록한다. 이슈별 버전을 알 수 있는 다른 입력은
  // editor-draft.json뿐인데 그건 gitignored라 CI에서는 항상 없다.
  // v1은 기본값이라 적지 않는다 — 적으면 기존 발행분과 엔트리 모양이 갈린다.
  const publicContractVersion = resolveIndexContractVersion(date, issue, previousEntry);
  if (publicContractVersion && publicContractVersion !== DEFAULT_PUBLIC_CONTRACT_VERSION) {
    entry.public_contract_version = publicContractVersion;
  }

  const updated = newsletters
    .filter(item => item.date !== date)
    .concat(entry)
    .sort((a, b) => b.date.localeCompare(a.date));
  writeJson(dataPath, updated);
}

function persistHeadlineStateArtifacts({ date, shortlistReport, shouldWritePublicArtifacts, editor }) {
  if (!shouldWritePublicArtifacts || !shortlistReport?.homepage_headline_state) {
    return { files: [], exposureCoverage: shortlistReport?.article_exposure_coverage || null };
  }
  const files = [];
  // persist/validate 전에 헤드라인을 방금 렌더된 공개 이슈에 맞춰 reconcile한다.
  // article anchor는 실행마다 달라지는 영문 헤드라인에서 파생되므로, retained 헤드라인의
  // newsletter_article_url anchor가 이번 render에 없을 수 있고 validate:site는 그 anchor를 요구한다.
  // ensure-public-newsletter-artifacts가 이후 동일하게 reconcile(멱등)하지만,
  // generate가 먼저 해야 자체 validate:site가 일관된 상태를 본다.
  const reconciled = renderedHeadlineState({
    root,
    date,
    state: shortlistReport.homepage_headline_state,
    shortlist: shortlistReport
  });
  const state = reconciled.state;
  shortlistReport.homepage_headline_state = state;
  if (reconciled.reconciliation?.applied) {
    shortlistReport.headline_public_render_reconciliation = reconciled.reconciliation;
    shortlistReport.headline_decision = {
      ...(shortlistReport.headline_decision || {}),
      public_rendered_headline_key: reconciled.reconciliation.rendered_headline_key,
      public_render_reconciled: true,
      public_render_reconciliation_reason: reconciled.reconciliation.reason
    };
  }
  const headlinePath = writeHomepageHeadlineState(root, state);
  files.push(path.relative(root, headlinePath).replace(/\\/g, '/'));

  let history = readExposureHistory(root, date);
  if (state.current_headline) {
    history = recordArticleExposure(history, state.current_headline, {
      date,
      type: 'homepage_headline',
      score: state.current_headline.current_score,
      reuseReason: shortlistReport.headline_decision?.reason || shortlistReport.headline_decision?.decision || '',
      newsletterUrl: state.current_headline.newsletter_url
    });
  }
  const sections = ensureArray(editor?.sections);
  if (sections.length > 0) {
    history = recordNewsletterArticles(history, sections, {
      date,
      newsletterUrl: `newsletters/${date}/index.html`,
      cooldownDays: 21
    });
  }
  const historyPath = writeExposureHistory(root, history);
  files.push(path.relative(root, historyPath).replace(/\\/g, '/'));
  shortlistReport.article_exposure_coverage = history.coverage;
  return { files, exposureCoverage: history.coverage };
}

function assertJsonArtifactsReadable(filePaths) {
  for (const filePath of filePaths) {
    readJson(filePath);
  }
}

function assertTerminalPublicationContracts({
  date,
  editor,
  markdown,
  html,
  newsroomDir,
  shortlistReport,
  qualityReport,
  factCheck
}) {
  const result = validateRenderedIssueStructure({ date, editor, markdown, html, root });
  if (result.ok) return;

  if (newsroomDir) {
    writeRecoveryPrompt(newsroomDir, {
      date,
      stage: 'structural validation',
      reason: `Terminal structural validation failed:\n${result.text}`,
      shortlistReport,
      selectedInputs: ensureArray(shortlistReport?.selected_articles),
      qualityReport,
      factCheck
    });
  }
  fail(`Terminal structural validation failed:\n${result.text}`);
}

module.exports = {
  updateNewsletterData,
  persistHeadlineStateArtifacts,
  assertJsonArtifactsReadable,
  assertTerminalPublicationContracts
};
