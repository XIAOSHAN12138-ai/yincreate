import request from '../utils/request'
import { getStorage } from '../utils/storage'

// 开发模式 Mock 开关：在 .env 中设置 VITE_MOCK=true 即可开启
const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

// 模拟延迟（毫秒）
const MOCK_DELAY = 800

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 从 localStorage 读取当前登录用户信息，避免 Mock 覆盖真实角色。
 * 若本地无用户信息（未登录），回退到默认 employee 数据。
 */
function getMockCurrentUser() {
  const stored = getStorage('user', null)
  if (stored && stored.user_type) {
    return {
      ...stored,
      last_login_at: stored.last_login_at || new Date().toISOString(),
      last_login_ip: stored.last_login_ip || '127.0.0.1'
    }
  }
  // 未登录时的兜底数据
  return {
    user_id: 'demo-company90010001',
    user_type: 'employee',
    name: '超级管理员',
    enterprise_id: 'demo-company',
    enterprise_name: '示例科技有限公司',
    permission_level: 9,
    email: 'admin@demo-company.com',
    last_login_at: new Date().toISOString(),
    last_login_ip: '127.0.0.1'
  }
}

// 模拟登录响应数据
function mockLoginData(params) {
  const { user_type, login_id } = params

  // 模拟账号密码错误
  if (params.password !== 'admin123' && params.password !== 'demo123' && params.password !== 'manager123' && params.password !== 'employee123') {
    const err = new Error('账号或密码错误')
    err.code = 'INVALID_CREDENTIALS'
    err.status = 401
    throw err
  }

  // 模拟账号禁用
  if (login_id === 'disabled-user') {
    const err = new Error('账号已被禁用，请联系管理员')
    err.code = 'ACCOUNT_DISABLED'
    err.status = 403
    throw err
  }

  const userMap = {
    admin: {
      user_id: 'admin-001',
      user_type: 'admin',
      name: login_id || '系统管理员',
      enterprise_id: null,
      enterprise_name: null,
      permission_level: null,
      email: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: '127.0.0.1'
    },
    enterprise: {
      user_id: login_id || 'demo-company',
      user_type: 'enterprise',
      name: login_id === 'demo-company' ? '示例科技有限公司' : login_id,
      enterprise_id: login_id || 'demo-company',
      enterprise_name: login_id === 'demo-company' ? '示例科技有限公司' : login_id,
      permission_level: null,
      email: 'admin@' + (login_id || 'example.com'),
      last_login_at: new Date().toISOString(),
      last_login_ip: '127.0.0.1'
    },
    employee: {
      user_id: login_id || 'demo-company90010001',
      user_type: 'employee',
      name: login_id?.includes('9001') ? '超级管理员' : login_id?.includes('5101') ? '部门经理' : '普通员工',
      enterprise_id: 'demo-company',
      enterprise_name: '示例科技有限公司',
      permission_level: login_id?.includes('9001') ? 9 : login_id?.includes('5101') ? 5 : 2,
      email: (login_id || 'admin') + '@demo-company.com',
      last_login_at: new Date().toISOString(),
      last_login_ip: '127.0.0.1'
    }
  }

  return {
    data: {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      token_type: 'bearer',
      expires_in: 7200,
      user: userMap[user_type] || userMap.employee
    }
  }
}

/**
 * 登录
 * @param {Object} params - { login_id, password, user_type }
 * @returns {Promise} { access_token, refresh_token, token_type, expires_in, user }
 */
export function loginApi(params) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => mockLoginData(params))
  }
  return request.post('/api/v1/auth/login', params)
}

/**
 * 获取当前用户基本信息（不查库，从JWT解析）
 * @returns {Promise}
 */
export function getMeApi() {
  if (MOCK_ENABLED) {
    return delay(300).then(() => ({
      data: getMockCurrentUser()
    }))
  }
  return request.get('/api/v1/auth/me')
}

/**
 * 获取当前用户完整信息（查库）
 * @returns {Promise}
 */
export function getMeProfileApi() {
  if (MOCK_ENABLED) {
    return delay(300).then(() => ({
      data: getMockCurrentUser()
    }))
  }
  return request.get('/api/v1/auth/me/profile')
}

/**
 * 登出
 * @returns {Promise}
 */
export function logoutApi() {
  if (MOCK_ENABLED) {
    return delay(300).then(() => ({ data: { message: 'Logged out' } }))
  }
  return request.post('/api/v1/auth/logout')
}

// Mock 模式下可识别的密码集合（与 mockLoginData 保持一致）
const MOCK_PASSWORDS = ['admin123', 'demo123', 'manager123', 'employee123']

/**
 * 修改当前登录用户密码
 * @param {Object} params - { old_password, new_password }
 * @returns {Promise} { message, user_type, target_sub, reset_at }
 */
export function changePasswordApi(params) {
  if (MOCK_ENABLED) {
    return delay(MOCK_DELAY).then(() => {
      const { old_password, new_password } = params || {}
      const currentUser = getMockCurrentUser()

      // admin 不支持
      if (currentUser.user_type === 'admin') {
        const err = new Error('系统管理员不支持通过该接口修改密码')
        err.code = 'NOT_SUPPORTED'
        err.status = 403
        throw err
      }

      // 非空校验
      if (!old_password || !new_password) {
        const err = new Error('旧密码与新密码不能为空')
        err.code = 'INVALID_INPUT'
        err.status = 400
        throw err
      }

      // 新旧密码相同
      if (old_password === new_password) {
        const err = new Error('新密码不能与旧密码相同')
        err.code = 'INVALID_INPUT'
        err.status = 400
        throw err
      }

      // 旧密码错误
      if (!MOCK_PASSWORDS.includes(old_password)) {
        const err = new Error('旧密码错误')
        err.code = 'INVALID_CREDENTIALS'
        err.status = 401
        throw err
      }

      return {
        data: {
          message: 'Password updated',
          user_type: currentUser.user_type,
          target_sub: currentUser.user_id,
          reset_at: new Date().toISOString()
        }
      }
    })
  }
  return request.post('/api/v1/auth/password', params)
}
