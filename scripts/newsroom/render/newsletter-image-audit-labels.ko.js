const IMAGE_REASON_LABELS_KO = {
  selected: '대표 이미지 선택됨',
  no_candidate: '이미지 후보 없음',
  missing_attribution: '출처 정보 부족',
  validator_failed: '이미지 검증 실패',
  unsafe_url: '안전하지 않은 URL',
  non_https_url: 'HTTPS가 아닌 URL',
  logo_only: '로고 전용 이미지',
  generic_or_unrelated_image: '기사와 무관한 일반 이미지',
  too_small: '이미지 크기 부족',
  unsupported_content_type: '지원하지 않는 이미지 형식',
  render_mismatch: '렌더 결과 불일치',
  missing_candidate_metadata: '후보 이미지 metadata 부족',
  missing_extraction_source: '추출 출처 정보 부족',
  redirect_validation_failed: 'redirect 검증 실패',
  validator_timeout: '이미지 검증 시간 초과',
  validator_failed_transient: '일시적 이미지 검증 실패',
  validator_failed_permanent: '영구적 이미지 검증 실패',
  html_response: 'HTML 응답',
  svg_rejected: 'SVG 이미지 제외',
  manual_repair_forbidden: '수동 복원 금지',
  schema_mismatch: '이미지 schema 불일치'
};

function imageReasonLabelKo(reasonCode) {
  return IMAGE_REASON_LABELS_KO[reasonCode] || '알 수 없는 사유';
}

function imageReasonTextKo(reasonCode) {
  const label = imageReasonLabelKo(reasonCode);
  switch (reasonCode) {
    case 'selected':
      return '기존 후보 이미지가 검증 가능한 metadata를 갖고 있어 대표 이미지로 선택했습니다.';
    case 'no_candidate':
      return '기존 artifact에 복원 가능한 이미지 후보가 없습니다.';
    case 'missing_attribution':
      return '이미지 출처 또는 attribution 정보를 기존 후보 metadata에서 안전하게 확인할 수 없습니다.';
    case 'validator_failed':
    case 'validator_failed_transient':
    case 'validator_failed_permanent':
      return '이미지 URL 검증을 통과하지 못해 대표 이미지로 선택하지 않았습니다.';
    case 'validator_timeout':
      return '이미지 URL 검증이 제한 시간 안에 완료되지 않았습니다.';
    case 'redirect_validation_failed':
      return 'redirect 이후 최종 URL을 안전하게 검증할 수 없습니다.';
    case 'unsafe_url':
    case 'non_https_url':
      return '이미지 URL이 publish 가능한 HTTPS 이미지 URL 조건을 만족하지 않습니다.';
    case 'logo_only':
    case 'generic_or_unrelated_image':
      return '기사 대표 이미지로 보기 어려운 logo 또는 일반 이미지 후보입니다.';
    case 'too_small':
      return '이미지 크기가 너무 작아 기사 대표 이미지로 사용하지 않습니다.';
    case 'unsupported_content_type':
    case 'html_response':
      return '응답 content type이 publish 가능한 이미지가 아닙니다.';
    case 'svg_rejected':
      return 'SVG 후보는 원문 대표 이미지 조건을 명확히 만족하지 않아 제외했습니다.';
    case 'missing_candidate_metadata':
    case 'missing_extraction_source':
      return '후보 이미지의 provenance 또는 validation metadata가 부족합니다.';
    case 'render_mismatch':
      return '선택된 이미지가 Markdown 또는 HTML 산출물에 일관되게 반영되지 않았습니다.';
    case 'schema_mismatch':
      return '이미지 필드가 기대 schema와 일치하지 않습니다.';
    default:
      return label;
  }
}

module.exports = {
  IMAGE_REASON_LABELS_KO,
  imageReasonLabelKo,
  imageReasonTextKo
};
