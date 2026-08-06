import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getStorage, setStorage, removeStorage, setStorageWithExpiry, getStorageWithExpiry } from '../utils/storage'
import { loginApi, getMeProfileApi, logoutApi } from '../api/auth'
import { getPointsApi } from '../api/profile'

// 登录有效期：7天（毫秒）
const LOGIN_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000

export const useUserStore = defineStore('user', () => {
  const user = ref(getStorage('user', null))
  const accessToken = ref(getStorage('access_token', null))
  const refreshToken = ref(getStorage('refresh_token', null))
  // 过期标记：响应式 ref，登录/登出时同步更新
  const loginExpired = ref(!getStorageWithExpiry('loginTime'))

  // 积分状态
  const userPoints = ref(null)
  const remainingPoints = computed(() => {
    if (!userPoints.value) return '--'
    // 后端 billing/quota 直接返回 remaining 字段，优先使用
    if (userPoints.value.remaining !== undefined && userPoints.value.remaining !== null) {
      return userPoints.value.remaining
    }
    return userPoints.value.total_points - userPoints.value.used_points
  })

  // 首次加载时如果已过期，清除所有状态
  if (loginExpired.value && (accessToken.value || user.value)) {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    removeStorage('user')
    removeStorage('access_token')
    removeStorage('refresh_token')
  }

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value && !loginExpired.value)

  function setTokens(access, refresh) {
    accessToken.value = access
    setStorage('access_token', access)
    if (refresh) {
      refreshToken.value = refresh
      setStorage('refresh_token', refresh)
    }
  }

  function setUser(userData) {
    user.value = userData
    setStorage('user', userData)
  }

  function updateUser(updates) {
    user.value = { ...user.value, ...updates }
    setStorage('user', user.value)
  }

  /**
   * 登录
   * @param {Object} params - { login_id, password, user_type }
   */
  async function login(params) {
    const res = await loginApi(params)
    const { access_token, refresh_token, user: userInfo } = res.data
    setTokens(access_token, refresh_token)
    setUser(userInfo)
    // 记录登录时间，7天后过期
    setStorageWithExpiry('loginTime', Date.now(), LOGIN_EXPIRE_MS)
    loginExpired.value = false
    return userInfo
  }

  /**
   * 获取完整用户信息
   */
  async function fetchProfile() {
    const res = await getMeProfileApi()
    setUser(res.data)
    return res.data
  }

  /**
   * 登出
   */
  async function logout() {
    try {
      await logoutApi()
    } catch {
      // 即使接口失败也要清除本地状态
    }
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    loginExpired.value = true
    removeStorage('user')
    removeStorage('access_token')
    removeStorage('refresh_token')
    removeStorage('loginTime')
  }

  /**
   * 获取积分信息
   * - 最佳努力调用：失败不应阻塞页面，调用方无需 .catch()
   * - 无 enterprise_id 的用户（如 admin）跳过调用，避免 403
   * @returns {Promise<Object|null>} 成功返回积分数据，失败或跳过返回 null
   */
  async function fetchPoints() {
    // 仅有企业/员工身份才查询企业配额
    if (!user.value?.enterprise_id) {
      return null
    }
    try {
      const res = await getPointsApi()
      userPoints.value = res.data
      return res.data
    } catch (e) {
      console.warn('获取积分信息失败:', e)
      // 不 re-throw：积分展示是辅助信息，失败不应阻塞业务流
      return null
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoggedIn,
    userPoints,
    remainingPoints,
    setTokens,
    setUser,
    updateUser,
    login,
    fetchProfile,
    fetchPoints,
    logout
  }
})
