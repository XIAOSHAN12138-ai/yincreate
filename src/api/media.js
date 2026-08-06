import request from '../utils/request'

// 开发模式 Mock 开关
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== 文件上传接口（不入库） ====================

/**
 * base64 上传
 * POST /api/v1/upload/base64
 * @param {Object} data - { data: string, media_type: 'image'|'video'|'audio', upload_to_vod?: boolean }
 * @returns {Promise} { data: { url, file_info: { is_valid, size_mb, format, mime_type, width, height, duration } } }
 */
export function uploadBase64Api(data) {
  if (MOCK_ENABLED) {
    return delay(600).then(() => ({
      data: {
        url: 'https://1500066181.vod-qcloud.com/mock/' + Date.now() + '.png',
        file_info: {
          is_valid: true,
          size_mb: 1.23,
          format: 'png',
          mime_type: 'image/png',
          width: 1920,
          height: 1080,
          duration: null
        }
      }
    }))
  }
  return request.post('/api/v1/upload/base64', data)
}

/**
 * multipart 文件上传
 * POST /api/v1/upload/file
 * @param {File} file - 文件对象
 * @param {boolean} uploadToVod - 是否上传到 VOD，默认 true
 * @param {Function} onProgress - 上传进度回调 (progressEvent) => void
 * @returns {Promise} { data: { url, filename, size_mb } }
 */
export function uploadFileApi(file, uploadToVod = true, onProgress) {
  if (MOCK_ENABLED) {
    return delay(800).then(() => ({
      data: {
        url: 'https://1500066181.vod-qcloud.com/mock/' + Date.now() + '/' + file.name,
        filename: file.name,
        size_mb: parseFloat((file.size / 1024 / 1024).toFixed(2))
      }
    }))
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_to_vod', uploadToVod)
  return request.post('/api/v1/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: onProgress
  })
}

/**
 * 获取上传配置（支持的格式 + 大小限制）
 * GET /api/v1/upload/info
 * @returns {Promise} { data: { max_file_size_mb, supported_formats, upload_methods } }
 */
export function getUploadInfoApi() {
  if (MOCK_ENABLED) {
    return delay(300).then(() => ({
      data: {
        max_file_size_mb: 50,
        supported_formats: {
          image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          video: ['mp4', 'webm', 'avi', 'mov'],
          audio: ['mp3', 'wav', 'ogg', 'm4a']
        },
        upload_methods: [
          { method: 'base64', endpoint: '/api/v1/upload/base64' },
          { method: 'file', endpoint: '/api/v1/upload/file' }
        ]
      }
    }))
  }
  return request.get('/api/v1/upload/info')
}

// ==================== 素材 CRUD ====================

/**
 * 创建素材（入库）
 * POST /api/v1/media
 * @param {Object} data - 素材数据 { media_type, media_name, media_url, thumbnail_url?, file_size?, duration?, width?, height?, format?, mime_type?, category?, tags?, description?, ... }
 * @returns {Promise} { data: MediaItem }
 */
export function createMediaApi(data) {
  if (MOCK_ENABLED) {
    return delay(600).then(() => ({
      data: {
        id: Math.floor(Math.random() * 10000),
        media_id: 'MEDIA-' + Date.now().toString(36).toUpperCase(),
        media_type: data.media_type,
        media_source: data.media_source || 'uploaded',
        media_name: data.media_name,
        media_url: data.media_url,
        thumbnail_url: data.thumbnail_url || null,
        file_size: data.file_size || null,
        duration: data.duration || null,
        width: data.width || null,
        height: data.height || null,
        format: data.format || null,
        mime_type: data.mime_type || null,
        category: data.category || null,
        tags: data.tags || [],
        description: data.description || null,
        view_count: 0,
        download_count: 0,
        use_count: 0,
        status: 'normal',
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      }
    }))
  }
  return request.post('/api/v1/media', data)
}

/**
 * 素材通用列表
 * GET /api/v1/media
 * @param {Object} params - { media_type?, media_source?, creator_type?, category?, keyword?, limit?, offset? }
 * @returns {Promise} { data: { total, items: [] } }
 */
export function getMediaListApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { total: 0, items: [] } }))
  }
  return request.get('/api/v1/media', { params })
}

/**
 * 按来源分组列表
 * GET /api/v1/media/by-source/{media_source}
 * @param {string} mediaSource - 'generated' | 'uploaded'
 * @param {Object} params - { media_type?, creator_type?, category?, keyword?, limit?, offset? }
 * @returns {Promise} { data: { total, items: [] } }
 */
export function getMediaBySourceApi(mediaSource, params = {}) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { total: 0, items: [] } }))
  }
  return request.get(`/api/v1/media/by-source/${mediaSource}`, { params })
}

/**
 * 按类型分组列表
 * GET /api/v1/media/by-type/{media_type}
 * @param {string} mediaType - 'image' | 'video' | 'audio'
 * @param {Object} params - { media_source?, creator_type?, category?, keyword?, limit?, offset? }
 * @returns {Promise} { data: { total, items: [] } }
 */
export function getMediaByTypeApi(mediaType, params = {}) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { total: 0, items: [] } }))
  }
  return request.get(`/api/v1/media/by-type/${mediaType}`, { params })
}

/**
 * 回收站列表
 * GET /api/v1/media/recycle-bin
 * @param {Object} params - { limit?, offset? }
 * @returns {Promise} { data: { total, items: [] } }
 */
export function getRecycleBinApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { total: 0, items: [] } }))
  }
  return request.get('/api/v1/media/recycle-bin', { params })
}

// ==================== 流式首屏加载（/stream 端点） ====================
// 后端固定每批 5 条，前端通过 offset 续拉实现首屏快速渲染。
// 响应结构 MediaStreamResponse：{ items, offset, next_offset, batch_size, returned,
//   requested_total, total_available, has_more, capped }

/**
 * 通用流式加载
 * GET /api/v1/media/stream
 * @param {Object} params - { limit?, offset?, media_type?, media_source?, creator_type?, category?, keyword? }
 * @returns {Promise} { data: MediaStreamResponse }
 */
export function getMediaStreamApi(params = {}) {
  return request.get('/api/v1/media/stream', { params })
}

/**
 * 按来源流式加载
 * GET /api/v1/media/by-source/{media_source}/stream
 * @param {string} mediaSource - 'generated' | 'uploaded'
 * @param {Object} params - { limit?, offset?, media_type?, creator_type?, category?, keyword? }
 * @returns {Promise} { data: MediaStreamResponse }
 */
export function getMediaBySourceStreamApi(mediaSource, params = {}) {
  return request.get(`/api/v1/media/by-source/${mediaSource}/stream`, { params })
}

/**
 * 按类型流式加载
 * GET /api/v1/media/by-type/{media_type}/stream
 * @param {string} mediaType - 'image' | 'video' | 'audio'
 * @param {Object} params - { limit?, offset?, media_source?, creator_type?, category?, keyword? }
 * @returns {Promise} { data: MediaStreamResponse }
 */
export function getMediaByTypeStreamApi(mediaType, params = {}) {
  return request.get(`/api/v1/media/by-type/${mediaType}/stream`, { params })
}

/**
 * 回收站流式加载
 * GET /api/v1/media/recycle-bin/stream
 * @param {Object} params - { limit?, offset? }
 * @returns {Promise} { data: MediaStreamResponse }
 */
export function getRecycleBinStreamApi(params = {}) {
  return request.get('/api/v1/media/recycle-bin/stream', { params })
}

/**
 * 素材详情
 * GET /api/v1/media/{media_id}
 * @param {string} mediaId
 * @returns {Promise} { data: MediaItem }
 */
export function getMediaDetailApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(400).then(() => ({ data: {} }))
  }
  return request.get(`/api/v1/media/${mediaId}`)
}

/**
 * 修改素材
 * PATCH /api/v1/media/{media_id}
 * @param {string} mediaId
 * @param {Object} data - { media_name?, description?, category?, tags?, thumbnail_url? }
 * @returns {Promise} { data: MediaItem }
 */
export function updateMediaApi(mediaId, data) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { media_id: mediaId, ...data } }))
  }
  return request.patch(`/api/v1/media/${mediaId}`, data)
}

/**
 * 软删素材（移入回收站）
 * DELETE /api/v1/media/{media_id}
 * @param {string} mediaId
 * @param {Object} data - { reason?: string }
 * @returns {Promise} { data: { message: string } }
 */
export function deleteMediaApi(mediaId, data) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { message: '删除成功' } }))
  }
  return request.delete(`/api/v1/media/${mediaId}`, { data })
}

/**
 * 从回收站恢复
 * POST /api/v1/media/{media_id}/restore
 * @param {string} mediaId
 * @returns {Promise} { data: { message: string } }
 */
export function restoreMediaApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { message: '恢复成功' } }))
  }
  return request.post(`/api/v1/media/${mediaId}/restore`)
}

/**
 * 立即永久删除（仅系统管理员）
 * POST /api/v1/media/{media_id}/purge
 * @param {string} mediaId
 * @returns {Promise} { data: { media_id, purged: true } }
 */
export function purgeMediaApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(500).then(() => ({ data: { media_id: mediaId, purged: true } }))
  }
  return request.post(`/api/v1/media/${mediaId}/purge`)
}

// ==================== 统计上报 ====================

/**
 * 上报浏览
 * POST /api/v1/media/{media_id}/view
 * @param {string} mediaId
 * @returns {Promise} { data: { media_id, view_count, download_count, use_count } }
 */
export function reportMediaViewApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => ({ data: { media_id: mediaId, view_count: 1, download_count: 0, use_count: 0 } }))
  }
  return request.post(`/api/v1/media/${mediaId}/view`)
}

/**
 * 上报下载
 * POST /api/v1/media/{media_id}/download
 * @param {string} mediaId
 * @returns {Promise} { data: { media_id, view_count, download_count, use_count } }
 */
export function reportMediaDownloadApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => ({ data: { media_id: mediaId, view_count: 0, download_count: 1, use_count: 0 } }))
  }
  return request.post(`/api/v1/media/${mediaId}/download`)
}

/**
 * 上报使用
 * POST /api/v1/media/{media_id}/use
 * @param {string} mediaId
 * @returns {Promise} { data: { media_id, view_count, download_count, use_count } }
 */
export function reportMediaUseApi(mediaId) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => ({ data: { media_id: mediaId, view_count: 0, download_count: 0, use_count: 1 } }))
  }
  return request.post(`/api/v1/media/${mediaId}/use`)
}

// ==================== 工具函数 ====================

/**
 * 根据文件对象推断 media_type
 * @param {File} file
 * @returns {'image'|'video'|'audio'}
 */
export function detectMediaType(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  // 兜底：按扩展名判断
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  const videoExts = ['mp4', 'webm', 'avi', 'mov']
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a']
  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  return 'image'
}

/**
 * 从文件名提取格式（扩展名，小写）
 * @param {File} file
 * @returns {string}
 */
export function detectFormat(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  return ext || ''
}
