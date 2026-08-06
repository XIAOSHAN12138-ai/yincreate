<template>
  <AppLayout>
    <div class="detail-page">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 公告详情 -->
      <div v-else-if="detail" class="detail-content">
        <!-- 返回导航 -->
        <div class="back-nav" @click="goBack">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
          <span>返回公告列表</span>
        </div>

        <!-- 文章头部 -->
        <div class="article-header">
          <div class="header-tags">
            <span :class="['category-badge', `badge-${detail.category}`]">
              {{ getCategoryLabel(detail.category) }}
            </span>
            <span v-if="detail.is_top" class="top-tag">
              <i data-lucide="pin" style="width: 12px; height: 12px;"></i>
              置顶
            </span>
          </div>
          <h1 class="article-title">{{ detail.title }}</h1>
          <div class="article-meta">
            <span class="meta-item">
              <i data-lucide="user" style="width: 14px; height: 14px;"></i>
              {{ detail.author }}
            </span>
            <span class="meta-item">
              <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
              {{ formatDate(detail.published_at || detail.created_at) }}
            </span>
            <span class="meta-item">
              <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
              {{ detail.view_count }} 次浏览
            </span>
          </div>
        </div>

        <!-- 文章正文 -->
        <div class="article-body" v-html="detail.content"></div>

        <!-- 底部操作 -->
        <div class="article-footer">
          <button class="btn-back" @click="goBack">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i>
            返回列表
          </button>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else class="error-state">
        <i data-lucide="file-x" style="width: 48px; height: 48px; color: #fca5a5;"></i>
        <p>公告不存在或已被删除</p>
        <button class="btn-back-error" @click="$router.push('/announcement')">返回公告列表</button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { getAnnouncementDetailApi } from '../api/announcement'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)

const route = useRoute()
const router = useRouter()

const detail = ref(null)
const loading = ref(true)

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goBack() {
  router.push('/announcement')
}

async function fetchDetail() {
  loading.value = true
  try {
    const id = route.params.id
    const res = await getAnnouncementDetailApi(id)
    if (isUnmounted.value) return
    detail.value = res.data
  } catch (e) {
    console.error('获取公告详情失败:', e)
    if (!isUnmounted.value) detail.value = null
  } finally {
    if (!isUnmounted.value) {
      loading.value = false
      if (window.lucide) lucide.createIcons()
    }
  }
}

onMounted(() => {
  fetchDetail()
})

onUnmounted(() => {
  isUnmounted.value = true
})
</script>

<style scoped>
.detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 8px 16px 32px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
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

/* 返回导航 */
.back-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 20px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.back-nav:hover {
  color: #3b82f6;
  background: #eff6ff;
}

/* 文章头部 */
.article-header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f3f4f6;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.category-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
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

.top-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 8px;
  background: #fef2f2;
  color: #ef4444;
  font-size: 11px;
  font-weight: 600;
}

.article-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  margin-bottom: 14px;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 12.5px;
  color: #9ca3af;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 文章正文 */
.article-body {
  font-size: 15px;
  line-height: 1.8;
  color: #374151;
  padding: 8px 0;
}

.article-body :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 28px 0 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid #dbeafe;
}

.article-body :deep(h3) {
  font-size: 17px;
  font-weight: 650;
  color: #1f2937;
  margin: 22px 0 10px;
}

.article-body :deep(p) {
  margin-bottom: 14px;
}

.article-body :deep(ul) {
  margin-bottom: 14px;
  padding-left: 24px;
}

.article-body :deep(li) {
  margin-bottom: 6px;
  line-height: 1.7;
}

.article-body :deep(strong) {
  color: #1d4ed8;
  font-weight: 600;
}

.article-body :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.article-body :deep(a:hover) {
  text-decoration: underline;
}

/* 底部操作 */
.article-footer {
  margin-top: 36px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-back:hover {
  border-color: #93c5fd;
  color: #3b82f6;
  background: #eff6ff;
}

/* 错误状态 */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 0;
  color: #9ca3af;
  font-size: 14px;
}

.btn-back-error {
  margin-top: 8px;
  padding: 8px 20px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-back-error:hover {
  border-color: #93c5fd;
  color: #3b82f6;
}
</style>
