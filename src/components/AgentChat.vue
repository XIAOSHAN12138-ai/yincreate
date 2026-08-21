<template>
  <div class="agent-chat-widget">
    <!-- 聊天面板（9:16 竖屏） -->
    <transition name="agent-panel">
      <section v-if="open" class="agent-panel" aria-label="智能体对话">
        <!-- 头部 -->
        <header class="agent-header">
          <div class="agent-header-info">
            <span class="agent-avatar">
              <LucideIcon name="sparkles" svgStyle="width: 18px; height: 18px;" />
            </span>
            <div class="agent-header-text">
              <span class="agent-name">智能助手</span>
              <span class="agent-status">
                <span class="agent-status-dot" :class="{ 'status-error': agentError }"></span>
                {{ statusText }}
              </span>
            </div>
          </div>
          <div class="agent-header-actions">
            <button
              class="agent-icon-btn"
              :class="{ active: view === 'history' }"
              @click="toggleHistory"
              title="历史对话"
              aria-label="历史对话"
            >
              <LucideIcon name="history" svgStyle="width: 16px; height: 16px;" />
            </button>
            <button
              class="agent-icon-btn"
              @click="resetConversation"
              title="新对话"
              aria-label="新对话"
              :disabled="loading"
            >
              <LucideIcon name="plus" svgStyle="width: 16px; height: 16px;" />
            </button>
            <button
              class="agent-icon-btn"
              @click="toggleOpen"
              title="收起"
              aria-label="收起"
            >
              <LucideIcon name="x" svgStyle="width: 16px; height: 16px;" />
            </button>
          </div>
        </header>

        <!-- ===== 历史对话视图 ===== -->
        <div v-if="view === 'history'" class="agent-history">
          <div class="agent-history-head">
            <span class="agent-history-title">历史对话</span>
            <span class="agent-history-count">{{ history.length }} 条</span>
          </div>
          <div v-if="history.length === 0" class="agent-history-empty">
            <LucideIcon name="messages-square" svgStyle="width: 28px; height: 28px; opacity: 0.4;" />
            <span>暂无历史对话</span>
          </div>
          <div v-else class="agent-history-list">
            <div
              v-for="item in history"
              :key="item.id"
              class="agent-history-item"
              :class="{ active: item.id === currentHistoryId }"
              @click="switchConversation(item)"
            >
              <div class="agent-history-item-main">
                <span class="agent-history-item-title">{{ item.title || '新对话' }}</span>
                <span class="agent-history-item-meta">{{ formatTime(item.updatedAt) }}</span>
              </div>
              <button
                class="agent-history-del"
                title="删除"
                aria-label="删除"
                @click.stop="deleteConversation(item.id)"
              >
                <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
          </div>
        </div>

        <!-- ===== 聊天视图 ===== -->
        <template v-else>
        <!-- Agent 模型切换 -->
        <div class="agent-picker">
          <button
            type="button"
            class="agent-model-trigger"
            :class="{ active: showAgentMenu }"
            :disabled="loading"
            :aria-expanded="showAgentMenu"
            aria-haspopup="listbox"
            title="切换模型"
            @click="showAgentMenu = !showAgentMenu"
          >
            <span class="agent-model-icon">
              <LucideIcon name="bot" svgStyle="width: 15px; height: 15px;" />
            </span>
            <span class="agent-model-copy">
              <span class="agent-model-label">当前模型</span>
              <span class="agent-model-name">{{ currentAgentLabel }}</span>
            </span>
            <span v-if="currentAgentSupportsImages" class="agent-model-capability">图像</span>
            <LucideIcon name="chevron-down" svgStyle="width: 15px; height: 15px;" />
          </button>

          <div v-if="showAgentMenu" class="agent-model-menu" role="listbox" aria-label="选择智能体模型">
            <div v-if="agentsLoading" class="agent-model-empty">正在加载模型…</div>
            <div v-else-if="agents.length === 0" class="agent-model-empty">暂无可用模型</div>
            <template v-else>
              <button
                v-for="agent in agents"
                :key="agent.agent_id"
                type="button"
                role="option"
                class="agent-model-option"
                :class="{ selected: agent.agent_id === currentAgentId }"
                :aria-selected="agent.agent_id === currentAgentId"
                @click="selectAgent(agent)"
              >
                <span class="agent-model-option-main">
                  <span class="agent-model-option-name">{{ agent.display_name || agent.agent_id }}</span>
                  <span class="agent-model-option-id">{{ agent.agent_id }}</span>
                </span>
                <span v-if="agent.supports_images" class="agent-model-capability">图像</span>
                <LucideIcon
                  v-if="agent.agent_id === currentAgentId"
                  name="check"
                  svgStyle="width: 15px; height: 15px;"
                />
              </button>
            </template>
          </div>
        </div>

        <!-- 消息列表 -->
        <div ref="messagesRef" class="agent-messages">
          <div v-if="agentError" class="agent-error-banner">
            <LucideIcon name="alert-triangle" svgStyle="width: 14px; height: 14px;" />
            <span>{{ agentError }}</span>
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['agent-msg', `agent-msg-${msg.role}`]"
          >
            <span v-if="msg.role === 'assistant'" class="agent-msg-avatar">
              <LucideIcon name="sparkles" svgStyle="width: 14px; height: 14px;" />
            </span>
            <div class="agent-msg-body">
              <div v-if="msg.content" class="agent-msg-bubble">{{ msg.content }}</div>
              <div v-if="msg.images?.length" class="agent-msg-images">
                <img
                  v-for="image in msg.images"
                  :key="image.id || image.previewUrl"
                  :src="image.previewUrl"
                  :alt="image.name || '对话图片'"
                  class="agent-msg-image"
                />
              </div>
            </div>
          </div>
          <!-- 正在输入指示 -->
          <div v-if="loading" class="agent-msg agent-msg-assistant">
            <span class="agent-msg-avatar">
              <LucideIcon name="sparkles" svgStyle="width: 14px; height: 14px;" />
            </span>
            <div class="agent-typing">
              <span class="agent-typing-dot"></span>
              <span class="agent-typing-dot"></span>
              <span class="agent-typing-dot"></span>
            </div>
          </div>
        </div>

        <!-- 快捷建议 -->
        <div v-if="showSuggestions" class="agent-suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            class="agent-suggestion-chip"
            @click="send(s)"
          >{{ s }}</button>
        </div>

        <transition name="agent-tools">
          <div v-if="showToolPanel" class="agent-tool-panel" aria-label="更多功能">
            <button
              type="button"
              class="agent-tool-item"
              :disabled="!currentAgentSupportsImages || loading || attachments.length >= MAX_IMAGES"
              @click="openImagePicker"
            >
              <span class="agent-tool-icon">
                <LucideIcon name="image-plus" svgStyle="width: 20px; height: 20px;" />
              </span>
              <span class="agent-tool-copy">
                <span class="agent-tool-name">上传图片</span>
                <span class="agent-tool-hint">JPEG、PNG、WebP</span>
              </span>
            </button>
            <button
              v-if="currentAgentSupportsImages"
              type="button"
              class="agent-tool-item agent-tool-item-secondary"
              :disabled="loading || attachments.length >= MAX_IMAGES"
              @click="toggleUrlForm"
            >
              <span class="agent-tool-icon">
                <LucideIcon name="link" svgStyle="width: 19px; height: 19px;" />
              </span>
              <span class="agent-tool-copy">
                <span class="agent-tool-name">图片链接</span>
                <span class="agent-tool-hint">HTTPS 地址</span>
              </span>
            </button>
            <span v-if="!currentAgentSupportsImages" class="agent-tool-disabled-note">
              当前模型不支持图片
            </span>
          </div>
        </transition>

        <div v-if="attachments.length || showUrlForm || attachmentError" class="agent-attachment-area">
          <div v-if="attachments.length" class="agent-attachment-list">
            <div v-for="attachment in attachments" :key="attachment.id" class="agent-attachment-item">
              <img :src="attachment.previewUrl" :alt="attachment.name || '待发送图片'" />
              <button
                type="button"
                class="agent-attachment-remove"
                :aria-label="`移除${attachment.name || '图片'}`"
                @click="removeAttachment(attachment.id)"
              >
                <LucideIcon name="x" svgStyle="width: 12px; height: 12px;" />
              </button>
            </div>
          </div>
          <form v-if="showUrlForm" class="agent-url-form" @submit.prevent="addUrlAttachment">
            <input
              ref="urlInputRef"
              v-model="imageUrlDraft"
              type="url"
              class="agent-url-input"
              placeholder="https://example.com/image.png"
              aria-label="图片 HTTPS 地址"
            />
            <select v-model="imageUrlMediaType" class="agent-url-type" aria-label="图片类型">
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
            <button type="submit" class="agent-url-add">添加</button>
          </form>
          <div v-if="attachmentError" class="agent-attachment-error" role="alert">{{ attachmentError }}</div>
        </div>

        <!-- 输入区 -->
        <footer class="agent-input-wrap">
          <input
            ref="imageInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            class="agent-file-input"
            @change="selectImageFiles"
          />
          <button
            type="button"
            class="agent-plus-btn"
            :class="{ active: showToolPanel }"
            :disabled="loading"
            :aria-expanded="showToolPanel"
            aria-label="展开更多功能"
            title="更多功能"
            @click="toggleToolPanel"
          >
            <LucideIcon name="plus" svgStyle="width: 19px; height: 19px;" />
          </button>
          <textarea
            ref="inputRef"
            v-model="draft"
            class="agent-input"
            placeholder="给智能助手发消息…"
            rows="1"
            :disabled="loading"
            @keydown.enter.exact.prevent="send()"
            @input="autoGrow"
          ></textarea>
          <button
            class="agent-send-btn"
            :disabled="(!draft.trim() && !attachments.length) || loading"
            @click="send()"
            title="发送"
            aria-label="发送"
          >
            <LucideIcon name="send-horizontal" svgStyle="width: 16px; height: 16px;" />
          </button>
        </footer>
        </template>
      </section>
    </transition>

    <!-- 圆形触发按钮 -->
    <button
      class="agent-fab"
      :class="{ 'is-open': open }"
      @click="toggleOpen"
      :title="open ? '收起智能助手' : '打开智能助手'"
      :aria-label="open ? '收起智能助手' : '打开智能助手'"
    >
      <LucideIcon v-if="!open" name="message-circle-more" svgStyle="width: 24px; height: 24px;" />
      <LucideIcon v-else name="chevron-down" svgStyle="width: 24px; height: 24px;" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useUserStore } from '../stores/user'
import LucideIcon from './LucideIcon.vue'
import {
  listAgentsApi,
  createAgentConversationApi,
  listAgentConversationsApi,
  getAgentConversationApi,
  deleteAgentConversationApi,
  chatStreamApi,
  genRequestId
} from '../api/agent'

const userStore = useUserStore()

const open = ref(false)
const draft = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)
const imageInputRef = ref(null)
const urlInputRef = ref(null)

const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
let attachmentId = 0
const attachments = ref([])
const attachmentError = ref('')
const showUrlForm = ref(false)
const showToolPanel = ref(false)
const showAgentMenu = ref(false)
const agentsLoading = ref(false)
const imageUrlDraft = ref('')
const imageUrlMediaType = ref('image/jpeg')

// 视图：chat 聊天 / history 历史列表
const view = ref('chat')

// 历史会话列表（最新在前）
const history = ref([])
// 当前活跃会话在历史中的标识
const currentHistoryId = ref(null)

let msgId = 0
const messages = ref([
  {
    id: ++msgId,
    role: 'assistant',
    content: '你好，我是你的智能助手，有什么可以帮你的吗？'
  }
])

const suggestions = [
  '介绍下这个平台',
  '如何生成视频？',
  '查看我的资产'
]
const showSuggestions = ref(true)

// Agent 列表与当前选择
const agents = ref([])
const currentAgentId = ref(import.meta.env.VITE_AGENT_DEFAULT_ID || 'deepseek-text')
const currentAgentSupportsImages = computed(() => {
  return agents.value.find(agent => agent.agent_id === currentAgentId.value)?.supports_images === true
})
const currentAgentLabel = computed(() => {
  if (agentsLoading.value) return '加载中…'
  const current = agents.value.find(agent => agent.agent_id === currentAgentId.value)
  return current?.display_name || current?.agent_id || currentAgentId.value || '未选择模型'
})

// 当前服务端会话与隔离身份
const conversationId = ref(null)
const userId = ref(null)
const tenantId = ref(null)

// 错误提示
const agentError = ref(null)

const statusText = computed(() => {
  if (agentError.value) return '连接异常'
  if (loading.value) return '思考中…'
  return '在线'
})

/**
 * 切换历史视图 / 返回聊天视图
 */
function toggleHistory() {
  if (view.value === 'history') {
    view.value = 'chat'
    nextTick(() => { scrollToBottom(); inputRef.value?.focus() })
  } else {
    view.value = 'history'
  }
}

/**
 * 格式化时间戳为简短文本
 */
function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const pad = (n) => String(n).padStart(2, '0')
  if (isToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 从服务端消息结构提取可展示文本
 */
function messageText(content) {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(part => part?.text || '').filter(Boolean).join('\n')
  }
  return content?.text || messageText(content?.content) || ''
}

function messageImages(content) {
  if (!content) return []
  const parts = Array.isArray(content) ? content : (Array.isArray(content.content) ? content.content : [])
  return parts.flatMap((part, index) => {
    if (part?.type === 'image_url' && part.url) {
      return [{ id: `url-${index}-${part.url}`, previewUrl: part.url, name: '链接图片' }]
    }
    if (part?.type === 'image_base64' && part.data && SUPPORTED_IMAGE_TYPES.has(part.media_type)) {
      return [{
        id: `base64-${index}`,
        previewUrl: `data:${part.media_type};base64,${part.data}`,
        name: '上传图片'
      }]
    }
    return []
  })
}

/**
 * 统一服务端会话摘要字段
 */
function normalizeConversation(item) {
  return {
    ...item,
    id: item.id || item.conversation_id,
    title: item.title || '新对话',
    agentId: item.agent_id,
    updatedAt: item.updated_at || item.created_at
  }
}

/**
 * 平台接口的租户与用户隔离参数
 */
function identityParams() {
  return { tenant_id: tenantId.value, user_id: userId.value }
}

/**
 * 从服务端加载历史会话
 */
async function loadHistory() {
  ensureIdentity()
  const data = await listAgentConversationsApi(identityParams())
  const items = Array.isArray(data) ? data : (data.items || data.conversations || [])
  history.value = items.map(normalizeConversation)
}

/**
 * 切换到指定历史会话
 */
async function switchConversation(item) {
  if (loading.value) return
  loading.value = true
  agentError.value = null
  try {
    const detail = await getAgentConversationApi(item.id, identityParams())
    const serverMessages = detail.messages || detail.items || detail.conversation?.messages || []
    currentHistoryId.value = item.id
    conversationId.value = item.id
    if (item.agentId || detail.agent_id) currentAgentId.value = item.agentId || detail.agent_id
    messages.value = serverMessages.map(m => ({
      id: m.id || m.message_id || ++msgId,
      role: m.role,
      content: messageText(m.content ?? m.message),
      images: messageImages(m.content ?? m.message)
    }))
    clearAttachments()
    showSuggestions.value = messages.value.every(m => m.role !== 'user')
    view.value = 'chat'
    nextTick(() => { scrollToBottom(); inputRef.value?.focus() })
  } catch (e) {
    agentError.value = `加载对话失败：${e.message}`
  } finally {
    loading.value = false
  }
}

/**
 * 删除指定历史会话
 */
async function deleteConversation(id) {
  if (loading.value) return
  try {
    await deleteAgentConversationApi(id, identityParams())
    history.value = history.value.filter(h => h.id !== id)
    if (id === currentHistoryId.value) {
      resetConversation()
      view.value = 'history'
    }
  } catch (e) {
    agentError.value = `删除对话失败：${e.message}`
  }
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      scrollToBottom()
      inputRef.value?.focus()
      // 首次打开时初始化会话身份与 Agent 列表
      ensureIdentity()
      fetchAgentsOnce()
      fetchHistoryOnce()
    })
  }
}

function autoGrow() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 96) + 'px'
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/**
 * 初始化 tenant_id / user_id 隔离身份
 */
function ensureIdentity() {
  if (userId.value && tenantId.value) return

  const user = userStore.user || {}
  userId.value = user.user_id || 'anonymous'
  tenantId.value = user.enterprise_id || user.user_id || 'default-tenant'
}

function nextAttachmentId() {
  attachmentId += 1
  return `image-${Date.now()}-${attachmentId}`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`读取图片“${file.name}”失败`))
    reader.readAsDataURL(file)
  })
}

async function selectImageFiles(event) {
  showToolPanel.value = false
  attachmentError.value = ''
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  const available = MAX_IMAGES - attachments.value.length
  if (files.length > available) {
    attachmentError.value = `最多发送 ${MAX_IMAGES} 张图片，本次仅添加前 ${available} 张。`
  }

  for (const file of files.slice(0, available)) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      attachmentError.value = '仅支持 JPEG、PNG、WebP 图片。'
      continue
    }
    if (file.size > MAX_IMAGE_BYTES) {
      attachmentError.value = `图片“${file.name}”超过 10 MiB。`
      continue
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
      attachments.value.push({
        id: nextAttachmentId(),
        kind: 'base64',
        data,
        mediaType: file.type,
        previewUrl: dataUrl,
        name: file.name
      })
    } catch (error) {
      attachmentError.value = error.message
    }
  }
}

function toggleToolPanel() {
  showToolPanel.value = !showToolPanel.value
  attachmentError.value = ''
  if (showToolPanel.value) showUrlForm.value = false
}

function openImagePicker() {
  if (!currentAgentSupportsImages.value || attachments.value.length >= MAX_IMAGES) return
  showToolPanel.value = false
  imageInputRef.value?.click()
}

function toggleUrlForm() {
  showToolPanel.value = false
  showUrlForm.value = !showUrlForm.value
  attachmentError.value = ''
  if (showUrlForm.value) nextTick(() => urlInputRef.value?.focus())
}

function addUrlAttachment() {
  attachmentError.value = ''
  if (attachments.value.length >= MAX_IMAGES) {
    attachmentError.value = `最多发送 ${MAX_IMAGES} 张图片。`
    return
  }

  let url
  try {
    url = new URL(imageUrlDraft.value.trim())
  } catch {
    attachmentError.value = '请输入有效的图片地址。'
    return
  }
  if (url.protocol !== 'https:') {
    attachmentError.value = '图片链接必须使用 HTTPS。'
    return
  }

  attachments.value.push({
    id: nextAttachmentId(),
    kind: 'url',
    url: url.toString(),
    mediaType: imageUrlMediaType.value,
    previewUrl: url.toString(),
    name: '链接图片'
  })
  imageUrlDraft.value = ''
  showUrlForm.value = false
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter(attachment => attachment.id !== id)
  attachmentError.value = ''
}

function clearAttachments() {
  attachments.value = []
  attachmentError.value = ''
  showToolPanel.value = false
  showUrlForm.value = false
  imageUrlDraft.value = ''
  if (imageInputRef.value) imageInputRef.value.value = ''
}

/**
 * 获取 Agent 列表（仅获取一次）
 */
let agentsLoaded = false
async function fetchAgentsOnce() {
  if (agentsLoaded) return
  agentsLoaded = true
  agentsLoading.value = true
  try {
    const res = await listAgentsApi()
    agents.value = (res.agents || []).filter(a => a.configured)
    // 如果默认 agent 不在列表里，使用第一个
    if (agents.value.length && !agents.value.some(a => a.agent_id === currentAgentId.value)) {
      currentAgentId.value = agents.value[0].agent_id
    }
  } catch (e) {
    agentsLoaded = false
    agentError.value = `获取模型列表失败：${e.message}`
  } finally {
    agentsLoading.value = false
  }
}

function selectAgent(agent) {
  showAgentMenu.value = false
  if (!agent || agent.agent_id === currentAgentId.value) return
  currentAgentId.value = agent.agent_id
  resetConversation()
}

let historyLoaded = false
async function fetchHistoryOnce() {
  if (historyLoaded) return
  historyLoaded = true
  try {
    await loadHistory()
  } catch (e) {
    historyLoaded = false
    agentError.value = `获取历史对话失败：${e.message}`
  }
}

/**
 * 重置会话：清空状态并开启新对话
 */
function resetConversation() {
  if (loading.value) return
  showAgentMenu.value = false
  conversationId.value = null
  currentHistoryId.value = null
  clearAttachments()
  messages.value = [
    { id: ++msgId, role: 'assistant', content: '新对话已开始，请问需要什么帮助？' }
  ]
  showSuggestions.value = true
  agentError.value = null
  view.value = 'chat'
  scrollToBottom()
}

async function ensureConversation() {
  if (conversationId.value) return conversationId.value
  const conversation = await createAgentConversationApi({
    ...identityParams(),
    agent_id: currentAgentId.value,
    memory_enabled: false
  })
  const id = conversation.id || conversation.conversation_id
  if (!id) throw new Error('创建会话响应缺少 id')
  conversationId.value = id
  currentHistoryId.value = id
  return id
}

async function send(text) {
  const content = (text ?? draft.value).trim()
  if ((!content && attachments.value.length === 0) || loading.value) return

  ensureIdentity()

  agentError.value = null
  loading.value = true
  try {
    await ensureConversation()
  } catch (e) {
    agentError.value = `创建对话失败：${e.message}`
    loading.value = false
    return
  }

  const outgoingAttachments = attachments.value.map(attachment => ({ ...attachment }))
  showSuggestions.value = false
  messages.value.push({
    id: ++msgId,
    role: 'user',
    content,
    images: outgoingAttachments.map(attachment => ({
      id: attachment.id,
      previewUrl: attachment.previewUrl,
      name: attachment.name
    }))
  })
  draft.value = ''
  clearAttachments()
  nextTick(autoGrow)
  scrollToBottom()

  await streamChat(content, outgoingAttachments)
}

/**
 * 调用平台会话流式接口并渲染回复
 */
async function streamChat(userContent, outgoingAttachments) {
  // 提前插入一条空的 assistant 消息，用于流式追加
  const assistantMsg = ref({ id: ++msgId, role: 'assistant', content: '' })
  messages.value.push(assistantMsg.value)
  scrollToBottom()

  const requestId = genRequestId()
  const messageParts = []
  if (userContent) messageParts.push({ type: 'text', text: userContent })
  for (const attachment of outgoingAttachments) {
    if (attachment.kind === 'url') {
      messageParts.push({
        type: 'image_url',
        url: attachment.url,
        media_type: attachment.mediaType
      })
    } else {
      messageParts.push({
        type: 'image_base64',
        data: attachment.data,
        media_type: attachment.mediaType
      })
    }
  }
  const payload = {
    request_id: requestId,
    tenant_id: tenantId.value,
    user_id: userId.value,
    message: {
      content: messageParts
    }
  }

  try {
    await chatStreamApi(conversationId.value, payload, {
      onDelta: (delta) => {
        assistantMsg.value.content += delta
        scrollToBottom()
      },
      onCompleted: async (data) => {
        // 兜底：若服务端未推送 delta，使用 completed 中的 assistant_message
        if (!assistantMsg.value.content && data.assistant_message) {
          assistantMsg.value.content = data.assistant_message
        }
        try {
          await loadHistory()
        } catch {
          // 回复已成功，历史列表刷新失败不影响本轮对话
        }
        scrollToBottom()
      },
      onError: (err) => {
        agentError.value = err.message || '智能体服务返回错误'

        // 移除空的 assistant 占位消息
        const idx = messages.value.findIndex(m => m.id === assistantMsg.value.id)
        if (idx !== -1 && !messages.value[idx].content) {
          messages.value.splice(idx, 1)
        }
        scrollToBottom()
      }
    })
  } finally {
    loading.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && showAgentMenu.value) {
    showAgentMenu.value = false
    return
  }
  if (e.key === 'Escape' && showToolPanel.value) {
    showToolPanel.value = false
    return
  }
  if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
/* 本组件统一使用蓝色（覆盖全局紫色调） */
.agent-chat-widget {
  --ac-blue: #3b82f6;
  --ac-blue-dark: #2563eb;
  --ac-blue-rgb: 59, 130, 246;
  --ac-edge-gap: 24px;
  --ac-fab-size: 56px;
  --ac-panel-gap: 16px;
  /* 确保悬浮按钮与面板始终在最上层，避免被其他 9999/100000 层遮挡 */
  --ac-z: 100001;
}

/* ====== 触发按钮 ====== */
.agent-fab {
  position: fixed;
  right: var(--ac-edge-gap);
  bottom: var(--ac-edge-gap);
  width: var(--ac-fab-size);
  height: var(--ac-fab-size);
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ac-blue) 0%, var(--ac-blue-dark) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(var(--ac-blue-rgb), 0.35), var(--shadow-md);
  z-index: var(--ac-z);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.agent-fab:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 12px 26px rgba(var(--ac-blue-rgb), 0.45), var(--shadow-lg);
}

.agent-fab:active {
  transform: translateY(0) scale(0.98);
}

.agent-fab.is-open {
  background: #fff;
  color: var(--ac-blue);
  box-shadow: var(--shadow-lg);
}

.agent-fab.is-open:hover {
  background: #fafafa;
}

/* ====== 聊天面板（9:16 竖屏） ====== */
.agent-panel {
  position: fixed;
  right: var(--ac-edge-gap);
  bottom: calc(var(--ac-edge-gap) + var(--ac-fab-size) + var(--ac-panel-gap));
  height: min(640px, calc(100vh - 120px));
  aspect-ratio: 9 / 16;
  max-width: calc(100vw - 48px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  z-index: var(--ac-z);
}

/* ====== 头部 ====== */
.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: linear-gradient(135deg, var(--ac-blue) 0%, var(--ac-blue-dark) 100%);
  color: #fff;
  flex-shrink: 0;
}

.agent-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-header-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.agent-name {
  font-size: 14px;
  font-weight: 600;
}

.agent-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  opacity: 0.9;
}

.agent-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
}

.agent-status-dot.status-error {
  background: var(--error-color);
}

.agent-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.agent-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.32);
}

.agent-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agent-icon-btn.active {
  background: rgba(255, 255, 255, 0.45);
}

/* ====== 历史对话视图 ====== */
.agent-history {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.agent-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  flex-shrink: 0;
}

.agent-history-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-history-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.agent-history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.agent-history-list::-webkit-scrollbar {
  width: 4px;
}

.agent-history-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 8px;
}

.agent-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}

.agent-history-item:hover {
  background: rgba(var(--ac-blue-rgb), 0.06);
}

.agent-history-item.active {
  background: rgba(var(--ac-blue-rgb), 0.1);
}

.agent-history-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.agent-history-item-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-history-item-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.agent-history-del {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.agent-history-item:hover .agent-history-del {
  opacity: 1;
}

.agent-history-del:hover {
  color: var(--error-color);
  background: rgba(239, 68, 68, 0.08);
}

.agent-history-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ====== Agent 选择器 ====== */
.agent-picker {
  position: relative;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  z-index: 3;
}

.agent-model-trigger {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.agent-model-trigger:hover:not(:disabled),
.agent-model-trigger.active,
.agent-model-trigger:focus-visible {
  border-color: rgba(var(--ac-blue-rgb), 0.55);
  box-shadow: 0 0 0 3px rgba(var(--ac-blue-rgb), 0.08);
  outline: none;
}

.agent-model-trigger:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.agent-model-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  border-radius: 8px;
  background: rgba(var(--ac-blue-rgb), 0.1);
  color: var(--ac-blue);
}

.agent-model-copy,
.agent-model-option-main {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.agent-model-label,
.agent-model-option-id {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.2;
}

.agent-model-name,
.agent-model-option-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-model-capability {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(var(--ac-blue-rgb), 0.1);
  color: var(--ac-blue-dark);
  font-size: 10px;
  font-weight: 600;
}

.agent-model-menu {
  position: absolute;
  top: calc(100% - 4px);
  right: 12px;
  left: 12px;
  max-height: 220px;
  padding: 5px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #fff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
}

.agent-model-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.agent-model-option:hover,
.agent-model-option:focus-visible,
.agent-model-option.selected {
  background: rgba(var(--ac-blue-rgb), 0.08);
  outline: none;
}

.agent-model-option.selected {
  color: var(--ac-blue);
}

.agent-model-empty {
  padding: 14px 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

/* ====== 消息列表 ====== */
.agent-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-secondary);
}

.agent-messages::-webkit-scrollbar {
  width: 4px;
}

.agent-messages::-webkit-scrollbar-track {
  background: transparent;
}

.agent-messages::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 8px;
}

/* 错误横幅 */
.agent-error-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--error-color);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.4;
}

.agent-msg {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  max-width: 100%;
}

.agent-msg-assistant {
  align-self: flex-start;
}

.agent-msg-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.agent-msg-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ac-blue) 0%, var(--ac-blue-dark) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-msg-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: calc(100% - 30px);
}

.agent-msg-user .agent-msg-body {
  align-items: flex-end;
}

.agent-msg-images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 96px));
  gap: 5px;
  overflow: hidden;
}

.agent-msg-image {
  width: 96px;
  height: 96px;
  display: block;
  object-fit: cover;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-tertiary);
}

.agent-msg-bubble {
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.agent-msg-assistant .agent-msg-bubble {
  background: #fff;
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-bottom-left-radius: 4px;
}

.agent-msg-user .agent-msg-bubble {
  background: linear-gradient(135deg, var(--ac-blue) 0%, var(--ac-blue-dark) 100%);
  color: #fff;
  border-bottom-right-radius: 4px;
}

/* 正在输入指示 */
.agent-typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  border-bottom-left-radius: 4px;
}

.agent-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: agent-typing-bounce 1.2s infinite ease-in-out;
}

.agent-typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.agent-typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes agent-typing-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ====== 快捷建议 ====== */
.agent-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px 4px;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.agent-suggestion-chip {
  border: 1px solid var(--border-light);
  background: #fff;
  color: var(--ac-blue);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.agent-suggestion-chip:hover {
  background: rgba(var(--ac-blue-rgb), 0.08);
  border-color: rgba(var(--ac-blue-rgb), 0.3);
}

/* ====== 输入区 ====== */
.agent-tool-panel {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.agent-tool-item {
  min-width: 0;
  display: flex;
  align-items: center;
  flex: 1;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(var(--ac-blue-rgb), 0.2);
  border-radius: 10px;
  background: rgba(var(--ac-blue-rgb), 0.06);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.agent-tool-item-secondary {
  border-color: var(--border-light);
  background: #fff;
}

.agent-tool-item:hover:not(:disabled),
.agent-tool-item:focus-visible {
  border-color: rgba(var(--ac-blue-rgb), 0.45);
  background: rgba(var(--ac-blue-rgb), 0.1);
  outline: none;
  transform: translateY(-1px);
}

.agent-tool-item:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.agent-tool-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  border-radius: 9px;
  background: #fff;
  color: var(--ac-blue);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.agent-tool-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.agent-tool-name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.agent-tool-hint,
.agent-tool-disabled-note {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.agent-tool-disabled-note {
  align-self: center;
  flex: 1;
}

.agent-tools-enter-active,
.agent-tools-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: bottom center;
}

.agent-tools-enter-from,
.agent-tools-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.agent-attachment-area {
  padding: 8px 12px 0;
  background: rgba(255, 255, 255, 0.7);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.agent-attachment-list {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.agent-attachment-item {
  position: relative;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  overflow: visible;
  background: var(--bg-tertiary);
}

.agent-attachment-item img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 8px;
}

.agent-attachment-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #374151;
  color: #fff;
  cursor: pointer;
}

.agent-url-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  padding-bottom: 7px;
}

.agent-url-input,
.agent-url-type {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border-light);
  border-radius: 7px;
  background: #fff;
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
}

.agent-url-input:focus,
.agent-url-type:focus,
.agent-plus-btn:focus-visible,
.agent-attachment-remove:focus-visible {
  border-color: var(--ac-blue);
  box-shadow: 0 0 0 3px rgba(var(--ac-blue-rgb), 0.12);
}

.agent-url-type {
  width: 66px;
  padding: 0 5px;
}

.agent-url-add {
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 7px;
  background: var(--ac-blue);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}

.agent-attachment-error {
  padding: 0 0 7px;
  color: var(--error-color);
  font-size: 11px;
  line-height: 1.4;
}

.agent-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.agent-file-input {
  display: none;
}

.agent-plus-btn {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.agent-plus-btn:hover:not(:disabled),
.agent-plus-btn.active {
  border-color: rgba(var(--ac-blue-rgb), 0.35);
  background: rgba(var(--ac-blue-rgb), 0.08);
  color: var(--ac-blue);
}

.agent-plus-btn.active {
  transform: rotate(45deg);
}

.agent-plus-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.agent-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 9px 12px;
  font-size: 13px;
  line-height: 1.5;
  background: #fff;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  max-height: 96px;
}

.agent-input::placeholder {
  color: var(--text-tertiary);
}

.agent-input:focus {
  border-color: var(--ac-blue);
  box-shadow: 0 0 0 3px rgba(var(--ac-blue-rgb), 0.08);
}

.agent-input:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.agent-send-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--ac-blue) 0%, var(--ac-blue-dark) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  box-shadow: 0 4px 12px rgba(var(--ac-blue-rgb), 0.25);
}

.agent-send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(var(--ac-blue-rgb), 0.35);
}

.agent-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* ====== 面板开关动画 ====== */
.agent-panel-enter-active,
.agent-panel-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform-origin: bottom right;
}

.agent-panel-enter-from,
.agent-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

@media (max-width: 480px) {
  .agent-chat-widget {
    --ac-edge-gap: 16px;
  }

  .agent-panel {
    height: min(620px, calc(100vh - 104px));
    max-width: calc(100vw - 32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-panel-enter-active,
  .agent-panel-leave-active,
  .agent-tools-enter-active,
  .agent-tools-leave-active,
  .agent-fab,
  .agent-model-trigger,
  .agent-plus-btn,
  .agent-tool-item,
  .agent-send-btn {
    transition-duration: 0.001ms !important;
  }

  .agent-typing-dot {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
