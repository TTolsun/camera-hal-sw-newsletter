const { parseGoogleJson } = require('../../shared/collect/google-json');

const GERRIT_HOSTS = new Set(['android-review.googlesource.com', 'chromium-review.googlesource.com']);
// Keep complete, bounded patches; the caller divides them into existing 16k documents.
const MAX_GERRIT_CHARS = 64000;
const SHA = /^[a-f0-9]{40}$/;

function gerritTarget(url) {
  const parsed = new URL(url);
  if (!GERRIT_HOSTS.has(parsed.hostname)) return null;
  const match = /^\/c\/(.+)\/\+\/([1-9]\d*)\/?$/.exec(parsed.pathname);
  try {
    return { origin: parsed.origin, project: match ? decodeURIComponent(match[1]) : '', number: match?.[2] || '' };
  } catch { return { origin: parsed.origin, project: '', number: '' }; }
}

async function readGerritSource(target, candidate, client) {
  const unavailable = error => ({ status: 'unavailable', error, blocks: [], related: [] });
  if (!target.number) return unavailable('unsupported_gerrit_change_url');
  const expected = candidate.gerrit_commit_sha;
  if (expected && !SHA.test(expected)) return unavailable('invalid_gerrit_revision');
  const base = `${target.origin}/changes/${target.number}`;
  const detailUrl = `${base}/detail?o=CURRENT_REVISION&o=CURRENT_COMMIT&o=CURRENT_FILES`;
  const detailResponse = await client.fetchBounded(detailUrl, { accept: 'application/json' });
  if (!detailResponse.ok) return unavailable(`gerrit_detail:${detailResponse.error}`);
  const detail = parseGoogleJson(detailResponse.body);
  if (!detail || String(detail._number) !== target.number || detail.project !== target.project) {
    return unavailable('gerrit_change_identity_mismatch');
  }
  const revision = detail.current_revision;
  if (!SHA.test(revision || '') || !detail.revisions?.[revision] || (expected && revision !== expected)) {
    return unavailable('gerrit_revision_mismatch');
  }
  const patchUrl = `${base}/revisions/${revision}/patch`;
  const patchResponse = await client.fetchBounded(patchUrl, { accept: 'text/plain' });
  if (!patchResponse.ok) return unavailable(`gerrit_patch:${patchResponse.error}`);
  const encoded = patchResponse.body.replace(/\s/g, '');
  // Buffer's decoder silently accepts invalid base64. Require a canonical encoding.
  const bytes = Buffer.from(encoded, 'base64');
  if (!encoded || bytes.toString('base64') !== encoded) return unavailable('invalid_gerrit_patch_encoding');
  let patch;
  try { patch = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return unavailable('invalid_gerrit_patch_text'); }
  if (!patch.startsWith(`From ${revision} `) || !/^diff --git /m.test(patch)) {
    return unavailable('invalid_gerrit_patch_content');
  }
  const metadata = {
    change_number: detail._number, project: detail.project, branch: detail.branch,
    status: detail.status, created: detail.created, submitted: detail.submitted || '',
    revision, subject: detail.subject,
    files: Object.keys(detail.revisions[revision].files || {})
  };
  // Never strip HTML from a diff: handle<platform>, template types and +/- lines are evidence.
  const body = 'Official Gerrit metadata (UTC timestamps):\n' + JSON.stringify(metadata, null, 2) +
    '\n\nComplete revision patch (commit message and diff):\n' + patch;
  if (body.length > MAX_GERRIT_CHARS) return unavailable('gerrit_source_exceeds_document_budget');
  return { status: 'read', error: '', body, fetched_from: [detailUrl, patchUrl], revision };
}

module.exports = { GERRIT_REVISION: SHA, gerritTarget, readGerritSource };
