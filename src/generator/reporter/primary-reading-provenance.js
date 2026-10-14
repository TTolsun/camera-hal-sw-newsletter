// Bind existing primary-reading notes to fetched evidence; never resolve linked evidence here.
function bindPrimaryReadingNotes(section, candidate = {}) {
  const originalNotes = Array.isArray(section.source_verification_notes) ? section.source_verification_notes : [];
  const notes = originalNotes.flatMap(note => {
    const match = String(note).match(/^Source URL:\s*(https?:\/\/[^\s,]+),\s*Evidence ID:\s*(source-body:[a-zA-Z0-9_-]+)\s*$/i);
    if (!match || candidate.article_source_reading?.status !== 'read') return [note];
    const document = (candidate.article_source_reading.documents || []).find(doc =>
      doc.url === candidate.url && doc.url === match[1] && doc.evidence_id === match[2] &&
      doc.truncated === false && doc.text);
    return document ? [`Source URL: ${document.url}`, `Evidence ID: ${document.evidence_id}`] : [note];
  });
  if (candidate.article_source_reading?.status !== 'read') return notes;
  if (notes.some(note => /^(Source URL|Evidence ID):/i.test(String(note)))) return notes;
  const ids = [...new Set(notes.flatMap(note => String(note).match(/source-body:[a-zA-Z0-9_-]+/g) || []))];
  if (!ids.length) return notes;
  const documents = ids.map(id => (candidate.article_source_reading.documents || []).find(doc =>
    doc.evidence_id === id && doc.url === candidate.url && doc.truncated === false && doc.text));
  if (documents.some(doc => !doc)) return notes;
  const document = documents[0];
  const changeId = String(candidate.url || '').match(/\/\+\/(\d+)\/?$/)?.[1];
  const scopedNotes = notes.map(note => {
    const match = String(note).match(/^Verified against (?:primary )?Gerrit change (\d+) (?:documents?(?: and commit message)?|commit message and patch diff)\.?$/i);
    // Only this exact primary-reading statement is scoped. Other URLs, bugs,
    // blanket confirmations and factual assertions remain untouched for the gate.
    return match && match[1] === changeId ? `Primary source: ${note}` : note;
  });
  return [...scopedNotes, `Source URL: ${document.url}`, `Evidence ID: ${document.evidence_id}`];
}

module.exports = { bindPrimaryReadingNotes };
