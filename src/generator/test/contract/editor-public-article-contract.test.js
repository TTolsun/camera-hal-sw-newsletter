'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');
const {
  isConcreteCheckpoint,
  mergePublicArticleFromLlm,
  mergePublicArticlesFromLlmSections,
  validatePublicArticle
} = require('../../reporter/public-article-contract');
const {
  section,
  editor,
  normalizeSection
} = require('../../../core/test/helpers/editor-builders');

const DATE = '2026-05-08';

test('editor output contract requires article_sections on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { article_sections: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.article_sections');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_article_sections'));
      return true;
    }
  );
});

test('editor output contract requires HAL Signal Capsule on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { hal_signal_capsule: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.hal_signal_capsule');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_hal_signal_capsule'));
      return true;
    }
  );
});

test('editor output contract requires public_article on new draft sections', () => {
  const draft = editor({
    sections: [
      section(1, { public_article: undefined }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'missing_public_article'));
      return true;
    }
  );
});

test('editor output contract rejects invalid public_article source_links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: '',
            url: '.tmp/newsletter.md',
            source_role: 'editorial'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      const reasons = error.details.issues.map(issue => issue.reason).filter(Boolean);
      assert.ok(reasons.includes('missing_title'));
      assert.ok(reasons.includes('invalid_url'));
      assert.ok(reasons.includes('unsupported_role'));
      return true;
    }
  );
});

test('editor output contract maps source-quality roles on public_article source_links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'Official release note',
            url: 'https://example.com/source-1',
            source_role: 'official_release_source'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  const result = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(result.sections[0].public_article.source_links[0].source_role, 'primary');
});

test('LLM public_article merge preserves deterministic article fields', () => {
  const base = section(1, {
    finalSelectionEligibility: 'main',
    source_gap_risk: true,
    main_article_readiness: { status: 'blocked' },
    do_not_claim: ['Do not claim HAL driver changes.']
  });
  const llm = {
    ...base,
    finalSelectionEligibility: 'main',
    source_gap_risk: false,
    main_article_readiness: { status: 'ready' },
    do_not_claim: [],
    public_article: {
      ...base.public_article,
      headline: 'Rewritten public headline'
    }
  };

  const merged = mergePublicArticleFromLlm(base, llm, {
    finalSelectionEligibility: base.finalSelectionEligibility,
    source_gap_risk: base.source_gap_risk,
    main_article_readiness: base.main_article_readiness,
    do_not_claim: base.do_not_claim
  });

  assert.equal(merged.public_article.headline, 'Rewritten public headline');
  assert.equal(merged.source_gap_risk, true);
  assert.deepEqual(merged.main_article_readiness, { status: 'blocked' });
  assert.deepEqual(merged.do_not_claim, ['Do not claim HAL driver changes.']);
});

test('LLM public_article merge fails closed on invalid source link provenance', () => {
  const base = section(1, {
    related_context_sources: [{
      title: 'Context-only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }]
  });
  const llm = {
    ...base,
    public_article: {
      ...base.public_article,
      source_links: [{
        title: 'Context-only reference',
        url: 'https://example.com/context-doc',
        source_role: 'primary'
      }]
    }
  };

  assert.throws(
    () => mergePublicArticleFromLlm(base, llm),
    error => {
      assert.equal(error.code, 'invalid_public_source_links');
      assert.ok(error.details.issues.some(issue => issue.reason === 'source_role_not_allowed_for_url'));
      return true;
    }
  );
});

test('LLM section merge uses source_candidate_hash before title or URL', () => {
  const baseSections = [section(1), section(2)];
  const llmSections = [{
    ...section(2, { headline: 'LLM changed title' }),
    source_candidate_hash: 'hash-2',
    sources: [{ title: 'Unexpected URL', url: 'https://example.com/unmatched' }],
    public_article: {
      ...section(2).public_article,
      headline: 'Hash matched public headline'
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'Headline 1');
  assert.equal(merged[1].public_article.headline, 'Hash matched public headline');
  assert.equal(merged[1].source_candidate_hash, 'hash-2');
  assert.deepEqual(merged[1].sources, section(2).sources);
});

test('LLM section merge falls back to normalized source URL when hash is absent', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      sources: [{ title: 'Source 1', url: 'https://example.com/source-1?a=1&b=2' }]
    }),
    section(2)
  ];
  const llmSections = [{
    headline: 'Different LLM title',
    sources: [{ title: 'Source 1', url: 'https://example.com/source-1?utm_source=ai&b=2&a=1' }],
    public_article: {
      ...section(1).public_article,
      headline: 'URL matched public headline',
      source_links: [{
        title: 'Source 1',
        url: 'https://example.com/source-1?a=1&b=2',
        source_role: 'primary'
      }]
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'URL matched public headline');
  assert.equal(merged[1].public_article.headline, 'Headline 2');
});

test('LLM section merge uses unique section title when hash and URL are absent', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      sources: [],
      public_article: { ...section(1).public_article, source_links: [] }
    }),
    section(2)
  ];
  const llmSections = [{
    headline: 'Headline 1',
    public_article: {
      ...section(1).public_article,
      headline: 'Rewritten public title',
      source_links: []
    }
  }];

  const merged = mergePublicArticlesFromLlmSections(baseSections, llmSections);

  assert.equal(merged[0].public_article.headline, 'Rewritten public title');
  assert.equal(merged[1].public_article.headline, 'Headline 2');
});

test('LLM section merge fails closed when title fallback is ambiguous', () => {
  const baseSections = [
    section(1, {
      source_candidate_hash: '',
      headline: 'Same title',
      public_article: { ...section(1).public_article, headline: 'Same title', source_links: [] },
      sources: []
    }),
    section(2, {
      source_candidate_hash: '',
      headline: 'Same title',
      public_article: { ...section(2).public_article, headline: 'Same title', source_links: [] },
      sources: []
    })
  ];
  const llmSections = [{
    headline: 'Same title',
    public_article: {
      ...section(1).public_article,
      headline: 'Same title',
      source_links: []
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections(baseSections, llmSections),
    error => {
      assert.equal(error.code, 'ambiguous_section_match');
      assert.equal(error.details.strategy, 'unique_title');
      assert.equal(error.details.match_count, 2);
      return true;
    }
  );
});

test('LLM section merge rejects an unmatched LLM section', () => {
  const llmSections = [{
    source_candidate_hash: 'unknown-hash',
    headline: 'Unknown source section',
    sources: [{ title: 'Unknown', url: 'https://example.com/unknown' }],
    public_article: {
      ...section(1).public_article,
      headline: 'Unknown source section',
      source_links: []
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections([section(1), section(2)], llmSections),
    error => {
      assert.equal(error.code, 'ambiguous_section_match');
      assert.equal(error.details.strategy, 'unique_title');
      assert.equal(error.details.match_count, 0);
      return true;
    }
  );
});

test('LLM section merge fails closed when LLM omits an invalid base public_article', () => {
  const missingPublicArticle = section(2, {
    public_article: {
      headline: '',
      lead: '',
      body_paragraphs: [],
      camera_hal_takeaway: '',
      reader_checkpoints: [],
      source_links: []
    }
  });
  const llmSections = [{
    ...section(1),
    public_article: {
      ...section(1).public_article,
      headline: 'Merged first article'
    }
  }];

  assert.throws(
    () => mergePublicArticlesFromLlmSections([section(1), missingPublicArticle], llmSections),
    error => {
      assert.equal(error.code, 'missing_llm_section_public_article_invalid');
      assert.equal(error.details.base_index, 1);
      return true;
    }
  );
});

test('editor output contract rejects source link label leakage and related context role', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'source_gap_risk evidence',
            url: 'https://example.com/source-1',
            source_role: 'related_context'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.type === 'public_article_leakage'));
      assert.ok(error.details.issues.some(issue => issue.reason === 'related_context_not_allowed'));
      return true;
    }
  );
});

test('public_article source_links cannot promote related context URL provenance to primary', () => {
  const contextOnly = section(1, {
    sources: [],
    allowed_public_source_links: [{
      title: 'Context only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }],
    public_article: {
      ...section(1).public_article,
      source_links: [{
        title: 'Context only reference',
        url: 'https://example.com/context-doc',
        source_role: 'primary'
      }]
    }
  });
  const seedAndContext = section(1, {
    sources: [],
    seed_evidence_urls: ['https://example.com/context-doc'],
    allowed_public_source_links: [{
      title: 'Context only reference',
      url: 'https://example.com/context-doc',
      source_role: 'related_context'
    }],
    public_article: {
      ...section(1).public_article,
      source_links: [{
        title: 'Seed evidence reference',
        url: 'https://example.com/context-doc',
        source_role: 'seed_evidence'
      }]
    }
  });

  const contextOnlyIssues = validatePublicArticle(contextOnly, 0);
  const seedAndContextIssues = validatePublicArticle(seedAndContext, 0);

  assert.ok(contextOnlyIssues.some(issue => issue.reason === 'source_role_not_allowed_for_url'));
  assert.equal(seedAndContextIssues.some(issue => issue.reason === 'source_role_not_allowed_for_url'), false);
});

test('editor output contract rejects hallucinated public source links', () => {
  const draft = editor({
    sections: [
      section(1, {
        public_article: {
          ...section(1).public_article,
          source_links: [{
            title: 'Different source',
            url: 'https://example.com/not-in-section',
            source_role: 'primary'
          }]
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.equal(error.details.field, 'sections.public_article');
      assert.ok(error.details.issues.some(issue => issue.reason === 'url_not_in_allowed_source_set'));
      return true;
    }
  );
});

test('reader checkpoint concrete contract requires actionable source or validation target combinations', () => {
  assert.equal(isConcreteCheckpoint('CameraX 관련 내용을 확인합니다.', section(1)), false);
  assert.equal(isConcreteCheckpoint('CameraX preview의 aspect ratio와 rotation 동작이 기존 앱과 달라지지 않는지 확인합니다.', section(1)), true);
  assert.equal(isConcreteCheckpoint('CameraX / Android camera APIs 관련 API/component/date를 확인합니다.', section(1)), false);
  assert.equal(
    isConcreteCheckpoint('HAL/driver 변경 근거는 없음으로 제한하고 Camera2 compatibility 범위만 확인합니다.', section(1)),
    true
  );
});

test('public_article deterministic validation does not hard-fail semantic checkpoint vocabulary', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      reader_checkpoints: [
        '폴더블 기기 및 태블릿 환경에서 화면 전환 시 CameraX 미리보기 스트림이 끊김 없이 재구성되는지 검증합니다.',
        '다양한 해상도 조합(YUV/JPEG/PRIVATE)에서 스트림 재구성 시 발생하는 지연 시간과 버퍼 라이프사이클을 모니터링합니다.'
      ]
    }
  });

  assert.deepEqual(validatePublicArticle(draftSection, 0), []);
});

test('public_article prose quality rejects validator-token checkpoint placeholders', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      camera_hal_takeaway: 'CameraX preview의 앱 호환성만 확인하고 HAL/driver 변경으로 해석하지 않습니다.',
      reader_checkpoints: [
        'Google AI Studio 관련 API/component/date가 현재 device matrix와 맞는지 확인합니다.',
        'Google AI Studio compatibility test scenario 또는 stream/metadata 확인 항목만 추적합니다.'
      ]
    }
  });

  const issues = validatePublicArticle(draftSection, 0);

  assert.ok(issues.some(issue => /validator-token prose/.test(issue.message || '')));
});

test('public_article prose quality accepts reader-facing camera checkpoints', () => {
  const draftSection = section(1, {
    public_article: {
      ...section(1).public_article,
      camera_hal_takeaway: '이 소식은 HAL API 변경이 아니라 app/framework 계층의 참고 신호입니다.',
      reader_checkpoints: [
        '테스트용 클라이언트 앱에서 manifest permission 선언과 Camera API 호출 위치를 확인합니다.',
        '출처가 직접 말하지 않는 HAL/driver runtime 변경이나 vendor pipeline 영향은 별도 근거가 있을 때만 다룹니다.'
      ]
    }
  });

  assert.deepEqual(validatePublicArticle(draftSection, 0), []);
});

test('editor output contract rejects article_sections keys outside normalized contract', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          legacy_summary: 'This key is outside the normalized contract.'
        }
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.article_sections');
      assert.ok(error.details.issues.some(issue =>
        issue.type === 'unexpected_article_section_keys' &&
        issue.keys.includes('legacy_summary')
      ));
      return true;
    }
  );
});

test('editor output contract allows and preserves optional article_sections keys', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          known_limitations: ['No direct HAL contract change is stated.'],
          watch_items: ['Track CameraX SessionConfig regressions.'],
          do_not_claim: ['Do not claim direct Camera HAL API changes.']
        }
      }),
      section(2),
      section(3)
    ]
  });

  const validated = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.deepEqual(validated.sections[0].article_sections.known_limitations, [
    'No direct HAL contract change is stated.'
  ]);
  assert.deepEqual(validated.sections[0].article_sections.watch_items, [
    'Track CameraX SessionConfig regressions.'
  ]);
  assert.deepEqual(validated.sections[0].article_sections.do_not_claim, [
    'Do not claim direct Camera HAL API changes.'
  ]);
});

test('editor output contract drops empty optional article_sections keys after normalization', () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1'],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1',
          known_limitations: [],
          watch_items: '',
          do_not_claim: []
        }
      }),
      section(2),
      section(3)
    ]
  });

  const validated = validateEditorOutputContract(draft, DATE, { normalizeSection });

  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'known_limitations'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'watch_items'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(validated.sections[0].article_sections, 'do_not_claim'), false);
});
