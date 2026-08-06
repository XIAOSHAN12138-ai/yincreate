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
        <!-- Agent 选择器 -->
        <div v-if="agents.length > 1" class="agent-picker">
          <select v-model="currentAgentId" class="agent-select" :disabled="loading">
            <option v-for="a in agents" :key="a.agent_id" :value="a.agent_id">
              {{ a.display_name || a.agent_id }}
            </option>
          </select>
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
            <div class="agent-msg-bubble">{{ msg.content }}</div>
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

        <!-- 输入区 -->
        <footer class="agent-input-wrap">
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
            :disabled="!draft.trim() || loading"
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
  chatStreamApi,
  genRequestId,
  genConversationId
} from '../api/agent'

const STORAGE_KEY = 'agent_chat_state'
const HISTORY_KEY = 'agent_chat_history'
const MAX_HISTORY = 50

const userStore = useUserStore()

const open = ref(false)
const draft = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)

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

// 会话状态：首轮 null / 0，后续原样回传
const conversationState = ref(null)
const stateVersion = ref(0)
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
 * 从消息列表提取会话标题（首条用户消息，截断 24 字）
 */
function extractTitle(msgs) {
  const firstUser = msgs.find(m => m.role === 'user')
  if (!firstUser) return '新对话'
  const t = firstUser.content.replace(/\s+/g, ' ').trim()
  return t.length > 24 ? t.slice(0, 24) + '…' : t
}

/**
 * 加载本地历史会话列表
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

/**
 * 持久化历史会话列表（截断上限，最新在前）
 */
function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(0, MAX_HISTORY)))
  } catch {
    // 存储失败时忽略
  }
}

/**
 * 将当前会话 upsert 到历史列表
 */
function upsertHistory() {
  const item = {
    id: currentHistoryId.value,
    conversationId: conversationId.value,
    title: extractTitle(messages.value),
    messages: messages.value.map(m => ({ role: m.role, content: m.content })),
    conversationState: conversationState.value,
    stateVersion: stateVersion.value,
    agentId: currentAgentId.value,
    updatedAt: Date.now()
  }
  const idx = history.value.findIndex(h => h.id === item.id)
  if (idx !== -1) {
    history.value[idx] = item
  } else {
    history.value.unshift(item)
  }
  history.value.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  saveHistory()
}

/**
 * 切换到指定历史会话
 */
function switchConversation(item) {
  if (loading.value) return
  currentHistoryId.value = item.id
  conversationId.value = item.conversationId
  conversationState.value = item.conversationState || null
  stateVersion.value = item.stateVersion || 0
  if (item.agentId) currentAgentId.value = item.agentId
  messages.value = (item.messages || []).map(m => ({ id: ++msgId, role: m.role, content: m.content }))
  showSuggestions.value = messages.value.every(m => m.role !== 'user')
  agentError.value = null
  view.value = 'chat'
  persistState()
  nextTick(() => { scrollToBottom(); inputRef.value?.focus() })
}

/**
 * 删除指定历史会话
 */
function deleteConversation(id) {
  history.value = history.value.filter(h => h.id !== id)
  saveHistory()
  // 如果删的是当前会话，回到新对话
  if (id === currentHistoryId.value) {
    resetConversation()
    view.value = 'history'
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
 * 初始化身份字段（tenant_id / user_id / conversation_id）
 * 优先从 localStorage 恢复，避免刷新丢失上下文
 */
function ensureIdentity() {
  // 加载历史列表（仅一次）
  if (history.value.length === 0) {
    history.value = loadHistory()
  }

  if (conversationId.value) return

  const user = userStore.user || {}
  userId.value = user.user_id || 'anonymous'
  tenantId.value = user.enterprise_id || user.user_id || 'default-tenant'

  const stored = loadStoredState()
  if (stored?.conversationId) {
    // 尝试从历史中恢复最近一条会话内容
    const recent = history.value.find(h => h.conversationId === stored.conversationId)
    if (recent) {
      switchConversation(recent)
      return
    }
    conversationId.value = stored.conversationId
    conversationState.value = stored.conversationState || null
    stateVersion.value = stored.stateVersion || 0
  } else {
    conversationId.value = genConversationId()
    conversationState.value = null
    stateVersion.value = 0
    currentHistoryId.value = `h-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`
    persistState()
  }
}

/**
 * 加载本地缓存的会话状态
 */
function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 持久化会话状态（仅存身份与状态，不存消息）
 */
function persistState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversationId: conversationId.value,
        conversationState: conversationState.value,
        stateVersion: stateVersion.value
      })
    )
  } catch {
    // 存储失败时忽略，不影响对话
  }
}

/**
 * 获取 Agent 列表（仅获取一次）
 */
let agentsLoaded = false
async function fetchAgentsOnce() {
  if (agentsLoaded) return
  agentsLoaded = true
  try {
    const res = await listAgentsApi()
    agents.value = (res.agents || []).filter(a => a.configured)
    // 如果默认 agent 不在列表里，使用第一个
    if (agents.value.length && !agents.value.some(a => a.agent_id === currentAgentId.value)) {
      currentAgentId.value = agents.value[0].agent_id
    }
  } catch (e) {
    agentError.value = `获取模型列表失败：${e.message}`
  }
}

/**
 * 重置会话：清空状态并开启新对话
 */
function resetConversation() {
  if (loading.value) return
  conversationId.value = genConversationId()
  conversationState.value = null
  stateVersion.value = 0
  currentHistoryId.value = `h-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`
  messages.value = [
    { id: ++msgId, role: 'assistant', content: '新对话已开始，请问需要什么帮助？' }
  ]
  showSuggestions.value = true
  agentError.value = null
  view.value = 'chat'
  persistState()
  scrollToBottom()
}

async function send(text) {
  const content = (text ?? draft.value).trim()
  if (!content || loading.value) return

  ensureIdentity()

  showSuggestions.value = false
  agentError.value = null
  messages.value.push({ id: ++msgId, role: 'user', content })
  draft.value = ''
  nextTick(autoGrow)
  scrollToBottom()

  // 用户发送后立即登记历史，确保即使后端异常也能看到已发起的对话
  upsertHistory()

  await streamChat(content)
}

/**
 * 调用 /v1/chat/stream 并流式渲染
 */
async function streamChat(userContent) {
  loading.value = true

  // 提前插入一条空的 assistant 消息，用于流式追加
  const assistantMsg = ref({ id: ++msgId, role: 'assistant', content: '' })
  messages.value.push(assistantMsg.value)
  scrollToBottom()

  const requestId = genRequestId()
  const payload = {
    request_id: requestId,
    tenant_id: tenantId.value,
    user_id: userId.value,
    conversation_id: conversationId.value,
    agent_id: currentAgentId.value,
    message: {
      content: [{ type: 'text', text: userContent }]
    },
    conversation_state: conversationState.value,
    state_version: stateVersion.value,
    memory_enabled: false,
    user_memory_state: null
  }

  // 记录本次请求前的状态，出错时回滚
  const prevConversationState = conversationState.value
  const prevStateVersion = stateVersion.value

  await chatStreamApi(payload, {
    onDelta: (delta) => {
      assistantMsg.value.content += delta
      scrollToBottom()
    },
    onCompleted: (data) => {
      // 收到 completed 才能保存新状态
      conversationState.value = data.conversation_state
      stateVersion.value = data.new_state_version ?? prevStateVersion
      // 兜底：若服务端未推送 delta，使用 completed 中的 assistant_message
      if (!assistantMsg.value.content && data.assistant_message) {
        assistantMsg.value.content = data.assistant_message
      }
      persistState()
      upsertHistory()
      scrollToBottom()
    },
    onError: (err) => {
      // 出错时不更新状态，保留旧状态
      conversationState.value = prevConversationState
      stateVersion.value = prevStateVersion
      agentError.value = err.message || '智能体服务返回错误'

      // 移除空的 assistant 占位消息
      const idx = messages.value.findIndex(m => m.id === assistantMsg.value.id)
      if (idx !== -1 && !messages.value[idx].content) {
        messages.value.splice(idx, 1)
      }
      scrollToBottom()
    }
  })

  loading.value = false
}

function onKeydown(e) {
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
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.agent-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.agent-select:focus {
  border-color: var(--ac-blue);
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
.agent-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
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
</style>
