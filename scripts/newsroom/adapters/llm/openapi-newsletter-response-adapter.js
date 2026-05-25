function parseOpenApiNewsletterResponse() {
  const error = new Error('provider_not_implemented: openapi provider adapter is reserved for a dedicated implementation PR.');
  error.code = 'provider_not_implemented';
  throw error;
}

module.exports = {
  parseOpenApiNewsletterResponse
};
