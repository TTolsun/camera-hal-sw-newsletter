const path = require('path');

const AUDIT_DIRECTORY = 'content/audit';
const LEDGER_FILENAME = 'newsletter-provenance-ledger.md';
const CLEANUP_REPORT_FILENAME = 'newsletter-quality-cleanup-report.md';
const INVENTORY_FILENAME = 'newsletter-quality-inventory.md';

const LEDGER_PATH = path.posix.join(AUDIT_DIRECTORY, LEDGER_FILENAME);
const CLEANUP_REPORT_PATH = path.posix.join(AUDIT_DIRECTORY, CLEANUP_REPORT_FILENAME);
const INVENTORY_PATH = path.posix.join(AUDIT_DIRECTORY, INVENTORY_FILENAME);

module.exports = {
  AUDIT_DIRECTORY,
  LEDGER_FILENAME,
  CLEANUP_REPORT_FILENAME,
  INVENTORY_FILENAME,
  LEDGER_PATH,
  CLEANUP_REPORT_PATH,
  INVENTORY_PATH
};
