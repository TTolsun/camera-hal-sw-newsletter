function stableTextHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function articleAnchorBase(title = '') {
  const words = String(title || '')
    .normalize('NFKD')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const compactWords = words.filter((word, index) => {
    const previous = words[index - 1] || '';
    return !(word === 'camera' && previous.includes('camera'));
  });
  const slug = compactWords.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `article-${slug || stableTextHash(title) || 'item'}`;
}

function uniqueArticleAnchorId(title = '', index = 0, usedAnchors = new Set()) {
  const base = articleAnchorBase(title);
  let anchor = base;
  if (usedAnchors.has(anchor)) {
    anchor = `${base}-${index + 1}`;
  }
  let suffix = 2;
  while (usedAnchors.has(anchor)) {
    anchor = `${base}-${index + 1}-${suffix}`;
    suffix += 1;
  }
  usedAnchors.add(anchor);
  return anchor;
}

module.exports = {
  articleAnchorBase,
  uniqueArticleAnchorId
};
