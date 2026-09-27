'use strict';

function hasKoreanText(value) {
  return /[\u1100-\u11ff\u3130-\u318f가-힣]/.test(String(value || ''));
}

module.exports = { hasKoreanText };
