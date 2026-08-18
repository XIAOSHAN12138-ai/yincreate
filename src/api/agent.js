/**
 * AgentScope 多轮对话服务接口
 *
 * 对接文档：接口文档.md
 * 开发环境通过 Vite 代理 /agent → http://127.0.0.1:8000，规避 CORS。
 * 使用平台模式 /api/*，会话状态与消息由服务端持久化。
 */

const BASE_URL = (import.meta.env.VITE_AGENT_API_BASE_URL || '/agent').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_AGENT_API_KEY || ''

/**
 * 拼接智能体服务完整 URL
 */
function buildUrl(path) {
  return `${BASE_URL}${path}`
}

/**
 * 生成请求 ID（req-<timestamp>-<random>）
 */
export function genRequestId() {
  return `req-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * 获取可用 Agent
 * GET /api/agents
 * @returns {Promise} { agents: AgentInfo[] }
 */
export async function listAgentsApi() {
  const res = await fetch(buildUrl('/api/agents'), {
    method: 'GET',
    headers: buildHeaders()
  })
  if (!res.ok) {
    throw await toError(res)
  }
  return res.json()
}

async function requestJson(path, options = {}) {
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: buildHeaders(options.headers)
  })
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return null
  return res.json()
}

export function createAgentConversationApi(payload) {
  return requestJson('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function listAgentConversationsApi(params) {
  const query = new URLSearchParams(params).toString()
  return requestJson(`/api/conversations?${query}`)
}

export function getAgentConversationApi(conversationId, params) {
  const query = new URLSearchParams(params).toString()
  return requestJson(`/api/conversations/${encodeURIComponent(conversationId)}?${query}`)
}

export function deleteAgentConversationApi(conversationId, params) {
  const query = new URLSearchParams(params).toString()
  return requestJson(`/api/conversations/${encodeURIComponent(conversationId)}?${query}`, {
    method: 'DELETE'
  })
}

/**
 * 构建请求头
 */
function buildHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra
  }
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`
  }
  return headers
}

/**
 * 将响应体转换为标准 Error
 */
async function toError(res) {
  let code = 'UNKNOWN_ERROR'
  let message = `请求失败 (${res.status})`
  try {
    const data = await res.json()
    if (data?.error?.code) code = data.error.code
    if (data?.error?.message) message = data.error.message
  } catch {
    // body 不是 JSON
  }
  const err = new Error(message)
  err.code = code
  err.status = res.status
  return err
}

/**
 * SSE 流式聊天
 * POST /api/conversations/{id}/chat/stream
 *
 * @param {string} conversationId - 服务端会话 ID
 * @param {Object} payload - 平台模式聊天请求体
 * @param {Object} handlers
 * @param {(text: string) => void} [handlers.onDelta] - 收到增量文本
 * @param {(payload: object) => void} [handlers.onCompleted] - 收到 completed，含新状态
 * @param {(err: Error) => void} [handlers.onError] - 收到 error 事件或网络错误
 * @param {AbortSignal} [handlers.signal] - 取消信号
 * @returns {Promise<void>} resolve 表示流结束（无论成功或错误，错误已通过 onError 抛出）
 */
export async function chatStreamApi(conversationId, payload, handlers = {}) {
  const { onDelta, onCompleted, onError, signal } = handlers

  let res
  try {
    res = await fetch(buildUrl(`/api/conversations/${encodeURIComponent(conversationId)}/chat/stream`), {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal
    })
  } catch (e) {
    if (e.name === 'AbortError') return
    const err = new Error('无法连接到智能体服务，请检查服务是否已启动')
    err.code = 'NETWORK_ERROR'
    onError?.(err)
    return
  }

  if (!res.ok) {
    const err = await toError(res)
    onError?.(err)
    return
  }

  // 手动解析 SSE 流
  if (!res.body) {
    const err = new Error('智能体服务未返回可读取的数据流')
    err.code = 'EMPTY_STREAM'
    onError?.(err)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let terminalReceived = false
  const callbacks = {
    onDelta,
    onCompleted: (data) => {
      terminalReceived = true
      onCompleted?.(data)
    },
    onError: (err) => {
      terminalReceived = true
      onError?.(err)
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 事件以空行分隔，按事件块解析
      let separator
      while ((separator = buffer.match(/\r?\n\r?\n/))) {
        const rawEvent = buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator[0].length)
        parseSseEvent(rawEvent, callbacks)
      }
    }
    buffer += decoder.decode()
    // 处理尾部残留
    if (buffer.trim()) {
      parseSseEvent(buffer, callbacks)
    }
    if (!terminalReceived) {
      const err = new Error('连接提前结束，请重试')
      err.code = 'STREAM_INTERRUPTED'
      callbacks.onError(err)
    }
  } catch (e) {
    if (e.name === 'AbortError') return
    const err = new Error('连接中断，请重试')
    err.code = 'STREAM_INTERRUPTED'
    callbacks.onError(err)
  } finally {
    try { reader.releaseLock() } catch { /* noop */ }
  }
}

/**
 * 解析单个 SSE 事件块
 *
 * 事件格式：
 *   event: <name>
 *   data: <json>
 *
 * 多行 data 以 \n 拼接
 */
function parseSseEvent(rawEvent, { onDelta, onCompleted, onError }) {
  if (!rawEvent) return
  const lines = rawEvent.split(/\r?\n/)
  let eventName = 'message'
  const dataLines = []

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return
  const dataStr = dataLines.join('\n')

  let data
  try {
    data = JSON.parse(dataStr)
  } catch {
    // 非 JSON 数据，忽略
    return
  }

  switch (eventName) {
    case 'delta':
      if (typeof data.delta === 'string') {
        onDelta?.(data.delta)
      }
      break
    case 'completed':
      onCompleted?.(data)
      break
    case 'error':
      onError?.(buildSseError(data))
      break
    // started / 其他事件：忽略
    default:
      break
  }
}

function buildSseError(data) {
  const errInfo = data?.error || {}
  const err = new Error(errInfo.message || '智能体服务返回错误')
  err.code = errInfo.code || 'SSE_ERROR'
  err.details = errInfo.details
  err.request_id = data?.request_id
  return err
}
