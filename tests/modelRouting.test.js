import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveModelRoute, resolveUpstreamRoutes, resolveVariantFeature } from '../src/utils/modelRouting.js'

const family = {
  business_model_id: 'happyhorse_1_0_i2v_720p_vendor_b',
  generation_type: 'image_to_video',
  variants: {
    image_to_video: {
      business_model_ids: [
        'happyhorse_1_0_i2v_720p_vendor_b',
        'happyhorse_1_0_i2v_1080p_vendor_b'
      ],
      business_model_ids_by_resolution: {
        '720P': 'happyhorse_1_0_i2v_720p_vendor_b',
        '1080P': 'happyhorse_1_0_i2v_1080p_vendor_b'
      }
    },
    text_to_video: {
      business_model_ids_by_resolution: {
        '720P': 'happyhorse_1_0_t2v_720p_vendor_b',
        '1080P': 'happyhorse_1_0_t2v_1080p_vendor_b'
      }
    },
    reference_to_video: {
      business_model_ids_by_resolution: {
        '1080P': 'happyhorse_1_0_r2v_1080p_vendor_b'
      }
    },
    video_edit: {
      business_model_ids_by_resolution: {
        '1080P': 'happyhorse_1_0_video_edit_1080p_vendor_b'
      }
    }
  },
  upstream_routes: [
    { resolution_key: '720P', priority_order: 1, upstream_id: 'canonical-720p' }
  ],
  variant_routes: {
    happyhorse_1_0_video_edit_1080p_vendor_b: [
      { resolution_key: '1080P', priority_order: 2, upstream_id: 'edit-fallback' },
      { resolution_key: '1080P', priority_order: 1, upstream_id: 'edit-primary' }
    ]
  }
}

test('routes an aggregated family by input mode and resolution', () => {
  assert.deepEqual(
    resolveModelRoute(family, { feature: 'global_reference', resolution: '1080p', inputFiles: [{ type: 'image' }] }),
    {
      feature: 'image_to_video',
      businessModelId: 'happyhorse_1_0_i2v_1080p_vendor_b',
      variant: family.variants.image_to_video
    }
  )
  assert.equal(resolveVariantFeature(family, { inputFiles: [] }), 'text_to_video')
  assert.equal(resolveVariantFeature(family, { inputFiles: [{ type: 'image' }, { type: 'image' }] }), 'reference_to_video')
  assert.equal(resolveVariantFeature(family, { inputFiles: [{ type: 'video' }] }), 'video_edit')
})

test('honors an explicit family feature and matches resolution case-insensitively', () => {
  const route = resolveModelRoute(family, { feature: 'video_edit', resolution: '1080p' })
  assert.equal(route.feature, 'video_edit')
  assert.equal(route.businessModelId, 'happyhorse_1_0_video_edit_1080p_vendor_b')
})

test('keeps legacy non-family model routing compatible', () => {
  const route = resolveModelRoute(
    { id: 'legacy_model_vendor_b', business_model_id: 'stable_legacy_model' },
    { feature: 'text_to_video', resolution: '720P' }
  )
  assert.equal(route.feature, 'text_to_video')
  assert.equal(route.businessModelId, 'stable_legacy_model')
  assert.equal(route.variant, null)

  const vendorQualified = resolveModelRoute({ business_model_id: 'legacy_model_vendor_b' })
  assert.equal(vendorQualified.businessModelId, 'legacy_model_vendor_b')
})

test('exposes the resolved variant upstream chain in priority order', () => {
  const routes = resolveUpstreamRoutes(family, {
    businessModelId: 'happyhorse_1_0_video_edit_1080p_vendor_b',
    resolution: '1080p'
  })
  assert.deepEqual(routes.map(route => route.upstream_id), ['edit-primary', 'edit-fallback'])
  assert.deepEqual(resolveUpstreamRoutes({}, { resolution: '720P' }), [])
})
