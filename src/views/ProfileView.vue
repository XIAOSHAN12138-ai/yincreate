<template>
  <AppLayout>
    <!-- 个人资料页面主容器 -->
    <div class="profile-page">
      <!-- 用户信息卡片 - 头像、昵称、VIP状态 -->
      <div class="profile-card">
        <div class="profile-user-section">
          <img :src="userStore.user?.avatar || userData.user.avatar" alt="" class="profile-avatar-img" @error="handleImageError">
          <div class="profile-user-info">
            <div class="profile-name-row">
              <h3 class="profile-name">{{ userStore.user?.name || userData.user.name }}</h3>
              <span v-if="userStore.user?.user_type === 'enterprise'" class="vip-badge-inline">
                <i data-lucide="crown" style="width: 12px; height: 12px;"></i>
                企业
              </span>
              <span v-else-if="userStore.user?.user_type === 'admin'" class="vip-badge-inline">
                <i data-lucide="shield" style="width: 12px; height: 12px;"></i>
                管理员
              </span>
            </div>
            <p class="profile-id">ID: {{ userStore.user?.user_id || userData.user.id }}</p>
            <p class="profile-join-days">
              <i data-lucide="calendar" style="width: 13px; height: 13px;"></i>
              {{ userStore.user?.enterprise_name || '' }}
            </p>
            <p class="profile-bio">{{ userStore.user?.email || '' }}</p>
          </div>
          <button class="edit-profile-btn" @click="$router.push('/settings')">编辑资料</button>
        </div>
      </div>

      <!-- 统计数据行 - 作品数、草稿、收藏、素材 -->
      <div class="stats-row">
        <div v-for="(stat, index) in userStats" :key="stat.id" class="stat-box">
          <div class="stat-icon-wrap" :style="{ background: index === 0 ? '#eef2ff' : index === 1 ? '#fef3e2' : index === 2 ? '#fdf4ff' : '#f0fdf4' }">
            <i :data-lucide="stat.icon" :style="{ width: '20px', height: '20px', color: index === 0 ? '#6366f1' : index === 1 ? '#f59e0b' : index === 2 ? '#a855f7' : '#10b981' }"></i>
          </div>
          <div class="stat-content">
            <span class="stat-num">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>

      <!-- 余额中心 - 积分信息 -->
      <div class="section-block">
        <h3 class="section-title">余额中心</h3>
        <div class="balance-card">
          <div class="balance-item">
            <div class="balance-icon-wrap" style="background: #eef2ff;">
              <i data-lucide="wallet" style="width: 22px; height: 22px; color: #6366f1;"></i>
            </div>
            <div class="balance-info">
              <span class="balance-num">{{ pointsData.total_points }}</span>
              <span class="balance-label">拥有积分</span>
            </div>
          </div>
          <div class="balance-divider"></div>
          <div class="balance-item">
            <div class="balance-icon-wrap" style="background: #fef3c7;">
              <i data-lucide="trending-down" style="width: 22px; height: 22px; color: #f59e0b;"></i>
            </div>
            <div class="balance-info">
              <span class="balance-num">{{ pointsData.used_points }}</span>
              <span class="balance-label">已使用积分</span>
            </div>
          </div>
          <div class="balance-divider"></div>
          <div class="balance-item">
            <div class="balance-icon-wrap" style="background: #d1fae5;">
              <i data-lucide="check-circle" style="width: 22px; height: 22px; color: #10b981;"></i>
            </div>
            <div class="balance-info">
              <span class="balance-num">{{ pointsData.remaining ?? (pointsData.total_points - pointsData.used_points) }}</span>
              <span class="balance-label">剩余额度</span>
            </div>
          </div>
        </div>

        <!-- 扣费记录 / 流水明细 -->
        <div class="transactions-section">
          <div class="transactions-header">
            <h4 class="transactions-title">
              <i data-lucide="receipt" style="width: 16px; height: 16px;"></i>
              扣费记录
            </h4>
            <div class="transactions-filter">
              <button
                v-for="t in txTypeOptions"
                :key="t.value"
                :class="['tx-filter-btn', { active: txFilter === t.value }]"
                @click="txFilter = t.value; fetchTransactions()"
              >{{ t.label }}</button>
            </div>
          </div>

          <div v-if="txLoading && txList.length === 0" class="tx-loading">
            <i data-lucide="loader-2" class="spin-icon" style="width: 20px; height: 20px;"></i>
            加载中...
          </div>

          <div v-else-if="txList.length === 0" class="tx-empty">
            <i data-lucide="inbox" style="width: 32px; height: 32px; color: #d1d5db;"></i>
            <p>暂无{{ txFilterLabel }}记录</p>
          </div>

          <div v-else class="tx-list">
            <div v-for="(tx, i) in txList" :key="tx.id || i" class="tx-item">
              <div class="tx-left">
                <div :class="['tx-type-badge', `tx-${tx.transaction_type}`]">
                  {{ txTypeLabel(tx.transaction_type) }}
                </div>
                <div class="tx-desc">{{ tx.description || formatTxDesc(tx) }}</div>
                <div class="tx-meta">
                  <span class="tx-time">{{ formatTime(tx.created_at) }}</span>
                  <span v-if="tx.related_model_id" class="tx-model-id">模型: {{ tx.related_model_id }}</span>
                </div>
              </div>
              <div class="tx-right">
                <span :class="['tx-amount', { 'tx-plus': tx.amount > 0, 'tx-minus': tx.amount < 0 }]">
                  {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
                </span>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div v-if="txTotal > txPageSize" class="tx-pagination">
            <button class="tx-page-btn" :disabled="txPage <= 1" @click="txPage--; fetchTransactions()">
              <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i> 上一页
            </button>
            <span class="tx-page-info">第 {{ txPage }} 页 / 共 {{ Math.ceil(txTotal / txPageSize) }} 页</span>
            <button class="tx-page-btn" :disabled="txPage >= Math.ceil(txTotal / txPageSize)" @click="txPage++; fetchTransactions()">
              下一页 <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 安全中心 - 密码、手机、邮箱等安全设置 -->
      <div class="section-block">
        <h3 class="section-title">安全中心</h3>
        <div class="security-list">
          <div v-for="item in securityItems" :key="item.type" class="security-item">
            <div class="security-item-left">
              <div class="security-icon-wrap">
                <i :data-lucide="item.type === 'password' ? 'key-round' : item.type === 'phone' ? 'smartphone' : item.type === 'mail' ? 'mail' : item.type === 'link' ? 'link' : 'monitor'" style="width: 18px; height: 18px; color: #6366f1;"></i>
              </div>
              <div class="security-info">
                <span class="security-label">{{ item.label }}</span>
                <span class="security-desc">{{ item.desc }}</span>
              </div>
            </div>
            <button class="security-action-btn" @click="handleSecurityAction(item.type)">{{ item.action }}</button>
          </div>
        </div>
        <button class="logout-btn" @click="handleLogout">
          <i data-lucide="log-out" style="width: 15px; height: 15px;"></i>
          退出登录
        </button>
      </div>
    </div>

    <!-- 右侧边栏内容（通过AppLayout的slot传入） -->
    <template #right-sidebar>
      <aside class="right-sidebar-profile">
        <!-- 快捷入口 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">快捷入口</h3>
          <div class="quick-grid">
            <div v-for="(entry, idx) in quickEntries" :key="idx" class="quick-entry-item">
              <div class="quick-entry-icon" :style="{ background: entry.color + '15', color: entry.color }">
                <i :data-lucide="entry.icon" style="width: 20px; height: 20px;"></i>
              </div>
              <span class="quick-entry-label">{{ entry.label }}</span>
            </div>
          </div>
        </div>

        <!-- 账户设置 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">账户设置</h3>
          <div class="settings-list">
            <div v-for="(setting, idx) in accountSettings" :key="idx" class="settings-item" @click="$router.push('/settings')">
              <div class="settings-item-left">
                <div class="settings-icon-wrap" :style="{ background: setting.color + '15', color: setting.color }">
                  <i :data-lucide="setting.icon" style="width: 16px; height: 16px;"></i>
                </div>
                <div class="settings-info">
                  <span class="settings-label">{{ setting.label }}</span>
                  <span class="settings-desc">{{ setting.desc }}</span>
                </div>
              </div>
              <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: #d1d5db;"></i>
            </div>
          </div>
        </div>

        <!-- 帮助中心 -->
        <div class="sidebar-section">
          <h3 class="sidebar-section-title">帮助中心</h3>
          <div class="help-list">
            <div v-for="(item, idx) in helpItems" :key="idx" class="help-item">
              <div class="help-item-left">
                <div class="help-icon-wrap" :style="{ background: item.color + '15', color: item.color }">
                  <i :data-lucide="item.icon" style="width: 16px; height: 16px;"></i>
                </div>
                <div class="help-info">
                  <span class="help-label">{{ item.label }}</span>
                  <span class="help-desc">{{ item.desc }}</span>
                </div>
              </div>
              <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: #d1d5db;"></i>
            </div>
          </div>
        </div>
      </aside>
    </template>

    <!-- 实名认证弹窗 -->
    <Teleport to="body">
      <div v-if="showRealNameAuthModal" class="modal-overlay" @click.self="closeRealNameAuth">
        <div class="realname-modal-container">
          <!-- 步骤条 -->
          <div class="realname-header">
            <button class="back-btn" @click="closeRealNameAuth">
              <i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i>
              返回认证中心
            </button>
            <div class="step-indicator">
              <div :class="['step-item', { active: currentStep >= 1, completed: currentStep > 1 }]">
                <span class="step-num">1</span>
                <span class="step-text">同意协议</span>
                <i v-if="currentStep > 1" data-lucide="check" class="step-check"></i>
              </div>
              <i data-lucide="chevron-right" class="step-arrow"></i>
              <div :class="['step-item', { active: currentStep >= 2, completed: currentStep > 2 }]">
                <span class="step-num">2</span>
                <span class="step-text">填写身份信息及验证</span>
                <i v-if="currentStep > 2" data-lucide="check" class="step-check"></i>
              </div>
              <i data-lucide="chevron-right" class="step-arrow"></i>
              <div :class="['step-item', { active: currentStep >= 3 }]">
                <span class="step-num">3</span>
                <span class="step-text">完成认证</span>
              </div>
            </div>
          </div>

          <div class="realname-body">
            <!-- 第一步：同意协议 -->
            <div v-if="currentStep === 1" class="step-content">
              <h3 class="step-title">实名认证协议</h3>
              <div class="agreement-box">
                <p class="agreement-placeholder">协议内容</p>
              </div>
              <div class="agreement-actions">
                <button class="btn-disagree" @click="closeRealNameAuth">不同意</button>
                <button class="btn-agree" @click="goToStep(2)">同意</button>
              </div>
            </div>

            <!-- 第二步：填写身份信息 -->
            <div v-if="currentStep === 2" class="step-content">
              <h3 class="step-title">填写身份信息</h3>
              <div class="form-section">
                <div class="form-group-realname">
                  <label class="form-label-realname">证件类型</label>
                  <select v-model="authForm.idType" class="form-select-realname">
                    <option value="">请选择证件类型</option>
                    <option value="身份证">中国居民身份证</option>
                  </select>
                </div>

                <div class="form-group-realname">
                  <label class="form-label-realname">姓名</label>
                  <input
                    type="text"
                    v-model="authForm.realName"
                    placeholder="请输入真实姓名"
                    class="form-input-realname"
                  >
                </div>

                <div class="form-group-realname">
                  <label class="form-label-realname">证件号码</label>
                  <input
                    type="text"
                    v-model="authForm.idNumber"
                    placeholder="请输入证件号码"
                    class="form-input-realname"
                    maxlength="18"
                    @blur="validateIdNumber"
                  >
                  <p v-if="idNumberError" class="error-msg">{{ idNumberError }}</p>
                </div>
              </div>

              <div class="form-actions">
                <button class="btn-submit-auth" @click="submitAuth">提交</button>
              </div>
            </div>

            <!-- 第三步：认证成功 -->
            <div v-if="currentStep === 3" class="step-content success-content">
              <div class="success-icon-wrap">
                <i data-lucide="check-circle" style="width: 64px; height: 64px; color: #10b981;"></i>
              </div>
              <h3 class="success-title">认证成功！</h3>
              <p class="success-desc">您的实名认证已通过审核，现在可以享受更多服务了。</p>
              <button class="btn-close-success" @click="closeRealNameAuth">完成</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 修改密码弹窗 -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="modal-overlay" @click.self="closePasswordModal">
        <div class="password-modal-container">
          <div class="password-header">
            <h3 class="password-modal-title">修改登录密码</h3>
            <button class="password-close-btn" @click="closePasswordModal">
              <i data-lucide="x" style="width: 18px; height: 18px;"></i>
            </button>
          </div>

          <div class="password-body">
            <!-- 表单态 -->
            <div v-if="passwordStep === 'form'" class="password-form-content">
              <div class="form-group-pwd">
                <label class="form-label-pwd">当前密码</label>
                <div class="pwd-input-wrap">
                  <input
                    :type="showOldPwd ? 'text' : 'password'"
                    v-model="passwordForm.old_password"
                    placeholder="请输入当前密码"
                    class="form-input-pwd"
                    maxlength="128"
                    @keyup.enter="submitPasswordChange"
                  >
                  <button type="button" class="pwd-toggle-btn" @click="showOldPwd = !showOldPwd">
                    <i :data-lucide="showOldPwd ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
              </div>

              <div class="form-group-pwd">
                <label class="form-label-pwd">新密码</label>
                <div class="pwd-input-wrap">
                  <input
                    :type="showNewPwd ? 'text' : 'password'"
                    v-model="passwordForm.new_password"
                    placeholder="请输入新密码（1-128 位）"
                    class="form-input-pwd"
                    maxlength="128"
                  >
                  <button type="button" class="pwd-toggle-btn" @click="showNewPwd = !showNewPwd">
                    <i :data-lucide="showNewPwd ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
              </div>

              <div class="form-group-pwd">
                <label class="form-label-pwd">确认新密码</label>
                <div class="pwd-input-wrap">
                  <input
                    :type="showConfirmPwd ? 'text' : 'password'"
                    v-model="passwordForm.confirm_password"
                    placeholder="请再次输入新密码"
                    class="form-input-pwd"
                    maxlength="128"
                    @keyup.enter="submitPasswordChange"
                  >
                  <button type="button" class="pwd-toggle-btn" @click="showConfirmPwd = !showConfirmPwd">
                    <i :data-lucide="showConfirmPwd ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
              </div>

              <p v-if="passwordError" class="pwd-error-msg">
                <i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i>
                {{ passwordError }}
              </p>

              <div class="pwd-form-actions">
                <button class="pwd-btn-cancel" @click="closePasswordModal" :disabled="passwordSubmitting">取消</button>
                <button class="pwd-btn-submit" @click="submitPasswordChange" :disabled="passwordSubmitting">
              <i v-if="passwordSubmitting" data-lucide="loader-2" class="spin-icon" style="width: 14px; height: 14px;"></i>
                  {{ passwordSubmitting ? '提交中...' : '确认修改' }}
                </button>
              </div>
            </div>

            <!-- 成功态 -->
            <div v-else-if="passwordStep === 'success'" class="pwd-success-content">
              <div class="pwd-success-icon-wrap">
                <i data-lucide="check-circle" style="width: 64px; height: 64px; color: #10b981;"></i>
              </div>
              <h3 class="pwd-success-title">密码修改成功</h3>
              <p class="pwd-success-desc">
                您的登录密码已更新。为保障账户安全，建议您<span class="pwd-success-strong">重新登录</span>以刷新登录状态。
              </p>
              <div class="pwd-success-actions">
                <button class="pwd-btn-stay" @click="closePasswordModal">稍后再说</button>
                <button class="pwd-btn-relogin" @click="handlePasswordChangedRelogin">
                  <i data-lucide="log-in" style="width: 15px; height: 15px;"></i>
                  重新登录
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { userData } from '../data/userData'
import { useUserStore } from '../stores/user'
import { getPointsApi } from '../api/profile'
import { getBillingTransactionsApi } from '../api/billing'
import { changePasswordApi } from '../api/auth'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)
let iconTimer = null

const router = useRouter()
const userStore = useUserStore()

const userStats = ref([
  { id: 'works', value: 36, label: '我的作品', icon: 'file-video' },
  { id: 'drafts', value: 12, label: '草稿箱', icon: 'file-text' },
  { id: 'favorites', value: 8, label: '收藏夹', icon: 'star' },
  { id: 'assets', value: 128, label: '素材库', icon: 'folder' }
])

const pointsData = reactive({
  total_points: 0,
  used_points: 0,
  expired_points: 0,
  remaining: null
})

// ==================== 扣费记录 / 流水 ====================
const txList = ref([])
const txLoading = ref(false)
const txTotal = ref(0)
const txPage = ref(1)
const txPageSize = 5
const txFilter = ref('') // ''=全部, consume, refund, recharge, expire

const txTypeOptions = [
  { label: '全部', value: '' },
  { label: '消费', value: 'consume' },
  { label: '退款', value: 'refund' },
  { label: '充值', value: 'recharge' },
  { label: '过期', value: 'expire' }
]

const txFilterLabel = computed(() => {
  const opt = txTypeOptions.find(o => o.value === txFilter.value)
  return opt ? opt.label : ''
})

function txTypeLabel(type) {
  const map = { consume: '消费', refund: '退款', recharge: '充值', expire: '过期' }
  return map[type] || type || '未知'
}

function formatTxDesc(tx) {
  if (tx.related_task_id && tx.related_model_id) {
    return `生成消费 task=${tx.related_task_id} model=${tx.related_model_id}`
  }
  return ''
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return isoStr
  }
}

async function fetchTransactions() {
  txLoading.value = true
  try {
    const params = {
      page: txPage.value,
      page_size: txPageSize
    }
    if (txFilter.value) params.transaction_type = txFilter.value

    const res = await getBillingTransactionsApi(params)
    if (isUnmounted.value) return
    txList.value = res.items || []
    txTotal.value = res.total || 0
  } catch (e) {
    console.error('获取扣费记录失败:', e)
    txList.value = []
    txTotal.value = 0
  } finally {
    txLoading.value = false
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  }
}

const securityItems = computed(() => {
  const baseItems = [
    { label: '登录密码', desc: '建议定期更换密码以保障账户安全', action: '修改', type: 'password' },
    { label: '手机绑定', desc: '138****8888', action: '修改', type: 'phone' },
    { label: '邮箱绑定', desc: 'creator@example.com', action: '修改', type: 'mail' },
    { label: '第三方账号', desc: '已绑定微信', action: '管理', type: 'link' },
    { label: '设备管理', desc: '暂无登录设备，保护账号安全', action: '管理', type: 'monitor' },
    { label: '实名认证', desc: '未认证，完成认证可享受更多服务', action: '去认证', type: 'badge-check' }
  ]
  // 系统管理员不支持通过该接口修改密码，隐藏该项
  if (userStore.user?.user_type === 'admin') {
    return baseItems.filter(item => item.type !== 'password')
  }
  return baseItems
})

const quickEntries = ref([])

const updateQuickEntries = () => {
  const userLevel = userData.user.level
  if (userLevel === 1) {
    quickEntries.value = [
      { label: '我的订单', icon: 'receipt', color: '#6366f1' },
      { label: '我的发票', icon: 'file-text', color: '#10b981' },
      { label: '兑换码', icon: 'ticket', color: '#10b981' },
      { label: '帮助中心', icon: 'help-circle', color: '#6366f1' }
    ]
  } else {
    quickEntries.value = [
      { label: '帮助中心', icon: 'help-circle', color: '#6366f1' }
    ]
  }
}

const accountSettings = ref([
  { label: '个人资料', desc: '头像、昵称、个人简介', icon: 'user', color: '#6366f1' },
  { label: '通知设置', desc: '消息通知、操作通知等', icon: 'bell', color: '#3b82f6' },
  { label: '隐私设置', desc: '隐私权限与数据管理', icon: 'shield', color: '#10b981' },
  { label: '偏好设置', desc: '界面语言、主题模式等', icon: 'palette', color: '#ec4899' },
  { label: '内容偏好', desc: '推荐内容与屏蔽设置', icon: 'sliders', color: '#f97316' }
])

const helpItems = ref([
  { label: '常见问题', desc: '了解常见问题与解决方案', icon: 'help-circle', color: '#6366f1' },
  { label: '使用教程', desc: '学习如何使用影创 studio 各项功能', icon: 'book-open', color: '#3b82f6' },
  { label: '意见反馈', desc: '告诉我们您的建议与问题', icon: 'message-square', color: '#10b981' },
  { label: '联系客服', desc: '7x24 小时在线客服支持', icon: 'headphones', color: '#a855f7' }
])

const handleImageError = (event) => {
  event.target.style.display = 'none'
}

const handleLogout = async () => {
  await userStore.logout()
  router.push('/login')
}

const showRealNameAuthModal = ref(false)
const currentStep = ref(1)
const authForm = ref({
  idType: '',
  realName: '',
  idNumber: ''
})
const idNumberError = ref('')

const openRealNameAuth = () => {
  currentStep.value = 1
  authForm.value = { idType: '', realName: '', idNumber: '' }
  idNumberError.value = ''
  showRealNameAuthModal.value = true
  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

const closeRealNameAuth = () => {
  showRealNameAuthModal.value = false
  currentStep.value = 1
  authForm.value = { idType: '', realName: '', idNumber: '' }
  idNumberError.value = ''
}

const goToStep = (step) => {
  currentStep.value = step
  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

const validateIdNumber = () => {
  const idNum = authForm.value.idNumber.trim()
  if (!idNum) {
    idNumberError.value = ''
    return false
  }
  if (!/^\d{18}$/.test(idNum)) {
    idNumberError.value = '请输入正确的身份证号！'
    return false
  }
  idNumberError.value = ''
  return true
}

const submitAuth = () => {
  if (!authForm.value.idType) {
    return
  }
  if (!authForm.value.realName.trim()) {
    return
  }
  if (!validateIdNumber()) {
    return
  }
  goToStep(3)
}

// ==================== 修改密码 ====================
const showPasswordModal = ref(false)
const passwordStep = ref('form') // 'form' | 'success'
const passwordSubmitting = ref(false)
const passwordError = ref('')
const showOldPwd = ref(false)
const showNewPwd = ref(false)
const showConfirmPwd = ref(false)
const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

const openPasswordModal = () => {
  passwordForm.old_password = ''
  passwordForm.new_password = ''
  passwordForm.confirm_password = ''
  passwordError.value = ''
  passwordStep.value = 'form'
  showOldPwd.value = false
  showNewPwd.value = false
  showConfirmPwd.value = false
  showPasswordModal.value = true
  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

/**
 * 安全中心条目点击分发
 */
function handleSecurityAction(type) {
  if (type === 'badge-check') {
    openRealNameAuth()
  } else if (type === 'password') {
    openPasswordModal()
  } else {
    router.push('/settings')
  }
}

const closePasswordModal = () => {
  showPasswordModal.value = false
  passwordStep.value = 'form'
  passwordForm.old_password = ''
  passwordForm.new_password = ''
  passwordForm.confirm_password = ''
  passwordError.value = ''
  passwordSubmitting.value = false
}

/**
 * 前端表单校验，返回错误消息字符串，校验通过返回 ''
 */
function validatePasswordForm() {
  const { old_password, new_password, confirm_password } = passwordForm
  if (!old_password) return '请输入当前密码'
  if (!new_password) return '请输入新密码'
  if (new_password.length > 128) return '新密码长度不能超过 128 个字符'
  if (new_password === old_password) return '新密码不能与旧密码相同'
  if (new_password !== confirm_password) return '两次输入的新密码不一致'
  return ''
}

/**
 * 将后端错误码映射为用户友好的提示文案
 */
function mapPasswordError(err) {
  const code = err?.code
  const msg = err?.message || ''
  switch (code) {
    case 'INVALID_INPUT':
      return msg || '旧密码或新密码为空，或新密码与旧密码相同'
    case 'INVALID_CREDENTIALS':
      return msg || '旧密码错误，请重新输入'
    case 'NOT_SUPPORTED':
      return msg || '当前账号类型不支持通过该接口修改密码'
    case 'USER_NOT_FOUND':
      return msg || '账号不存在或已被删除'
    case 'TOKEN_INVALID':
      return msg || '登录状态异常，请重新登录'
    default:
      return msg || '修改密码失败，请稍后重试'
  }
}

async function submitPasswordChange() {
  if (passwordSubmitting.value) return
  passwordError.value = validatePasswordForm()
  if (passwordError.value) return

  passwordSubmitting.value = true
  try {
    await changePasswordApi({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password
    })
    if (isUnmounted.value) return
    passwordStep.value = 'success'
    nextTick(() => {
      if (window.lucide) lucide.createIcons()
    })
  } catch (e) {
    if (isUnmounted.value) return
    passwordError.value = mapPasswordError(e)
  } finally {
    passwordSubmitting.value = false
  }
}

/**
 * 修改密码成功后跳转登录页重新登录
 */
async function handlePasswordChangedRelogin() {
  closePasswordModal()
  await userStore.logout()
  router.push('/login')
}

onMounted(async () => {
  updateQuickEntries()
  // 获取积分信息
  try {
    const res = await getPointsApi()
    if (isUnmounted.value) return
    pointsData.total_points = res.data.total_points
    pointsData.used_points = res.data.used_points
    pointsData.expired_points = res.data.expired_points || 0
    if (res.data.remaining !== undefined && res.data.remaining !== null) {
      pointsData.remaining = res.data.remaining
    }
  } catch (e) {
    console.error('获取积分信息失败', e)
  }
  // 获取扣费记录
  fetchTransactions()
  iconTimer = setTimeout(() => {
    if (isUnmounted.value) return
    if (window.lucide) lucide.createIcons()
  }, 100)
})

onUnmounted(() => {
  isUnmounted.value = true
  if (iconTimer) {
    clearTimeout(iconTimer)
    iconTimer = null
  }
  // Teleport 弹窗需在卸载时关闭，避免覆盖新页面
  showPasswordModal.value = false
  showRealNameAuthModal.value = false
})
</script>

<style scoped>
.profile-page {
  max-width: none;
  width: 100%;
}

.page-header-info {
  display: flex;
  flex-direction: column;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.header-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-user-info:hover {
  background: #f1f5f9;
}

.header-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.header-username {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.vip-badge-sm {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: #92400e;
}

.storage-expand {
  padding: 0 16px 20px;
}

.storage-link {
  display: block;
  font-size: 12px;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.profile-card {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 24px 28px;
  margin-bottom: 20px;
}

.profile-user-section {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.profile-avatar-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.15);
}

.profile-user-info {
  flex: 1;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.profile-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.vip-badge-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #92400e;
}

.profile-id {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.profile-join-days {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.profile-bio {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.edit-profile-btn {
  padding: 8px 18px;
  background: white;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.edit-profile-btn:hover {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.04);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-box {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.25s ease;
}

.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.section-block {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 24px 28px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 18px;
}

.balance-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 28px 22px;
  background: linear-gradient(135deg, #f0f4ff, #eef2ff);
  border: 1.5px solid #c7d2fe;
  border-radius: var(--radius-lg);
}

.balance-item {
  display: flex;
  align-items: center;
  gap: 14px;
}

.balance-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.balance-info {
  display: flex;
  flex-direction: column;
}

.balance-num {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.balance-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  margin-top: 2px;
}

.balance-divider {
  width: 1px;
  height: 48px;
  background: #c7d2fe;
}

.security-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 18px;
}

.security-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-light);
}

.security-item:first-child {
  padding-top: 0;
}

.security-item-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.security-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.security-info {
  display: flex;
  flex-direction: column;
}

.security-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.security-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.security-action-btn {
  padding: 6px 16px;
  background: white;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.security-action-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  background: white;
  border: 1.5px solid #fecaca;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.25s ease;
}

.logout-btn:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.right-sidebar-profile {
  padding: 16px 14px;
}

.sidebar-section {
  margin-bottom: 14px;
  background: #ffffff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1.5px solid rgba(229, 231, 235, 0.7);
}

.sidebar-section-title {
  font-size: 13.5px;
  font-weight: 650;
  color: #111827;
  margin-bottom: 12px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.quick-entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-entry-item:hover {
  background: #f8fafc;
}

.quick-entry-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-entry-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
}

.settings-list,
.help-list {
  display: flex;
  flex-direction: column;
}

.settings-item,
.help-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-item:last-child,
.help-item:last-child {
  border-bottom: none;
}

.settings-item:hover,
.help-item:hover {
  background: #f8fafc;
  margin: 0 -14px;
  padding: 14px;
  border-radius: 10px;
  border-bottom-color: transparent;
}

.settings-item-left,
.help-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-icon-wrap,
.help-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-info,
.help-info {
  display: flex;
  flex-direction: column;
}

.settings-label,
.help-label {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.settings-desc,
.help-desc {
  font-size: 11px;
  color: #9ca3af;
}

/* 实名认证弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.realname-modal-container {
  width: 90%;
  max-width: 680px;
  max-height: 85vh;
  background: white;
  border-radius: 16px;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.realname-header {
  padding: 20px 28px;
  border-bottom: 1.5px solid #e5e7eb;
  background: #fafafa;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 16px;
}

.back-btn:hover {
  background: rgba(59, 130, 246, 0.08);
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
  background: white;
  border: 1.5px solid #e5e7eb;
  transition: all 0.25s ease;
  position: relative;
}

.step-item.active {
  color: #3b82f6;
  border-color: #3b82f6;
  background: #eff6ff;
}

.step-item.completed {
  color: #10b981;
  border-color: #10b981;
  background: #ecfdf5;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-item.active .step-num {
  background: #3b82f6;
  color: white;
}

.step-item.completed .step-num {
  background: #10b981;
  color: white;
}

.step-text {
  white-space: nowrap;
}

.step-check {
  position: absolute;
  right: -4px;
  top: -4px;
  width: 16px !important;
  height: 16px !important;
  color: #10b981;
  background: white;
  border-radius: 50%;
}

.step-arrow {
  width: 18px;
  height: 18px;
  color: #d1d5db;
  flex-shrink: 0;
}

.realname-body {
  padding: 32px 40px;
}

.step-content {
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-title {
  font-size: 19px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24px;
  text-align: left;
}

.agreement-box {
  min-height: 240px;
  padding: 24px;
  background: #f9fafb;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agreement-placeholder {
  font-size: 15px;
  color: #9ca3af;
  text-align: center;
}

.agreement-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.btn-disagree,
.btn-agree {
  padding: 11px 36px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-disagree {
  background: white;
  border: 1.5px solid #d1d5db;
  color: #6b7280;
}

.btn-disagree:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-agree {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-agree:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 28px;
}

.form-group-realname {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label-realname {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-select-realname,
.form-input-realname {
  padding: 12px 16px;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
  color: #111827;
  background: white;
  outline: none;
  transition: all 0.2s ease;
}

.form-select-realname:focus,
.form-input-realname:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.error-msg {
  font-size: 12px;
  color: #dc2626;
  margin-top: -4px;
  font-weight: 500;
}

.form-actions {
  display: flex;
  justify-content: center;
}

.btn-submit-auth {
  padding: 12px 56px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-submit-auth:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.success-icon-wrap {
  margin-bottom: 20px;
  animation: scaleIn 0.4s ease;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.success-title {
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 12px;
}

.success-desc {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 400px;
}

.btn-close-success {
  padding: 12px 48px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-close-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

/* ==================== 扣费记录 / 流水明细 ==================== */
.transactions-section {
  margin-top: 20px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 20px 24px;
}

.transactions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.transactions-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.transactions-filter {
  display: flex;
  gap: 6px;
}

.tx-filter-btn {
  padding: 5px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  background: white;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tx-filter-btn:hover {
  border-color: #c7d2fe;
  color: #6366f1;
}

.tx-filter-btn.active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #6366f1;
  font-weight: 600;
}

.tx-loading,
.tx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  transition: background 0.15s ease;
}

.tx-item:hover {
  background: #f9fafb;
}

.tx-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.tx-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
  margin-left: 24px;
}

.tx-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  width: fit-content;
}

.tx-consume {
  background: #fef2f2;
  color: #dc2626;
}

.tx-refund {
  background: #ecfdf5;
  color: #059669;
}

.tx-recharge {
  background: #eff6ff;
  color: #2563eb;
}

.tx-expire {
  background: #fff7ed;
  color: #ea580c;
}

.tx-desc {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.tx-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.tx-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.tx-model-id {
  font-size: 11px;
  color: #6366f1;
  background: #eef2ff;
  padding: 2px 6px;
  border-radius: 4px;
}

.tx-amount {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tx-minus {
  color: #dc2626;
}

.tx-plus {
  color: #059669;
}

/* 分页 */
.tx-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.tx-page-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  background: white;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tx-page-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}

.tx-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tx-page-info {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* ==================== 修改密码弹窗 ==================== */
.password-modal-container {
  width: 90%;
  max-width: 460px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: pwdModalIn 0.25s ease;
}

@keyframes pwdModalIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.password-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1.5px solid #e5e7eb;
  background: #fafafa;
}

.password-modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.password-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.password-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.password-body {
  padding: 28px 28px 24px;
}

.password-form-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: fadeInUp 0.3s ease;
}

.form-group-pwd {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label-pwd {
  font-size: 13.5px;
  font-weight: 600;
  color: #374151;
}

.pwd-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input-pwd {
  width: 100%;
  padding: 11px 42px 11px 14px;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
  color: #111827;
  background: white;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input-pwd:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-input-pwd::placeholder {
  color: #9ca3af;
}

.pwd-toggle-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pwd-toggle-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

.pwd-error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 12.5px;
  color: #dc2626;
  font-weight: 500;
  margin: -4px 0 0;
}

.pwd-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

.pwd-btn-cancel,
.pwd-btn-submit {
  padding: 10px 22px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pwd-btn-cancel {
  background: white;
  border: 1.5px solid #d1d5db;
  color: #6b7280;
}

.pwd-btn-cancel:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #374151;
}

.pwd-btn-submit {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.pwd-btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.pwd-btn-cancel:disabled,
.pwd-btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 成功态 */
.pwd-success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 16px 8px;
  animation: fadeInUp 0.3s ease;
}

.pwd-success-icon-wrap {
  margin-bottom: 16px;
  animation: scaleIn 0.4s ease;
}

.pwd-success-title {
  font-size: 22px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 10px;
}

.pwd-success-desc {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 24px;
  max-width: 320px;
}

.pwd-success-strong {
  color: #6366f1;
  font-weight: 600;
}

.pwd-success-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.pwd-btn-stay,
.pwd-btn-relogin {
  flex: 1;
  padding: 11px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.pwd-btn-stay {
  background: white;
  border: 1.5px solid #d1d5db;
  color: #6b7280;
}

.pwd-btn-stay:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.pwd-btn-relogin {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.pwd-btn-relogin:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}
</style>
