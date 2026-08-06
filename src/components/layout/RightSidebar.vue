<template>
  <aside class="right-sidebar">
    <!-- 用户信息和统计数据 -->
    <div class="user-section">
      <!-- 未登录状态 -->
      <div v-if="!userStore.isLoggedIn" class="user-profile login-prompt" @click="$router.push('/login')">
        <div class="user-avatar">?</div>
        <div class="user-details">
          <span class="user-name">点击登录</span>
          <p class="user-id">登录后查看更多信息</p>
        </div>
      </div>
      <!-- 已登录状态 -->
      <template v-else>
        <div class="user-profile" @click="$router.push('/profile')">
          <!-- 用户头像 -->
          <div class="user-avatar">{{ displayAvatar }}</div>
          <div class="user-details">
            <div class="user-name-row">
              <span class="user-name">{{ displayName }}</span>
              <!-- VIP标识 -->
              <span v-if="displayIsVip" class="vip-badge">
                <i data-lucide="crown" style="width: 10px; height: 10px;"></i>
                VIP
              </span>
            </div>
            <p class="user-id">ID: {{ displayUserId }}</p>
            <p v-if="displayVipExpiry" class="user-date">会员有效期：{{ displayVipExpiry }}</p>
          </div>
        </div>

        <!-- 统计数据网格 -->
        <div class="stats-grid">
          <div v-for="stat in userStats" :key="stat.id" class="stat-card">
            <div class="stat-number">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 平台公告 -->
    <div class="sidebar-section">
      <div class="sidebar-section-header">
        <h3 class="sidebar-section-title">平台公告</h3>
        <router-link to="/announcement" class="section-link-small">查看更多</router-link>
      </div>
      <div class="announcement-list">
        <div
          v-for="item in announcements"
          :key="item.id"
          class="announcement-item"
          @click="goToAnnouncement(item.id)"
        >
          <span :class="['announcement-tag', `tag-${item.type || item.category}`]">
            【{{ item.tag || getCategoryLabel(item.category) }}】
          </span>
          <span class="announcement-text">{{ item.text || item.title }}</span>
          <span class="announcement-date">{{ item.date || formatDate(item.published_at) }}</span>
        </div>
      </div>
    </div>

    <!-- 推荐工具 -->
    <div class="sidebar-section">
      <div class="sidebar-section-header">
        <h3 class="sidebar-section-title">推荐工具</h3>
        <router-link to="/tools" class="section-link-small">全部工具</router-link>
      </div>
      <div class="tools-grid">
        <div v-for="tool in recommendedTools" :key="tool.id" class="tool-card">
          <div :class="['tool-icon-wrapper', tool.color]">
            <i :data-lucide="tool.icon" style="width: 18px; height: 18px;"></i>
          </div>
          <div class="tool-info">
            <h4 class="tool-name">{{ tool.name }}</h4>
            <p class="tool-desc">{{ tool.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { userData } from '../../data/userData'
import { getLatestAnnouncementsApi } from '../../api/announcement'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)

const router = useRouter()
const userStore = useUserStore()

// 从后端用户数据计算显示值
const displayAvatar = computed(() => {
  const name = userStore.user?.name || ''
  return name ? name.charAt(0) : '?'
})

const displayName = computed(() => {
  return userStore.user?.name || '未知用户'
})

const displayUserId = computed(() => {
  return userStore.user?.user_id || userStore.user?.enterprise_id || '--'
})

const displayIsVip = computed(() => {
  return userStore.user?.permission_level >= 5
})

const displayVipExpiry = computed(() => {
  // 后端暂无会员有效期字段，后续可扩展
  return userStore.user?.vip_expiry || ''
})

const userStats = computed(() => {
  // 优先使用后端返回的统计数据，否则使用本地默认
  const stats = userStore.user?.stats || userData.user.stats
  return [
    { id: 'works', value: stats.works, label: '我的作品' },
    { id: 'drafts', value: stats.drafts, label: '草稿箱' },
    { id: 'favorites', value: stats.favorites, label: '收藏夹' },
    { id: 'assets', value: stats.assets, label: '素材库' }
  ]
})

const announcements = ref(userData.announcements)
const recommendedTools = userData.recommendedTools

const categoryLabels = {
  update: '功能更新',
  event: '活动',
  tutorial: '教程'
}

function getCategoryLabel(key) {
  return categoryLabels[key] || key
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goToAnnouncement(id) {
  router.push(`/announcement/${id}`)
}

async function fetchLatestAnnouncements() {
  try {
    const res = await getLatestAnnouncementsApi({ limit: 4 })
    if (isUnmounted.value) return
    if (res.data && res.data.length > 0) {
      announcements.value = res.data.map(item => ({
        id: item.id,
        tag: getCategoryLabel(item.category),
        type: item.category,
        text: item.title,
        date: formatDate(item.published_at || item.created_at)
      }))
    }
  } catch (e) {
    // 使用本地默认数据
  }
}

onMounted(async () => {
  if (window.lucide) {
    lucide.createIcons()
  }
  fetchLatestAnnouncements()
  // 登录状态下获取最新用户信息
  if (userStore.isLoggedIn) {
    try {
      await userStore.fetchProfile()
      if (isUnmounted.value) return
      // 重新渲染 lucide 图标（VIP徽章等可能变化）
      if (window.lucide) lucide.createIcons()
    } catch {
      // 获取失败不影响页面展示
    }
  }
})

onUnmounted(() => {
  isUnmounted.value = true
})
</script>

<style scoped>
.right-sidebar {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(243, 244, 246, 1);
  padding: 16px 14px;
  position: relative;
  z-index: 50;
}

.right-sidebar::-webkit-scrollbar {
  width: 3px;
}

.right-sidebar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 8px;
}

.user-section {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  margin-bottom: 12px;
  cursor: pointer;
}

.user-profile.login-prompt {
  margin-bottom: 0;
}

.user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #6366f1;
  flex-shrink: 0;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.user-name {
  font-size: 13px;
  font-weight: 650;
  color: #111827;
}

.vip-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 6px;
  font-size: 9px;
  font-weight: 700;
  color: #92400e;
  letter-spacing: 0.03em;
}

.user-id {
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 2px;
}

.user-date {
  font-size: 9px;
  color: #9ca3af;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 0;
}

.stat-card {
  text-align: center;
  padding: 10px 5px;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: default;
}

.stat-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.06);
}

.stat-number {
  font-size: 18px;
  font-weight: 750;
  color: #111827;
  margin-bottom: 3px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 9.5px;
  color: #9ca3af;
  font-weight: 500;
}

.sidebar-section {
  margin-bottom: 14px;
  background: #ffffff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1.5px solid rgba(229, 231, 235, 0.7);
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sidebar-section-title {
  font-size: 13.5px;
  font-weight: 650;
  color: #111827;
}

.section-link-small {
  font-size: 11px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.25s ease;
}

.section-link-small:hover {
  color: #4f46e5;
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.announcement-item {
  padding: 10px 12px;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 12px;
  transition: all 0.25s ease;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.4;
}

.announcement-item:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.06);
  transform: translateX(2px);
}

.announcement-tag {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
  margin-right: 4px;
  vertical-align: middle;
}

.tag-update {
  background: #dbeafe;
  color: #1d4ed8;
}

.tag-event {
  background: #dcfce7;
  color: #15803d;
}

.tag-feature {
  background: #f3e8ff;
  color: #7c3aed;
}

.announcement-text {
  font-size: 10px;
  color: #6b7280;
  display: inline;
  line-height: 1.4;
}

.announcement-date {
  font-size: 9px;
  color: #9ca3af;
  margin-left: auto;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.tool-card {
  padding: 10px;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tool-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.06);
  transform: translateY(-2px);
}

.tool-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.tool-icon-wrapper.blue {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #2563eb;
}

.tool-icon-wrapper.purple {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #9333ea;
}

.tool-icon-wrapper.green {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #16a34a;
}

.tool-icon-wrapper.orange {
  background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
  color: #ea580c;
}

.tool-name {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 3px;
}

.tool-desc {
  font-size: 9px;
  color: #9ca3af;
  line-height: 1.35;
}
</style>
