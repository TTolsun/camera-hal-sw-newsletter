class NewsletterDomainValidationError extends Error {
  constructor(errors = [], message = 'Newsletter domain model validation failed.') {
    super(message);
    this.name = 'NewsletterDomainValidationError';
    this.errors = Array.isArray(errors) ? errors : [];
  }
}

function domainIssue(code, path, message, severity = 'error', extra = {}) {
  return {
    code,
    path,
    message,
    severity,
    source: 'domain_model',
    ...extra
  };
}

module.exports = {
  NewsletterDomainValidationError,
  domainIssue
};
