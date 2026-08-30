const assert = require('node:assert/strict');
const test = require('node:test');

const {
  selectEvidenceFetchTargets
} = require('../../../gemini-source-discovery-boundary');
const {
  validateCandidateEvidence
} = require('../../../validate-candidate-evidence');

function candidate(index, overrides = {}) {
  return {
    id: `candidate-${index}`,
    title: `Camera candidate ${index}`,
    url: `https://example.com/camera-${index}`,
    finalSelectionEligibility: 'main',
    source_quality_bucket: 'strong_candidate',
    duplicate_of_selected_source: false,
    source_gap_risk: false,
    ...overrides
  };
}

test('evidence fetch target selection is capped and skips weak watchlist candidates', () => {
  const candidates = [
    ...Array.from({ length: 20 }, (_, index) => candidate(index)),
    candidate('weak', {
      id: 'weak-watchlist',
      finalSelectionEligibility: 'watchlist',
      source_quality_bucket: 'weak_candidate'
    })
  ];
  const targets = selectEvidenceFetchTargets(candidates, { clusters: [] }, { maxTargets: 12 });
  const targetIds = new Set(targets.map(item => item.id));

  assert.equal(targets.length, 12);
  assert.equal(targetIds.has('weak-watchlist'), false);

  const evidence = validateCandidateEvidence(candidates, {
    sources: targets.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      source_fetch_used: true,
      source_fetch_status: 'success',
      validation_mode: 'source_fetch',
      claims: [{ claim: item.title, evidence_text: `${item.title} source evidence.` }]
    }))
  }, { newsletterDate: '2026-05-16' });
  const skipped = evidence.report.candidates.find(item => item.candidate_id === 'weak-watchlist');

  assert.equal(skipped.validation_mode, 'skipped');
  assert.equal(skipped.source_fetch_status, 'skipped');
  assert.equal(skipped.evidence_validation_status, 'not_checked');
});

test('evidence fetch target selection uses deterministic priority instead of input order', () => {
  const canonical = candidate('canonical', {
    id: 'canonical',
    title: 'Canonical Camera source',
    url: 'https://example.com/canonical',
    finalSelectionEligibility: 'watchlist',
    source_quality_bucket: 'weak_candidate',
    source_quality_score: 0.1,
    reliability: 'community',
    published_date: '2026-05-01'
  });
  const shuffled = [
    candidate('low-first', {
      id: 'low-first',
      source_quality_score: 0.05,
      reliability: 'community',
      published_date: '2026-05-16'
    }),
    candidate('review-high', {
      id: 'review-high',
      source_quality_bucket: 'review_candidate',
      source_quality_score: 0.99,
      reliability: 'official',
      published_date: '2026-05-16'
    }),
    candidate('strong-community-new', {
      id: 'strong-community-new',
      source_quality_score: 0.7,
      reliability: 'community',
      published_date: '2026-05-20'
    }),
    candidate('strong-official-old', {
      id: 'strong-official-old',
      source_quality_score: 0.7,
      reliability: 'official',
      published_date: '2026-05-01'
    }),
    candidate('strong-official-new', {
      id: 'strong-official-new',
      source_quality_score: 0.7,
      reliability: 'official',
      published_date: '2026-05-20'
    }),
    candidate('strong-high', {
      id: 'strong-high',
      source_quality_score: 0.95,
      reliability: 'community',
      published_date: '2026-05-10'
    }),
    ...Array.from({ length: 14 }, (_, index) => candidate(`filler-${index}`, {
      id: `filler-${index}`,
      source_quality_bucket: index % 2 === 0 ? 'review_candidate' : 'strong_candidate',
      source_quality_score: 0.2,
      reliability: 'community',
      published_date: '2026-04-01'
    })),
    canonical
  ];

  const targets = selectEvidenceFetchTargets(shuffled, {
    clusters: [{
      duplicate_count: 1,
      canonical_url: canonical.url,
      canonical_title: canonical.title
    }]
  }, { maxTargets: 12 });

  // eligibility -> bucket -> score -> reliability -> published_date -> canonical -> stable_key 순.
  // filler 세 건은 앞의 여섯 키가 전부 같아 stable_key 사전순으로 갈린다.
  assert.deepEqual(targets.slice(0, 7).map(item => item.id), [
    'strong-high',
    'strong-official-new',
    'strong-official-old',
    'strong-community-new',
    'filler-1',
    'filler-11',
    'filler-13'
  ]);
  assert.equal(targets.length, 12);
  // bucket이 score보다 앞선다. score 0.05짜리 strong_candidate가 score 0.99짜리
  // review_candidate를 이긴다.
  assert.equal(targets.some(item => item.id === 'low-first'), true);
  assert.equal(targets.some(item => item.id === 'review-high'), false);
  // weak_candidate 대표는 strong_candidate 12건에 밀린다(대표 여부는 순위를 정하지 않는다).
  assert.equal(targets.some(item => item.id === 'canonical'), false);
});

test('duplicate canonical candidate is fetched when the cap has room, even outside the strong final-eligible subset', () => {
  const canonical = candidate('canonical', {
    id: 'canonical',
    title: 'Canonical Camera source',
    url: 'https://example.com/canonical',
    finalSelectionEligibility: 'watchlist',
    source_quality_bucket: 'weak_candidate'
  });
  const duplicate = candidate('duplicate', {
    id: 'duplicate',
    title: 'Duplicate Camera source',
    url: 'https://example.com/duplicate',
    duplicate_of_selected_source: true
  });

  const targets = selectEvidenceFetchTargets([canonical, duplicate], {
    clusters: [{
      duplicate_count: 1,
      canonical_url: canonical.url,
      canonical_title: canonical.title
    }]
  }, { maxTargets: 12 });

  assert.deepEqual(targets.map(item => item.id), ['canonical']);
});

test('fetch failure requires editor review without turning metadata into deep evidence', () => {
  const source = candidate('fetch-failed');
  const evidence = validateCandidateEvidence([source], {
    sources: [{
      id: source.id,
      url: source.url,
      title: source.title,
      source_fetch_used: true,
      source_fetch_status: 'failed',
      source_fetch_error: 'timeout',
      validation_mode: 'source_fetch',
      claims: [{ claim: source.title, evidence_text: '' }]
    }]
  }, { newsletterDate: '2026-05-16' });
  const item = evidence.report.candidates[0];
  const annotated = evidence.annotatedCandidates[0];

  assert.equal(item.deep_checked, false);
  assert.equal(item.source_fetch_used, true);
  assert.equal(item.source_fetch_status, 'failed');
  assert.equal(item.validation_mode, 'source_fetch');
  assert.equal(item.evidence_validation_status, 'fetch_failed_review_required');
  assert.equal(item.final_selection_blocked, false);
  assert.equal(item.editor_review_required, true);
  assert.equal(annotated.evidence_validation_status, 'fetch_failed_review_required');
});

test('source gap risk stays blocked even when source fetch fails', () => {
  const source = candidate('source-gap', { source_gap_risk: true });
  const evidence = validateCandidateEvidence([source], {
    sources: [{
      id: source.id,
      url: source.url,
      title: source.title,
      source_fetch_used: true,
      source_fetch_status: 'failed',
      source_fetch_error: 'timeout',
      validation_mode: 'source_fetch',
      claims: [{ claim: source.title, evidence_text: '' }]
    }]
  }, { newsletterDate: '2026-05-16' });
  const item = evidence.report.candidates[0];

  assert.equal(item.final_selection_blocked, true);
  assert.equal(item.evidence_validation_status, 'blocked');
  assert.ok(item.reasons.includes('source_gap_risk=true'));
});

// 같은 기사 URL이 registry 수집본과 gemini 발견본으로 두 번 들어오는 일은 상시로 일어난다.
// 두 사본은 id가 다르므로(수집본은 id 자체가 없다) 예전에는 서로 다른 후보로 세어졌고,
// 근거 수집 cap 12를 같은 URL이 두 칸씩 먹어 다른 출처가 밀려났다.
// cap은 "서로 다른 출처 몇 개를 확인할 것인가"를 세는 값이어야 한다.
test('evidence fetch cap counts distinct source urls, not duplicate candidate records', () => {
  const duplicatedUrlCount = 4;
  const singleUrlCount = 8;
  const candidates = [];
  for (let index = 0; index < duplicatedUrlCount; index += 1) {
    const url = `https://example.com/duplicated-${index}`;
    candidates.push(candidate(`registry-${index}`, {
      id: undefined,
      url,
      origin: 'source_registry',
      source_quality_score: 0.9
    }));
    candidates.push(candidate(`gemini-${index}`, {
      id: `gemini-${index}`,
      url,
      origin: 'gemini_discovery',
      source_quality_score: 0.9
    }));
  }
  for (let index = 0; index < singleUrlCount; index += 1) {
    candidates.push(candidate(`single-${index}`, {
      id: `single-${index}`,
      url: `https://example.com/single-${index}`,
      source_quality_score: 0.8
    }));
  }

  const targets = selectEvidenceFetchTargets(candidates, { clusters: [] }, { maxTargets: 12 });
  const distinctUrls = new Set(targets.map(item => item.url));

  // 서로 다른 URL 12개를 전부 확인할 수 있어야 한다. 중복 사본이 칸을 먹으면 8개에서 멈춘다.
  assert.equal(distinctUrls.size, duplicatedUrlCount + singleUrlCount);

  // 사본을 버리지는 않는다. 버리면 그 사본의 id로 근거를 조회할 때 fact가 없어
  // not_checked 로 조용히 통과하는 구멍이 그대로 남는다.
  assert.equal(targets.length, candidates.length);
});

// 그룹 순위를 '먼저 들어온 사본'으로 정하면 같은 URL에 강한 사본이 있어도 약한 사본 등급으로
// 그룹 전체가 밀린다. 2026-08-24 실데이터의 lore .../natalie.klaus 쌍이 정확히 이 모양이었다
// (registry review_candidate 0.758 + gemini strong_candidate 0.81).
test('a duplicated source is ranked by its strongest copy, not by the first one seen', () => {
  const url = 'https://example.com/mixed-strength';
  const weakFirst = candidate('registry-weak', {
    id: undefined,
    url,
    source_quality_bucket: 'review_candidate',
    source_quality_score: 0.2
  });
  const strongSecond = candidate('gemini-strong', {
    id: 'gemini-strong',
    url,
    source_quality_bucket: 'strong_candidate',
    source_quality_score: 0.9
  });
  const fillers = Array.from({ length: 12 }, (_, index) => candidate(`filler-${index}`, {
    id: `filler-${index}`,
    url: `https://example.com/filler-${index}`,
    source_quality_bucket: 'strong_candidate',
    source_quality_score: 0.5
  }));

  const targets = selectEvidenceFetchTargets([weakFirst, strongSecond, ...fillers], { clusters: [] }, { maxTargets: 12 });
  const distinctUrls = new Set(targets.map(item => item.url));

  // 약한 사본 등급으로 정렬하면 filler 12개에 밀려 이 출처가 통째로 잘린다.
  assert.equal(distinctUrls.has(url), true);
  // 살아남은 그룹은 사본을 전부 데려온다.
  assert.equal(targets.filter(item => item.url === url).length, 2);
});

// 한 그룹 안에서 사본을 합칠 때 쓰는 키는 근거 조회 id와 같아야 한다. candidateKey로 합치면
// id 없는 사본은 URL로 묶여 하나가 사라지는데, 근거 조회 id는 stableId([url, title])이라
// 제목이 다르면 서로 다른 id다 — 사라진 사본은 끝내 fact를 못 받고 not_checked 로 통과한다.
test('copies that resolve to different fact ids are both kept in the same source group', () => {
  const url = 'https://example.com/same-page';
  const targets = selectEvidenceFetchTargets([
    candidate('first', { id: undefined, url, title: 'Camera release notes' }),
    candidate('second', { id: undefined, url, title: 'Camera release notes (mirror)' })
  ], { clusters: [] }, { maxTargets: 12 });

  assert.equal(targets.length, 2);
  assert.equal(new Set(targets.map(item => item.title)).size, 2);
});

// 같은 문서가 www 유무·끝 슬래시·Android 문서의 hl 파라미터만 다르게 들어올 수 있다.
// raw URL로 묶으면 이런 쌍이 다시 두 칸을 먹는 원래 버그로 돌아간다.
test('source grouping normalizes host, trailing slash, and the android locale parameter', () => {
  const pairs = [
    ['https://www.example.com/camera-a/', 'https://example.com/camera-a'],
    ['https://developer.android.com/jetpack/camera?hl=ko', 'https://developer.android.com/jetpack/camera']
  ];
  for (const [left, right] of pairs) {
    const targets = selectEvidenceFetchTargets([
      candidate('left', { id: undefined, url: left }),
      candidate('right', { id: 'gemini-right', url: right })
    ], { clusters: [] }, { maxTargets: 1 });

    // 한 칸만 허용해도 두 사본이 함께 나온다 = 같은 출처 한 그룹으로 세었다는 뜻이다.
    assert.equal(targets.length, 2, `${left} 와 ${right} 가 한 그룹으로 묶여야 한다`);
  }
});

// cap 초과와 중복 사본이 동시에 있을 때, 잘리는 단위가 사본이 아니라 그룹이어야 한다.
// 그룹이 반쪽만 잘리면 남은 사본은 원문 없이 통과하고 잘린 사본은 fact를 잃는다.
test('when the cap truncates, it drops whole sources and never a partial copy set', () => {
  const maxTargets = 12;
  const distinctUrlCount = 20;
  const candidates = [];
  for (let index = 0; index < distinctUrlCount; index += 1) {
    const url = `https://example.com/source-${index}`;
    candidates.push(candidate(`registry-${index}`, { id: undefined, url, source_quality_score: 0.5 }));
    if (index % 2 === 0) {
      candidates.push(candidate(`gemini-${index}`, { id: `gemini-${index}`, url, source_quality_score: 0.5 }));
    }
  }

  const targets = selectEvidenceFetchTargets(candidates, { clusters: [] }, { maxTargets });
  const distinctUrls = new Set(targets.map(item => item.url));

  assert.equal(distinctUrls.size, maxTargets);
  for (const url of distinctUrls) {
    const expectedMemberCount = candidates.filter(item => item.url === url).length;
    assert.equal(targets.filter(item => item.url === url).length, expectedMemberCount, `${url} 그룹이 통째로 들어와야 한다`);
  }
});

// 중복 클러스터가 슬롯 수만큼 있어도 클러스터 밖 후보가 슬롯을 받는다.
// 사유는 compareEvidenceTargets 주석이 정본이다.
test('a strong candidate outside every duplicate cluster still gets a slot', () => {
  const maxTargets = 12;
  const clusterCanonicals = Array.from({ length: maxTargets }, (_, index) => candidate(`cluster-${index}`, {
    id: `cluster-${index}`,
    url: `https://example.com/cluster-${index}`,
    title: `Clustered camera source ${index}`,
    source_quality_bucket: 'review_candidate',
    source_quality_score: 0.2
  }));
  const outsider = candidate('outsider', {
    id: 'outsider',
    url: 'https://example.com/outsider',
    title: 'Unclustered camera source',
    source_quality_bucket: 'strong_candidate',
    source_quality_score: 0.95
  });

  const targets = selectEvidenceFetchTargets([...clusterCanonicals, outsider], {
    clusters: clusterCanonicals.map(item => ({
      duplicate_count: 1,
      canonical_url: item.url,
      canonical_title: item.title
    }))
  }, { maxTargets });

  assert.equal(targets.some(item => item.id === 'outsider'), true);
});

// 대표 우선 의도 자체는 남아야 한다. 다른 조건이 같으면 클러스터 대표가 앞선다.
// 대표의 stable_key를 일부러 사전순 뒤에 둔다. 앞에 두면 마지막 키인 stable_key만으로도
// 같은 결과가 나와서 canonical_rank를 지워도 통과하는 빈 단언이 된다.
test('cluster canonical still wins when quality signals tie', () => {
  const canonical = candidate('canonical', {
    id: 'zeta-canonical',
    url: 'https://example.com/canonical',
    title: 'Canonical camera source'
  });
  const plain = candidate('plain', {
    id: 'alpha-plain',
    url: 'https://example.com/plain',
    title: 'Plain camera source'
  });

  const targets = selectEvidenceFetchTargets([plain, canonical], {
    clusters: [{ duplicate_count: 1, canonical_url: canonical.url, canonical_title: canonical.title }]
  }, { maxTargets: 1 });

  assert.deepEqual(targets.map(item => item.id), ['zeta-canonical']);
});

// canonical_rank의 서열 위치를 잠근다. published_date보다 위로 올리면 오래된 대표가 최신
// 비대표를 이겨서 이 단언이 실패한다.
test('a newer non-canonical source outranks an older cluster canonical', () => {
  const canonical = candidate('canonical', {
    id: 'canonical',
    url: 'https://example.com/canonical',
    title: 'Canonical camera source',
    source_quality_score: 0.5,
    reliability: 'community',
    published_date: '2026-05-01'
  });
  const newer = candidate('newer', {
    id: 'newer',
    url: 'https://example.com/newer',
    title: 'Newer camera source',
    source_quality_score: 0.5,
    reliability: 'community',
    published_date: '2026-05-20'
  });

  const targets = selectEvidenceFetchTargets([canonical, newer], {
    clusters: [{ duplicate_count: 1, canonical_url: canonical.url, canonical_title: canonical.title }]
  }, { maxTargets: 1 });

  assert.deepEqual(targets.map(item => item.id), ['newer']);
});

// 발행할 수 없는 후보가 슬롯을 쓰고 발행할 후보가 밀리면 안 된다.
// 사유는 compareEvidenceTargets 주석이 정본이다.
test('a publishable candidate outranks a stronger candidate that cannot be published', () => {
  const unpublishable = candidate('unpublishable', {
    id: 'unpublishable',
    url: 'https://example.com/unpublishable',
    title: 'Watchlist camera source',
    finalSelectionEligibility: 'watchlist',
    source_quality_bucket: 'strong_candidate',
    source_quality_score: 0.99
  });
  const publishable = candidate('publishable', {
    id: 'publishable',
    url: 'https://example.com/publishable',
    title: 'Publishable camera source',
    finalSelectionEligibility: 'main',
    source_quality_bucket: 'review_candidate',
    source_quality_score: 0.1
  });

  const targets = selectEvidenceFetchTargets([unpublishable, publishable], {
    clusters: [{
      duplicate_count: 1,
      canonical_url: unpublishable.url,
      canonical_title: unpublishable.title
    }]
  }, { maxTargets: 1 });

  assert.deepEqual(targets.map(item => item.id), ['publishable']);
});
