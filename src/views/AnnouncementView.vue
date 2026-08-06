<template>
  <AppLayout>
    <div class="announcement-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">平台公告</h1>
          <p class="page-subtitle">了解最新功能更新、活动信息和教程指南</p>
        </div>
      </div>

      <!-- 分类标签 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          :class="['category-tab', { active: activeCategory === cat.key }]"
          @click="switchCategory(cat.key)"
        >
          <i :data-lucide="cat.icon" style="width: 16px; height: 16px;"></i>
          <span>{{ cat.label }}</span>
          <span v-if="cat.count > 0" class="tab-count">{{ cat.count }}</span>
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 公告列表 -->
      <div v-else-if="announcements.length > 0" class="announcement-list">
        <div
          v-for="item in announcements"
          :key="item.id"
          class="announcement-card"
          @click="goToDetail(item.id)"
        >
          <div class="card-left">
            <span :class="['category-badge', `badge-${item.category}`]">
              {{ getCategoryLabel(item.category) }}
            </span>
            <div v-if="item.is_top" class="top-badge">
              <i data-lucide="pin" style="width: 12px; height: 12px;"></i>
              置顶
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-summary">{{ item.summary }}</p>
            <div class="card-meta">
              <span class="meta-item">
                <i data-lucide="user" style="width: 12px; height: 12px;"></i>
                {{ item.author }}
              </span>
              <span class="meta-item">
                <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                {{ formatDate(item.published_at || item.created_at) }}
              </span>
              <span class="meta-item">
                <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                {{ item.view_count }}
              </span>
            </div>
          </div>
          <div class="card-arrow">
            <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <i data-lucide="inbox" style="width: 48px; height: 48px; color: #c7d2fe;"></i>
        <p>暂无公告内容</p>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
          <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
        </button>
        <button
          v-for="p in totalPages"
          :key="p"
          :class="['page-num', { active: currentPage === p }]"
          @click="currentPage = p"
        >
          {{ p }}
        </button>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
          <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { getAnnouncementsApi } from '../api/announcement'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)

const router = useRouter()

const categories = ref([
  { key: '', label: '全部', icon: 'layout-list', count: 0 },
  { key: 'update', label: '功能更新', icon: 'rocket', count: 0 },
  { key: 'event', label: '活动', icon: 'party-popper', count: 0 },
  { key: 'tutorial', label: '教程', icon: 'book-open', count: 0 }
])

const activeCategory = ref('')
const announcements = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)

const totalPages = computed(() => Math.ceil(total.value / pageSize))

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchAnnouncements() {
  loading.value = true
  try {
    const res = await getAnnouncementsApi({
      category: activeCategory.value || undefined,
      page: currentPage.value,
      page_size: pageSize,
      status: 'published'
    })
    if (isUnmounted.value) return
    announcements.value = res.data.items
    total.value = res.data.total
  } catch (e) {
    console.error('获取公告失败:', e)
  } finally {
    if (!isUnmounted.value) {
      loading.value = false
      if (window.lucide) lucide.createIcons()
    }
  }
}

async function fetchCategoryCounts() {
  try {
    const res = await getAnnouncementsApi({ page: 1, page_size: 1, status: 'published' })
    if (isUnmounted.value) return
    // 替换整项以触发响应式更新
    categories.value[0] = { ...categories.value[0], count: res.data.total }
    for (let i = 1; i < categories.value.length; i++) {
      const catRes = await getAnnouncementsApi({
        category: categories.value[i].key,
        page: 1,
        page_size: 1,
        status: 'published'
      })
      if (isUnmounted.value) return
      categories.value[i] = { ...categories.value[i], count: catRes.data.total }
    }
  } catch (e) {
    // 静默处理
  }
}

function switchCategory(key) {
  activeCategory.value = key
  currentPage.value = 1
  fetchAnnouncements()
}

function goToDetail(id) {
  router.push(`/announcement/${id}`)
}

watch(currentPage, () => {
  fetchAnnouncements()
})

onMounted(() => {
  fetchAnnouncements()
  fetchCategoryCounts()
})

onUnmounted(() => {
  isUnmounted.value = true
})
</script>

<style scoped>
.announcement-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 8px 16px 24px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: #9ca3af;
}

/* 分类标签 */
.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1.5px solid #e5e7eb;
  border-radius: 20px;
  background: white;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
}

.category-tab:hover {
  border-color: #93c5fd;
  color: #3b82f6;
  background: #eff6ff;
}

.category-tab.active {
  border-color: #3b82f6;
  color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  font-weight: 600;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e5e7eb;
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
}

.category-tab.active .tab-count {
  background: #bfdbfe;
  color: #1d4ed8;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: #9ca3af;
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 公告列表 */
.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.announcement-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03);
}

.announcement-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 16px -2px rgba(59, 130, 246, 0.12);
  transform: translateY(-2px);
}

.card-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 70px;
}

.category-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.badge-update {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-event {
  background: #dcfce7;
  color: #15803d;
}

.badge-tutorial {
  background: #fef3c7;
  color: #b45309;
}

.top-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #ef4444;
  font-weight: 600;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 650;
  color: #111827;
  margin-bottom: 6px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary {
  font-size: 12.5px;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 11px;
  color: #9ca3af;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-arrow {
  color: #d1d5db;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.announcement-card:hover .card-arrow {
  color: #3b82f6;
  transform: translateX(3px);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: #9ca3af;
  font-size: 14px;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 24px;
}

.page-btn {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: #93c5fd;
  color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-num {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-num:hover {
  border-color: #93c5fd;
  color: #3b82f6;
}

.page-num.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  font-weight: 600;
}
</style>
