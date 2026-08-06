<template>
  <AppLayout>
    <!-- 实名认证提示 -->
    <Teleport to="body">
      <div v-if="showRealNameTip" class="realname-tip-overlay" @click="closeRealNameTip">
        <div class="realname-tip-modal" @click.stop>
          <div class="tip-icon-wrap">
            <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #f59e0b;"></i>
          </div>
          <h3 class="tip-title">账号暂未实名</h3>
          <p class="tip-desc">请先完成实名认证，以享受完整服务！</p>
          <div class="tip-actions">
            <button class="btn-tip-close" @click="closeRealNameTip">稍后再说</button>
            <button class="btn-tip-go" @click="goToProfile">去实名认证</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 首页主容器 -->
    <div class="home-page">
      <!-- Hero 区域 - 主标题和CTA按钮 -->
      <section class="hero-section">
        <div class="hero-bg-decoration">
          <svg class="hero-floating-icons" width="180" height="180" viewBox="0 0 180 180" fill="none">
            <rect x="20" y="20" width="80" height="80" rx="24" fill="#c7d2fe" opacity="0.35"/>
            <rect x="90" y="90" width="70" height="70" rx="20" fill="#ddd6fe" opacity="0.3"/>
            <circle cx="140" cy="40" r="25" fill="#bfdbfe" opacity="0.4"/>
          </svg>

          <div class="hero-play-button">
            <i data-lucide="play" style="width: 32px; height: 32px; margin-left: 4px;"></i>
          </div>

          <svg class="hero-wave-decoration" width="120" height="40" viewBox="0 0 120 40" fill="none">
            <path d="M0 20 Q 15 10, 30 20 T 60 20 T 90 20 T 120 20" stroke="#818cf8" stroke-width="2.5" fill="none" opacity="0.5"/>
            <path d="M0 28 Q 15 22, 30 28 T 60 28 T 90 28 T 120 28" stroke="#a78bfa" stroke-width="2" fill="none" opacity="0.4"/>
          </svg>
        </div>

        <div class="hero-content">
          <h1 class="hero-title">
            AI 让视频创作更<span>简单</span>
          </h1>
          <p class="hero-subtitle">
            从灵感到成片，一键生成高质量视频
          </p>
          <button class="cta-button" @click="$router.push('/generate')">
            开始创作
            <i data-lucide="arrow-right" style="width: 18px; height: 18px;"></i>
          </button>
        </div>
      </section>

      <!-- 快速开始区域 - 功能入口卡片 -->
      <section class="quick-start-section">
        <div class="section-header">
          <h3 class="section-title">快速开始</h3>
          <router-link to="/tools" class="section-link">
            全部工具
            <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
          </router-link>
        </div>

        <div class="quick-start-grid">
          <div
            v-for="card in quickStartCards"
            :key="card.id"
            class="quick-start-card"
            :style="{ '--card-color': card.color === 'blue' ? '#2563eb' : card.color === 'green' ? '#16a34a' : card.color === 'purple' ? '#9333ea' : '#ea580c' }"
            @click="$router.push('/generate')"
          >
            <div :class="['card-icon-wrapper', card.color]">
              <i :data-lucide="card.icon" style="width: 26px; height: 26px;"></i>
            </div>
            <h4 class="card-title">{{ card.title }}</h4>
            <p class="card-desc">{{ card.desc }}</p>
            <a href="#" class="card-link" @click.prevent="$router.push('/generate')">
              {{ card.linkText }}
              <i data-lucide="arrow-right" style="width: 14px; height: 14px;"></i>
            </a>
          </div>
        </div>
      </section>

      <!-- 社区精选 - 视频推荐列表 -->
      <section class="community-section">
        <div class="section-header">
          <h3 class="section-title">社区精选</h3>
          <router-link to="/community" class="section-link">
            查看更多
            <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
          </router-link>
        </div>

        <div class="tabs-container">
          <button
            v-for="tab in tabs"
            :key="tab"
            :class="['tab-item', { active: activeTab === tab }]"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>

        <div class="video-grid">
          <div v-for="video in videos" :key="video.id" class="video-card">
            <img :src="video.thumbnail" :alt="video.title" class="video-thumbnail" @error="handleImageError">
            <span class="video-duration">{{ video.duration }}</span>
            <div class="video-info">
              <h4 class="video-title">{{ video.title }}</h4>
              <div class="video-meta">
                <div class="video-author">
                  <div class="author-avatar">{{ video.avatar }}</div>
                  <span>{{ video.author }}</span>
                </div>
                <div class="video-stats">
                  <span class="stat-item">
                    <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                    {{ video.views }}
                  </span>
                  <span class="stat-item">
                    <i data-lucide="heart" style="width: 12px; height: 12px;"></i>
                    {{ video.likes }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 最近项目 - 用户项目列表 -->
      <section class="recent-projects-section">
        <div class="section-header">
          <h3 class="section-title">最近项目</h3>
          <router-link to="/assets" class="section-link">
            全部项目
            <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
          </router-link>
        </div>

        <div class="projects-scroll">
          <div class="project-new-card" @click="$router.push('/generate')">
            <div class="new-project-plus">
              <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
            </div>
            <span>新建项目</span>
          </div>

          <div v-if="projectsLoading" class="projects-loading">
            <i data-lucide="loader-2" style="width: 18px; height: 18px;"></i>
            <span>加载中...</span>
          </div>
          <div v-else-if="recentProjects.length === 0" class="projects-empty">
            <span>暂无对话，点击左侧"新建项目"开始创作</span>
          </div>

          <div
            v-for="project in recentProjects"
            :key="project.id"
            class="project-card"
            @click="openConversation(project.id)"
          >
            <div class="project-thumb-wrap">
              <img
                v-if="project.thumbnail && project.thumbnailType === 'image'"
                :src="project.thumbnail"
                :alt="project.name"
                class="project-thumbnail"
                @error="handleImageError"
              >
              <video
                v-else-if="project.thumbnail && project.thumbnailType === 'video'"
                ref="coverVideoRefs"
                :src="project.thumbnail"
                :alt="project.name"
                class="project-thumbnail"
                preload="metadata"
                muted
                playsinline
                @loadeddata="onCoverVideoFrameLoaded"
                @loadedmetadata="onCoverVideoMetaLoaded"
                @error="handleImageError"
              ></video>
              <div v-else class="project-thumbnail project-thumbnail-placeholder">
                <i data-lucide="film" style="width: 28px; height: 28px;"></i>
              </div>
              <!-- 视频播放按钮覆盖层 -->
              <div v-if="project.thumbnail && project.thumbnailType === 'video'" class="play-button-overlay">
                <i data-lucide="play" style="width: 22px; height: 22px; fill: currentColor;"></i>
              </div>
              <!-- 视频时长标签 -->
              <span
                v-if="project.thumbnail && project.thumbnailType === 'video' && project.duration"
                class="video-duration-badge"
              >{{ project.duration }}</span>
            </div>
            <div class="project-info">
              <h4 class="project-name">{{ project.name }}</h4>
              <p class="project-date">{{ project.date }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { videosData } from '../data/videosData'
import { listConversationsApi, listMessagesApi } from '../api/conversation'

const route = useRoute()
const router = useRouter()

const activeTab = ref('推荐')
const tabs = ['推荐', '最新', '热门', '关注']
const showRealNameTip = ref(false)

const quickStartCards = [
  { id: 1, title: '文本转视频', desc: '输入文本，AI生成视频', color: 'blue', icon: 'video', linkText: '去生成 →' },
  { id: 2, title: '图文转视频', desc: '上传图片，生成视频', color: 'green', icon: 'image-plus', linkText: '去生成 →' },
  { id: 3, title: '智能剪辑', desc: '剪辑、拼接、添加特效', color: 'purple', icon: 'scissors', linkText: '去剪辑 →' },
  { id: 4, title: '模版创作', desc: '使用模板快速生成视频', color: 'orange', icon: 'layout-template', linkText: '选择模版 →' }
]

const videos = ref(videosData)
const recentProjects = ref([])
const projectsLoading = ref(false)
// 组件卸载标志：防止异步回调在卸载后修改 state
let isUnmounted = false

function handleImageError(e) {
  e.target.style.display = 'none'
}

// 视频封面加载后 seek 到 0.1s 展示第一帧
function onCoverVideoFrameLoaded(e) {
  const video = e.target
  try {
    if (video.duration > 0.2 && Math.abs(video.currentTime - 0.1) > 0.05) {
      video.currentTime = 0.1
    }
  } catch (_) { /* ignore */ }
}

// 视频元数据加载完成 → 提取时长并格式化回写到对应 project
function onCoverVideoMetaLoaded(e) {
  const video = e.target
  const dur = video && typeof video.duration === 'number' && isFinite(video.duration) ? video.duration : 0
  if (dur <= 0) return
  const formatted = formatVideoDuration(dur)
  if (!formatted) return
  // 通过 src 反查对应 project
  const src = video.src || ''
  const target = recentProjects.value.find(p => p.thumbnail === src)
  if (target && target.duration !== formatted) {
    target.duration = formatted
  }
}

// 把秒数格式化为 mm:ss 或 h:mm:ss
function formatVideoDuration(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 根据 URL 扩展名判断媒体类型
function inferTypeFromUrl(url) {
  if (!url || typeof url !== 'string') return 'image'
  const cleanUrl = url.split('?')[0].toLowerCase()
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv']
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico']
  if (videoExts.some(ext => cleanUrl.endsWith(ext))) return 'video'
  if (imageExts.some(ext => cleanUrl.endsWith(ext))) return 'image'
  return 'image'
}

// 格式化对话时间为展示文案：刚刚 / N 分钟前 / N 小时前 / MM/DD HH:mm
function formatProjectTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `更新于 ${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`
}

// 解包 API 响应：兼容 { code, data } 包装和直接返回业务数据两种格式
function unwrapResponse(resData) {
  if (resData && resData.code === 200 && resData.data !== undefined) {
    return resData.data
  }
  return resData
}

// 从消息列表中提取最近一个生成结果的封面 URL
// 优先使用 result_thumbnail_url，其次用 result_video_url（前端展示时截取第一帧）
// messages 为 created_at ASC 排序，从尾部往前找最新的 assistant 结果
function pickCoverFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'assistant') {
      if (m.result_thumbnail_url) {
        return { url: m.result_thumbnail_url, type: 'image' }
      }
      if (m.result_video_url) {
        return { url: m.result_video_url, type: inferTypeFromUrl(m.result_video_url) }
      }
    }
  }
  return null
}

// 为单个对话异步加载封面（从消息列表提取）
async function loadCoverForProject(project) {
  try {
    const res = await listMessagesApi(project.id, { limit: 50, offset: 0 })
    if (isUnmounted) return
    const data = unwrapResponse(res.data)
    if (!data || !Array.isArray(data.items)) return
    const cover = pickCoverFromMessages(data.items)
    if (!cover) return
    // 找到列表中对应的 project 并更新（避免数组被整体替换后引用失效）
    const target = recentProjects.value.find(p => p.id === project.id)
    if (target) {
      target.thumbnail = cover.url
      target.thumbnailType = cover.type
    }
  } catch (e) {
    // 单个对话封面加载失败不影响其他
    console.warn(`加载对话封面失败(${project.id}):`, e?.message || e)
  }
}

// 并发上限控制的批量加载封面
async function loadCoversBatch(projects, concurrency = 4) {
  const queue = [...projects]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const p = queue.shift()
      if (!p) return
      await loadCoverForProject(p)
    }
  })
  await Promise.all(workers)
}

// 从后端加载最近对话，映射为最近项目列表
async function loadRecentProjects() {
  projectsLoading.value = true
  try {
    const res = await listConversationsApi({ limit: 20, offset: 0 })
    const data = unwrapResponse(res.data)
    if (!data || !Array.isArray(data.items)) {
      recentProjects.value = []
      return
    }
    recentProjects.value = data.items
      .filter(c => (c.status || 'active') === 'active')
      .map(c => ({
        id: c.conversation_id || c.id,
        name: c.title || '未命名对话',
        thumbnail: '',
        thumbnailType: 'image',
        duration: '',
        date: formatProjectTime(new Date(c.last_message_at || c.updated_at || c.created_at).getTime()),
        status: c.status || 'active'
      }))
    // 异步加载封面（不阻塞列表首屏）
    loadCoversBatch(recentProjects.value.slice()).then(() => {
      if (isUnmounted) return
      nextTick(() => { if (window.lucide) lucide.createIcons() })
    })
  } catch (e) {
    console.warn('加载最近对话失败:', e)
    recentProjects.value = []
  } finally {
    projectsLoading.value = false
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  }
}

// 点击项目卡片跳转到生成页面并选中指定对话
function openConversation(conversationId) {
  router.push({ path: '/generate', query: { conversation_id: conversationId } })
}

onMounted(() => {
  if (window.lucide) {
    lucide.createIcons()
  }

  // 拉取最近对话列表（仅展示 active 状态的）
  loadRecentProjects()

  if (route.query.showRealNameTip === 'true') {
    showRealNameTip.value = true
    router.replace({ query: {} })
  }
})

onBeforeUnmount(() => {
  isUnmounted = true
})

const closeRealNameTip = () => {
  showRealNameTip.value = false
}

const goToProfile = () => {
  showRealNameTip.value = false
  router.push('/profile')
}
</script>

<style scoped>
/* 完全基于原始 home.css 的样式 */
.home-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

/* Hero Section - 超紧凑版 */
.hero-section {
  background: linear-gradient(135deg, #eef2ff 0%, #74aee1 50%, #0bacdd 100%);
  border-radius: 20px;
  padding: 20px 24px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(199, 210, 254, 0.5);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08);
  flex-shrink: 0;
  min-height: 110px;
  max-height: 130px;
  margin-bottom: 12px;
}

.hero-bg-decoration {
  position: absolute;
  top: 0;
  right: 0;
  width: 45%;
  height: 100%;
  pointer-events: none;
}

.hero-floating-icons {
  position: absolute;
  top: 20px;
  right: 50px;
  animation: float 6s ease-in-out infinite;
}

.hero-play-button {
  position: absolute;
  bottom: 35px;
  right: 100px;
  width: 55px;
  height: 55px;
  background: linear-gradient(135deg, #63cdf1 0%, #127ef1 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 6px 24px rgba(99, 102, 241, 0.45);
  animation: pulse-glow 3s ease-in-out infinite;
  cursor: pointer;
  transition: all 0.3s ease;
  color: white;
}

.hero-play-button:hover {
  transform: scale(1.08);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 10px 32px rgba(99, 102, 241, 0.55);
}

.hero-wave-decoration {
  position: absolute;
  bottom: 28px;
  right: 40px;
  opacity: 0.6;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 6px 24px rgba(99, 102, 241, 0.45);
  }
  50% {
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 6px 34px rgba(99, 102, 241, 0.65);
  }
}

.hero-content {
  max-width: 380px;
  position: relative;
  z-index: 2;
}

.hero-title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}

.hero-title span {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 12px;
  font-weight: 400;
}

.cta-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  background: linear-gradient(135deg, #5557d2 0%, #27a7ec 100%);
  color: white;
  border: none;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 4px 16px rgba(99, 102, 241, 0.35);
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08), 0 8px 24px rgba(99, 102, 241, 0.45);
}

/* Section Headers */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  font-size: 13.5px;
  font-weight: 650;
  color: #111827;
  letter-spacing: -0.01em;
}

.section-link {
  font-size: 11px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 2px;
  transition: all 0.25s ease;
}

.section-link:hover {
  gap: 5px;
  color: #4f46e5;
}

/* Quick Start Cards - 超紧凑版 */
.quick-start-section {
  margin-bottom: 12px;
}

.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  flex-shrink: 0;
}

.quick-start-card {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03);
}

.quick-start-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--card-color) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.quick-start-card:hover {
  transform: translateY(-3px);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08);
}

.quick-start-card:hover::before {
  opacity: 1;
}

.card-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.card-icon-wrapper.blue {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #2563eb;
}

.card-icon-wrapper.green {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #16a34a;
}

.card-icon-wrapper.purple {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #9333ea;
}

.card-icon-wrapper.orange {
  background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
  color: #ea580c;
}

.quick-start-card:hover .card-icon-wrapper {
  transform: scale(1.08) rotate(-3deg);
}

.card-title {
  font-size: 12px;
  font-weight: 650;
  color: #111827;
  margin-bottom: 3px;
}

.card-desc {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.4;
  margin-bottom: 8px;
}

.card-link {
  font-size: 10.5px;
  color: #6366f1;
  font-weight: 550;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: all 0.25s ease;
}

.card-link:hover {
  gap: 5px;
}

/* Tabs - 超紧凑版 */
.community-section {
  margin-bottom: 12px;
}

.tabs-container {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.tab-item {
  padding: 5px 12px;
  border-radius: 18px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  color: #6b7280;
  background: transparent;
  border: none;
  position: relative;
}

.tab-item:hover {
  color: #3b82f6;
}

.tab-item.active {
  color: #3b82f6;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: #3b82f6;
  border-radius: 2px;
}

/* Video Grid - 超紧凑版 */
.video-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  flex-shrink: 0;
}

.video-card {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  position: relative;
}

.video-card:hover {
  transform: translateY(-4px);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08);
}

.video-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
}

.video-duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  color: white;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 9.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.video-info {
  padding: 7px 9px 9px;
}

.video-title {
  font-size: 10.5px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 5px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9.5px;
  color: #9ca3af;
}

.video-author {
  display: flex;
  align-items: center;
  gap: 4px;
}

.author-avatar {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Recent Projects - 超紧凑版 */
.recent-projects-section {
  margin-bottom: 12px;
}

.projects-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x mandatory;
}

.projects-scroll::-webkit-scrollbar {
  height: 3px;
}

.projects-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.projects-scroll::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 8px;
}

.project-new-card {
  min-width: 140px;
  aspect-ratio: 16/10;
  background: white;
  border: 2px dashed rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #9ca3af;
  scroll-snap-align: start;
}

.project-new-card:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.04);
  transform: scale(1.02);
}

.new-project-plus {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  color: inherit;
}

.project-new-card:hover .new-project-plus {
  background: rgba(99, 102, 241, 0.15);
  transform: rotate(90deg);
}

.project-card {
  min-width: 190px;
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.35s ease;
  scroll-snap-align: start;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  border: 1.5px solid rgba(229, 231, 235, 0.7);
}

.project-card:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08);
}

.project-thumb-wrap {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.project-thumbnail {
  width: 100%;
  aspect-ratio: 16/10;
  object-fit: cover;
  background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
  display: block;
}

.project-thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5b4fc;
}

/* 视频播放按钮覆盖层 */
.play-button-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  pointer-events: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.play-button-overlay i {
  margin-left: 3px;
}

.project-card:hover .play-button-overlay {
  background: rgba(99, 102, 241, 0.85);
  transform: translate(-50%, -50%) scale(1.08);
}

/* 视频时长标签 */
.video-duration-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  color: #fff;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 9.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  line-height: 1.4;
}

.projects-loading,
.projects-empty {
  min-width: 190px;
  aspect-ratio: 16/10;
  background: white;
  border: 1.5px dashed rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 11px;
  padding: 12px;
  text-align: center;
}

.projects-loading i {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.project-info {
  padding: 8px 10px;
  background: white;
}

.project-name {
  font-size: 11px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.project-date {
  font-size: 9px;
  color: #9ca3af;
}

/* 实名认证提示框样式 */
.realname-tip-overlay {
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
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.realname-tip-modal {
  background: white;
  border-radius: 16px;
  padding: 40px 36px;
  max-width: 420px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.tip-icon-wrap {
  margin-bottom: 20px;
  animation: bounceIn 0.5s ease;
}

@keyframes bounceIn {
  0% { transform: scale(0); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.tip-title {
  font-size: 24px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 12px;
}

.tip-desc {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 28px;
}

.tip-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-tip-close,
.btn-tip-go {
  padding: 11px 28px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-tip-close {
  background: white;
  border: 1.5px solid #d1d5db;
  color: #6b7280;
}

.btn-tip-close:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-tip-go {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-tip-go:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

/* 响应式适配 */
@media (max-width: 1200px) {
  .video-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .quick-start-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .video-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .quick-start-grid {
    grid-template-columns: 1fr;
  }
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
