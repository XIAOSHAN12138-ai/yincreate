<template>
  <AppLayout>
    <div class="routing-page">
      <!-- 标签页导航 -->
      <div class="enterprise-tab-bar">
        <div class="tabs-nav">
          <button
            v-for="tab in tabs"
            :key="tab"
            :class="['ent-tab', { active: activeTab === tab }]"
            @click="selectTab(tab)"
          >
            {{ tab }}
          </button>
        </div>
      </div>

      <!-- 顶部操作栏 -->
      <div class="routing-toolbar">
        <div class="toolbar-left">
          <div class="page-title-section">
            <h1 class="routing-title">智能路由管理</h1>
            <p class="routing-subtitle">为每个账号配置AI模型推荐策略的权重分配（价格/速度/质量，合计100%）</p>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="reset-config-btn" @click="resetAllAccounts">
            <i data-lucide="rotate-ccw" style="width: 16px; height: 16px;"></i>
            重置全部
          </button>
          <button class="save-config-btn" @click="saveConfiguration">
            <i data-lucide="save" style="width: 16px; height: 16px;"></i>
            保存配置
          </button>
        </div>
      </div>

      <!-- 全局预设 + 搜索栏 -->
      <div class="routing-controls-row">
        <div class="global-presets-area">
          <span class="presets-label">全局预设：</span>
          <div class="global-preset-buttons">
            <button
              v-for="preset in presetTemplates"
              :key="preset.id"
              class="global-preset-btn"
              @click="applyPresetToAll(preset)"
            >
              <i :data-lucide="preset.icon" style="width: 14px; height: 14px;"></i>
              {{ preset.name }}
            </button>
          </div>
        </div>
        <div class="account-search-box">
          <i data-lucide="search" style="width: 15px; height: 15px; color: #9ca3af;"></i>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索账号ID、名称、部门或使用人..."
            class="account-search-input"
          >
        </div>
      </div>

      <!-- 账号列表表格 -->
      <div class="accounts-table-wrapper">
        <table class="accounts-table">
          <thead>
            <tr>
              <th class="col-account-info">账号信息</th>
              <th class="col-status">状态</th>
              <th class="col-slider">
                <div class="slider-th-header">
                  <i data-lucide="piggy-bank" style="width: 14px; height: 14px; color: #10b981;"></i>
                  价格权重
                </div>
              </th>
              <th class="col-slider">
                <div class="slider-th-header">
                  <i data-lucide="zap" style="width: 14px; height: 14px; color: #3b82f6;"></i>
                  速度权重
                </div>
              </th>
              <th class="col-slider">
                <div class="slider-th-header">
                  <i data-lucide="award" style="width: 14px; height: 14px; color: #8b5cf6;"></i>
                  质量权重
                </div>
              </th>
              <th class="col-total">合计</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(account, idx) in filteredAccounts" :key="account.id" class="account-row">
              <!-- 账号信息列 -->
              <td class="cell-account-info">
                <div class="account-info-block">
                  <div class="account-id-text">{{ account.id }}</div>
                  <div class="account-name-text">{{ account.name }}</div>
                  <div class="account-meta-line">
                    <span class="meta-dept">{{ account.department }}</span>
                    <span class="meta-divider">·</span>
                    <span class="meta-user">{{ account.user }}</span>
                  </div>
                </div>
              </td>
              <!-- 状态列 -->
              <td class="cell-status">
                <span :class="['status-tag', getStatusClass(account.status)]">
                  {{ getStatusLabel(account.status) }}
                </span>
              </td>
              <!-- 价格滑块 -->
              <td class="cell-slider">
                <div class="slider-cell-wrapper slider-cell-price">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="account.priceWeight"
                    @input="onWeightChange(idx, 'priceWeight', $event)"
                    class="custom-range-slider"
                    :style="{ background: getSliderBackground(account.priceWeight, 'price') }"
                  >
                  <span class="slider-cell-value value-price">{{ account.priceWeight }}</span>
                </div>
              </td>
              <!-- 速度滑块 -->
              <td class="cell-slider">
                <div class="slider-cell-wrapper slider-cell-speed">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="account.speedWeight"
                    @input="onWeightChange(idx, 'speedWeight', $event)"
                    class="custom-range-slider"
                    :style="{ background: getSliderBackground(account.speedWeight, 'speed') }"
                  >
                  <span class="slider-cell-value value-speed">{{ account.speedWeight }}</span>
                </div>
              </td>
              <!-- 质量滑块 -->
              <td class="cell-slider">
                <div class="slider-cell-wrapper slider-cell-quality">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="account.qualityWeight"
                    @input="onWeightChange(idx, 'qualityWeight', $event)"
                    class="custom-range-slider"
                    :style="{ background: getSliderBackground(account.qualityWeight, 'quality') }"
                  >
                  <span class="slider-cell-value value-quality">{{ account.qualityWeight }}</span>
                </div>
              </td>
              <!-- 合计列 -->
              <td class="cell-total">
                <span :class="['total-badge', getWeightTotal(account) === 100 ? 'total-ok' : 'total-error']">
                  {{ getWeightTotal(account) }}%
                </span>
              </td>
              <!-- 操作列 -->
              <td class="cell-actions">
                <div class="action-dropdown">
                  <select class="preset-select" @change="applyPresetToAccount(idx, $event.target.value)">
                    <option value="">应用预设</option>
                    <option v-for="preset in presetTemplates" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 达到最大值提示弹窗 -->
      <Teleport to="body">
        <Transition name="alert-fade">
          <div v-if="showMaxAlert" class="max-alert-toast">
            <i data-lucide="alert-triangle" style="width: 18px; height: 18px; color: #f59e0b;"></i>
            <span>已达到最大值（100%），无法继续增加！</span>
          </div>
        </Transition>
      </Teleport>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../../components/layout/AppLayout.vue'

const router = useRouter()

const tabs = ['概览', '额度分配', '账号管理', '人员管理', '部门管理', '项目管理', '智能路由']
const activeTab = ref('智能路由')
const searchQuery = ref('')

const accounts = ref([
  { id: '101', name: '超级管理员账号', department: '公司', status: 'active', user: '王开发', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '102', name: '公司账号', department: '公司', status: 'active', user: '赵老板', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '103', name: '漫剧部主账号', department: '漫剧部', status: 'active', user: '杜总', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '104', name: '漫剧部副账号', department: '漫剧部', status: 'active', user: '刘总', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '105', name: '电商部主账号', department: '电商部', status: 'active', user: '张经理', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '106', name: '电商部副账号', department: '电商部', status: 'active', user: '马经理', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '107', name: '漫剧1组主账号', department: '漫剧1组', status: 'active', user: '小关', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '108', name: '漫剧1组副账号', department: '漫剧1组', status: 'active', user: '小李', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '109', name: '漫剧2组主账号', department: '漫剧2组', status: 'active', user: '小谢', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '110', name: '漫剧2组副账号', department: '漫剧2组', status: 'inactive', user: '-', priceWeight: 0, speedWeight: 0, qualityWeight: 0 },
  { id: '111', name: '电商1组账号', department: '电商1组', status: 'active', user: '小胡', priceWeight: 0, speedWeight: 0, qualityWeight: 0 }
])

const presetTemplates = [
  { id: 'cost', name: '成本优先', icon: 'piggy-bank', weights: { price: 70, speed: 15, quality: 15 } },
  { id: 'balanced', name: '均衡型', icon: 'scale', weights: { price: 34, speed: 33, quality: 33 } },
  { id: 'quality', name: '质量优先', icon: 'award', weights: { price: 10, speed: 20, quality: 70 } },
  { id: 'speed', name: '速度优先', icon: 'zap', weights: { price: 15, speed: 70, quality: 15 } }
]

const filteredAccounts = computed(() => {
  if (!searchQuery.value.trim()) return accounts.value
  const q = searchQuery.value.toLowerCase()
  return accounts.value.filter(a =>
    a.id.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.department.toLowerCase().includes(q) ||
    a.user.toLowerCase().includes(q)
  )
})

const showMaxAlert = ref(false)
const maxAlertTimer = ref(null)

const onWeightChange = (accountIdx, field, event) => {
  const account = accounts.value[accountIdx]
  const numVal = parseInt(event.target.value) || 0

  const fields = ['priceWeight', 'speedWeight', 'qualityWeight']
  const otherFields = fields.filter(f => f !== field)

  const currentOtherSum = otherFields.reduce((sum, f) => sum + account[f], 0)
  const maxAllowed = 100 - currentOtherSum

  if (numVal > maxAllowed) {
    account[field] = maxAllowed
    event.target.value = maxAllowed
    showMaxAlertMessage()
  } else {
    account[field] = numVal
  }
}

const showMaxAlertMessage = () => {
  showMaxAlert.value = true
  if (maxAlertTimer.value) clearTimeout(maxAlertTimer.value)
  maxAlertTimer.value = setTimeout(() => {
    showMaxAlert.value = false
  }, 2000)
}

const applyPresetToAll = (template) => {
  accounts.value.forEach(account => {
    account.priceWeight = template.weights.price
    account.speedWeight = template.weights.speed
    account.qualityWeight = template.weights.quality
  })
}

const applyPresetToAccount = (accountIdx, presetId) => {
  if (!presetId) return
  const template = presetTemplates.find(p => p.id === presetId)
  if (!template) return

  const account = accounts.value[accountIdx]
  account.priceWeight = template.weights.price
  account.speedWeight = template.weights.speed
  account.qualityWeight = template.weights.quality
}

const resetAllAccounts = () => {
  accounts.value.forEach(account => {
    account.priceWeight = 0
    account.speedWeight = 0
    account.qualityWeight = 0
  })
}

const saveConfiguration = () => {
  alert('配置已保存成功！')
}

const getSliderBackground = (value, type) => {
  const colors = {
    price: ['#10b981', '#34d399'],
    speed: ['#3b82f6', '#60a5fa'],
    quality: ['#8b5cf6', '#a78bfa']
  }
  return `linear-gradient(90deg, ${colors[type][0]} 0%, ${colors[type][1]} ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)`
}

const getWeightTotal = (account) => {
  return account.priceWeight + account.speedWeight + account.qualityWeight
}

const getStatusClass = (status) => {
  const map = {
    active: 'status-active',
    inactive: 'status-inactive',
    recycled: 'status-recycled'
  }
  return map[status] || ''
}

const getStatusLabel = (status) => {
  const map = { active: '使用中', inactive: '已停用', recycled: '已回收' }
  return map[status] || status
}

const selectTab = (tab) => {
  activeTab.value = tab
  const routeMap = {
    '概览': '/enterprise/bi',
    '额度分配': '/enterprise/quota',
    '账号管理': '/enterprise/member',
    '人员管理': '/enterprise/personnel',
    '部门管理': '/enterprise/department',
    '项目管理': '/enterprise/project',
    '智能路由': '/enterprise/routing'
  }
  if (routeMap[tab]) router.push(routeMap[tab])
}

let iconTimer = null
onMounted(() => {
  iconTimer = setTimeout(() => {
    if (window.lucide) lucide.createIcons()
  }, 100)
})

onUnmounted(() => {
  // 清理定时器，避免卸载后修改 state
  if (maxAlertTimer.value) {
    clearTimeout(maxAlertTimer.value)
    maxAlertTimer.value = null
  }
  if (iconTimer) {
    clearTimeout(iconTimer)
    iconTimer = null
  }
})
</script>

<style scoped>
.routing-page {
  max-width: 1400px;
}

.enterprise-tab-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-radius: var(--radius-xl);
}

.tabs-nav {
  display: flex;
  gap: 8px;
}

.ent-tab {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}
.ent-tab:hover { color: #3b82f6; }
.ent-tab.active { color: #3b82f6; }
.ent-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2.5px;
  background: #3b82f6;
  border-radius: 2px;
}

.routing-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px 24px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
}

.page-title-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.routing-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.routing-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.toolbar-right {
  display: flex;
  gap: 12px;
}

.reset-config-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: #f1f5f9;
  color: var(--text-secondary);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-config-btn:hover { background: #e2e8f0; }

.save-config-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.save-config-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.routing-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  gap: 16px;
}

.global-presets-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.presets-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.global-preset-buttons {
  display: flex;
  gap: 8px;
}

.global-preset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #f8fafc;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.global-preset-btn:hover {
  background: #eef2ff;
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.account-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 380px;
  padding: 8px 14px;
  background: #f8fafc;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
}

.account-search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
}

.accounts-table-wrapper {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  overflow-x: auto;
}

.accounts-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
}

.accounts-table th {
  padding: 14px 12px;
  text-align: left;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  background: #f8fafc;
  border-bottom: 1.5px solid var(--border-light);
  white-space: nowrap;
}

.accounts-table td {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.col-account-info { width: 220px; }
.col-status { width: 90px; }
.col-slider { width: 200px; }
.col-total { width: 80px; text-align: center; }
.col-actions { width: 130px; }

.account-info-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-id-text {
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.account-name-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.account-meta-line {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-secondary);
}

.meta-divider { color: #d1d5db; }

.status-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.status-active { background: #dcfce7; color: #16a34a; }
.status-inactive { background: #fee2e2; color: #dc2626; }
.status-recycled { background: #f3f4f6; color: #9ca3af; }

.slider-cell-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.custom-range-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.custom-range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  border: 2px solid currentColor;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slider-cell-price .custom-range-slider::-webkit-slider-thumb { border-color: #10b981; }
.slider-cell-speed .custom-range-slider::-webkit-slider-thumb { border-color: #3b82f6; }
.slider-cell-quality .custom-range-slider::-webkit-slider-thumb { border-color: #8b5cf6; }

.slider-cell-value {
  font-size: 13px;
  font-weight: 700;
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.value-price { color: #10b981; }
.value-speed { color: #3b82f6; }
.value-quality { color: #8b5cf6; }

.total-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.total-ok { background: #dcfce7; color: #16a34a; }
.total-error { background: #fee2e2; color: #dc2626; }

.preset-select {
  width: 120px;
  padding: 7px 10px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-primary);
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-select:focus {
  border-color: var(--primary-color);
  outline: none;
}

.max-alert-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
  z-index: 10000;
  animation: alert-slide-down 0.3s ease-out;
}

.max-alert-toast span {
  font-size: 14px;
  font-weight: 700;
  color: #92400e;
}

@keyframes alert-slide-down {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: all 0.3s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>