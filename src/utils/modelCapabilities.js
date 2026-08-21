import { resolveVariantFeature } from './modelRouting.js'

const SPECIAL_VIDEO_FEATURES = new Set([
  'first-last-frame', 'smart-multi-frame', 'first-frame-gen', 'motion-imitate',
  'lip-sync', 'ai-outfit', 'scene-replace', 'local-adjust', 'style-replace',
  'effect-copy', 'item-fix', 'color-restore', 'smart-remove', 'video-expand'
])

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(value => value !== null && value !== undefined && value !== ''))]
}

function normalizeResolution(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeRatio(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeDuration(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const REFERENCE_LIMIT_FIELDS = {
  image: 'max_reference_images',
  video: 'max_reference_videos',
  audio: 'max_reference_audios'
}

function normalizeReferenceLimit(value) {
  if (value === null || value === undefined || value === '') return null
  const limit = Number(value)
  return Number.isInteger(limit) && limit >= 0 ? limit : null
}

function parseInputMaterials(value) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function getModelMaterialConfig(source) {
  const capabilities = source?.capabilities && typeof source.capabilities === 'object'
    ? source.capabilities
    : null
  const inputMaterials = parseInputMaterials(source?.input_materials)
    || parseInputMaterials(capabilities?.input_materials)
  const limits = {}

  for (const [type, field] of Object.entries(REFERENCE_LIMIT_FIELDS)) {
    limits[type] = normalizeReferenceLimit(
      source?.[field] ?? capabilities?.[field] ?? inputMaterials?.[type]
    )
  }

  const rawRequiresInput = source?.requires_input ?? capabilities?.requires_input
  return {
    limits,
    requiresInput: typeof rawRequiresInput === 'boolean' ? rawRequiresInput : null
  }
}

export function resolveModelReferenceLimit(model, type, { variant = null, resolution = '' } = {}) {
  const resolutionConfig = model?._resolutionMaterialConfigs?.[String(resolution).toLowerCase()]
  for (const source of [variant, resolutionConfig, model]) {
    if (!source) continue
    const config = source.limits ? source : getModelMaterialConfig(source)
    const limit = normalizeReferenceLimit(config.limits?.[type])
    if (limit !== null) return limit
  }
  return null
}

export function resolveModelRequiresInput(model, { variant = null, resolution = '' } = {}) {
  const resolutionConfig = model?._resolutionMaterialConfigs?.[String(resolution).toLowerCase()]
  for (const source of [variant, resolutionConfig, model]) {
    if (!source) continue
    const config = source.limits ? source : getModelMaterialConfig(source)
    if (typeof config.requiresInput === 'boolean') return config.requiresInput
  }
  return false
}

export function normalizeModelCapabilities(model) {
  const resolutions = unique(model?.supported_resolutions || model?.supported_quality).map(normalizeResolution)
  const ratios = unique(model?.supported_aspect_ratios?.length ? model.supported_aspect_ratios : model?.supported_ratios).map(normalizeRatio)
  const configuredDurations = model?.supported_durations?.length
    ? model.supported_durations
    : model?.valid_durations
  const durations = unique(configuredDurations).map(normalizeDuration).filter(value => value !== null)
  const generationTypes = unique([
    model?.generation_type,
    ...(Array.isArray(model?.supported_features) ? model.supported_features : [])
  ]).map(value => String(value))

  return {
    resolutions,
    ratios,
    durations,
    generationTypes,
    uiFeatures: unique(model?.ui_features).map(value => String(value)),
    requiresInput: model?.requires_input === true,
    maxDuration: normalizeDuration(model?.max_duration)
  }
}

export function inferCatalogGenerationType(mediaType, inputFiles = []) {
  const files = Array.isArray(inputFiles) ? inputFiles : []
  if (mediaType === 'image') return files.length > 0 ? 'image_edit' : 'text_to_image'
  if (mediaType === 'audio') return 'text_to_audio'
  if (mediaType === 'digital-human') return 'digital_human'

  if (files.some(file => file?.type === 'video')) return 'video_edit'
  const imageCount = files.filter(file => file?.type === 'image').length
  if (files.length === 0) return 'text_to_video'
  if (files.length === 1 && imageCount === 1) return 'image_to_video'
  return 'reference_to_video'
}

function getBaseUiFeature(mediaType, generationTypes, requiresInput) {
  if (mediaType === 'image') {
    const values = []
    if (generationTypes.includes('text_to_image') || !requiresInput) values.push('text2img')
    if (requiresInput || generationTypes.some(value => ['image_to_image', 'image_edit'].includes(value))) values.push('reference')
    return values
  }
  if (mediaType === 'video') return ['all-reference']
  return []
}

function getSelectionCapabilities(model, generationType = '') {
  const base = normalizeModelCapabilities(model)
  const variant = generationType ? model?.variants?.[generationType] : null
  if (!variant) return base
  const specific = normalizeModelCapabilities(variant)
  return {
    ...base,
    resolutions: specific.resolutions.length > 0 ? specific.resolutions : base.resolutions,
    ratios: specific.ratios.length > 0 ? specific.ratios : base.ratios,
    durations: specific.durations.length > 0 ? specific.durations : base.durations,
    maxDuration: specific.maxDuration || base.maxDuration,
    requiresInput: typeof variant.requires_input === 'boolean' ? variant.requires_input : base.requiresInput
  }
}

export function getModelFacetValues(model, facet, mediaType, generationType = '') {
  const capabilities = getSelectionCapabilities(model, generationType)
  if (facet === 'feature') {
    return unique([
      ...getBaseUiFeature(mediaType, capabilities.generationTypes, capabilities.requiresInput),
      ...capabilities.uiFeatures
    ])
  }
  if (facet === 'resolution') return capabilities.resolutions
  if (facet === 'ratio') return capabilities.ratios
  if (facet === 'duration') {
    if (capabilities.durations.length > 0) return capabilities.durations
    if (capabilities.maxDuration && capabilities.maxDuration > 0) {
      return Array.from({ length: capabilities.maxDuration }, (_, index) => index + 1)
    }
    return []
  }
  return []
}

function capabilityMatches(values, selected, normalize = value => value) {
  if (selected === null || selected === undefined || selected === '') return true
  if (values.length === 0) return true
  const target = normalize(selected)
  return values.some(value => normalize(value) === target)
}

export function modelSupportsSelection(model, filters = {}, omitFacet = '') {
  if (!model || model.is_enabled === false) return false
  const capabilities = getSelectionCapabilities(model, filters.generationType)
  const mediaType = filters.mediaType || model.media_type

  if (omitFacet !== 'feature' && filters.uiFeature) {
    const features = getModelFacetValues(model, 'feature', mediaType, filters.generationType)
    if (!features.includes(filters.uiFeature)) return false
  }
  if (omitFacet !== 'resolution' && !capabilityMatches(capabilities.resolutions, filters.resolution, normalizeResolution)) return false
  if (omitFacet !== 'ratio' && !capabilityMatches(capabilities.ratios, filters.ratio, normalizeRatio)) return false
  if (omitFacet !== 'duration') {
    const durations = getModelFacetValues(model, 'duration', mediaType, filters.generationType)
    if (!capabilityMatches(durations, filters.duration, normalizeDuration)) return false
  }

  // 明确选择特色功能时，以后端 ui_features 为权威；通用模式再按素材推导底层能力。
  const shouldCheckGenerationType = !filters.uiFeature || ['all-reference', 'text2img', 'reference'].includes(filters.uiFeature)
  if (omitFacet !== 'feature' && shouldCheckGenerationType && filters.generationType && capabilities.generationTypes.length > 0) {
    const acceptedTypes = filters.generationType === 'image_edit'
      ? ['image_edit', 'image_to_image']
      : [filters.generationType]
    if (!acceptedTypes.some(type => capabilities.generationTypes.includes(type))) return false
  }

  return true
}

export function filterModelsByCapabilities(models, filters = {}, omitFacet = '') {
  return (Array.isArray(models) ? models : []).filter(model => modelSupportsSelection(model, filters, omitFacet))
}

export function buildFacetOptions(models, filters, facet) {
  const candidates = filterModelsByCapabilities(models, filters, facet)
  const counts = new Map()
  for (const model of candidates) {
    for (const value of getModelFacetValues(model, facet, filters.mediaType, filters.generationType)) {
      counts.set(value, (counts.get(value) || 0) + 1)
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }))
}

function getStrictFilterValues(model, facet, mediaType) {
  if (facet === 'feature') return normalizeModelCapabilities(model).uiFeatures
  return getModelFacetValues(model, facet, mediaType)
}

function normalizeFacetValue(facet, value) {
  if (facet === 'resolution') return normalizeResolution(value)
  if (facet === 'ratio') return normalizeRatio(value)
  if (facet === 'duration') return normalizeDuration(value)
  return String(value || '')
}

export function buildModelFilterOptions(models, mediaType, facet) {
  const counts = new Map()
  for (const model of Array.isArray(models) ? models : []) {
    if (!model || model.is_enabled === false) continue
    for (const value of getStrictFilterValues(model, facet, mediaType)) {
      const normalized = normalizeFacetValue(facet, value)
      if (normalized === null || normalized === '') continue
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }))
}

export function filterModelsByTagSelections(models, selections = {}, mediaType = '') {
  const facets = ['feature', 'resolution', 'ratio', 'duration']
  return (Array.isArray(models) ? models : []).filter(model => {
    if (!model || model.is_enabled === false) return false
    return facets.every(facet => {
      const selected = Array.isArray(selections[facet]) ? selections[facet] : []
      if (selected.length === 0) return true
      const targets = new Set(selected.map(value => normalizeFacetValue(facet, value)))
      const values = getStrictFilterValues(model, facet, mediaType)
        .map(value => normalizeFacetValue(facet, value))
      return values.some(value => targets.has(value))
    })
  })
}

export function chooseSmartModel(models, currentModelId = '') {
  const candidates = Array.isArray(models) ? models : []
  if (currentModelId) {
    const current = candidates.find(model => model.id === currentModelId)
    if (current) return current
  }
  return candidates.find(model => model.is_default || model.is_recommended) || candidates[0] || null
}

function inferLegacyApiFeature(mediaType, uiFeature, inputFiles) {
  const files = Array.isArray(inputFiles) ? inputFiles : []
  if (mediaType === 'image') {
    if (uiFeature === 'text2img' || (!uiFeature && files.length === 0)) return 'text_to_image'
    if (uiFeature === 'reference' || (!uiFeature && files.length > 0)) return 'image_reference'
    return uiFeature || 'text_to_image'
  }
  if (mediaType === 'digital-human') return 'digital_human'
  if (mediaType === 'audio') return 'text_to_audio'

  const referenceFeature = files.length >= 2 ? 'multi_reference' : (files.length === 1 ? 'global_reference' : 'text_to_video')
  if (!uiFeature || uiFeature === 'all-reference' || SPECIAL_VIDEO_FEATURES.has(uiFeature)) return referenceFeature
  return referenceFeature
}

export function resolveRouteContext(model, {
  mediaType = 'image',
  uiFeature = '',
  resolution = '',
  ratio = '',
  duration = null,
  inputFiles = []
} = {}) {
  const catalogFeature = inferCatalogGenerationType(mediaType, inputFiles)
  const variantFeature = resolveVariantFeature(model, { feature: catalogFeature, inputFiles })
  const variant = model?.variants?.[variantFeature] || null
  const businessModelId = String(model?.business_model_id || model?.id || model?.model_id || '')
    .trim()
    .replace(/_vendor_[ab]$/i, '')
  const apiFeature = inferLegacyApiFeature(mediaType, uiFeature, inputFiles)

  return {
    model,
    businessModelId,
    feature: apiFeature,
    catalogFeature: variantFeature || catalogFeature,
    variant,
    parameters: {
      resolution,
      ratio,
      ...(duration === null || duration === undefined ? {} : { duration })
    }
  }
}
