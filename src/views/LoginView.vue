<template>
  <!-- 登录页面主容器 -->
  <div class="login-page">
    <!-- 左侧品牌展示区域 -->
    <div class="login-brand">
      <div class="brand-bg-orb orb-1"></div>
      <div class="brand-bg-orb orb-2"></div>
      <div class="brand-bg-orb orb-3"></div>

      <div class="brand-content">
        <div class="brand-logo">
          <div class="logo-icon-large">
            <i data-lucide="play" style="width: 28px; height: 28px;"></i>
          </div>
          <span class="logo-text-large">影创studio</span>
        </div>
        <h1 class="brand-tagline">
          用 AI 释放<br><span class="accent">创意无限</span>
        </h1>
        <p class="brand-desc">
          从灵感到成片，AI让视频创作更简单高效
        </p>
        <div class="brand-features">
          <div class="feature-item">
            <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
            <span>AI智能生成</span>
          </div>
          <div class="feature-item">
            <i data-lucide="zap" style="width: 16px; height: 16px;"></i>
            <span>极速渲染</span>
          </div>
          <div class="feature-item">
            <i data-lucide="shield" style="width: 16px; height: 16px;"></i>
            <span>安全可靠</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录表单区域 -->
    <div class="login-form-container">
      <form class="login-form" @submit.prevent="handleLogin">
        <h2 class="form-title">欢迎回来</h2>
        <p class="form-subtitle">登录以继续使用</p>

        <!-- 用户类型选择 -->
        <div class="form-group">
          <label class="form-label">登录身份</label>
          <div class="user-type-tabs">
            <button
              type="button"
              :class="['user-type-tab', { active: userType === 'employee' }]"
              @click="userType = 'employee'"
            >员工</button>
            <button
              type="button"
              :class="['user-type-tab', { active: userType === 'enterprise' }]"
              @click="userType = 'enterprise'"
            >企业</button>
            <button
              type="button"
              :class="['user-type-tab', { active: userType === 'admin' }]"
              @click="userType = 'admin'"
            >系统管理员</button>
          </div>
        </div>

          <div class="form-group">
            <label class="form-label">{{ loginIdLabel }}</label>
            <input
              v-model="loginId"
              type="text"
              class="form-input"
              :placeholder="loginIdPlaceholder"
              :class="{ error: errors.loginId }"
            >
            <span v-if="errors.loginId" class="error-message">{{ errors.loginId }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">密码</label>
            <div class="password-input-wrapper">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="请输入密码"
                :class="{ error: errors.password }"
              >
              <button
                type="button"
                class="password-toggle"
                @click="showPassword = !showPassword"
              >
                <i :data-lucide="showPassword ? 'eye-off' : 'eye'" style="width: 18px; height: 18px;"></i>
              </button>
            </div>
            <span v-if="errors.password" class="error-message">{{ errors.password }}</span>
          </div>

        <!-- 记住我 & 忘记密码 -->
        <div class="form-options">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe">
            <span>记住我</span>
          </label>
          <a href="#" class="forgot-password">忘记密码？</a>
        </div>

        <!-- 登录按钮 -->
        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登录' }}
        </button>

        <!-- 登录错误提示 -->
        <div v-if="loginError" class="login-error">{{ loginError }}</div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginId = ref('')
const password = ref('')
const userType = ref('employee')
const showPassword = ref(false)
const rememberMe = ref(false)
const isLoading = ref(false)
const loginError = ref('')

const errors = reactive({})

const loginIdLabel = computed(() => {
  if (userType.value === 'admin') return '管理员名称'
  if (userType.value === 'enterprise') return '企业ID'
  return '账号ID / 邮箱'
})

const loginIdPlaceholder = computed(() => {
  if (userType.value === 'admin') return '请输入管理员名称'
  if (userType.value === 'enterprise') return '请输入企业ID'
  return '请输入账号ID或邮箱'
})

function getDefaultRouteByRole(type) {
  if (type === 'admin') return '/admin'
  if (type === 'enterprise') return '/enterprise/bi'
  return '/'
}

function validate() {
  Object.keys(errors).forEach(key => delete errors[key])
  loginError.value = ''

  if (!loginId.value.trim()) errors.loginId = '请输入登录账号'
  if (!password.value.trim()) errors.password = '请输入密码'

  return Object.keys(errors).length === 0
}

async function handleLogin() {
  if (!validate()) return

  isLoading.value = true
  loginError.value = ''

  try {
    await userStore.login({
      login_id: loginId.value.trim(),
      password: password.value,
      user_type: userType.value
    })

    // 登录成功，按角色跳转到对应页面（优先使用 redirect 参数）
    const redirect = route.query.redirect || getDefaultRouteByRole(userType.value)
    router.push(redirect)
  } catch (error) {
    // 根据错误码显示中文提示
    const code = error.code || ''
    if (code === 'NETWORK_ERROR') {
      loginError.value = '无法连接到服务器，请检查后端服务是否已启动'
    } else if (code === 'INVALID_CREDENTIALS') {
      loginError.value = '账号或密码错误'
    } else if (code === 'ACCOUNT_DISABLED') {
      loginError.value = '账号已被禁用，请联系管理员'
    } else if (code === 'INVALID_USER_TYPE') {
      loginError.value = '登录身份类型无效'
    } else {
      loginError.value = error.message || '登录失败，请稍后重试'
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (window.lucide) {
    lucide.createIcons()
  }
})
</script>

<style scoped>
.login-page {
  height: 100vh;
  overflow: hidden;
  display: flex;
  background: linear-gradient(135deg, #fafafa 0%, #f5f3ff 100%);
}

.login-brand {
  width: 50%;
  background: linear-gradient(135deg, #9db3f9 0%, #74aee1 50%, #0bacdd 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.brand-bg-orb {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: white;
  top: -100px;
  left: -100px;
  animation: float 8s ease-in-out infinite;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: rgba(251, 191, 36, 0.4);
  bottom: -80px;
  right: -80px;
  animation: float 6s ease-in-out infinite reverse;
}

.orb-3 {
  width: 200px;
  height: 200px;
  background: white;
  top: 50%;
  right: 20%;
  animation: float 7s ease-in-out infinite 1s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}

.brand-content {
  position: relative;
  z-index: 1;
  color: white;
  max-width: 420px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
}

.logo-icon-large {
  width: 52px;
  height: 52px;
  background: white;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6366f1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.logo-text-large {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.brand-tagline {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 20px;
}

.accent {
  color: #fbbf24;
}

.brand-desc {
  font-size: 17px;
  line-height: 1.6;
  opacity: 0.9;
  margin-bottom: 40px;
}

.brand-features {
  display: flex;
  gap: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
}

.login-form-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: white;
}

.login-form {
  width: 100%;
  max-width: 420px;
}

.form-title {
  font-size: 32px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 15px;
  color: #6b7280;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background: #f9fafb;
}

.form-input:focus {
  border-color: #6366f1;
  background: white;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
}

.form-input.error {
  border-color: #ef4444;
}

.form-input::placeholder {
  color: #9ca3af;
}

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #6366f1;
}

.error-message {
  display: block;
  font-size: 12px;
  color: #ef4444;
  margin-top: 6px;
  font-weight: 500;
}

.user-type-tabs {
  display: flex;
  gap: 6px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 10px;
}

.user-type-tab {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-type-tab.active {
  background: white;
  color: #111827;
  box-shadow: var(--shadow-sm);
}

.login-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: #6b7280;
  cursor: pointer;
}

.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.forgot-password {
  color: #6366f1;
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.forgot-password:hover {
  color: #4f46e5;
}

.submit-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4fc3e7 0%, #404cf7 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 968px) {
  .login-brand {
    display: none;
  }

  .login-form-container {
    padding: 32px 24px;
  }
}
</style>
