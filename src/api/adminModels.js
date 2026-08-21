import request from '../utils/request'

// 开发模式 Mock 开关
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'
const MOCK_DELAY = 500

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== Mock 数据 ====================
const VENDOR_LABELS = {
  vendor_a: '腾讯云 VOD',
  vendor_b: 'Token Switch'
}

const MEDIA_TYPE_LABELS = {
  image: '图片',
  video: '视频',
  audio: '音频'
}

const STATUS_LABELS = {
  active: '正常',
  deprecated: '已弃用',
  unavailable: '不可用'
}

let mockModelIdSeq = 100
const mockModels = [
  {
    id: 1, model_id: 'kling_3_0', model_name: 'Kling', model_version: '3.0',
    display_name: 'Kling 3.0', vendor: 'vendor_a', vendor_display_name: '腾讯云 VOD',
    media_type: 'video',
    supported_features: ['text_to_video', 'image_to_video'],
    ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen', 'lip-sync', 'ai-outfit', 'scene-replace'],
    supported_resolutions: ['720P', '1080P', '2K'],
    supported_aspect_ratios: ['16:9', '9:16', '1:1'],
    sound_mode: 'free',
    max_width: 1920, max_height: 1080, min_width: 256, min_height: 256,
    max_duration: 10, max_fps: 30,
    price_per_request: null, price_per_second: 50, price_multiplier: 1.00,
    currency: 'POINTS',
    price_tiers: { '720p': 30, '1080p': 50, '2K': 120 },
    status: 'active', is_enabled: true,
    availability_region: 'ap-guangzhou',
    description: '高质量视频生成模型',
    tags: ['高清', '快速'],
    created_at: '2026-06-15 14:00:00', updated_at: '2026-06-15 14:00:00'
  },
  {
    id: 2, model_id: 'kling_3_0_omni', model_name: 'Kling', model_version: '3.0 Omni',
    display_name: 'Kling 3.0 Omni', vendor: 'vendor_a', vendor_display_name: '腾讯云 VOD',
    media_type: 'video',
    supported_features: ['text_to_video', 'image_to_video'],
    ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen'],
    supported_resolutions: ['720P', '1080P'],
    supported_aspect_ratios: ['16:9', '9:16'],
    sound_mode: 'free',
    max_width: 1920, max_height: 1080, min_width: 256, min_height: 256,
    max_duration: 8, max_fps: 30,
    price_per_request: null, price_per_second: 60, price_multiplier: 1.10,
    currency: 'POINTS', price_tiers: null,
    status: 'active', is_enabled: true,
    availability_region: null, description: '全能视频生成', tags: ['全能'],
    created_at: '2026-06-15 14:00:00', updated_at: '2026-06-15 14:00:00'
  },
  {
    id: 3, model_id: 'image_5.0', model_name: 'Image', model_version: '5.0',
    display_name: '图片5.0', vendor: 'vendor_a', vendor_display_name: '腾讯云 VOD',
    media_type: 'image',
    supported_features: ['text_to_image', 'image_to_image'],
    ui_features: ['text2img', 'reference', 'style-transfer', 'inpaint', 'outpaint', 'erase', 'face-swap', 'outfit-change'],
    supported_resolutions: ['1024x1024', '1920x1080'],
    supported_aspect_ratios: ['1:1', '16:9', '9:16'],
    sound_mode: null,
    max_width: 4096, max_height: 4096, min_width: 256, min_height: 256,
    max_duration: null, max_fps: null,
    price_per_request: 15, price_per_second: null, price_multiplier: 1.00,
    currency: 'POINTS', price_tiers: null,
    status: 'active', is_enabled: true,
    availability_region: null, description: '全能王者', tags: ['VIP'],
    created_at: '2026-06-15 14:00:00', updated_at: '2026-06-15 14:00:00'
  },
  {
    id: 4, model_id: 'gpt-image-2', model_name: 'GPT Image', model_version: '2',
    display_name: 'GPT Image 2', vendor: 'vendor_b', vendor_display_name: 'Token Switch',
    media_type: 'image',
    supported_features: ['text_to_image'],
    ui_features: ['text2img', 'reference'],
    supported_resolutions: ['1024x1024'],
    supported_aspect_ratios: ['1:1'],
    sound_mode: null,
    max_width: 2048, max_height: 2048, min_width: 256, min_height: 256,
    max_duration: null, max_fps: null,
    price_per_request: 25, price_per_second: null, price_multiplier: 1.00,
    currency: 'POINTS', price_tiers: null,
    status: 'active', is_enabled: false,
    availability_region: null, description: '临时下架测试', tags: [],
    created_at: '2026-06-10 14:00:00', updated_at: '2026-06-18 14:00:00'
  },
  {
    id: 5, model_id: 'audio_1.0', model_name: 'Audio', model_version: '1.0',
    display_name: '音频生成 1.0', vendor: 'vendor_a', vendor_display_name: '腾讯云 VOD',
    media_type: 'audio',
    supported_features: ['text_to_audio'],
    ui_features: [],
    supported_resolutions: null,
    supported_aspect_ratios: null,
    sound_mode: null,
    max_width: null, max_height: null, min_width: null, min_height: null,
    max_duration: 60, max_fps: null,
    price_per_request: 10, price_per_second: null, price_multiplier: 1.00,
    currency: 'POINTS', price_tiers: null,
    status: 'active', is_enabled: true,
    availability_region: null, description: '高质量音频生成', tags: ['新'],
    created_at: '2026-06-12 14:00:00', updated_at: '2026-06-12 14:00:00'
  },
  {
    id: 6, model_id: 'kling_2_6', model_name: 'Kling', model_version: '2.6',
    display_name: 'Kling 2.6', vendor: 'vendor_a', vendor_display_name: '腾讯云 VOD',
    media_type: 'video',
    supported_features: ['text_to_video', 'image_to_video'],
    ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen'],
    supported_resolutions: ['720P', '1080P'],
    supported_aspect_ratios: ['16:9', '9:16'],
    sound_mode: 'free',
    max_width: 1920, max_height: 1080, min_width: 256, min_height: 256,
    max_duration: 10, max_fps: 30,
    price_per_request: null, price_per_second: 30, price_multiplier: 1.00,
    currency: 'POINTS', price_tiers: null,
    status: 'deprecated', is_enabled: false,
    availability_region: null, description: '已弃用旧版本', tags: [],
    created_at: '2026-05-01 14:00:00', updated_at: '2026-06-01 14:00:00'
  },
  {
    id: 7, model_id: 'sora_1_0', model_name: 'Sora', model_version: '1.0',
    display_name: 'Sora 1.0 (已删除)', vendor: 'vendor_b', vendor_display_name: 'Token Switch',
    media_type: 'video',
    supported_features: ['text_to_video'],
    ui_features: ['all-reference', 'first-frame-gen'],
    supported_resolutions: ['720P', '1080P'],
    supported_aspect_ratios: ['16:9', '9:16'],
    sound_mode: 'disabled-silent',
    max_width: 1920, max_height: 1080, min_width: 256, min_height: 256,
    max_duration: 15, max_fps: 24,
    price_per_request: null, price_per_second: 80, price_multiplier: 1.00,
    currency: 'POINTS', price_tiers: null,
    status: 'deprecated', is_enabled: false,
    deleted_at: '2026-06-20 10:30:00', // 软删标记
    availability_region: null, description: '已软删的测试模型', tags: ['回收站'],
    created_at: '2026-04-15 14:00:00', updated_at: '2026-06-20 10:30:00'
  }
]

// 让本地 Mock 与 ADMIN_MODELS_API PR-4.10/4.11 字段保持一致。
for (const model of mockModels) {
  model.business_model_id ??= model.model_id.replaceAll('-', '_')
  model.generation_type ??= model.supported_features?.[0] || 'text_to_image'
  model.upstream_id_by_resolution ??= { default: model.model_id }
  model.resolution_variants ??= {}
  model.supported_durations ??= model.max_duration ? [model.max_duration] : []
  model.supported_sizes ??= model.media_type === 'image' ? [...(model.supported_resolutions || [])] : []
  model.max_reference_images ??= 0
  model.max_reference_videos ??= 0
  model.max_reference_audios ??= 0
  model.requires_input ??= null
  model.input_materials ??= { image: 0, video: 0, audio: 0 }
  model.supports_audio ??= model.media_type === 'video' && model.sound_mode === 'free'
  if (!model.price_tiers || Object.keys(model.price_tiers).length === 0) {
    const fallbackPrice = model.price_per_second ?? model.price_per_request
    model.price_tiers = fallbackPrice == null ? {} : { default: fallbackPrice }
  }
  if (model.media_type === 'video') {
    model.price_tiers = Object.fromEntries(Object.entries(model.price_tiers).map(([resolution, tier]) => {
      if (tier && typeof tier === 'object') return [resolution, tier]
      return [resolution, { silent: tier, with_audio: Number(tier) * 1.5 }]
    }))
  }
}

const mockChangelogs = {}
const mockUsageCache = {}

function getMockChangelogs(modelId) {
  if (!mockChangelogs[modelId]) {
    mockChangelogs[modelId] = [
      {
        id: 1, model_id: modelId, change_type: 'created',
        change_description: 'created via admin API',
        changed_fields: { model_id: modelId, media_type: 'video' },
        operator_id: '72cae811-611c-4691-8677-001bf2ba106c',
        operator_name: '系统管理员',
        created_at: '2026-06-15 14:00:00'
      }
    ]
  }
  return mockChangelogs[modelId]
}

function getMockUsage(modelId) {
  if (!mockUsageCache[modelId]) {
    const hourly = []
    for (let i = 0; i < 24; i++) {
      hourly.push({
        stat_date: '2026-06-18',
        stat_hour: i,
        total_requests: Math.floor(Math.random() * 30),
        successful_requests: Math.floor(Math.random() * 28),
        failed_requests: Math.floor(Math.random() * 3),
        total_processing_time: Math.floor(Math.random() * 500),
        total_cost: Math.round(Math.random() * 50 * 100) / 100
      })
    }
    const aggregate = hourly.reduce((acc, h) => {
      acc.total_requests += h.total_requests
      acc.successful_requests += h.successful_requests
      acc.failed_requests += h.failed_requests
      acc.total_processing_time += h.total_processing_time
      acc.total_cost += h.total_cost
      return acc
    }, { total_requests: 0, successful_requests: 0, failed_requests: 0, total_processing_time: 0, total_cost: 0 })
    aggregate.avg_processing_time = aggregate.total_requests > 0
      ? Math.round((aggregate.total_processing_time / aggregate.total_requests) * 100) / 100
      : 0
    aggregate.total_cost = Math.round(aggregate.total_cost * 100) / 100
    mockUsageCache[modelId] = { model_id: modelId, days: 30, aggregate, hourly }
  }
  return mockUsageCache[modelId]
}

function nowStr() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function writeChangelog(modelId, changeType, description, changedFields) {
  const logs = getMockChangelogs(modelId)
  logs.unshift({
    id: logs.length + 1,
    model_id: modelId,
    change_type: changeType,
    change_description: description,
    changed_fields: changedFields,
    operator_id: '72cae811-611c-4691-8677-001bf2ba106c',
    operator_name: '系统管理员',
    created_at: nowStr()
  })
}

// ==================== API 函数 ====================

/**
 * 获取模型列表
 * GET /api/v1/admin/models
 * @param {Object} params - { vendor?, media_type?, status?, is_enabled?, include_deleted?, limit?, offset? }
 */
export function getAdminModelsApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      let filtered = [...mockModels]
      // 默认隐藏软删的模型，除非显式 include_deleted=true
      const includeDeleted = params.include_deleted === true || params.include_deleted === 'true'
      if (!includeDeleted) {
        filtered = filtered.filter(m => !m.deleted_at)
      }
      if (params.vendor) filtered = filtered.filter(m => m.vendor === params.vendor)
      if (params.media_type) filtered = filtered.filter(m => m.media_type === params.media_type)
      if (params.status) filtered = filtered.filter(m => m.status === params.status)
      if (params.is_enabled !== undefined && params.is_enabled !== null && params.is_enabled !== '') {
        const val = params.is_enabled === true || params.is_enabled === 'true'
        filtered = filtered.filter(m => m.is_enabled === val)
      }
      const limit = params.limit || 200
      const offset = params.offset || 0
      const total = filtered.length
      const items = filtered.slice(offset, offset + limit)
      return {
        data: {
          items, total, limit, offset,
          filters: {
            vendor: params.vendor || null,
            media_type: params.media_type || null,
            status: params.status || null,
            is_enabled: params.is_enabled ?? null,
            include_deleted: includeDeleted
          }
        }
      }
    })
  }
  return request.get('/api/v1/admin/models', { params })
}

/**
 * 获取模型详情
 * GET /api/v1/admin/models/{model_id}
 */
export function getAdminModelDetailApi(modelId) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const item = mockModels.find(m => m.model_id === modelId)
      if (!item) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      return { data: { ...item } }
    })
  }
  return request.get(`/api/v1/admin/models/${modelId}`)
}

/**
 * 新增模型
 * POST /api/v1/admin/models
 */
export function createAdminModelApi(data) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const existing = mockModels.find(m => m.model_id === data.model_id)
      const ts = nowStr()
      if (existing) {
        // upsert：覆盖
        Object.assign(existing, data, { updated_at: ts })
        writeChangelog(data.model_id, 'updated', 'upsert via admin API', { ...data })
        return { data: { ...existing } }
      }
      const newItem = {
        id: ++mockModelIdSeq,
        ...data,
        created_at: ts, updated_at: ts
      }
      mockModels.push(newItem)
      writeChangelog(data.model_id, 'created', 'created via admin API', { ...data })
      return { data: { ...newItem } }
    })
  }
  return request.post('/api/v1/admin/models', data)
}

/**
 * 局部更新模型
 * PATCH /api/v1/admin/models/{model_id}
 */
export function updateAdminModelApi(modelId, data) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const idx = mockModels.findIndex(m => m.model_id === modelId)
      if (idx === -1) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      const old = { ...mockModels[idx] }
      const diff = {}
      Object.keys(data).forEach(k => {
        if (JSON.stringify(old[k]) !== JSON.stringify(data[k])) {
          diff[k] = { old: old[k], new: data[k] }
          mockModels[idx][k] = data[k]
        }
      })
      mockModels[idx].updated_at = nowStr()
      if (Object.keys(diff).length > 0) {
        writeChangelog(modelId, 'updated', `updated ${Object.keys(diff).length} field(s) via admin API`, diff)
      }
      return { data: { ...mockModels[idx] } }
    })
  }
  return request.patch(`/api/v1/admin/models/${modelId}`, data)
}

/**
 * 启用模型
 * POST /api/v1/admin/models/{model_id}/enable
 */
export function enableAdminModelApi(modelId) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const item = mockModels.find(m => m.model_id === modelId)
      if (!item) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      if (!item.is_enabled) {
        item.is_enabled = true
        item.updated_at = nowStr()
        writeChangelog(modelId, 'enabled', 'enabled via admin API', { is_enabled: { old: false, new: true } })
      }
      return { data: { ...item } }
    })
  }
  return request.post(`/api/v1/admin/models/${modelId}/enable`)
}

/**
 * 停用模型
 * POST /api/v1/admin/models/{model_id}/disable
 */
export function disableAdminModelApi(modelId) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const item = mockModels.find(m => m.model_id === modelId)
      if (!item) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      if (item.is_enabled) {
        item.is_enabled = false
        item.updated_at = nowStr()
        writeChangelog(modelId, 'disabled', 'disabled via admin API', { is_enabled: { old: true, new: false } })
      }
      return { data: { ...item } }
    })
  }
  return request.post(`/api/v1/admin/models/${modelId}/disable`)
}

/**
 * 获取模型用量统计
 * GET /api/v1/admin/models/{model_id}/usage?days=30
 */
export function getAdminModelUsageApi(modelId, params = {}) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => ({
      data: getMockUsage(modelId)
    }))
  }
  return request.get(`/api/v1/admin/models/${modelId}/usage`, { params })
}

/**
 * 获取模型变更历史
 * GET /api/v1/admin/models/{model_id}/changelog?limit=50
 */
export function getAdminModelChangelogApi(modelId, params = {}) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const logs = getMockChangelogs(modelId)
      const limit = params.limit || 50
      return {
        data: {
          model_id: modelId,
          items: logs.slice(0, limit),
          total: logs.length
        }
      }
    })
  }
  return request.get(`/api/v1/admin/models/${modelId}/changelog`, { params })
}

/**
 * 删除模型（支持软删和硬删）
 * DELETE /api/v1/admin/models/{model_id}?force=false
 * @param {string} modelId - 模型ID
 * @param {Object} params - { force?: boolean }
 */
export function deleteAdminModelApi(modelId, params = {}) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const idx = mockModels.findIndex(m => m.model_id === modelId)
      if (idx === -1) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      const item = mockModels[idx]
      const force = params.force === true || params.force === 'true'

      if (force) {
        // 硬删：物理删除
        mockModels.splice(idx, 1)
        writeChangelog(modelId, 'hard_deleted', 'hard deleted via admin API', { force: true })
        return { data: { model_id: modelId, delete_mode: 'hard', deleted: true } }
      } else {
        // 软删：设置 deleted_at、is_enabled=false、status=deprecated
        if (item.deleted_at) {
          // 已软删，幂等返回
          return { data: { model_id: modelId, delete_mode: 'soft', deleted: true, already_deleted: true, deleted_at: item.deleted_at } }
        }
        item.deleted_at = nowStr()
        item.is_enabled = false
        item.status = 'deprecated'
        item.updated_at = nowStr()
        writeChangelog(modelId, 'soft_deleted', 'soft deleted via admin API', {
          is_enabled: { old: item.is_enabled, new: false },
          status: { old: item.status, new: 'deprecated' }
        })
        return { data: { model_id: modelId, delete_mode: 'soft', deleted: true, already_deleted: false } }
      }
    })
  }
  return request.delete(`/api/v1/admin/models/${modelId}`, { params })
}

/**
 * 克隆模型
 * POST /api/v1/admin/models/{model_id}/clone
 * @param {string} modelId - 源模型ID
 * @param {Object} data - 克隆配置 { new_model_id, model_name?, display_name?, ... }
 */
export function cloneAdminModelApi(modelId, data) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const source = mockModels.find(m => m.model_id === modelId)
      if (!source) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      if (!data.new_model_id || data.new_model_id === modelId) {
        const err = new Error('new_model_id 不能与源 model_id 相同')
        err.code = 'INVALID_PARAM'
        err.status = 400
        throw err
      }
      const existing = mockModels.find(m => m.model_id === data.new_model_id)
      if (existing) {
        const err = new Error('目标 model_id 已存在')
        err.code = 'MODEL_EXISTS'
        err.status = 409
        throw err
      }

      const ts = nowStr()
      const cloned = {
        id: ++mockModelIdSeq,
        model_id: data.new_model_id,
        business_model_id: data.business_model_id ?? data.new_model_id.replaceAll('-', '_'),
        model_name: data.model_name ?? source.model_name,
        model_version: data.model_version ?? source.model_version,
        display_name: data.display_name ?? source.display_name,
        vendor: source.vendor,
        vendor_display_name: data.vendor_display_name ?? source.vendor_display_name,
        media_type: source.media_type,
        upstream_model_id: source.upstream_model_id,
        upstream_id_by_resolution: data.upstream_id_by_resolution ?? (source.upstream_id_by_resolution ? { ...source.upstream_id_by_resolution } : {}),
        resolution_variants: data.resolution_variants ?? (source.resolution_variants ? JSON.parse(JSON.stringify(source.resolution_variants)) : {}),
        endpoint: source.endpoint,
        endpoint_2: source.endpoint_2,
        generation_type: source.generation_type,
        supported_features: source.supported_features ? [...source.supported_features] : null,
        ui_features: source.ui_features ? [...source.ui_features] : null,
        supported_resolutions: source.supported_resolutions ? [...source.supported_resolutions] : null,
        supported_aspect_ratios: source.supported_aspect_ratios ? [...source.supported_aspect_ratios] : null,
        supported_durations: source.supported_durations ? [...source.supported_durations] : null,
        supported_sizes: source.supported_sizes ? [...source.supported_sizes] : null,
        sound_mode: source.sound_mode ?? null,
        max_width: source.max_width,
        max_height: source.max_height,
        min_width: source.min_width,
        min_height: source.min_height,
        max_duration: source.max_duration,
        max_fps: source.max_fps,
        max_reference_images: source.max_reference_images,
        max_reference_videos: source.max_reference_videos,
        max_reference_audios: source.max_reference_audios,
        requires_input: source.requires_input,
        input_materials: source.input_materials ? { ...source.input_materials } : null,
        supports_audio: source.supports_audio,
        price_per_request: data.price_per_request ?? source.price_per_request,
        price_per_second: data.price_per_second ?? source.price_per_second,
        price_multiplier: data.price_multiplier ?? source.price_multiplier,
        currency: data.currency ?? source.currency,
        price_tiers: data.price_tiers ?? (source.price_tiers ? JSON.parse(JSON.stringify(source.price_tiers)) : {}),
        availability_region: data.availability_region ?? source.availability_region,
        description: data.description ?? source.description,
        tags: data.tags ?? (source.tags ? [...source.tags] : null),
        status: 'deprecated',
        is_enabled: false,
        deleted_at: null,
        created_at: ts,
        updated_at: ts
      }

      mockModels.push(cloned)

      // 写 changelog：源模型 cloned_to，新模型 cloned_from
      writeChangelog(modelId, 'cloned_to', `cloned to '${data.new_model_id}' via admin API`, { target_model_id: data.new_model_id })
      writeChangelog(data.new_model_id, 'cloned_from', `cloned from '${modelId}' via admin API`, { source_model_id: modelId })

      return { data: { ...cloned } }
    })
  }
  return request.post(`/api/v1/admin/models/${modelId}/clone`, data)
}

/**
 * 恢复软删的模型
 * POST /api/v1/admin/models/{model_id}/restore
 * @param {string} modelId - 模型ID
 */
export function restoreAdminModelApi(modelId) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const item = mockModels.find(m => m.model_id === modelId)
      if (!item) {
        const err = new Error('模型不存在')
        err.code = 'MODEL_NOT_FOUND'
        err.status = 404
        throw err
      }
      if (!item.deleted_at) {
        const err = new Error('模型未处于软删状态，无需恢复')
        err.code = 'NOT_DELETED'
        err.status = 400
        throw err
      }
      const oldDeletedAt = item.deleted_at
      item.deleted_at = null
      item.is_enabled = true
      item.status = 'active'
      item.updated_at = nowStr()
      writeChangelog(modelId, 'restored', 'restored via admin API', { deleted_at: { old: oldDeletedAt, new: null } })
      return { data: { ...item } }
    })
  }
  return request.post(`/api/v1/admin/models/${modelId}/restore`)
}

/**
 * 从 JSON 批量灌库
 * POST /api/v1/admin/models/sync-from-json?force=false
 */
export function syncAdminModelsFromJsonApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => ({
      data: {
        summary: {
          tencent: { inserted: 0, updated: 0, skipped: 5, errors: 0 },
          token_switch: { inserted: 0, updated: 0, skipped: 3, errors: 0 }
        },
        force: params.force || false,
        items: []
      }
    }))
  }
  return request.post('/api/v1/admin/models/sync-from-json', null, { params })
}

// ==================== 常量导出 ====================
export const VENDOR_OPTIONS = [
  { value: 'vendor_a', label: '腾讯云 VOD (vendor_a)' },
  { value: 'vendor_b', label: 'Token Switch (vendor_b)' }
]

export const MEDIA_TYPE_OPTIONS = [
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' }
]

export const STATUS_OPTIONS = [
  { value: 'active', label: '正常' },
  { value: 'deprecated', label: '已弃用' },
  { value: 'unavailable', label: '不可用' }
]

export const FEATURE_OPTIONS = [
  'text_to_image', 'image_to_image',
  'text_to_video', 'image_to_video',
  'text_to_audio', 'audio_to_audio',
  'video_edit', 'image_to_3d'
]

export const RESOLUTION_OPTIONS = ['480p', '720P', '1080P', '2K', '4K']
export const ASPECT_RATIO_OPTIONS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']

export const SOUND_MODE_OPTIONS = [
  { value: 'free', label: '自由切换' },
  { value: 'forced-sound', label: '强制有声' },
  { value: 'disabled-silent', label: '强制无声' },
  { value: 'hidden', label: '隐藏开关' }
]

export const SOUND_MODE_LABELS = {
  free: '自由切换',
  'forced-sound': '强制有声',
  'disabled-silent': '强制无声',
  hidden: '隐藏'
}

export function getSoundModeLabel(mode) {
  return SOUND_MODE_LABELS[mode] || mode || '-'
}

export const FEATURE_UI_OPTIONS = [
  // 图片
  { id: 'text2img', label: '文生图', media_type: 'image' },
  { id: 'reference', label: '参考图', media_type: 'image' },
  { id: 'style-transfer', label: '风格转换', media_type: 'image' },
  { id: 'inpaint', label: '局部重绘', media_type: 'image' },
  { id: 'outpaint', label: '扩图', media_type: 'image' },
  { id: 'erase', label: '消除笔', media_type: 'image' },
  { id: 'face-swap', label: 'AI换脸', media_type: 'image' },
  { id: 'outfit-change', label: 'AI换装', media_type: 'image' },
  // 视频
  { id: 'all-reference', label: '全能参考', media_type: 'video' },
  { id: 'video-expand', label: '视频扩写', media_type: 'video' },
  { id: 'first-last-frame', label: '首尾帧', media_type: 'video' },
  { id: 'smart-multi-frame', label: '智能多帧', media_type: 'video' },
  { id: 'first-frame-gen', label: '首帧生成', media_type: 'video' },
  { id: 'motion-imitate', label: '动作模仿', media_type: 'video' },
  { id: 'lip-sync', label: '对口型', media_type: 'video' },
  { id: 'ai-outfit', label: 'AI换装', media_type: 'video' },
  { id: 'scene-replace', label: '场景替换', media_type: 'video' },
  { id: 'local-adjust', label: '局部调整', media_type: 'video' },
  { id: 'style-replace', label: '风格替换', media_type: 'video' },
  { id: 'effect-copy', label: '特效复刻', media_type: 'video' },
  { id: 'item-fix', label: '物品修复', media_type: 'video' },
  { id: 'color-restore', label: '色彩还原', media_type: 'video' },
  { id: 'smart-remove', label: '智能消除', media_type: 'video' },
  // 数字人
  { id: 'talking-head', label: '数字人播报', media_type: 'digital-human' },
  { id: 'voice-clone', label: '声音克隆', media_type: 'digital-human' },
  { id: 'emotion-control', label: '情感控制', media_type: 'digital-human' },
  { id: 'gesture-control', label: '手势控制', media_type: 'digital-human' }
]

export function getVendorLabel(v) { return VENDOR_LABELS[v] || v }
export function getMediaTypeLabel(t) { return MEDIA_TYPE_LABELS[t] || t }
export function getStatusLabel(s) { return STATUS_LABELS[s] || s }

/**
 * 获取 Mock 模型定价数据（供 estimatePriceApi 使用）
 * 返回 { [model_id]: { price_per_second, price_per_request, price_multiplier, price_tiers } }
 * 管理员改价后 mockModels 实时更新，此函数始终返回最新数据
 */
export function getMockModelPricingMap() {
  const map = {}
  for (const m of mockModels) {
    map[m.model_id] = {
      price_per_second: m.price_per_second,
      price_per_request: m.price_per_request,
      price_multiplier: m.price_multiplier,
      price_tiers: m.price_tiers
    }
    // 同时用 display_name 做别名
    if (m.display_name) {
      map[m.display_name] = {
        price_per_second: m.price_per_second,
        price_per_request: m.price_per_request,
        price_multiplier: m.price_multiplier,
        price_tiers: m.price_tiers
      }
    }
  }
  return map
}
