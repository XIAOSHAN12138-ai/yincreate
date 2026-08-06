import request from '../utils/request'
import { getStorage } from '../utils/storage'

// 开发模式 Mock 开关
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

// Mock 延迟
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ====== Mock 数据存储（内存，刷新后丢失）======
let mockConversations = []
let mockMessages = {}
let convIdCounter = 1000
let msgIdCounter = 5000

/**
 * 生成 CONV-xxx 格式的对话 ID
 */
function genConvId() {
  convIdCounter++
  return 'CONV-' + Math.random().toString(16).slice(2, 10)
}

/**
 * 生成 MSG-xxx 格式的消息 ID
 */
function genMsgId() {
  msgIdCounter++
  return 'MSG-' + Math.random().toString(16).slice(2, 8)
}

/**
 * 获取当前登录用户信息（与 auth.js 的 getMockCurrentUser 一致）
 */
function getMockUser() {
  const stored = getStorage('user', null)
  if (stored && stored.user_type) return stored
  return { user_id: 'demo-company', user_type: 'enterprise', name: '示例科技', enterprise_id: 'demo-company' }
}

// ====== Mock 端点实现 ======

function mockCreateConversation(params) {
  const user = getMockUser()
  // admin 不允许创建
  if (user.user_type === 'admin') {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }

  const now = new Date().toISOString()
  const id = genConvId()
  const conv = {
    id: convIdCounter,
    conversation_id: id,
    project_id: null,
    user_type: user.user_type,
    user_id: user.user_id,
    user_name: user.name || '',
    enterprise_id: user.enterprise_id || null,
    title: params.title || '未命名对话',
    message_count: 0,
    generation_count: 0,
    total_quota_used: 0,
    status: 'active',
    last_message_at: null,
    created_at: now,
    updated_at: now
  }
  mockConversations.unshift(conv)
  mockMessages[id] = []
  return { data: conv, status: 201 }
}

function mockListConversations(params) {
  const limit = Math.min(Math.max(params?.limit || 50, 1), 200)
  const offset = params?.offset || 0

  // 排序：last_message_at DESC NULLS LAST → created_at DESC
  const sorted = [...mockConversations].sort((a, b) => {
    if (a.last_message_at && !b.last_message_at) return -1
    if (!a.last_message_at && b.last_message_at) return 1
    if (a.last_message_at && b.last_message_at) return new Date(b.last_message_at) - new Date(a.last_message_at)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const items = sorted.slice(offset, offset + limit)
  return { data: { total: items.length, items } }
}

function mockGetConversation(conversationId) {
  const conv = mockConversations.find(c =>
    c.conversation_id === conversationId || String(c.id) === String(conversationId)
  )
  if (!conv) {
    const err = new Error('NOT_FOUND')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }
  return { data: conv }
}

function mockUpdateConversation(conversationId, params) {
  const user = getMockUser()
  if (user.user_type === 'admin') {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }

  const conv = mockConversations.find(c =>
    c.conversation_id === conversationId || String(c.id) === String(conversationId)
  )
  if (!conv) {
    const err = new Error('NOT_FOUND')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }
  if (conv.user_id !== user.user_id) {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }
  if (!params.title && !params.status) {
    const err = new Error('VALIDATION_ERROR')
    err.status = 422
    throw err
  }
  if (params.title) conv.title = params.title
  if (params.status === 'archived') conv.status = 'archived'
  conv.updated_at = new Date().toISOString()
  return { data: conv }
}

function mockPostMessage(conversationId, params) {
  const user = getMockUser()
  const conv = mockConversations.find(c =>
    c.conversation_id === conversationId || String(c.id) === String(conversationId)
  )
  if (!conv) {
    const err = new Error('NOT_FOUND')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }
  if (conv.user_id !== user.user_id) {
    const err = new Error('FORBIDDEN')
    err.code = 'FORBIDDEN'
    err.status = 403
    throw err
  }
  if (!params.content) {
    const err = new Error('VALIDATION_ERROR')
    err.status = 422
    throw err
  }

  const now = new Date().toISOString()
  const msg = {
    id: msgIdCounter,
    message_id: genMsgId(),
    conversation_id: conv.conversation_id,
    role: params.role || 'user',
    content: params.content,
    generation_task_id: null,
    result_task_id: null,
    result_video_url: null,
    result_thumbnail_url: null,
    created_at: now,
    updated_at: now,
    deleted_at: null
  }

  if (!mockMessages[conv.conversation_id]) mockMessages[conv.conversation_id] = []
  mockMessages[conv.conversation_id].push(msg)

  // 触发器效果：更新对话统计
  conv.message_count++
  conv.last_message_at = now
  conv.updated_at = now

  return { data: msg, status: 201 }
}

function mockListMessages(conversationId, queryParams) {
  const conv = mockConversations.find(c =>
    c.conversation_id === conversationId || String(c.id) === String(conversationId)
  )
  if (!conv) {
    const err = new Error('NOT_FOUND')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }

  const limit = Math.min(Math.max(queryParams?.limit || 200, 1), 500)
  const offset = queryParams?.offset || 0
  const allMsgs = (mockMessages[conv.conversation_id] || [])
    .filter(m => !m.deleted_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const items = allMsgs.slice(offset, offset + limit).map(m => ({
    message_id: m.message_id,
    role: m.role,
    content: m.content,
    generation_task_id: m.generation_task_id,
    result_task_id: m.result_task_id,
    result_video_url: m.result_video_url,
    result_thumbnail_url: m.result_thumbnail_url,
    created_at: m.created_at
  }))

  return { data: { total: allMsgs.length, items } }
}

/**
 * 流式消息 Mock：返回精简的 MessageStreamItem 字段（含 model_name/feature/ratio/quality）
 * 排序 DESC，3 条/批
 */
function mockStreamMessages(conversationId, queryParams) {
  const conv = mockConversations.find(c =>
    c.conversation_id === conversationId || String(c.id) === String(conversationId)
  )
  if (!conv) {
    const err = new Error('NOT_FOUND')
    err.code = 'NOT_FOUND'
    err.status = 404
    throw err
  }

  const requestedLimit = queryParams?.limit ?? 3
  const batchSize = 3
  const offset = queryParams?.offset || 0
  const allMsgs = (mockMessages[conv.conversation_id] || [])
    .filter(m => !m.deleted_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // DESC

  const totalAvailable = allMsgs.length
  const targetTotal = requestedLimit === 0 ? totalAvailable : requestedLimit
  const capped = requestedLimit === 0 && totalAvailable > 500
  const itemsToSlice = capped ? 500 : Math.min(targetTotal, totalAvailable)
  const items = allMsgs.slice(offset, offset + Math.min(batchSize, itemsToSlice - offset)).map(m => {
    const isUser = m.role === 'user'
    const isAssistant = m.role === 'assistant'
    return {
      id: m.id,
      message_id: m.message_id,
      role: m.role,
      content: m.content || '',
      generation_task_id: m.generation_task_id || null,
      result_task_id: m.result_task_id || null,
      created_at: m.created_at || null,
      duration: m.duration || null,
      output_type: m.output_type || null,
      uploaded_image_url: isUser ? (m.attachments?.[0]?.url || null) : null,
      attachments: isUser ? (m.attachments || null) : null,
      model_name: m.model_name || null,
      feature: m.feature || null,
      ratio: m.ratio || null,
      quality: m.quality || null,
      result_url: isAssistant ? (m.result_video_url || null) : null,
      result_thumbnail_url: isAssistant ? (m.result_thumbnail_url || null) : null
    }
  })

  return {
    data: {
      items,
      offset,
      next_offset: offset + items.length,
      batch_size: batchSize,
      returned: items.length,
      requested_total: requestedLimit === 0 ? null : requestedLimit,
      total_available: totalAvailable,
      has_more: offset + items.length < itemsToSlice,
      capped
    }
  }
}

// ====== 导出的 API 函数 ======

/**
 * 创建对话
 * POST /api/v1/conversations
 * @param {Object} params - { title?: string }
 * @returns {Promise} ConversationResponse
 */
export function createConversationApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(300).then(() => mockCreateConversation(params))
  }
  return request.post('/api/v1/conversations', params)
}

/**
 * 列出我可见的对话
 * GET /api/v1/conversations
 * @param {Object} params - { limit?: number, offset?: number }
 * @returns {Promise} { total, items: ConversationResponse[] }
 */
export function listConversationsApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockListConversations(params))
  }
  return request.get('/api/v1/conversations', { params })
}

/**
 * 流式首屏加载对话列表（精简字段，5 条/批）
 * GET /api/v1/conversations/stream
 * @param {Object} params - { limit?: number, offset?: number }
 * @returns {Promise} ConversationStreamResponse
 *   { items: ConversationListItem[], offset, next_offset, batch_size, returned,
 *     requested_total, total_available, has_more, capped }
 */
export function streamConversationsApi(params = {}) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockListConversations(params))
  }
  return request.get('/api/v1/conversations/stream', { params })
}

/**
 * 获取对话详情
 * GET /api/v1/conversations/{id}
 * @param {string} conversationId
 * @returns {Promise} ConversationResponse
 */
export function getConversationApi(conversationId) {
  if (MOCK_ENABLED) {
    return delay(150).then(() => mockGetConversation(conversationId))
  }
  return request.get(`/api/v1/conversations/${conversationId}`)
}

/**
 * 修改对话（重命名 / 归档）
 * PATCH /api/v1/conversations/{id}
 * @param {string} conversationId
 * @param {Object} params - { title?: string, status?: 'active'|'archived' }
 * @returns {Promise} ConversationResponse
 */
export function updateConversationApi(conversationId, params) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockUpdateConversation(conversationId, params))
  }
  return request.patch(`/api/v1/conversations/${conversationId}`, params)
}

/**
 * 获取对话消息列表
 * GET /api/v1/conversations/{id}/messages
 * @param {string} conversationId
 * @param {Object} params - { limit?: number, offset?: number }
 * @returns {Promise} { total, items: MessageResponse[] }
 */
export function listMessagesApi(conversationId, params = {}) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockListMessages(conversationId, params))
  }
  return request.get(`/api/v1/conversations/${conversationId}/messages`, { params })
}

/**
 * 流式加载对话消息（精简字段，3 条/批，DESC 排序）
 * GET /api/v1/conversations/{id}/messages/stream
 * @param {string} conversationId
 * @param {Object} params - { limit?: number, offset?: number }
 * @returns {Promise} MessageStreamResponse
 *   { items: MessageStreamItem[], offset, next_offset, batch_size, returned,
 *     requested_total, total_available, has_more, capped }
 * 排序：created_at DESC, id DESC。前端需 reverse(items) 后渲染。
 */
export function streamMessagesApi(conversationId, params = {}) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockStreamMessages(conversationId, params))
  }
  return request.get(`/api/v1/conversations/${conversationId}/messages/stream`, { params })
}

/**
 * 追加一条文本消息
 * POST /api/v1/conversations/{id}/messages
 * @param {string} conversationId
 * @param {Object} params - { content: string, role?: 'user'|'assistant'|'system' }
 * @returns {Promise} MessageResponse
 */
export function postMessageApi(conversationId, params) {
  if (MOCK_ENABLED) {
    return delay(200).then(() => mockPostMessage(conversationId, params))
  }
  return request.post(`/api/v1/conversations/${conversationId}/messages`, params)
}
