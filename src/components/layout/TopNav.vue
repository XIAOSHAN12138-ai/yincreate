<template>
  <header class="top-nav">
    <!-- 页面标题 -->
    <h2 class="page-title">{{ pageTitle }}</h2>

    <!-- 搜索框 -->
    <div class="search-container">
      <input
        type="text"
        class="search-input"
        placeholder="搜索模板、工具、用户或作品"
        v-model="searchQuery"
        @input="handleSearch"
      >
      <i data-lucide="search" class="search-icon" style="width: 18px; height: 18px;"></i>
    </div>

    <!-- 操作按钮区域 -->
    <div class="nav-actions">
      <!-- 通知按钮 -->
      <button class="action-btn notification-btn" title="通知">
        <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
        <span class="notification-badge">3</span>
      </button>

      <!-- 用户信息 + 悬停下拉菜单 -->
      <div
        class="user-info-wrapper"
        @mouseenter="openUserMenu"
        @mouseleave="scheduleCloseUserMenu"
      >
        <div class="user-info" @click="goToProfile">
          <span class="user-avatar">{{ userAvatar }}</span>
          <span class="user-name">{{ userName }}</span>
          <i
            data-lucide="chevron-down"
            class="user-chevron"
            :class="{ 'chevron-open': userMenuOpen }"
            style="width: 14px; height: 14px;"
          ></i>
        </div>

        <!-- 下拉菜单 -->
        <transition name="user-menu-fade">
          <div v-if="userMenuOpen" class="user-dropdown" @mouseenter="cancelCloseUserMenu" @mouseleave="scheduleCloseUserMenu">
            <button class="dropdown-item" @click="handleMenuClick('profile')">
              <LucideIcon name="user" svgStyle="width: 16px; height: 16px;" />
              <span>个人资料</span>
            </button>
            <button class="dropdown-item" @click="handleMenuClick('password')">
              <LucideIcon name="key-round" svgStyle="width: 16px; height: 16px;" />
              <span>修改密码</span>
            </button>
            <button class="dropdown-item" @click="handleMenuClick('settings')">
              <LucideIcon name="settings" svgStyle="width: 16px; height: 16px;" />
              <span>账户设置</span>
            </button>
            <button class="dropdown-item" @click="handleMenuClick('assets')">
              <LucideIcon name="folder" svgStyle="width: 16px; height: 16px;" />
              <span>我的资产</span>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout-item" @click="handleMenuClick('logout')">
              <LucideIcon name="log-out" svgStyle="width: 16px; height: 16px;" />
              <span>退出登录</span>
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { useAppStore } from '../../stores/app'
import { userData } from '../../data/userData'
import LucideIcon from '../LucideIcon.vue'

const props = defineProps({
  pageTitle: {
    type: String,
    default: '首页'
  }
})

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const searchQuery = ref('')

const userAvatar = computed(() => userStore.user?.avatar || '👤')
const userName = computed(() => userStore.user?.name || '用户')

// 用户下拉菜单：鼠标悬停显示，移出延迟关闭（避免滑过间隙时误关）
const userMenuOpen = ref(false)
let closeTimer = null

function openUserMenu() {
  cancelCloseUserMenu()
  userMenuOpen.value = true
}

function scheduleCloseUserMenu() {
  cancelCloseUserMenu()
  closeTimer = setTimeout(() => {
    userMenuOpen.value = false
  }, 150)
}

function cancelCloseUserMenu() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function closeUserMenu() {
  cancelCloseUserMenu()
  userMenuOpen.value = false
}

async function handleMenuClick(key) {
  closeUserMenu()
  if (key === 'logout') {
    await userStore.logout()
    router.push('/login')
    return
  }
  if (key === 'profile') {
    router.push('/profile')
  } else if (key === 'password') {
    router.push({ path: '/settings', query: { section: 'password' } })
  } else if (key === 'settings') {
    router.push('/settings')
  } else if (key === 'assets') {
    router.push('/assets')
  }
}

function handleSearch() {
  appStore.setSearchQuery(searchQuery.value)
}

function goToProfile() {
  router.push('/profile')
}

function goToAssets() {
  router.push('/assets')
}

onMounted(() => {
  if (window.lucide) {
    lucide.createIcons()
  }
})

onBeforeUnmount(() => {
  cancelCloseUserMenu()
})
</script>

<style scoped>
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 28px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(229, 231, 235, 0.7);
  gap: 20px;
  position: relative;
  /* 提升整个顶栏层级，确保下拉菜单不会被下方 content-wrapper 遮挡 */
  z-index: 100;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.search-container {
  flex: 1;
  max-width: 480px;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 16px 10px 42px;
  border: 1.5px solid rgba(209, 213, 219, 0.8);
  border-radius: 10px;
  font-size: 13.5px;
  background: white;
  outline: none;
  transition: all 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.search-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-btn {
  width: 38px;
  height: 38px;
  border: none;
  background: transparent;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s ease;
  position: relative;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  color: #4338ca;
}

.notification-btn {
  position: relative;
}

.asset-nav-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  width: auto;
  padding: 0 12px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4338ca;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.asset-nav-btn:hover {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  border-color: rgba(99, 102, 241, 0.3);
}

.asset-nav-label {
  white-space: nowrap;
}

.notification-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  border: 2px solid white;
}

.user-info-wrapper {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1.5px solid transparent;
}

.user-info:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: rgba(99, 102, 241, 0.15);
}

.user-chevron {
  transition: transform 0.25s ease;
  color: #6b7280;
}

.user-chevron.chevron-open {
  transform: rotate(180deg);
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

/* 下拉菜单 */
.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: white;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 6px;
  z-index: 9999;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  color: #374151;
  transition: all 0.15s ease;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(99, 102, 241, 0.08);
  color: #4338ca;
}

.dropdown-item :deep(svg) {
  flex-shrink: 0;
  color: #6b7280;
  transition: color 0.15s ease;
}

.dropdown-item:hover :deep(svg) {
  color: #4338ca;
}

.dropdown-divider {
  height: 1px;
  background: rgba(229, 231, 235, 0.9);
  margin: 6px 4px;
}

.logout-item {
  color: #dc2626;
}

.logout-item:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
}

.logout-item :deep(svg) {
  color: #dc2626;
}

.logout-item:hover :deep(svg) {
  color: #b91c1c;
}

/* 下拉动画 */
.user-menu-fade-enter-active,
.user-menu-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.user-menu-fade-enter-from,
.user-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
