function valueOrUnknown(value) {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value);
}

function valueOrUnknownKo(value) {
  if (value === null || value === undefined || value === '') return '알 수 없음';
  return String(value);
}

function booleanText(value) {
  return value === true ? 'true' : 'false';
}

module.exports = {
  valueOrUnknown,
  valueOrUnknownKo,
  booleanText
};
