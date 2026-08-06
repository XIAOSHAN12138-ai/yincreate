import axios from 'axios'
import { getStorage, removeStorage } from '../utils/storage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：自动附加 token，无 token 时提前拦截
request.interceptors.request.use(
  (config) => {
    // 认证接口（登录/刷新）不需要 token，放行
    const isAuthEndpoint =
      config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh')
    const token = getStorage('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else if (!isAuthEndpoint) {
      // 未登录且非认证接口：提前 abort，避免请求出去再被后端拒
      // 已在跳登录中时 hang 住，避免 uncaught 级联
      if (isRedirecting) return hangForever()
      const err = new Error('未登录')
      err.isUnauthorized = true
      err.code = 'NO_TOKEN'
      return Promise.reject(err)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 防重入标志：确保 401 跳登录只执行一次，避免并发请求多次跳转
let isRedirecting = false

/**
 * 清除登录态并跳转登录页（防重入）。
 * @returns {boolean} true = 本次触发了跳转；false = 已有跳转在进行中
 */
function clearLoginAndRedirect() {
  if (isRedirecting) return false
  isRedirecting = true
  removeStorage('access_token')
  removeStorage('refresh_token')
  removeStorage('user')
  // 用 setTimeout 推迟跳转，让当前 Vue 更新周期完成
  setTimeout(() => {
    window.location.href = '/login'
    // 兜底：若导航因某种原因未触发页面卸载（如浏览器扩展拦截、开发期 HMR 等），
    // 2 秒后重置标志，避免后续无 token 请求被 hangForever 永久吞掉，
    // 让这些请求正常 reject（NO_TOKEN）并提示用户重新登录
    setTimeout(() => { isRedirecting = false }, 2000)
  }, 100)
  return true
}

/**
 * 返回一个永不 resolve/reject 的 pending Promise。
 * 用于跳登录期间"吞掉"后续请求，避免业务层产生 uncaught (in promise) 错误级联。
 */
function hangForever() {
  return new Promise(() => {})
}

/**
 * 从任意类型的值中安全提取错误消息，保证返回 string。
 * 兼容 message 为 string / dict / nested object / undefined / null 的情况。
 */
function safeMessage(raw, fallback) {
  // null / undefined / 其他 falsy
  if (raw == null) return fallback

  // 已经是字符串
  if (typeof raw === 'string') return raw

  // 数字等原始类型
  if (typeof raw !== 'object') return String(raw)

  // 对象类型
  // FastAPI 的 HTTPException: { detail: string | {msg, type, ...} }
  if (typeof raw.detail === 'string') return raw.detail
  if (raw.detail && typeof raw.detail === 'object') {
    return raw.detail.msg || raw.detail.message || JSON.stringify(raw.detail)
  }

  // 递归提取常见字段（确保最终返回 string）
  const candidates = [raw.msg, raw.message, raw.error, raw.detail_msg, raw.errorMessage]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
    if (c && typeof c === 'object') {
      // 嵌套一层
      const inner = c.msg || c.message || c.error || c.detail
      if (typeof inner === 'string' && inner.trim()) return inner
    }
  }

  // 最终兜底：JSON 序列化
  try { return JSON.stringify(raw) } catch { return fallback }
}

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { status, data, config } = error.response

      // 后端 500 时 body 可能是 {"error": {...}} 而非标准 {"detail": "..."}
      // 先尝试 detail，再尝试整个 data
      const rawDetail = data?.detail ?? data?.error ?? data?.message ?? data
      const isLoginRequest = config.url?.includes('/auth/login')
      const isRefreshRequest = config.url?.includes('/auth/refresh')

      // 区分"token 失效"和"业务无权限"
      // 只处理 401：token 过期/无效
      // 不处理 403：可能是业务权限、配额、路由等正常错误，不应跳登录
      if (status === 401 && !isLoginRequest && !isRefreshRequest) {
        const code = data?.code || data?.detail?.code
        const detailMsg = typeof data?.detail === 'string'
          ? data.detail
          : (data?.detail?.msg || data?.detail?.message || '')
        const isTokenInvalid = (
          // token 过期 / 无效 / 缺失
          code === 'token_expired' ||
          code === 'invalid_token' ||
          code === 'token_invalid' ||
          code === 'TOKEN_EXPIRED' ||
          code === 'INVALID_TOKEN' ||
          code === 'TOKEN_INVALID' ||
          // 英文：token expired / invalid / missing
          /token\s*(expired|invalid|missing)/i.test(detailMsg) ||
          // 中文：token已过期 / token已失效 / 令牌过期 / 已过期 / 已失效
          /(token|令牌).{0,3}(已过期|已失效|过期|失效)/i.test(detailMsg) ||
          /(已过期|已失效)/.test(detailMsg) ||
          // 未授权（且无业务 code，视为认证失败而非业务权限不足）
          /unauthorized/i.test(detailMsg) && code === undefined
        )

        if (isTokenInvalid) {
          // 后端 token 12 小时有效，过期后直接踢登录界面，不做自动续期
          if (clearLoginAndRedirect()) {
            const err = new Error('登录已过期，请重新登录')
            err.code = 'TOKEN_EXPIRED'
            err.status = status
            return Promise.reject(err)
          }
          return hangForever()
        }
        // 业务无权限 401：只把错误抛回业务层，不动 token
      } else if (status === 401 && isRefreshRequest) {
        // refresh 接口本身返回 401：refresh_token 也失效了，清登录态跳转
        if (clearLoginAndRedirect()) {
          const err = new Error('登录已过期，请重新登录')
          err.code = 'TOKEN_EXPIRED'
          err.status = status
          return Promise.reject(err)
        }
        return hangForever()
      }

      const err = new Error(safeMessage(rawDetail, `请求失败 (${status})`))
      err.code = data?.code || data?.detail?.code || 'UNKNOWN_ERROR'
      err.status = status
      err.rawData = data
      return Promise.reject(err)
    }

    // 网络错误、超时、代理失败等（无 response）
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      const err = new Error('无法连接到服务器，请检查后端服务是否已启动')
      err.code = 'NETWORK_ERROR'
      return Promise.reject(err)
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      const err = new Error('请求超时，请稍后重试')
      err.code = 'TIMEOUT_ERROR'
      return Promise.reject(err)
    }

    return Promise.reject(error)
  }
)

export default request
export { safeMessage }
