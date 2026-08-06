/**
 * AgentScope 多轮对话服务接口
 *
 * 对接文档：接口文档.md
 * 开发环境通过 Vite 代理 /agent → http://127.0.0.1:8000，规避 CORS
 * 关键规则：
 *   1. 首轮传 conversation_state=null、state_version=0
 *   2. 下一轮原样传回上次成功返回的 conversation_state 和 new_state_version
 *   3. SSE 只有收到 completed 才能保存新状态；error 或断流时保留旧状态
 */

const BASE_URL = (import.meta.env.VITE_AGENT_API_BASE_URL || '').replace(/\/$/, '')
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
 * 生成会话 ID（conversation-<timestamp>-<random>）
 */
export function genConversationId() {
  return `conversation-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * 获取可用 Agent
 * GET /v1/agents
 * @returns {Promise} { agents: AgentInfo[] }
 */
export async function listAgentsApi() {
  const res = await fetch(buildUrl('/v1/agents'), {
    method: 'GET',
    headers: buildHeaders()
  })
  if (!res.ok) {
    throw await toError(res)
  }
  return res.json()
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
 * POST /v1/chat/stream
 *
 * @param {Object} payload - 请求体（按文档 4.2 节字段）
 * @param {Object} handlers
 * @param {(text: string) => void} [handlers.onDelta] - 收到增量文本
 * @param {(payload: object) => void} [handlers.onCompleted] - 收到 completed，含新状态
 * @param {(err: Error) => void} [handlers.onError] - 收到 error 事件或网络错误
 * @param {AbortSignal} [handlers.signal] - 取消信号
 * @returns {Promise<void>} resolve 表示流结束（无论成功或错误，错误已通过 onError 抛出）
 */
export async function chatStreamApi(payload, handlers = {}) {
  const { onDelta, onCompleted, onError, signal } = handlers

  let res
  try {
    res = await fetch(buildUrl('/v1/chat/stream'), {
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
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 事件以空行分隔，按事件块解析
      let sepIndex
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        parseSseEvent(rawEvent, { onDelta, onCompleted, onError })
      }
    }
    // 处理尾部残留
    if (buffer.trim()) {
      parseSseEvent(buffer, { onDelta, onCompleted, onError })
    }
  } catch (e) {
    if (e.name === 'AbortError') return
    const err = new Error('连接中断，请重试')
    err.code = 'STREAM_INTERRUPTED'
    onError?.(err)
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
  const lines = rawEvent.split('\n')
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
