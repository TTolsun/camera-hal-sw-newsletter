'use strict';

const assert = require('node:assert/strict');

function seedEvidencePack(packs = []) {
  return {
    schema_version: 1,
    report_type: 'seed_evidence_pack',
    packs
  };
}

function articleStructureSection(markdown) {
  const match = markdown.match(/## Article Structure Contract[\s\S]*?(?=\n## Article Gate Results|\n## Hard Fails|$)/);
  return match ? match[0] : '';
}

function seedPack({
  packId = 'seed-camerax-pack',
  seedId = 'seed-camerax',
  sourceId = '',
  url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
  evidenceId = 'seed-camerax-primary-01',
  title = 'CameraX 1.6.1 claim binding',
  fact = 'CameraX 1.6.1 release date: 2026-05-06.',
  publishedAt = '2026-05-06'
} = {}) {
  return {
    evidence_pack_id: packId,
    seed_id: seedId,
    source_id: sourceId,
    seed_url: url,
    final_url: url,
    title,
    primary_evidence: [{
      evidence_id: evidenceId,
      url,
      title,
      published_at: publishedAt,
      source_backed_items: [fact]
    }],
    linked_evidence: [],
    do_not_claim: []
  };
}

const {
  section,
  validSections,
  reportFor,
  scopedCandidate,
  reporterCandidatesFor
} = require('./quality-builders');
const {
  buildNewsletterQualityReport
} = require('../../../generator/quality/newsletter-quality');
const {
  qualityGatePolicy
} = require('../../common/newsletter-policy');

const hardFailRegressionCases = new Map([
  ['source-less main article', {
    name: 'hardFailCondition: source-less main article remains blocking in the quality gate',
    buildReport: () => {
      const sections = [
        section({ headline: 'Source-less main article', sources: [] }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, reporterCandidatesFor(validSections()).slice(1));
    },
    assertReport: report => {
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.article_results.some(item =>
        item.headline === 'Source-less main article' &&
        item.status === 'FAIL' &&
        item.hard_fail_reasons.some(reason => reason.includes('Missing required article list: sources'))
      ));
    }
  }],
  ['source candidate binding failure', {
    name: 'hardFailCondition: source candidate binding failure remains blocking in the quality gate',
    buildReport: () => {
      const sections = [
        section({ headline: 'Unbound source candidate article', url: 'https://example.com/unbound-source' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, reporterCandidatesFor(validSections()).slice(1));
    },
    assertReport: report => {
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.article_results.some(item =>
        item.headline === 'Unbound source candidate article' &&
        item.status === 'FAIL' &&
        item.hard_fail_reasons.some(reason => reason.includes('does not bind to reporter/shortlist candidate metadata'))
      ));
    }
  }],
  ['missing dated evidence', {
    name: 'hardFailCondition: missing dated evidence blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Missing dated evidence article', url: 'https://example.com/missing-dated-evidence' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/missing-dated-evidence', 'direct_aosp_camera', { hasDatedEvidence: false }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('missing dated evidence')
      ));
    }
  }],
  ['source_gap_risk', {
    name: 'hardFailCondition: source_gap_risk blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Source gap risk article', url: 'https://example.com/source-gap-risk' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/source-gap-risk', 'direct_aosp_camera', { source_gap_risk: true }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('source_gap_risk=true')
      ));
    }
  }],
  ['blocked source quality', {
    name: 'hardFailCondition: blocked source quality blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Blocked source quality article', url: 'https://example.com/blocked-source-quality' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/blocked-source-quality', 'direct_aosp_camera', {
          source_quality_required: true,
          source_quality: {
            source_role: 'tech_media_lead_source',
            source_url_quality: 'tech_media_lead_requires_cross_check',
            source_quality_status: 'blocked',
            main_article_source_allowed: false,
            main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
            main_article_source_blockers: ['cross_check_required_but_missing'],
            cross_check_status: 'required_missing',
            requires_cross_check: true,
            evidence_granularity: 'article_with_primary_confirmation',
            source_quality_notes: []
          },
          sourceRole: 'tech_media_lead_source',
          source_role: 'tech_media_lead_source',
          sourceUrlQuality: 'tech_media_lead_requires_cross_check',
          source_url_quality: 'tech_media_lead_requires_cross_check',
          sourceQualityStatus: 'blocked',
          source_quality_status: 'blocked',
          mainArticleSourceAllowed: false,
          main_article_source_allowed: false,
          mainArticleSourceAllowedReason: 'Source requires primary confirmation before main promotion.',
          main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
          mainArticleSourceBlockers: ['cross_check_required_but_missing'],
          main_article_source_blockers: ['cross_check_required_but_missing'],
          crossCheckStatus: 'required_missing',
          cross_check_status: 'required_missing',
          requiresCrossCheck: true,
          requires_cross_check: true,
          evidenceGranularity: 'article_with_primary_confirmation',
          evidence_granularity: 'article_with_primary_confirmation',
          sourceQualityNotes: [],
          source_quality_notes: []
        }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('main_article_source_allowed=false')
      ));
    }
  }],
  ['source quality drift', {
    name: 'hardFailCondition: source quality drift blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Drift source quality article', url: 'https://example.com/drift-source-quality' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/drift-source-quality', 'direct_aosp_camera', {
          source_quality_required: true,
          source_quality: {
            source_role: 'official_release_source',
            source_url_quality: 'official_release_note_anchor',
            source_quality_status: 'allowed',
            main_article_source_allowed: true,
            main_article_source_allowed_reason: 'Source policy allows this candidate with concrete source evidence.',
            main_article_source_blockers: [],
            cross_check_status: 'not_required',
            requires_cross_check: false,
            evidence_granularity: 'versioned_release_row',
            source_quality_notes: []
          },
          source_url_quality: 'unknown'
        }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('SOURCE_QUALITY_FIELD_DRIFT')
      ));
    }
  }],
  ['fact-check must_fix', {
    name: 'hardFailCondition: fact-check must_fix blocks publish-quality status above threshold',
    buildReport: () => buildNewsletterQualityReport(
      '2026-05-03',
      {
        briefing: ['one', 'two', 'three'],
        sections: validSections()
      },
      { candidates: reporterCandidatesFor(validSections()) },
      {
        status: 'NEEDS_FIX',
        must_fix: ['CameraX release A has an unsupported source claim.'],
        source_gaps: [],
        source_gap_count: 0
      }
    ),
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.equal(report.metrics.must_fix_count, 1);
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Fact checker returned 1 must_fix item')
      ));
    }
  }],
  ['duplicate source URL', {
    name: 'hardFailCondition: duplicate source URL blocks publish-quality status above threshold',
    buildReport: () => {
      const sharedUrl = 'https://example.com/duplicate-source-url';
      const sections = [
        section({ headline: 'Duplicate source article A', url: sharedUrl }),
        section({ headline: 'Duplicate source article B', url: sharedUrl }),
        ...validSections().slice(2)
      ];
      return reportFor(sections, [
        scopedCandidate(sharedUrl, 'direct_aosp_camera'),
        ...reporterCandidatesFor(validSections()).slice(2)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Duplicate source URL is used across main sections')
      ));
    }
  }],
  ['stale claim hard failure', {
    name: 'hardFailCondition: stale claim hard failure blocks publish-quality status above threshold',
    buildReport: () => reportFor(validSections(), reporterCandidatesFor(validSections()), {
      staleClaimReport: {
        status: 'NEEDS_FIX',
        stale_claim_items_removed: [],
        unsupported_release_claims_removed: [],
        hard_failures: [{ reason: 'removed-section-claim-remains', claims: ['Android 17 Beta 4'] }]
      }
    }),
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.equal(report.metrics.stale_claim_hard_failure_count, 1);
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('Stale claim report has 1 hard failure')
      ));
    }
  }],
  ['undated watch/reference page promoted to main article', {
    name: 'hardFailCondition: undated watch/reference page promoted to main article blocks publish-quality status above threshold',
    buildReport: () => {
      const sections = [
        section({ headline: 'Undated watch page promoted article', url: 'https://example.com/watch-page' }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate('https://example.com/watch-page', 'direct_aosp_camera', {
          finalSelectionEligibility: 'watchlist',
          isWatchPage: true,
          hasDatedEvidence: false
        }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.reason.includes('watch page lacks dated evidence')
      ));
    }
  }],
  ['CameraX source extraction failure', {
    name: 'hardFailCondition: CameraX source extraction failure blocks metadata fallback CameraX main articles',
    buildReport: () => {
      const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
      const sections = [
        section({
          headline: 'CameraX metadata fallback article',
          url,
          what_changed: 'CameraX 1.6.1 was released on 2026-05-06 with Android Camera compatibility behavior.',
          confirmed_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
          evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX / androidx.camera; behavior change: compatibility validation target.',
          specificity_checks: ['Version: CameraX 1.6.1', 'Release date: 2026-05-06'],
          camera_hal_checks: ['Run Camera ITS focused scenes and compare request/result metadata.'],
          action_items: [
            'Within 2 weeks, assign a camera owner to run Camera ITS on CameraX-backed preview and capture paths.',
            'Measure stream latency, frame drops, and metadata consistency before and after CameraX 1.6.1.'
          ],
          article_sections: {
            verified_facts: ['CameraX 1.6.1 release date: 2026-05-06.'],
            background_context: 'CameraX sits above camera2 and should be treated as framework-adjacent, not direct HAL contract evidence.',
            hal_driver_impact: 'Use this as a framework-adjacent Android Camera signal, then validate Camera ITS scenes, stream behavior, buffer handling, and request/result metadata on representative devices.',
            action_items: [
              'Within 2 weeks, assign a camera owner to run Camera ITS on CameraX-backed preview and capture paths.',
              'Measure stream latency, frame drops, and metadata consistency before and after CameraX 1.6.1.'
            ],
            team_share_points: 'Use CameraX 1.6.1 as a concrete compatibility validation trigger.'
          }
        }),
        ...validSections().slice(1)
      ];
      return reportFor(sections, [
        scopedCandidate(url, 'android', {
          title: 'CameraX Release Notes - CameraX 1.6.1',
          published_date: '2026-05-06',
          version_or_release: 'CameraX 1.6.1',
          api_or_component: 'CameraX / androidx.camera',
          behavior_change: 'CameraX / androidx.camera update.',
          field_builder_warnings: ['behavior_fallback_from_metadata'],
          source_extraction: {
            adapter_id: 'android-developers-jetpack-release',
            source_type: 'release_note',
            source: {
              name: 'CameraX Release Notes',
              url: 'https://developer.android.com/jetpack/androidx/releases/camera'
            },
            release: {
              version: 'CameraX 1.6.1',
              date: '2026-05-06',
              component: 'CameraX / androidx.camera',
              sections: []
            },
            minor_line_context: null,
            extraction_quality: {
              has_concrete_behavior_change: false,
              used_fallback: true,
              raw_table_used_as_body: false,
              main_article_allowed: false,
              warnings: ['no_concrete_release_note_bullet']
            }
          },
          extraction_quality: {
            has_concrete_behavior_change: false,
            used_fallback: true,
            raw_table_used_as_body: false,
            main_article_allowed: false,
            warnings: ['no_concrete_release_note_bullet']
          },
          derived_editorial_hints: {
            relevance_bucket_hint: 'direct_aosp_camera',
            hal_boundary: 'framework_adjacent_not_direct_hal_contract',
            validation_targets: ['Camera2 interop regression validation'],
            device_specific_notes: [],
            do_not_claim: ['Do not claim direct Camera HAL API changes.'],
            main_article_allowed_hint: false,
            warnings: ['no_concrete_release_note_bullet']
          }
        }),
        ...reporterCandidatesFor(validSections()).slice(1)
      ]);
    },
    assertReport: report => {
      assert.equal(report.score >= qualityGatePolicy.threshold, true);
      assert.equal(report.status, 'NEEDS_FIX');
      assert.ok(report.deductions.some(item =>
        item.blocking === true &&
        item.category === 'source-integrity' &&
        item.reason.includes('CameraX source extraction failure') &&
        item.reason.includes('source_extraction.used_fallback=true')
      ));
    }
  }]
]);

module.exports = {
  seedEvidencePack,
  articleStructureSection,
  seedPack,
  hardFailRegressionCases
};
