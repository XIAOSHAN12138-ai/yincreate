<template>
  <aside class="sidebar">
    <!-- Logo区域 -->
    <div class="sidebar-logo">
      <div class="logo-icon">
        <img v-if="appStore.siteFavicon" :src="appStore.siteFavicon" class="logo-custom-icon" />
        <i v-else data-lucide="play" style="width: 22px; height: 22px;"></i>
      </div>
      <div class="logo-text">
        <h1>{{ appStore.siteTitle || '影创studio' }}</h1>
        <p>AI 视频创作平台</p>
      </div>
    </div>

    <!-- 导航菜单 -->
    <nav class="nav-menu">
      <router-link
        v-for="item in navItems"
        :key="item.id"
        :to="item.path"
        :class="['nav-item', { active: isActive(item.path) }]"
      >
        <div class="icon-wrapper">
          <i :data-lucide="item.icon" style="width: 18px; height: 18px;"></i>
        </div>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- 会员卡片 -->
    <div class="member-card">
      <!-- 剩余积分显示 -->
      <div class="points-display">
        <i data-lucide="coins" class="points-icon"></i>
        <span class="points-label">剩余积分</span>
        <span class="points-value">{{ remainingPoints }}</span>
      </div>
      <button class="upgrade-btn" @click="goToPricing">立即充值</button>

      <!-- 存储空间信息 -->
      <div class="storage-info">
        <div class="storage-label">
          <span class="storage-text">存储空间</span>
          <i data-lucide="chevron-right" class="storage-arrow" style="width: 14px; height: 14px;"></i>
        </div>
        <div class="storage-bar-bg">
          <div class="storage-bar-fill" :style="{ width: storagePercentage + '%' }"></div>
        </div>
        <div class="storage-value">{{ storageUsed }} / {{ storageTotal }}</div>
      </div>
      <a href="#" class="expand-storage-link" @click.prevent="goToPricing">
        升级存储空间
        <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
      </a>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { useAppStore } from '../../stores/app'
import { userData } from '../../data/userData'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()

const allNavItems = [
  { id: 'home', label: '首页', icon: 'home', path: '/' },
  { id: 'generate', label: '生成', icon: 'sparkles', path: '/generate' },
  { id: 'tools', label: '全部工具', icon: 'layout-grid', path: '/tools' },
  { id: 'community', label: '社区', icon: 'users', path: '/community' },
  { id: 'announcement', label: '公告', icon: 'megaphone', path: '/announcement' },
  { id: 'assets', label: '资产', icon: 'folder-open', path: '/assets' },
  { id: 'enterprise', label: '企业管理', icon: 'building-2', path: '/enterprise/bi', requireRole: ['enterprise', 'admin'] },
  { id: 'admin', label: '管理员', icon: 'shield-check', path: '/admin', requireRole: ['admin'] }
]

const navItems = computed(() => {
  const userType = userStore.user?.user_type
  // 企业管理员和系统管理员可见企业管理菜单，公司账号（employee）不可见
  return allNavItems.filter(item => !item.requireRole || item.requireRole.includes(userType))
})

const storageUsed = computed(() => `${userData.user.storage.used}${userData.user.storage.unit}`)
const storageTotal = computed(() => `${userData.user.storage.total}${userData.user.storage.unit}`)
const storagePercentage = computed(() => (userData.user.storage.used / userData.user.storage.total) * 100)

// 使用 store 的积分状态
const remainingPoints = computed(() => userStore.remainingPoints)

function isActive(path) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

function goToPricing() {
  router.push('/pricing')
}

onMounted(() => {
  if (window.lucide) {
    lucide.createIcons()
  }
  userStore.fetchPoints()
})
</script>

<style scoped>
.sidebar {
  width: 210px;
  min-width: 180px;
  flex-shrink: 0;
  height: 100vh;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(243, 244, 246, 1);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  position: relative;
  z-index: 50;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.logo-icon {
  width: 34px;
  height: 34px;
  background: #2b7cff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.06), 0 4px 12px rgba(99, 102, 241, 0.35);
  overflow: hidden;
}

.logo-custom-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
}

.logo-text h1 {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.logo-text p {
  font-size: 9.5px;
  color: #9ca3af;
  margin-top: 2px;
}

.nav-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 8px;
  color: #64748b;
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.nav-item:hover {
  color: #2563eb;
}

.nav-item:hover .icon-wrapper {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
}

.nav-item.active {
  color: #2563eb;
  font-weight: 600;
}

.nav-item.active::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: #2563eb;
  border-radius: 0 3px 3px 0;
}

.icon-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  color: #3b82f6;
  transition: all 0.2s ease;
}

.nav-item.active .icon-wrapper {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}

.member-card {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  padding: 12px;
  margin-top: auto;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.15);
}

.points-display {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.points-icon {
  width: 16px;
  height: 16px;
  color: #d97706;
}

.points-label {
  font-size: 12px;
  color: #92400e;
  font-weight: 500;
}

.points-value {
  font-size: 15px;
  color: #d97706;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.upgrade-btn {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
}

.upgrade-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(245, 158, 11, 0.35);
}

.storage-info {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(180, 83, 9, 0.15);
}

.storage-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.storage-text {
  font-size: 11.5px;
  color: #92400e;
  font-weight: 500;
}

.storage-arrow {
  color: #d97706;
}

.storage-bar-bg {
  height: 6px;
  background: rgba(180, 83, 9, 0.15);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.storage-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.storage-value {
  font-size: 10.5px;
  color: #b45309;
  text-align: right;
}

.expand-storage-link {
  display: block;
  text-align: center;
  margin-top: 10px;
  font-size: 11.5px;
  color: #d97706;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.expand-storage-link:hover {
  color: #f59e0b;
}
</style>
