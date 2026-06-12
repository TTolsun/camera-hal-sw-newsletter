'use strict';

// YouTube 등의 재생목록(playlist) URL은 dated article이 아니라 영상 모음(collection)이다.
// 메인 기사/홈페이지 대표 기사로 승격되면 source-integrity 게이트가 "shared watch URL
// requires matching version/date evidence"로 hard-fail시키므로, 선택과 headline 양쪽에서
// 동일 기준으로 제외한다. 단일 영상(watch?v=)은 제외하지 않는다.
function isPlaylistCollectionUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '').toLowerCase();
  if (host !== 'youtube.com' && host !== 'youtu.be') return false;
  if (/^\/playlist\/?$/.test(parsed.pathname)) return true;
  return parsed.searchParams.has('list') &&
    !parsed.searchParams.has('v') &&
    !/\/watch/.test(parsed.pathname);
}

module.exports = { isPlaylistCollectionUrl };
