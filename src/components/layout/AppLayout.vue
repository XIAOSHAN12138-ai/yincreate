<template>
  <div class="app-layout">
    <!-- 左侧导航栏 -->
    <Sidebar />
    <div class="main-wrapper">
      <!-- 顶部导航栏 -->
      <TopNav :page-title="pageTitle" />
      <div class="content-wrapper">
        <!-- 主内容区域 -->
        <main :class="['content-area', { 'content-full-width': !showRightSidebar }]">
          <slot />
        </main>
        <!-- 右侧边栏（条件显示） -->
        <aside v-if="showRightSidebar" class="right-sidebar-container">
          <slot name="right-sidebar">
            <RightSidebar />
          </slot>
        </aside>
      </div>
    </div>
    <!-- 智能体对话悬浮入口 -->
    <AgentChat />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './Sidebar.vue'
import TopNav from './TopNav.vue'
import RightSidebar from './RightSidebar.vue'
import AgentChat from '../AgentChat.vue'

const route = useRoute()

const pageTitle = computed(() => {
  const titleMap = {
    '/': '首页',
    '/generate': '生成',
    '/tools': '全部工具',
    '/community': '社区',
    '/assets': '资产',
    '/pricing': '定价方案',
    '/profile': '个人资料',
    '/settings': '设置',
    '/login': '登录',
    '/announcement': '平台公告',
    '/admin': '系统管理'
  }

  if (route.path.startsWith('/announcement/')) {
    return '公告详情'
  }

  if (route.path.startsWith('/enterprise')) {
    const enterpriseTitles = {
      '/enterprise/bi': '企业仪表盘',
      '/enterprise/department': '部门管理',
      '/enterprise/member': '成员管理',
      '/enterprise/personnel': '人员管理',
      '/enterprise/project': '项目管理',
      '/enterprise/routing': '路由配置'
    }
    return enterpriseTitles[route.path] || '企业管理'
  }

  return titleMap[route.path] || '影创studio'
})

const showRightSidebar = computed(() => {
  // 生成页面有自己的左侧对话历史栏，不需要右侧边栏
  if (route.path === '/generate') return false
  return route.path === '/' || route.path === '/profile'
})
</script>

<style scoped>
.app-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
  position: relative;
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  display: flex;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.6);
}

.content-wrapper::-webkit-scrollbar {
  width: 3px;
}

.content-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.content-wrapper::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 8px;
}

.content-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.35);
}

.content-area {
  flex: 7;
  min-width: 0;
  min-height: 0;
  padding: 12px 16px;
  overflow-y: visible;
}

.content-full-width {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow-y: visible;
}

.right-sidebar-container {
  flex: 2;
  min-width: 220px;
  max-width: 300px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(243, 244, 246, 1);
  position: relative;
  z-index: 50;
  overflow-y: visible;
}
</style>
