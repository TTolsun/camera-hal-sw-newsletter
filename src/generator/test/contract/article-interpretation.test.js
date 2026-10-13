const assert = require('node:assert/strict');
const test = require('node:test');
const {
  reporterSystemPrompt,
  editorSystemPrompt,
  editorRepairPatchSystemPrompt,
  editorCompletionSystemPrompt,
  factCheckSystemPrompt,
  factCheckRepairSystemPrompt,
  factCheckCompletionSystemPrompt
} = require('../../publish/orchestrator-stage-prompts');
const { publicArticleJudgePrompt } = require('../../reporter/newsletter-prompts');
const {
  PUBLIC_ARTICLE_V2_ALLOWED_KEYS,
  PUBLIC_SOURCE_ROLES,
  validatePublicArticle
} = require('../../reporter/public-article-contract');
const { publicArticleSchema } = require('../../render/newsletter-schema');
const {
  publicArticleJudgeInput,
  publicArticleJudgeBlockingIssues
} = require('../../publish/orchestrator-judge-helpers');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');

test('writers and semantic reviewers share type-specific scope, status and attribution criteria', () => {
  const prompts = [editorSystemPrompt(), editorRepairPatchSystemPrompt(),
    editorCompletionSystemPrompt({ missingArticleCount: 1 }), publicArticleJudgePrompt()];
  for (const prompt of prompts) {
    assert.match(prompt, /HAL\/Framework\/Driver 변경/);
    assert.match(prompt, /AI\/C\+\+ 개발 도구/);
    assert.match(prompt, /연구·패치 제안·참고 소식/);
    assert.match(prompt, /제안·리뷰·병합·배포를 구분/);
    assert.match(prompt, /특정 스택의 제안을 일반 Android HAL 대응으로 확대하지/);
    assert.match(prompt, /새 기술을 발견하고 이해하는 것도 독자 가치/);
    assert.match(prompt, /공급사 주장으로 귀속/);
    assert.match(prompt, /사내 브랜치·제품·담당자를 추측하지/);
    assert.match(prompt, /동일한 입력\/구성과 확인할 출력/);
    assert.match(prompt, /비교 실험은 선택 판단에 유용할 때만/);
    assert.match(prompt, /실행할 일이 없으면 빈 배열/);
    assert.match(prompt, /source가 없는 로그 태그·임계값·담당자를 지어내지/);
    assert.doesNotMatch(prompt, /C\+\+ tooling action_items에는 HAL\/native owner/);
  }
});

test('all fact-check stages distinguish unsupported facts from non-actionable but useful explanations', () => {
  for (const prompt of [factCheckSystemPrompt(), factCheckRepairSystemPrompt(), factCheckCompletionSystemPrompt()]) {
    assert.match(prompt, /제안을 병합\/배포로 단정/);
    assert.match(prompt, /공급사 주장을 사내 실측\/절감 효과/);
    assert.match(prompt, /unsupported factual claim으로 must_fix/);
    assert.match(prompt, /내부 QA에 올바른 제한을 적었어도 공개 문장의 오류는 해소되지/);
    assert.match(prompt, /action_items·owner·metric이 없다는 이유만으로 must_fix하지/);
    assert.match(prompt, /기존 source binding·dated evidence·cross-check 누락은 그대로 차단/);
    assert.match(prompt, /설명이 일반론에 그치면 article_quality에서 판정/);
    assert.match(prompt, /내부 검토 필드로 공개 설명의 누락을 메우지/);
    assert.doesNotMatch(prompt, /measurable metrics가 빠진 C\+\+ tooling action item/);
  }
});

test('reporter extracts status and limitations into existing evidence fields without writing public articles', () => {
  const prompt = reporterSystemPrompt();
  assert.match(prompt, /기존 evidence_notes에 source가 확인한 적용 스택·브랜치·조건/);
  assert.match(prompt, /제안·리뷰·병합·배포 상태와 미확정 범위/);
  assert.match(prompt, /누락된 근거는 evidence_notes\/do_not_overstate/);
  assert.match(prompt, /final article-level claims\[\]를 만들지/);
  assert.doesNotMatch(prompt, /Public article contract|body_markdown/);
});

test('semantic judge checks public explanation and concrete internal QA without mandating experiments', () => {
  const prompt = publicArticleJudgePrompt();
  assert.match(prompt, /제안을 배포로, 공급사 주장을 팀 실측으로 바꾸면 source_boundary_pass=false/);
  assert.match(prompt, /일반론만 반복되면 public_article_pass=false/);
  assert.match(prompt, /특정 설계 조건·지원 범위·리뷰 쟁점을 확인하는 내부 QA도 유효/);
  assert.match(prompt, /owner·실험·metric이 없다는 이유만으로 FAIL하지/);
});

// 사람이 작성한 최소 synthetic 계약 입력이다. LLM 의미 판정 PASS나 golden 기사가 아니다.
const cases = [
  {
    name: 'HAL proposal', bucket: 'direct_aosp_camera',
    lead: '샘플 Framework 패치는 화면에 보이는 앱의 조건부 영상 차단을 제안했습니다.',
    takeaway: '해당 Framework 경로를 검토하는 독자는 연결 유지 조건과 기존 차단 조건을 구분할 수 있습니다.',
    body: '제안은 샘플 브랜치의 앱 가시성과 영상 차단 지원 조건을 함께 확인합니다. 연결을 유지하는 경로와 끊는 경로가 다릅니다.\n\n리뷰 중인 패치이며 병합과 배포는 확인되지 않았습니다. HAL 인터페이스 변경이나 제품 적용 결과로 해석할 수 없습니다.'
  },
  {
    name: 'AI tool announcement', bucket: 'cpp_ai_tooling_fallback',
    lead: '샘플 도구는 C++ 코드 리뷰에서 변경된 함수의 설명을 생성하는 기능을 발표했습니다.',
    takeaway: 'C++ 리뷰에서 변경 내용을 읽는 보조 선택지이며 오류 탐지 정확도와 사내 효과는 검증되지 않았습니다.',
    body: '도구는 입력한 C++ diff에 대해 함수별 설명을 생성합니다. 발표에서 지원 입력 형식을 안내했습니다.\n\n공급사는 자체 표본의 응답 시간을 보고했지만 팀 실측 자료는 없습니다. 설명 생성 기능의 인지가 이번 소식의 의미이며 도입이나 HAL 런타임 변경을 뜻하지 않습니다.'
  },
  {
    name: 'stack-specific design', bucket: 'camera_driver_image_pipeline',
    lead: '샘플 ISP 드라이버의 블록 헤더 설계가 메일링 리스트 리뷰에 제안되었습니다.',
    takeaway: '해당 Linux ISP 드라이버의 블록 배치를 이해하는 참고 설계이며 일반 Android HAL 대응으로 확대할 근거는 없습니다.',
    body: '제안은 샘플 ISP 드라이버의 설정 블록을 공통 헤더 뒤에 배치합니다. 리뷰에서는 블록 길이를 표현하는 방식을 논의했습니다.\n\n확인한 범위는 메일링 리스트의 설계와 리뷰 의견입니다. 병합 상태와 다른 드라이버의 지원 여부는 확인되지 않았습니다.'
  },
  {
    name: 'limited evidence', bucket: 'cpp_ai_tooling_fallback',
    lead: '샘플 C++ 도구 발표는 지원 입력 형식을 설명했지만 비교 실험 조건은 공개하지 않았습니다.',
    takeaway: '지원 형식을 이해할 수 있으나 성능 비교와 제품 적용 여부는 이 자료만으로 판단할 수 없습니다.',
    body: '제공된 문서는 C++ 함수 설명에 사용할 수 있는 입력 형식을 안내합니다. 비교 결과의 표본과 환경은 제시하지 않았습니다.\n\n이번 설명은 지원 형식에 한정합니다. 성능 우위나 팀 비용 절감, Android HAL 적용 결과를 채우기 위한 추가 사실을 만들지 않습니다.'
  }
];

function syntheticIssue(sample) {
  const source = { title: 'Synthetic source', url: 'https://example.com/interpretation' };
  return {
    date: '2026-10-12', title: '형식 검증용 소식', summary: '', briefing: [],
    public_contract_version: 'story-v2', generation_contract_version: 2,
    sections: [{
      id: 'sample', headline: sample.name, relevance_bucket: sample.bucket,
      sources: [source], source_candidate_url: source.url,
      public_article: {
        story_contract_version: 2, source_subtitle: '샘플 문서', headline: sample.name,
        lead: sample.lead, camera_hal_takeaway: sample.takeaway, body_markdown: sample.body,
        reader_checkpoints: ['샘플 문서의 지원 조건을 확인합니다.', '샘플 문서에서 확인되지 않은 배포 범위를 구분합니다.'],
        editorial_story: { not_to_overclaim: '자료에 없는 성능 우위를 주장하지 않습니다.', editor_take: '지원 범위를 이해하는 참고 자료입니다.' },
        source_links: [source]
      }
    }]
  };
}

test('public schema and version preserve existing required QA fields with no new status/owner/action fields', () => {
  assert.deepEqual(publicArticleSchema.properties.source_links.items.properties.source_role.enum, PUBLIC_SOURCE_ROLES);
  assert.ok(!publicArticleSchema.properties.source_links.items.required.includes('source_role'));
  assert.deepEqual(Object.keys(publicArticleSchema.properties).sort(),
    PUBLIC_ARTICLE_V2_ALLOWED_KEYS.filter(key => key !== 'decision_metadata').sort());
  for (const key of ['headline', 'lead', 'camera_hal_takeaway', 'body_markdown', 'reader_checkpoints', 'source_links']) {
    assert.ok(publicArticleSchema.required.includes(key), key);
  }
  for (const sample of cases) {
    const issue = syntheticIssue(sample);
    assert.deepEqual(validatePublicArticle(issue.sections[0], 0, { issue }), []);
    assert.equal(issue.sections[0].public_article.story_contract_version, 2);
  }
});

test('new writers use existing source roles and every reviewer sees status/effect counterexamples', () => {
  for (const prompt of [editorSystemPrompt(), editorRepairPatchSystemPrompt(), editorCompletionSystemPrompt()]) {
    assert.match(prompt, /primary, seed_evidence, related_context/);
    assert.match(prompt, /official_blog.*source_role 값/);
    assert.match(prompt, /현재 미병합 상태의 증거도 아닙니다/);
  }
  for (const prompt of [factCheckSystemPrompt(), factCheckRepairSystemPrompt(), factCheckCompletionSystemPrompt(), publicArticleJudgePrompt()]) {
    assert.match(prompt, /최소 대조 예시 1/);
    assert.match(prompt, /최소 대조 예시 2/);
    assert.match(prompt, /최소 대조 예시 3/);
    assert.match(prompt, /source에 없는 항목을 material_omissions로 만들지/);
  }
});

for (const sample of cases) {
  test(`${sample.name}: real normalizer, judge input and renderer preserve public scope and keep QA internal`, () => {
    const issue = syntheticIssue(sample);
    assert.deepEqual(validatePublicArticle(issue.sections[0], 0, { issue }), []);
    const section = issue.sections[0];
    const reporter = { candidates: [{ url: section.source_candidate_url,
      evidence_notes: ['샘플 문서의 상태와 조건만 확인했습니다.'],
      api_or_component: '샘플 구성 요소', behavior_change: sample.lead }] };
    const input = publicArticleJudgeInput(issue.date, issue, reporter);
    assert.deepEqual(input.sections[0].public_article, section.public_article);
    assert.deepEqual(input.sections[0].reporter_evidence.evidence_notes, reporter.candidates[0].evidence_notes);
    for (const output of [buildHtml(issue), buildMarkdown(issue)]) {
      assert.ok(output.includes(sample.lead));
      assert.ok(output.includes(sample.takeaway));
      assert.ok(output.includes(section.public_article.source_links[0].url));
      for (const internal of [...section.public_article.reader_checkpoints,
        ...Object.values(section.public_article.editorial_story)]) {
        assert.ok(!output.includes(internal));
      }
    }
  });
}

test('type-specific prose does not bypass missing QA or forged source checks', () => {
  for (const sample of cases) {
    const issue = syntheticIssue(sample);
    issue.sections[0].public_article.reader_checkpoints = [];
    issue.sections[0].public_article.source_links[0] = { title: 'Forged', url: 'https://example.com/forged' };
    const issues = validatePublicArticle(issue.sections[0], 0, { issue });
    assert.ok(issues.some(item => item.key === 'reader_checkpoints'));
    assert.ok(issues.some(item => item.reason === 'url_not_in_allowed_source_set'));
  }
});

test('mock scope/status verdict remains blocking in the actual judge consumer', () => {
  // mock 판정의 소비 경로만 확인한다. LLM 사실성·문장 품질의 실측이 아니다.
  const issues = publicArticleJudgeBlockingIssues({ overall_pass: false, sections: [{
    section_index: 1, public_article_pass: true, reader_checkpoints_pass: true,
    public_prose_pass: true, source_boundary_pass: false, issues: []
  }] });
  assert.ok(issues.length > 0);
});
