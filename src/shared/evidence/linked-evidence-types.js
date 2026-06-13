const LINKED_EVIDENCE_TYPES = Object.freeze({
  ANDROID_GERRIT: 'android_gerrit',
  GOOGLE_ISSUE_TRACKER: 'google_issue_tracker',
  GITHUB_PULL_REQUEST: 'github_pull_request',
  GITHUB_ISSUE: 'github_issue',
  GITHUB_COMMIT: 'github_commit',
  GITHUB_RELEASE: 'github_release',
  MAILING_LIST: 'mailing_list',
  CVE: 'cve',
  DOCS_ANCHOR: 'docs_anchor',
  GENERIC_URL: 'generic_url',
  UNKNOWN: 'unknown'
});

const FETCH_STATUSES = Object.freeze({
  NOT_FETCHED: 'not_fetched',
  RESOLVED: 'resolved',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
  SKIPPED: 'skipped'
});

const RAW_EXCERPT_MAX_LENGTH = 500;
const MAX_LINKED_EVIDENCE_PER_CANDIDATE = 50;

const LINKED_EVIDENCE_TYPE_VALUES = Object.freeze(Object.values(LINKED_EVIDENCE_TYPES));
const FETCH_STATUS_VALUES = Object.freeze(Object.values(FETCH_STATUSES));

module.exports = {
  FETCH_STATUSES,
  FETCH_STATUS_VALUES,
  LINKED_EVIDENCE_TYPES,
  LINKED_EVIDENCE_TYPE_VALUES,
  MAX_LINKED_EVIDENCE_PER_CANDIDATE,
  RAW_EXCERPT_MAX_LENGTH
};
