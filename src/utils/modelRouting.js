function normalizeResolution(value) {
  return String(value || '').trim().toLowerCase()
}

function getVariantEntries(model) {
  if (!model?.variants || typeof model.variants !== 'object' || Array.isArray(model.variants)) {
    return []
  }
  return Object.entries(model.variants).filter(([, variant]) => variant && typeof variant === 'object')
}

/**
 * Resolve the generation feature represented by an aggregated model family.
 * Exact backend feature values win; otherwise infer the family route from the
 * attached media while keeping non-family models untouched.
 */
export function resolveVariantFeature(model, { feature = '', inputFiles = [] } = {}) {
  const entries = getVariantEntries(model)
  if (entries.length === 0) return String(feature || '')

  const variants = Object.fromEntries(entries)
  if (feature && variants[feature]) return feature

  const files = Array.isArray(inputFiles) ? inputFiles : []
  const hasVideo = files.some(file => file?.type === 'video')
  const imageCount = files.filter(file => file?.type === 'image').length

  if (hasVideo && variants.video_edit) return 'video_edit'
  if (files.length === 0 && variants.text_to_video) return 'text_to_video'
  if (files.length === 1 && imageCount === 1 && variants.image_to_video) return 'image_to_video'
  if (files.length > 0 && variants.reference_to_video) return 'reference_to_video'

  const primaryFeature = String(model?.generation_type || '')
  if (primaryFeature && variants[primaryFeature]) return primaryFeature
  return entries.length === 1 ? entries[0][0] : String(feature || '')
}

/**
 * Resolve the stable business model ID for a model family feature/resolution.
 * Falls back to the legacy top-level ID when the response has no variants or
 * when an incomplete variants payload cannot provide a concrete route.
 */
export function resolveModelRoute(model, { feature = '', resolution = '', inputFiles = [] } = {}) {
  const resolvedFeature = resolveVariantFeature(model, { feature, inputFiles })
  const variant = model?.variants?.[resolvedFeature]
  const targetResolution = normalizeResolution(resolution)

  let businessModelId = ''
  if (variant) {
    const byResolution = variant.business_model_ids_by_resolution
    if (byResolution && typeof byResolution === 'object') {
      const matchedKey = Object.keys(byResolution).find(key => normalizeResolution(key) === targetResolution)
      businessModelId = matchedKey ? String(byResolution[matchedKey] || '').trim() : ''
    }

    if (!businessModelId && Array.isArray(variant.business_model_ids)) {
      businessModelId = String(variant.business_model_ids.find(id => {
        const normalizedId = String(id || '').toLowerCase()
        return targetResolution && normalizedId.includes(`_${targetResolution}_`)
      }) || variant.business_model_ids[0] || '').trim()
    }

    if (!businessModelId && byResolution && typeof byResolution === 'object') {
      businessModelId = String(Object.values(byResolution).find(Boolean) || '').trim()
    }
  }

  if (!businessModelId) {
    businessModelId = String(model?.business_model_id || '').trim()
  }
  if (!businessModelId) {
    businessModelId = String(model?.id || model?.model_id || '')
      .trim()
      .replace(/_vendor_[ab]$/i, '')
  }

  return { feature: resolvedFeature || String(feature || ''), businessModelId, variant: variant || null }
}

/**
 * Return the public upstream fallback chain for the resolved business model.
 * These IDs are diagnostic only; generation requests must keep using the
 * stable businessModelId returned by resolveModelRoute().
 */
export function resolveUpstreamRoutes(model, { businessModelId = '', resolution = '' } = {}) {
  const familyRoutes = model?.variant_routes?.[businessModelId]
  const source = Array.isArray(familyRoutes)
    ? familyRoutes
    : (Array.isArray(model?.upstream_routes) ? model.upstream_routes : [])
  const targetResolution = normalizeResolution(resolution)

  const matching = source.filter(route => {
    const key = normalizeResolution(route?.resolution_key)
    return !targetResolution || key === targetResolution || key === 'all' || key === 'default'
  })
  const routes = matching.length > 0 ? matching : source

  return [...routes].sort((a, b) => Number(a?.priority_order || 0) - Number(b?.priority_order || 0))
}
