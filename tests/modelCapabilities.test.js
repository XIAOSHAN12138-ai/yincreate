import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFacetOptions,
  buildModelFilterOptions,
  filterModelsByCapabilities,
  filterModelsByTagSelections,
  getModelMaterialConfig,
  inferCatalogGenerationType,
  resolveModelReferenceLimit,
  resolveModelRequiresInput,
  resolveRouteContext
} from '../src/utils/modelCapabilities.js'

const models = [
  {
    id: 'cinema',
    media_type: 'video',
    generation_type: 'text_to_video',
    supported_features: ['text_to_video', 'image_to_video'],
    ui_features: ['all-reference', 'first-last-frame'],
    supported_resolutions: ['720P', '1080P'],
    supported_ratios: ['16:9'],
    supported_durations: [5, 10]
  },
  {
    id: 'portrait',
    media_type: 'video',
    generation_type: 'text_to_video',
    ui_features: ['all-reference'],
    supported_resolutions: ['1080P'],
    supported_ratios: ['9:16'],
    supported_durations: [5]
  }
]

test('filters models with all selected facets', () => {
  const result = filterModelsByCapabilities(models, {
    mediaType: 'video',
    uiFeature: 'all-reference',
    generationType: 'text_to_video',
    resolution: '1080p',
    ratio: '16:9',
    duration: 10
  })
  assert.deepEqual(result.map(model => model.id), ['cinema'])
})

test('builds each facet against all other selected facets', () => {
  const options = buildFacetOptions(models, {
    mediaType: 'video',
    uiFeature: 'all-reference',
    generationType: 'text_to_video',
    resolution: '1080P',
    ratio: '16:9',
    duration: 5
  }, 'ratio')
  assert.deepEqual(options, [
    { value: '16:9', count: 1 },
    { value: '9:16', count: 1 }
  ])
})

test('builds explicit filter tags from backend capability declarations', () => {
  assert.deepEqual(buildModelFilterOptions(models, 'video', 'resolution'), [
    { value: '720P', count: 1 },
    { value: '1080P', count: 2 }
  ])
  assert.deepEqual(buildModelFilterOptions(models, 'video', 'feature'), [
    { value: 'all-reference', count: 2 },
    { value: 'first-last-frame', count: 1 }
  ])
})

test('explicit model filters use OR within a category and AND across categories', () => {
  const matchingBothRatios = filterModelsByTagSelections(models, {
    feature: [],
    resolution: ['1080P'],
    ratio: ['16:9', '9:16'],
    duration: []
  }, 'video')
  assert.deepEqual(matchingBothRatios.map(model => model.id), ['cinema', 'portrait'])

  const matchingTenSeconds = filterModelsByTagSelections(models, {
    feature: ['all-reference'],
    resolution: ['1080P'],
    ratio: ['16:9', '9:16'],
    duration: [10]
  }, 'video')
  assert.deepEqual(matchingTenSeconds.map(model => model.id), ['cinema'])
})

test('an explicit tag does not match models missing that capability declaration', () => {
  const undeclared = { id: 'undeclared', media_type: 'video' }
  const result = filterModelsByTagSelections([...models, undeclared], {
    ratio: ['16:9']
  }, 'video')
  assert.deepEqual(result.map(model => model.id), ['cinema'])
})

test('reads material limits including zero from public model capability fields', () => {
  const config = getModelMaterialConfig({
    max_reference_images: 3,
    max_reference_videos: 1,
    max_reference_audios: 0,
    requires_input: false
  })
  assert.deepEqual(config, {
    limits: { image: 3, video: 1, audio: 0 },
    requiresInput: false
  })
})

test('uses selected resolution material limits after models are merged', () => {
  const model = {
    max_reference_images: null,
    _resolutionMaterialConfigs: {
      '720p': { limits: { image: 1, video: 0, audio: 0 }, requiresInput: true },
      '1080p': { limits: { image: 3, video: 1, audio: 0 }, requiresInput: false }
    }
  }
  assert.equal(resolveModelReferenceLimit(model, 'image', { resolution: '1080p' }), 3)
  assert.equal(resolveModelReferenceLimit(model, 'video', { resolution: '1080p' }), 1)
  assert.equal(resolveModelReferenceLimit(model, 'audio', { resolution: '1080p' }), 0)
  assert.equal(resolveModelRequiresInput(model, { resolution: '1080p' }), false)
})

test('accepts legacy JSON input_materials from the public model API', () => {
  const model = { input_materials: '{"image":3,"video":1,"audio":0}' }
  assert.equal(resolveModelReferenceLimit(model, 'image'), 3)
  assert.equal(resolveModelReferenceLimit(model, 'audio'), 0)
})

test('infers the catalog route from attached media', () => {
  assert.equal(inferCatalogGenerationType('video', []), 'text_to_video')
  assert.equal(inferCatalogGenerationType('video', [{ type: 'image' }]), 'image_to_video')
  assert.equal(inferCatalogGenerationType('video', [{ type: 'video' }]), 'video_edit')
  assert.equal(inferCatalogGenerationType('video', [{ type: 'image' }, { type: 'image' }]), 'reference_to_video')
})

test('keeps one stable model id while resolving upload-limit metadata', () => {
  const family = {
    id: 'family',
    business_model_id: 'family_t2v_720',
    variants: {
      image_to_video: {
        business_model_ids_by_resolution: { '1080P': 'family_i2v_1080' }
      }
    }
  }
  const context = resolveRouteContext(family, {
    mediaType: 'video',
    uiFeature: 'all-reference',
    resolution: '1080P',
    ratio: '16:9',
    duration: 5,
    inputFiles: [{ type: 'image' }]
  })
  assert.equal(context.businessModelId, 'family_t2v_720')
  assert.equal(context.feature, 'global_reference')
  assert.equal(context.variant, family.variants.image_to_video)
  assert.deepEqual(context.parameters, { resolution: '1080P', ratio: '16:9', duration: 5 })
})

test('uses variant-specific capabilities and keeps legacy resolution routing compatible', () => {
  const family = {
    id: 'family',
    supported_resolutions: ['720P', '1080P'],
    variants: {
      text_to_video: { supported_resolutions: ['720P'] },
      image_to_video: { supported_resolutions: ['1080P'] }
    }
  }
  assert.equal(filterModelsByCapabilities([family], {
    mediaType: 'video',
    generationType: 'text_to_video',
    resolution: '1080P'
  }).length, 0)

  const legacy = {
    id: 'legacy-720p',
    _resolutionVariants: { '720p': 'legacy-720p', '1080p': 'legacy-1080p' }
  }
  assert.equal(resolveRouteContext(legacy, {
    mediaType: 'video',
    resolution: '1080P'
  }).businessModelId, 'legacy-720p')
})
