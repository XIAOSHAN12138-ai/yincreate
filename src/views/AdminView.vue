<template>
  <AppLayout>
    <div class="admin-page">
      <!-- 标签页导航 -->
      <div class="admin-tab-bar">
        <div class="tabs-nav">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['admin-tab', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            <i :data-lucide="tab.icon" style="width: 15px; height: 15px; margin-right: 5px;"></i>
            {{ tab.label }}
          </button>
        </div>
        <div class="admin-user-info">
          <i data-lucide="shield-check" style="width: 18px; height: 18px; color: #6366f1;"></i>
          <span>系统管理员</span>
        </div>
      </div>

      <!-- ========== 系统概览 ========== -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <div class="stats-grid">
          <div class="stat-card stat-company">
            <div class="stat-icon-wrap">
              <i data-lucide="building-2" style="width: 24px; height: 24px;"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ companyAccounts.length }}</span>
              <span class="stat-label">公司账号</span>
            </div>
          </div>
          <div class="stat-card stat-user">
            <div class="stat-icon-wrap">
              <i data-lucide="users" style="width: 24px; height: 24px;"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ normalUsers.length }}</span>
              <span class="stat-label">普通账号</span>
            </div>
          </div>
          <div class="stat-card stat-active">
            <div class="stat-icon-wrap">
              <i data-lucide="user-check" style="width: 24px; height: 24px;"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ activeUserCount }}</span>
              <span class="stat-label">活跃用户</span>
            </div>
          </div>
          <div class="stat-card stat-log">
            <div class="stat-icon-wrap">
              <i data-lucide="scroll-text" style="width: 24px; height: 24px;"></i>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ operationLogs.length }}</span>
              <span class="stat-label">操作日志</span>
            </div>
          </div>
        </div>

        <div class="overview-row">
          <div class="overview-card system-info">
            <h3 class="card-title"><i data-lucide="server" style="width: 16px; height: 16px; margin-right: 6px;"></i>系统信息</h3>
            <div class="info-list">
              <div class="info-item"><span class="info-k">系统版本</span><span class="info-v">v2.4.1</span></div>
              <div class="info-item"><span class="info-k">数据库状态</span><span class="status-dot status-ok">正常</span></div>
              <div class="info-item"><span class="info-k">API 服务</span><span class="status-dot status-ok">运行中</span></div>
              <div class="info-item"><span class="info-k">存储使用</span><span class="info-v">128GB / 500GB (25.6%)</span></div>
              <div class="info-item"><span class="info-k">上次备份</span><span class="info-v">2026-06-03 02:00:00</span></div>
            </div>
          </div>
          <div class="overview-card recent-logs">
            <h3 class="card-title"><i data-lucide="clock" style="width: 16px; height: 16px; margin-right: 6px;"></i>最近操作</h3>
            <div class="log-list-compact">
              <div v-for="log in operationLogs.slice(0, 6)" :key="log.id" class="log-item-compact">
                <span :class="['log-type-dot', log.typeClass]"></span>
                <div class="log-content-compact">
                  <span class="log-desc">{{ log.description }}</span>
                  <span class="log-time-sm">{{ log.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 公司账号管理 ========== -->
      <div v-if="activeTab === 'company'" class="tab-content">
        <div class="company-stats-bar">
          <div class="company-stat"><span class="cs-label">总数量</span><span class="cs-val">{{ companyAccounts.length }}</span></div>
          <div class="company-stat"><span class="cs-label">已启用</span><span class="cs-val cs-green">{{ companyAccounts.filter(c => c.status === '启用').length }}</span></div>
          <div class="company-stat"><span class="cs-label">已禁用</span><span class="cs-val cs-red">{{ companyAccounts.filter(c => c.status === '禁用').length }}</span></div>
          <div class="company-stat"><span class="cs-label">总配额</span><span class="cs-val">&yen;{{ totalCompanyQuota.toLocaleString() }}</span></div>
        </div>

        <div class="search-action-bar">
          <div class="table-header-row">
            <h3 class="table-title">公司账号列表（共 {{ filteredCompanies.length }} 个）</h3>
            <div class="header-actions">
              <div class="search-wrap-member">
                <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
                <input v-model="companySearch" type="text" placeholder="搜索公司名称或联系人..." class="search-input-member">
              </div>
              <select v-model="companyStatusFilter" class="filter-select-member">
                <option value="">全部状态</option>
                <option value="启用">启用</option>
                <option value="禁用">禁用</option>
              </select>
              <button class="btn-add-new" @click="openCompanyModal()">
                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> 新增公司账号
              </button>
            </div>
          </div>

          <table class="account-table">
            <thead>
              <tr>
                <th>ID</th><th>公司名称</th><th>统一信用代码</th><th>联系人</th><th>联系电话</th>
                <th>配额(&yen;)</th><th>已用(&yen;)</th><th>剩余(&yen;)</th><th>状态</th><th>创建时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="company in pagedCompanies" :key="company.id">
                <td>{{ company.id }}</td>
                <td><strong>{{ company.name }}</strong></td>
                <td class="mono-text">{{ company.creditCode }}</td>
                <td>{{ company.contact }}</td>
                <td>{{ company.phone }}</td>
                <td class="money-cell">{{ company.quota.toLocaleString() }}</td>
                <td class="money-cell text-red">{{ company.used.toLocaleString() }}</td>
                <td class="money-cell text-green">{{ (company.quota - company.used).toLocaleString() }}</td>
                <td><span :class="['status-badge', getStatusBadgeClass(company.status)]">{{ company.status }}</span></td>
                <td class="text-secondary-small">{{ company.createdAt }}</td>
                <td class="action-buttons">
                  <button class="edit-btn-action" @click="openCompanyModal(company)">编辑</button>
                  <button :class="['toggle-btn', company.status === '启用' ? 'disable-style' : 'enable-style']" @click="toggleCompanyStatus(company)">
                    {{ company.status === '启用' ? '禁用' : '启用' }}
                  </button>
                  <button class="delete-btn-action" @click="deleteCompany(company)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="pagination-dept">
            <button class="page-btn-dept" :disabled="companyPage === 1" @click="companyPage--"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
            <button v-for="p in companyTotalPages" :key="p" :class="['page-num-dept', { active: companyPage === p }]" @click="companyPage = p">{{ p }}</button>
            <button class="page-btn-dept" :disabled="companyPage === companyTotalPages" @click="companyPage++"><i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      </div>

      <!-- ========== 普通账号管理 ========== -->
      <div v-if="activeTab === 'user'" class="tab-content">
        <div class="user-stats-bar">
          <div class="user-stat"><span class="us-label">总用户数</span><span class="us-val">{{ normalUsers.length }}</span></div>
          <div class="user-stat"><span class="us-label">活跃</span><span class="us-val us-green">{{ normalUsers.filter(u => u.status === '活跃').length }}</span></div>
          <div class="user-stat"><span class="us-label">停用</span><span class="us-val us-gray">{{ normalUsers.filter(u => u.status === '停用').length }}</span></div>
          <div class="user-stat"><span class="us-label">今日新增</span><span class="us-val us-blue">+3</span></div>
        </div>

        <div class="search-action-bar">
          <div class="table-header-row">
            <h3 class="table-title">普通账号列表（共 {{ filteredUsers.length }} 个）</h3>
            <div class="header-actions">
              <div class="search-wrap-member">
                <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
                <input v-model="userSearch" type="text" placeholder="搜索用户名、邮箱或手机号..." class="search-input-member">
              </div>
              <select v-model="userRoleFilter" class="filter-select-member">
                <option value="">全部角色</option>
                <option value="普通用户">普通用户</option>
                <option value="部门管理员">部门管理员</option>
                <option value="公司管理员">公司管理员</option>
              </select>
              <select v-model="userStatusFilter" class="filter-select-member">
                <option value="">全部状态</option>
                <option value="活跃">活跃</option>
                <option value="停用">停用</option>
              </select>
              <button class="btn-add-new" @click="openUserModal()">
                <i data-lucide="user-plus" style="width: 14px; height: 14px;"></i> 新增普通账号
              </button>
            </div>
          </div>

          <table class="account-table">
            <thead>
              <tr>
                <th>ID</th><th>用户名</th><th>邮箱</th><th>手机号</th><th>所属公司</th><th>角色</th>
                <th>配额(&yen;)</th><th>已用(&yen;)</th><th>剩余(&yen;)</th><th>状态</th><th>最后登录</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in pagedUsers" :key="user.id">
                <td>{{ user.id }}</td>
                <td>
                  <div class="user-name-cell">
                    <div class="avatar-mini" :style="{ background: user.avatarColor }">{{ user.name.charAt(0) }}</div>
                    <strong>{{ user.name }}</strong>
                  </div>
                </td>
                <td class="text-secondary-small">{{ user.email }}</td>
                <td>{{ user.phone }}</td>
                <td>{{ user.companyName || '-' }}</td>
                <td><span :class="['role-badge', getRoleClass(user.role)]">{{ user.role }}</span></td>
                <td class="money-cell">{{ user.quota.toLocaleString() }}</td>
                <td class="money-cell text-red">{{ user.used.toLocaleString() }}</td>
                <td class="money-cell text-green">{{ (user.quota - user.used).toLocaleString() }}</td>
                <td><span :class="['status-badge', getUserStatusClass(user.status)]">{{ user.status }}</span></td>
                <td class="text-secondary-small">{{ user.lastLogin }}</td>
                <td class="action-buttons">
                  <button class="detail-btn" @click="viewUserDetail(user)">详情</button>
                  <button class="edit-btn-action" @click="openUserModal(user)">编辑</button>
                  <button :class="['toggle-btn', user.status === '活跃' ? 'disable-style' : 'enable-style']" @click="toggleUserStatus(user)">
                    {{ user.status === '活跃' ? '停用' : '激活' }}
                  </button>
                  <button class="delete-btn-action" @click="deleteUser(user)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="pagination-dept">
            <button class="page-btn-dept" :disabled="userPage === 1" @click="userPage--"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
            <button v-for="p in userTotalPages" :key="p" :class="['page-num-dept', { active: userPage === p }]" @click="userPage = p">{{ p }}</button>
            <button class="page-btn-dept" :disabled="userPage === userTotalPages" @click="userPage++"><i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      </div>

      <!-- ========== 模型管理 ========== -->
      <div v-if="activeTab === 'model'" class="tab-content">
        <div class="model-stats-bar">
          <div class="model-stat">
            <span class="ms-label">模型总数</span>
            <span class="ms-val">{{ modelList.length }}</span>
          </div>
          <div class="model-stat">
            <span class="ms-label">已启用</span>
            <span class="ms-val ms-green">{{ modelList.filter(m => m.is_enabled).length }}</span>
          </div>
          <div class="model-stat">
            <span class="ms-label">已停用</span>
            <span class="ms-val ms-red">{{ modelList.filter(m => !m.is_enabled).length }}</span>
          </div>
          <div class="model-stat">
            <span class="ms-label">图片模型</span>
            <span class="ms-val ms-blue">{{ modelList.filter(m => m.media_type === 'image').length }}</span>
          </div>
          <div class="model-stat">
            <span class="ms-label">视频模型</span>
            <span class="ms-val ms-purple">{{ modelList.filter(m => m.media_type === 'video').length }}</span>
          </div>
          <div class="model-stat">
            <span class="ms-label">音频模型</span>
            <span class="ms-val ms-amber">{{ modelList.filter(m => m.media_type === 'audio').length }}</span>
          </div>
        </div>

        <div class="search-action-bar">
          <div class="table-header-row">
            <h3 class="table-title">模型列表（共 {{ filteredModels.length }} 个）</h3>
            <div class="header-actions" style="position:relative;z-index:10;">
              <div class="search-wrap-member">
                <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
                <input v-model="modelSearch" type="text" placeholder="搜索模型ID/名称..." class="search-input-member" @input="onModelSearchChange">
              </div>
              <select v-model="modelVendorFilter" class="filter-select-member" @change="onModelFilterChange('vendor', $event)">
                <option value="">全部厂商</option>
                <option v-for="v in vendorOptions" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
              <select v-model="modelMediaTypeFilter" class="filter-select-member" @change="onModelFilterChange('mediaType', $event)">
                <option value="">全部类型</option>
                <option v-for="t in mediaTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
              <select v-model="modelStatusFilter" class="filter-select-member" @change="onModelFilterChange('status', $event)">
                <option value="">全部状态</option>
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              <select v-model="modelEnabledFilter" class="filter-select-member" @change="onModelFilterChange('enabled', $event)">
                <option value="">全部启停</option>
                <option value="true">已启用</option>
                <option value="false">已停用</option>
              </select>
              <label class="checkbox-wrap" style="margin-left: 8px;">
                <input type="checkbox" v-model="showDeletedModels" @change="toggleDeletedView">
                <span class="checkbox-label">回收站</span>
              </label>
              <button class="export-btn" @click="handleSyncFromJson" title="从 JSON 重新灌入模型库">
                <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> 同步JSON
              </button>
              <button class="btn-add-new" @click="openModelModal()">
                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> 新增模型
              </button>
            </div>
          </div>

          <table class="account-table model-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>模型ID</th>
                <th>展示名</th>
                <th>厂商</th>
                <th>类型</th>
                <th>定价</th>
                <th>状态</th>
                <th>声音模式</th>
                <th>最大时长</th>
                <th>启停</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in pagedModels" :key="m.id" :class="{ 'deleted-row': m.deleted_at }">
                <td>{{ m.id }}<span v-if="m.deleted_at" class="deleted-badge" title="已软删">已删</span></td>
                <td><code class="mono-text">{{ m.model_id }}</code></td>
                <td>
                  <div class="model-name-cell">
                    <strong>{{ m.display_name }}</strong>
                    <span v-if="m.tags && m.tags.length" class="model-tags-mini">
                      <span v-for="t in m.tags.slice(0,2)" :key="t" class="tag-mini">{{ t }}</span>
                    </span>
                  </div>
                </td>
                <td><span :class="['vendor-badge', `vendor-${m.vendor}`]">{{ getVendorLabel(m.vendor) }}</span></td>
                <td><span :class="['media-type-badge', `media-${m.media_type}`]">{{ getMediaTypeLabel(m.media_type) }}</span></td>
                <td class="price-cell">
                  <div v-if="m.price_per_second != null" class="price-line">
                    <span class="price-val">{{ m.price_per_second }}积分/秒</span>
                    <span v-if="m.price_multiplier && m.price_multiplier !== 1" class="price-mult">×{{ m.price_multiplier }}</span>
                  </div>
                  <div v-else-if="m.price_per_request != null" class="price-line">
                    <span class="price-val">{{ m.price_per_request }}积分/次</span>
                    <span v-if="m.price_multiplier && m.price_multiplier !== 1" class="price-mult">×{{ m.price_multiplier }}</span>
                  </div>
                  <div v-else class="price-line"><span class="price-val text-secondary-small">未定价</span></div>
                  <div v-if="m.price_tiers && Object.keys(m.price_tiers).length" class="price-tiers-mini">
                    {{ Object.keys(m.price_tiers).length }} 档分级
                  </div>
                </td>
                <td><span :class="['status-badge', getModelStatusClass(m.status)]">{{ getStatusLabel(m.status) }}</span></td>
                <td><span :class="['sound-mode-badge', `sm-${m.sound_mode || 'hidden'}`]">{{ getSoundModeLabel(m.sound_mode) }}</span></td>
                <td>{{ m.max_duration ? m.max_duration + 's' : '-' }}</td>
                <td>
                  <label class="switch switch-mini" :title="m.is_enabled ? '点击停用' : '点击启用'">
                    <input type="checkbox" :checked="m.is_enabled" @change="toggleModelEnabled(m)">
                    <span class="slider"></span>
                  </label>
                </td>
                <td class="text-secondary-small">{{ m.updated_at }}</td>
                <td class="action-buttons">
                  <button class="detail-btn" @click="viewModelDetail(m)">详情</button>
                  <button class="edit-btn-action" @click="openModelModal(m)">编辑</button>
                  <button class="edit-btn-action" style="color:#0ea5e9;background:#e0f2fe;" @click="viewModelUsage(m)">用量</button>
                  <button class="edit-btn-action" style="color:#7c3aed;background:#ede9fe;" @click="viewModelChangelog(m)">历史</button>
                  <button class="edit-btn-action" style="color:#f59e0b;background:#fef3c7;" @click="openCloneModal(m)" v-if="!m.deleted_at">克隆</button>
                  <template v-if="m.deleted_at">
                    <button class="edit-btn-action" style="color:#10b981;background:#dcfce7;" @click="restoreModel(m)">恢复</button>
                    <button class="delete-btn-action" @click="hardDeleteModel(m)">硬删</button>
                  </template>
                  <button class="delete-btn-action" @click="deleteModel(m)" v-else>删除</button>
                </td>
              </tr>
              <tr v-if="filteredModels.length === 0">
                <td colspan="10" class="empty-row">暂无模型数据</td>
              </tr>
            </tbody>
          </table>

          <div class="pagination-dept">
            <button class="page-btn-dept" :disabled="modelPage === 1" @click="modelPage--"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
            <button v-for="p in modelTotalPages" :key="p" :class="['page-num-dept', { active: modelPage === p }]" @click="modelPage = p">{{ p }}</button>
            <button class="page-btn-dept" :disabled="modelPage === modelTotalPages" @click="modelPage++"><i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      </div>

      <!-- ========== 操作日志 ========== -->
      <div v-if="activeTab === 'logs'" class="tab-content">
        <div class="search-action-bar">
          <div class="table-header-row">
            <h3 class="table-title">操作日志（共 {{ filteredLogs.length }} 条）</h3>
            <div class="header-actions">
              <div class="search-wrap-member">
                <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
                <input v-model="logSearch" type="text" placeholder="搜索操作内容..." class="search-input-member">
              </div>
              <select v-model="logTypeFilter" class="filter-select-member">
                <option value="">全部类型</option>
                <option value="create">新增</option>
                <option value="update">修改</option>
                <option value="delete">删除</option>
                <option value="status">状态变更</option>
                <option value="login">登录</option>
              </select>
              <button class="export-btn" @click="exportLogs"><i data-lucide="download" style="width: 14px; height: 14px;"></i> 导出日志</button>
            </div>
          </div>
          <table class="account-table log-table">
            <thead>
              <tr>
                <th>ID</th><th>操作类型</th><th>操作描述</th><th>操作人</th><th>目标对象</th><th>IP地址</th><th>操作时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in pagedLogs" :key="log.id">
                <td>#{{ log.id }}</td>
                <td><span :class="['log-type-badge', log.typeClass]">{{ log.typeLabel }}</span></td>
                <td>{{ log.description }}</td>
                <td>{{ log.operator }}</td>
                <td class="text-secondary-small">{{ log.target }}</td>
                <td class="mono-text text-secondary-small">{{ log.ip }}</td>
                <td class="text-secondary-small">{{ log.time }}</td>
              </tr>
            </tbody>
          </table>
          <div class="pagination-dept">
            <button class="page-btn-dept" :disabled="logPage === 1" @click="logPage--"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
            <button v-for="p in logTotalPages" :key="p" :class="['page-num-dept', { active: logPage === p }]" @click="logPage = p">{{ p }}</button>
            <button class="page-btn-dept" :disabled="logPage === logTotalPages" @click="logPage++"><i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      </div>

      <!-- ========== 公告管理 ========== -->
      <div v-if="activeTab === 'announcement'" class="tab-content">
        <div class="announcement-stats-bar">
          <div class="ann-stat"><span class="ann-label">总公告数</span><span class="ann-val">{{ announcementList.length }}</span></div>
          <div class="ann-stat"><span class="ann-label">已发布</span><span class="ann-val ann-green">{{ announcementList.filter(a => a.status === 'published').length }}</span></div>
          <div class="ann-stat"><span class="ann-label">草稿</span><span class="ann-val ann-gray">{{ announcementList.filter(a => a.status === 'draft').length }}</span></div>
          <div class="ann-stat"><span class="ann-label">置顶</span><span class="ann-val ann-blue">{{ announcementList.filter(a => a.is_top).length }}</span></div>
        </div>

        <div class="search-action-bar">
          <div class="table-header-row">
            <h3 class="table-title">公告列表（共 {{ filteredAnnouncements.length }} 条）</h3>
            <div class="header-actions">
              <div class="search-wrap-member">
                <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
                <input v-model="annSearch" type="text" placeholder="搜索公告标题..." class="search-input-member">
              </div>
              <select v-model="annCategoryFilter" class="filter-select-member">
                <option value="">全部分类</option>
                <option value="update">功能更新</option>
                <option value="event">活动</option>
                <option value="tutorial">教程</option>
              </select>
              <select v-model="annStatusFilter" class="filter-select-member">
                <option value="">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
              </select>
              <button class="btn-add-new" @click="openAnnouncementModal()">
                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> 发布公告
              </button>
            </div>
          </div>

          <table class="account-table">
            <thead>
              <tr>
                <th>ID</th><th>标题</th><th>分类</th><th>状态</th><th>置顶</th><th>浏览量</th><th>作者</th><th>发布时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ann in pagedAnnouncements" :key="ann.id">
                <td>{{ ann.id }}</td>
                <td><strong>{{ ann.title }}</strong></td>
                <td><span :class="['ann-category-badge', `ann-cat-${ann.category}`]">{{ getAnnCategoryLabel(ann.category) }}</span></td>
                <td><span :class="['status-badge', ann.status === 'published' ? 'status-active' : 'status-expired']">{{ ann.status === 'published' ? '已发布' : '草稿' }}</span></td>
                <td>{{ ann.is_top ? '是' : '否' }}</td>
                <td>{{ ann.view_count }}</td>
                <td>{{ ann.author }}</td>
                <td class="text-secondary-small">{{ ann.published_at || '-' }}</td>
                <td class="action-buttons">
                  <button class="edit-btn-action" @click="openAnnouncementModal(ann)">编辑</button>
                  <button class="edit-btn-action" style="color: #3b82f6;" @click="toggleAnnouncementTop(ann)">{{ ann.is_top ? '取消置顶' : '置顶' }}</button>
                  <button :class="['toggle-btn', ann.status === 'published' ? 'disable-style' : 'enable-style']" @click="toggleAnnouncementStatus(ann)">{{ ann.status === 'published' ? '撤回' : '发布' }}</button>
                  <button class="delete-btn-action" @click="deleteAnnouncement(ann)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="pagination-dept">
            <button class="page-btn-dept" :disabled="annPage === 1" @click="annPage--"><i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i></button>
            <button v-for="p in annTotalPages" :key="p" :class="['page-num-dept', { active: annPage === p }]" @click="annPage = p">{{ p }}</button>
            <button class="page-btn-dept" :disabled="annPage === annTotalPages" @click="annPage++"><i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i></button>
          </div>
        </div>
      </div>

      <!-- ========== 系统设置 ========== -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="settings-grid">
          <div class="setting-section">
            <h3 class="section-title"><i data-lucide="bell" style="width: 16px; height: 16px; margin-right: 6px;"></i>通知设置</h3>
            <div class="setting-items">
              <div class="setting-item">
                <div class="setting-desc"><span class="setting-name">新注册用户通知</span><span class="setting-hint">有新用户注册时发送邮件通知</span></div>
                <label class="switch"><input type="checkbox" v-model="settings.newUserNotify" checked><span class="slider"></span></label>
              </div>
              <div class="setting-item">
                <div class="setting-desc"><span class="setting-name">额度预警通知</span><span class="setting-hint">用户配额低于20%时发送预警</span></div>
                <label class="switch"><input type="checkbox" v-model="settings.quotaAlert" checked><span class="slider"></span></label>
              </div>
              <div class="setting-item">
                <div class="setting-desc"><span class="setting-name">异常登录告警</span><span class="setting-hint">检测到异常IP登录时通知管理员</span></div>
                <label class="switch"><input type="checkbox" v-model="settings.abnormalLoginAlert" checked><span class="slider"></span></label>
              </div>
            </div>
          </div>
          <div class="setting-section">
            <h3 class="section-title"><i data-lucide="shield" style="width: 16px; height: 16px; margin-right: 6px;"></i>安全策略</h3>
            <div class="setting-items setting-form-items">
              <div class="setting-item-form"><label class="form-label">密码最小长度</label><input type="number" v-model="settings.minPasswordLength" class="form-input" min="6" max="32"></div>
              <div class="setting-item-form"><label class="form-label">登录失败锁定次数</label><input type="number" v-model="settings.maxLoginAttempts" class="form-input" min="3" max="20"></div>
              <div class="setting-item-form"><label class="form-label">Token 有效期（小时）</label><input type="number" v-model="settings.tokenExpiryHours" class="form-input" min="1" max="168"></div>
              <div class="setting-item-form"><label class="form-label">默认用户配额（&yen;）</label><input type="number" v-model="settings.defaultQuota" class="form-input" min="0"></div>
            </div>
          </div>
          <div class="setting-section">
            <h3 class="section-title"><i data-lucide="database" style="width: 16px; height: 16px; margin-right: 6px;"></i>数据管理</h3>
            <div class="setting-items">
              <div class="setting-item">
                <div class="setting-desc"><span class="setting-name">自动备份</span><span class="setting-hint">每日凌晨 2:00 自动备份数据库</span></div>
                <label class="switch"><input type="checkbox" v-model="settings.autoBackup" checked><span class="slider"></span></label>
              </div>
              <div class="setting-actions">
                <button class="btn-action-settings btn-backup" @click="handleBackup"><i data-lucide="hard-drive-upload" style="width: 14px; height: 14px;"></i> 立即备份</button>
                <button class="btn-action-settings btn-clear-cache" @click="handleClearCache"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> 清除缓存</button>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-footer">
          <button class="btn-save-settings" @click="saveSettings"><i data-lucide="save" style="width: 15px; height: 15px; margin-right: 6px;"></i> 保存设置</button>
        </div>
      </div>

      <!-- ========== 公司账号弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showCompanyModal" class="modal-overlay" @click.self="closeCompanyModal">
          <div class="modal-container-add modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">{{ editingCompany ? '编辑公司账号' : '新增公司账号' }}</h3>
              <button class="modal-close-btn" @click="closeCompanyModal"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group"><label class="form-label">公司名称 <span class="required">*</span></label><input type="text" v-model="companyForm.name" placeholder="请输入公司全称" class="form-input"></div>
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">统一社会信用代码 <span class="required">*</span></label><input type="text" v-model="companyForm.creditCode" placeholder="请输入18位信用代码" class="form-input"></div>
                <div class="form-group"><label class="form-label">初始配额(&yen;) <span class="required">*</span></label><input type="number" v-model="companyForm.quota" placeholder="请输入配额金额" class="form-input"></div>
              </div>
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">联系人 <span class="required">*</span></label><input type="text" v-model="companyForm.contact" placeholder="请输入联系人姓名" class="form-input"></div>
                <div class="form-group"><label class="form-label">联系电话 <span class="required">*</span></label><input type="text" v-model="companyForm.phone" placeholder="请输入联系电话" class="form-input"></div>
              </div>
              <div class="form-group"><label class="form-label">联系邮箱</label><input type="email" v-model="companyForm.email" placeholder="请输入联系邮箱" class="form-input"></div>
              <div class="form-group"><label class="form-label">公司地址</label><input type="text" v-model="companyForm.address" placeholder="请输入公司地址" class="form-input"></div>
              <div class="form-group"><label class="form-label">备注</label><textarea v-model="companyForm.remark" placeholder="可选备注信息" class="form-textarea" rows="3"></textarea></div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closeCompanyModal">取消</button>
              <button class="btn-submit" @click="submitCompany">{{ editingCompany ? '保存修改' : '确认创建' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 普通账号弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showUserModal" class="modal-overlay" @click.self="closeUserModal">
          <div class="modal-container-add modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">{{ editingUser ? '编辑普通账号' : '新增普通账号' }}</h3>
              <button class="modal-close-btn" @click="closeUserModal"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">用户名 <span class="required">*</span></label><input type="text" v-model="userForm.name" placeholder="请输入用户名" class="form-input" :disabled="!!editingUser"></div>
                <div class="form-group"><label class="form-label">角色 <span class="required">*</span></label><select v-model="userForm.role" class="form-select"><option value="普通用户">普通用户</option><option value="部门管理员">部门管理员</option><option value="公司管理员">公司管理员</option></select></div>
              </div>
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">邮箱 <span class="required">*</span></label><input type="email" v-model="userForm.email" placeholder="请输入邮箱" class="form-input" :disabled="!!editingUser"></div>
                <div class="form-group"><label class="form-label">手机号 <span class="required">*</span></label><input type="text" v-model="userForm.phone" placeholder="请输入手机号" class="form-input"></div>
              </div>
              <div v-if="!editingUser" class="form-row-2">
                <div class="form-group"><label class="form-label">初始密码 <span class="required">*</span></label><input type="password" v-model="userForm.password" placeholder="请输入初始密码" class="form-input"></div>
                <div class="form-group"><label class="form-label">确认密码 <span class="required">*</span></label><input type="password" v-model="userForm.confirmPassword" placeholder="请再次输入密码" class="form-input"></div>
              </div>
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">所属公司</label><select v-model="userForm.companyId" class="form-select"><option value="">无（独立账号）</option><option v-for="c in companyAccounts" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
                <div class="form-group"><label class="form-label">配额(&yen;)</label><input type="number" v-model="userForm.quota" placeholder="留空则使用默认值" class="form-input"></div>
              </div>
              <div class="form-group"><label class="form-label">备注</label><textarea v-model="userForm.remark" placeholder="可选备注信息" class="form-textarea" rows="2"></textarea></div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closeUserModal">取消</button>
              <button class="btn-submit" @click="submitUser">{{ editingUser ? '保存修改' : '确认创建' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 用户详情弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showUserDetail && selectedUser" class="modal-overlay" @click.self="showUserDetail = false">
          <div class="modal-container-detail">
            <div class="modal-header">
              <h3 class="modal-title">用户详情 - {{ selectedUser.name }}</h3>
              <button class="modal-close-btn" @click="showUserDetail = false"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">用户ID</span><span class="detail-value">#{{ selectedUser.id }}</span></div>
                <div class="detail-item"><span class="detail-label">用户名</span><span class="detail-value">{{ selectedUser.name }}</span></div>
                <div class="detail-item"><span class="detail-label">邮箱</span><span class="detail-value">{{ selectedUser.email }}</span></div>
                <div class="detail-item"><span class="detail-label">手机号</span><span class="detail-value">{{ selectedUser.phone }}</span></div>
                <div class="detail-item"><span class="detail-label">所属公司</span><span class="detail-value">{{ selectedUser.companyName || '独立账号' }}</span></div>
                <div class="detail-item"><span class="detail-label">角色</span><span :class="['role-badge', getRoleClass(selectedUser.role)]">{{ selectedUser.role }}</span></div>
                <div class="detail-item"><span class="detail-label">总配额</span><span class="detail-value money-text">&yen;{{ selectedUser.quota?.toLocaleString() || 0 }}</span></div>
                <div class="detail-item"><span class="detail-label">已使用</span><span class="detail-value money-text used-text">&yen;{{ selectedUser.used?.toLocaleString() || 0 }}</span></div>
                <div class="detail-item"><span class="detail-label">剩余配额</span><span class="detail-value money-text remain-text">&yen;{{ (selectedUser.quota - selectedUser.used)?.toLocaleString() || 0 }}</span></div>
                <div class="detail-item"><span class="detail-label">使用率</span><span class="detail-value">{{ (selectedUser.used / selectedUser.quota * 100).toFixed(1) }}%</span></div>
                <div class="detail-item"><span class="detail-label">状态</span><span :class="['status-badge', getUserStatusClass(selectedUser.status)]">{{ selectedUser.status }}</span></div>
                <div class="detail-item"><span class="detail-label">最后登录</span><span class="detail-value">{{ selectedUser.lastLogin }}</span></div>
                <div class="detail-item"><span class="detail-label">创建时间</span><span class="detail-value">{{ selectedUser.createdAt }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">备注</span><span class="detail-value">{{ selectedUser.remark || '无' }}</span></div>
              </div>
              <h4 class="detail-section-title">近期操作记录</h4>
              <div class="orders-table-wrap">
                <table class="orders-table">
                  <thead><tr><th>时间</th><th>操作类型</th><th>详情</th></tr></thead>
                  <tbody>
                    <tr v-for="(op, idx) in selectedUser.recentOps" :key="idx">
                      <td class="text-secondary-small">{{ op.time }}</td>
                      <td><span :class="['log-type-badge', op.typeClass]">{{ op.typeLabel }}</span></td>
                      <td>{{ op.desc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 删除确认弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
          <div class="modal-confirm">
            <div class="confirm-icon-wrap danger"><i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: #ef4444;"></i></div>
            <h3 class="confirm-title">确认删除</h3>
            <p class="confirm-desc">「{{ deleteTarget?.name || deleteTarget?.title }}」将被永久删除，此操作不可恢复。</p>
            <div class="confirm-actions">
              <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
              <button class="btn-danger" @click="confirmDelete">确认删除</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 公告编辑弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showAnnouncementModal" class="modal-overlay" @click.self="closeAnnouncementModal">
          <div class="modal-container-add modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">{{ editingAnnouncement ? '编辑公告' : '发布公告' }}</h3>
              <button class="modal-close-btn" @click="closeAnnouncementModal"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">公告标题 <span class="required">*</span></label>
                <input type="text" v-model="announcementForm.title" placeholder="请输入公告标题" class="form-input">
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">分类 <span class="required">*</span></label>
                  <select v-model="announcementForm.category" class="form-select">
                    <option value="update">功能更新</option>
                    <option value="event">活动</option>
                    <option value="tutorial">教程</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">发布状态</label>
                  <select v-model="announcementForm.status" class="form-select">
                    <option value="published">立即发布</option>
                    <option value="draft">保存为草稿</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">摘要 <span class="required">*</span></label>
                <textarea v-model="announcementForm.summary" placeholder="请输入公告摘要，不超过200字" class="form-textarea" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">正文内容 <span class="required">*</span></label>
                <textarea v-model="announcementForm.content" placeholder="请输入公告正文内容（支持HTML格式）" class="form-textarea" rows="8"></textarea>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">封面图片URL</label>
                  <input type="text" v-model="announcementForm.cover_image" placeholder="可选，输入封面图片地址" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">置顶</label>
                  <select v-model="announcementForm.is_top" class="form-select">
                    <option :value="false">否</option>
                    <option :value="true">是</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closeAnnouncementModal">取消</button>
              <button class="btn-submit" @click="submitAnnouncement">{{ editingAnnouncement ? '保存修改' : '确认发布' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 模型新增/编辑弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showModelModal" class="modal-overlay" @click.self="closeModelModal">
          <div class="modal-container-add modal-xl">
            <div class="modal-header">
              <h3 class="modal-title">{{ editingModel ? '编辑模型' : '新增模型' }}</h3>
              <button class="modal-close-btn" @click="closeModelModal"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <!-- 基础信息 -->
              <h4 class="form-section-title"><i data-lucide="info" style="width: 14px; height: 14px;"></i> 基础信息</h4>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">模型ID (model_id) <span class="required">*</span></label>
                  <input type="text" v-model="modelForm.model_id" placeholder="例如 kling_3_0" class="form-input" :disabled="!!editingModel">
                  <span class="form-hint-text">业务唯一标识，创建后不可修改</span>
                </div>
                <div class="form-group">
                  <label class="form-label">展示名 (display_name) <span class="required">*</span></label>
                  <input type="text" v-model="modelForm.display_name" placeholder="例如 Kling 3.0" class="form-input">
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">模型名 (model_name) <span class="required">*</span></label>
                  <input type="text" v-model="modelForm.model_name" placeholder="例如 Kling" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">版本号 (model_version) <span class="required">*</span></label>
                  <input type="text" v-model="modelForm.model_version" placeholder="例如 3.0" class="form-input">
                </div>
              </div>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">厂商 (vendor) <span class="required">*</span></label>
                  <select v-model="modelForm.vendor" class="form-select">
                    <option v-for="v in vendorOptions" :key="v.value" :value="v.value">{{ v.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">类型 (media_type) <span class="required">*</span></label>
                  <select v-model="modelForm.media_type" class="form-select">
                    <option v-for="t in mediaTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">状态 (status)</label>
                  <select v-model="modelForm.status" class="form-select">
                    <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
                  </select>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">厂商展示名</label>
                  <input type="text" v-model="modelForm.vendor_display_name" placeholder="例如 腾讯云 VOD" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">可用区域</label>
                  <input type="text" v-model="modelForm.availability_region" placeholder="例如 ap-guangzhou" class="form-input">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">描述</label>
                <textarea v-model="modelForm.description" placeholder="模型描述（后台自由文本）" class="form-textarea" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">标签（逗号分隔）</label>
                <input type="text" v-model="modelForm.tagsText" placeholder="例如 高清,快速,VIP" class="form-input">
              </div>

              <!-- 能力配置 -->
              <h4 class="form-section-title"><i data-lucide="sliders-horizontal" style="width: 14px; height: 14px;"></i> 能力配置</h4>
              <div class="form-group">
                <label class="form-label">支持特性 (supported_features)</label>
                <div class="checkbox-group">
                  <label v-for="f in featureOptions" :key="f" class="checkbox-item">
                    <input type="checkbox" :value="f" v-model="modelForm.supported_features">
                    <span>{{ f }}</span>
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">前端用户功能 (ui_features)</label>
                <span class="form-hint-text">控制生成页面中该模型可选的特色功能</span>
                <div class="checkbox-group">
                  <template v-if="modelForm.media_type">
                    <label v-for="f in filteredUiFeatureOptions" :key="f.id" class="checkbox-item">
                      <input type="checkbox" :value="f.id" v-model="modelForm.ui_features">
                      <span>{{ f.label }}</span>
                    </label>
                  </template>
                  <span v-else class="form-hint-text">请先选择模型类型</span>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">支持分辨率（逗号分隔）</label>
                  <input type="text" v-model="modelForm.supported_resolutions_text" placeholder="720P,1080P,2K,4K" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">支持宽高比（逗号分隔）</label>
                  <input type="text" v-model="modelForm.supported_aspect_ratios_text" placeholder="16:9,9:16,1:1" class="form-input">
                </div>
              </div>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">最大宽度</label>
                  <input type="number" v-model.number="modelForm.max_width" placeholder="4096" class="form-input" min="256" max="4096">
                </div>
                <div class="form-group">
                  <label class="form-label">最大高度</label>
                  <input type="number" v-model.number="modelForm.max_height" placeholder="4096" class="form-input" min="256" max="4096">
                </div>
                <div class="form-group">
                  <label class="form-label">最大时长(秒)</label>
                  <input type="number" v-model.number="modelForm.max_duration" placeholder="10" class="form-input" min="1">
                </div>
              </div>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">最小宽度</label>
                  <input type="number" v-model.number="modelForm.min_width" placeholder="256" class="form-input" min="256" max="4096">
                </div>
                <div class="form-group">
                  <label class="form-label">最小高度</label>
                  <input type="number" v-model.number="modelForm.min_height" placeholder="256" class="form-input" min="256" max="4096">
                </div>
                <div class="form-group">
                  <label class="form-label">最大帧率</label>
                  <input type="number" v-model.number="modelForm.max_fps" placeholder="30" class="form-input" min="1" max="60">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">声音模式</label>
                <select v-model="modelForm.sound_mode" class="form-select">
                  <option :value="null">不适用（非视频模型）</option>
                  <option v-for="sm in soundModeOptions" :key="sm.value" :value="sm.value">{{ sm.label }}</option>
                </select>
                <span class="form-hint-text">仅视频模型有效</span>
              </div>

              <!-- 积分定价配置 -->
              <h4 class="form-section-title"><i data-lucide="badge-dollar-sign" style="width: 14px; height: 14px;"></i> 积分定价配置</h4>
              <div class="form-row-3">
                <div class="form-group">
                  <label class="form-label">按次消耗 (price_per_request)</label>
                  <input type="number" step="1" v-model.number="modelForm.price_per_request" placeholder="15（图像/音频）" class="form-input" min="0">
                  <span class="form-hint-text">每次生成消耗的积分数</span>
                </div>
                <div class="form-group">
                  <label class="form-label">按秒消耗 (price_per_second)</label>
                  <input type="number" step="1" v-model.number="modelForm.price_per_second" placeholder="50（视频）" class="form-input" min="0">
                  <span class="form-hint-text">每秒生成消耗的积分数</span>
                </div>
                <div class="form-group">
                  <label class="form-label">消耗倍率 (price_multiplier)</label>
                  <input type="number" step="0.01" v-model.number="modelForm.price_multiplier" placeholder="1.00" class="form-input" min="0">
                  <span class="form-hint-text">1.00=原价，1.20=加价20%</span>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">积分单位</label>
                  <select v-model="modelForm.currency" class="form-input">
                    <option value="CNY">CNY (人民币)</option>
                    <option value="POINTS">POINTS (积分)</option>
                    <option value="USD">USD (美元)</option>
                    <option value="TOKENS">TOKENS (代币)</option>
                  </select>
                  <span class="form-hint-text">选择计费货币单位</span>
                </div>
                <div class="form-group">
                  <label class="form-label">分级定价 (price_tiers JSON)</label>
                  <textarea v-model="modelForm.price_tiers_text" placeholder='{"720p":30,"1080p":50,"4K":240}' class="form-textarea" rows="2"></textarea>
                  <span class="form-hint-text">键=分辨率，值=每秒/每次积分数。留空则使用上面的按次/按秒价</span>
                </div>
              </div>

              <!-- 启停 -->
              <h4 class="form-section-title"><i data-lucide="power" style="width: 14px; height: 14px;"></i> 启停控制</h4>
              <div class="form-group">
                <label class="switch">
                  <input type="checkbox" v-model="modelForm.is_enabled">
                  <span class="slider"></span>
                </label>
                <span class="switch-label-text">{{ modelForm.is_enabled ? '已启用（前端下拉中可见）' : '已停用（前端下拉中隐藏）' }}</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closeModelModal">取消</button>
              <button class="btn-submit" @click="submitModel">{{ editingModel ? '保存修改' : '确认创建' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 模型详情弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showModelDetailModal && selectedModelDetail" class="modal-overlay" @click.self="showModelDetailModal = false">
          <div class="modal-container-detail">
            <div class="modal-header">
              <h3 class="modal-title">模型详情 - {{ selectedModelDetail.display_name }}</h3>
              <button class="modal-close-btn" @click="showModelDetailModal = false"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">ID</span><span class="detail-value">#{{ selectedModelDetail.id }}</span></div>
                <div class="detail-item"><span class="detail-label">模型ID</span><span class="detail-value mono-text">{{ selectedModelDetail.model_id }}</span></div>
                <div class="detail-item"><span class="detail-label">模型名</span><span class="detail-value">{{ selectedModelDetail.model_name }}</span></div>
                <div class="detail-item"><span class="detail-label">版本号</span><span class="detail-value">{{ selectedModelDetail.model_version }}</span></div>
                <div class="detail-item"><span class="detail-label">展示名</span><span class="detail-value">{{ selectedModelDetail.display_name }}</span></div>
                <div class="detail-item"><span class="detail-label">厂商</span><span class="detail-value">{{ getVendorLabel(selectedModelDetail.vendor) }}</span></div>
                <div class="detail-item"><span class="detail-label">厂商展示名</span><span class="detail-value">{{ selectedModelDetail.vendor_display_name || '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">{{ getMediaTypeLabel(selectedModelDetail.media_type) }}</span></div>
                <div class="detail-item"><span class="detail-label">状态</span><span :class="['status-badge', getModelStatusClass(selectedModelDetail.status)]">{{ getStatusLabel(selectedModelDetail.status) }}</span></div>
                <div class="detail-item"><span class="detail-label">启用</span><span :class="['status-badge', selectedModelDetail.is_enabled ? 'status-active' : 'status-expired']">{{ selectedModelDetail.is_enabled ? '已启用' : '已停用' }}</span></div>
                <div class="detail-item"><span class="detail-label">可用区域</span><span class="detail-value">{{ selectedModelDetail.availability_region || '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">积分单位</span><span class="detail-value">{{ selectedModelDetail.currency || 'POINTS' }}</span></div>
                <div class="detail-item"><span class="detail-label">按次消耗</span><span class="detail-value">{{ selectedModelDetail.price_per_request != null ? selectedModelDetail.price_per_request + '积分' : '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">按秒消耗</span><span class="detail-value">{{ selectedModelDetail.price_per_second != null ? selectedModelDetail.price_per_second + '积分' : '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">消耗倍率</span><span class="detail-value">×{{ selectedModelDetail.price_multiplier ?? 1 }}</span></div>
                <div class="detail-item"><span class="detail-label">最大尺寸</span><span class="detail-value">{{ selectedModelDetail.max_width || '-' }}×{{ selectedModelDetail.max_height || '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">最小尺寸</span><span class="detail-value">{{ selectedModelDetail.min_width || '-' }}×{{ selectedModelDetail.min_height || '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">最大时长</span><span class="detail-value">{{ selectedModelDetail.max_duration || '-' }} 秒</span></div>
                <div class="detail-item"><span class="detail-label">最大帧率</span><span class="detail-value">{{ selectedModelDetail.max_fps || '-' }} fps</span></div>
                <div class="detail-item detail-full"><span class="detail-label">支持特性</span><span class="detail-value">{{ (selectedModelDetail.supported_features || []).join('、') || '-' }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">支持分辨率</span><span class="detail-value">{{ (selectedModelDetail.supported_resolutions || []).join('、') || '-' }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">支持宽高比</span><span class="detail-value">{{ (selectedModelDetail.supported_aspect_ratios || []).join('、') || '-' }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">标签</span><span class="detail-value">{{ (selectedModelDetail.tags || []).join('、') || '-' }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">分级定价</span><span class="detail-value mono-text">{{ selectedModelDetail.price_tiers ? JSON.stringify(selectedModelDetail.price_tiers) : '-' }}</span></div>
                <div class="detail-item detail-full"><span class="detail-label">描述</span><span class="detail-value">{{ selectedModelDetail.description || '-' }}</span></div>
                <div class="detail-item"><span class="detail-label">创建时间</span><span class="detail-value">{{ selectedModelDetail.created_at }}</span></div>
                <div class="detail-item"><span class="detail-label">更新时间</span><span class="detail-value">{{ selectedModelDetail.updated_at }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 模型用量统计弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showModelUsageModal && selectedModelUsage" class="modal-overlay" @click.self="showModelUsageModal = false">
          <div class="modal-container-detail">
            <div class="modal-header">
              <h3 class="modal-title">用量统计 - {{ selectedModelUsage.model_id }}</h3>
              <button class="modal-close-btn" @click="showModelUsageModal = false"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="usage-controls">
                <label class="form-label">统计天数：</label>
                <select v-model="usageDays" class="form-select usage-days-select" @change="reloadModelUsage">
                  <option :value="7">最近 7 天</option>
                  <option :value="30">最近 30 天</option>
                  <option :value="90">最近 90 天</option>
                </select>
              </div>
              <div class="usage-stats-grid">
                <div class="usage-stat-card"><span class="us-label">总请求数</span><span class="us-val">{{ selectedModelUsage.aggregate.total_requests }}</span></div>
                <div class="usage-stat-card us-success"><span class="us-label">成功</span><span class="us-val">{{ selectedModelUsage.aggregate.successful_requests }}</span></div>
                <div class="usage-stat-card us-fail"><span class="us-label">失败</span><span class="us-val">{{ selectedModelUsage.aggregate.failed_requests }}</span></div>
                <div class="usage-stat-card"><span class="us-label">平均耗时(秒)</span><span class="us-val">{{ selectedModelUsage.aggregate.avg_processing_time }}</span></div>
                <div class="usage-stat-card us-cost"><span class="us-label">总成本(¥)</span><span class="us-val">{{ selectedModelUsage.aggregate.total_cost }}</span></div>
              </div>
              <h4 class="detail-section-title">按小时聚合（最近 24 条）</h4>
              <div class="orders-table-wrap">
                <table class="orders-table">
                  <thead>
                    <tr><th>日期</th><th>小时</th><th>请求数</th><th>成功</th><th>失败</th><th>耗时(秒)</th><th>成本(¥)</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(h, idx) in (selectedModelUsage.hourly || []).slice(0, 24)" :key="idx">
                      <td>{{ h.stat_date }}</td>
                      <td>{{ h.stat_hour }}:00</td>
                      <td>{{ h.total_requests }}</td>
                      <td class="text-green">{{ h.successful_requests }}</td>
                      <td class="text-red">{{ h.failed_requests }}</td>
                      <td>{{ h.total_processing_time }}</td>
                      <td>{{ h.total_cost }}</td>
                    </tr>
                    <tr v-if="!(selectedModelUsage.hourly && selectedModelUsage.hourly.length)">
                      <td colspan="7" class="empty-row">暂无用量数据</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 模型变更历史弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showModelChangelogModal && selectedModelChangelog" class="modal-overlay" @click.self="showModelChangelogModal = false">
          <div class="modal-container-detail">
            <div class="modal-header">
              <h3 class="modal-title">变更历史 - {{ selectedModelChangelog.model_id }}</h3>
              <button class="modal-close-btn" @click="showModelChangelogModal = false"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="changelog-timeline">
                <div v-for="log in selectedModelChangelog.items" :key="log.id" class="changelog-item">
                  <div class="changelog-dot" :class="`cl-${log.change_type}`"></div>
                  <div class="changelog-content">
                    <div class="changelog-header">
                      <span :class="['log-type-badge', `log-${log.change_type === 'created' ? 'create' : log.change_type === 'updated' ? 'update' : log.change_type === 'disabled' ? 'delete' : 'status'}`]">{{ log.change_type }}</span>
                      <span class="changelog-time">{{ log.created_at }}</span>
                    </div>
                    <div class="changelog-desc">{{ log.change_description }}</div>
                    <div class="changelog-operator">操作人：{{ log.operator_name || '-' }}</div>
                    <details v-if="log.changed_fields" class="changelog-fields">
                      <summary>查看变更字段</summary>
                      <pre class="changelog-json">{{ JSON.stringify(log.changed_fields, null, 2) }}</pre>
                    </details>
                  </div>
                </div>
                <div v-if="!selectedModelChangelog.items || selectedModelChangelog.items.length === 0" class="empty-row">
                  暂无变更记录
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ========== 克隆模型弹窗 ========== -->
      <Teleport to="body">
        <div v-if="showCloneModal" class="modal-overlay" @click.self="closeCloneModal">
          <div class="modal-container-add">
            <div class="modal-header">
              <h3 class="modal-title">克隆模型 - {{ cloneSourceModel?.display_name }}</h3>
              <button class="modal-close-btn" @click="closeCloneModal"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            <div class="modal-body">
              <div class="clone-info-box">
                <div class="info-row"><span class="info-label">源模型ID：</span><code class="mono-text">{{ cloneSourceModel?.model_id }}</code></div>
                <div class="info-row"><span class="info-label">厂商：</span>{{ getVendorLabel(cloneSourceModel?.vendor) }}</div>
                <div class="info-row"><span class="info-label">类型：</span>{{ getMediaTypeLabel(cloneSourceModel?.media_type) }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">新模型ID (new_model_id) <span class="required">*</span></label>
                <input type="text" v-model="cloneForm.new_model_id" placeholder="例如 gp-im-2（全局唯一）" class="form-input">
                <span class="form-hint-text">新模型的唯一标识，不能与源模型相同</span>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">展示名</label>
                  <input type="text" v-model="cloneForm.display_name" placeholder="留空则沿用源模型展示名" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">模型名</label>
                  <input type="text" v-model="cloneForm.model_name" placeholder="留空则沿用源模型名" class="form-input">
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">版本号</label>
                  <input type="text" v-model="cloneForm.model_version" placeholder="留空则沿用源版本" class="form-input">
                </div>
                <div class="form-group">
                  <label class="form-label">按次消耗</label>
                  <input type="number" step="1" v-model.number="cloneForm.price_per_request" placeholder="留空则沿用源定价" class="form-input" min="0">
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">按秒消耗</label>
                  <input type="number" step="1" v-model.number="cloneForm.price_per_second" placeholder="留空则沿用源定价" class="form-input" min="0">
                </div>
                <div class="form-group">
                  <label class="form-label">消耗倍率</label>
                  <input type="number" step="0.01" v-model.number="cloneForm.price_multiplier" placeholder="留空则沿用源倍率" class="form-input" min="0">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">描述</label>
                <textarea v-model="cloneForm.description" placeholder="留空则沿用源描述" class="form-textarea" rows="2"></textarea>
              </div>
              <div class="clone-note">
                <i data-lucide="info" style="width:14px;height:14px;color:#f59e0b;"></i>
                <span>克隆后新模型默认 status=deprecated、is_enabled=false，需手动启用</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="closeCloneModal">取消</button>
              <button class="btn-submit" @click="submitClone">确认克隆</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import AppLayout from '../components/layout/AppLayout.vue'
import { getAnnouncementsApi, createAnnouncementApi, updateAnnouncementApi, deleteAnnouncementApi } from '../api/announcement'
import {
  getAdminModelsApi, getAdminModelDetailApi, createAdminModelApi, updateAdminModelApi,
  enableAdminModelApi, disableAdminModelApi, deleteAdminModelApi, getAdminModelUsageApi, getAdminModelChangelogApi,
  syncAdminModelsFromJsonApi, cloneAdminModelApi, restoreAdminModelApi,
  VENDOR_OPTIONS, MEDIA_TYPE_OPTIONS, STATUS_OPTIONS, FEATURE_OPTIONS,
  SOUND_MODE_OPTIONS, FEATURE_UI_OPTIONS,
  getVendorLabel, getMediaTypeLabel, getStatusLabel, getSoundModeLabel
} from '../api/adminModels'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)

const tabs = [
  { key: 'overview', label: '系统概览', icon: 'layout-dashboard' },
  { key: 'company', label: '公司账号', icon: 'building-2' },
  { key: 'user', label: '普通账号', icon: 'users' },
  { key: 'model', label: '模型管理', icon: 'cpu' },
  { key: 'announcement', label: '公告管理', icon: 'megaphone' },
  { key: 'logs', label: '操作日志', icon: 'scroll-text' },
  { key: 'settings', label: '系统设置', icon: 'settings' }
]
const activeTab = ref('overview')

// ==================== 公司账号数据 ====================
const companyAccounts = ref([
  { id: 1, name: '影创科技有限公司', creditCode: '91110108MA01XXXXX1', contact: '赵老板', phone: '138****1234', email: 'zhao@yingchuang.com', quota: 200000, used: 156000, status: '启用', createdAt: '2025-03-15', address: '北京市朝阳区xxx路88号', remark: '' },
  { id: 2, name: '漫剧文化传媒有限公司', creditCode: '91110108MA02XXXXX2', contact: '杜总', phone: '139****5678', email: 'du@manju.com', quota: 150000, used: 98000, status: '启用', createdAt: '2025-05-20', address: '上海市浦东新区xxx大厦12F', remark: 'VIP客户' },
  { id: 3, name: '电商视觉工作室', creditCode: '91110108MA03XXXXX3', contact: '张经理', phone: '137****9012', email: 'zhang@dianshang.com', quota: 80000, used: 72000, status: '启用', createdAt: '2025-07-10', address: '杭州市西湖区xxx科技园', remark: '' },
  { id: 4, name: '未来数字科技公司', creditCode: '91110108MA04XXXXX4', contact: '李总监', phone: '136****3456', email: 'li@future.com', quota: 50000, used: 12000, status: '禁用', createdAt: '2025-09-01', address: '深圳市南山区xxx创新中心', remark: '欠费停用' }
])

const companySearch = ref('')
const companyStatusFilter = ref('')
const companyPage = ref(1)
const companyPageSize = 8

const totalCompanyQuota = computed(() => companyAccounts.value.reduce((sum, c) => sum + c.quota, 0))

const filteredCompanies = computed(() => {
  let result = companyAccounts.value
  if (companySearch.value.trim()) {
    const q = companySearch.value.toLowerCase()
    result = result.filter(c => c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q))
  }
  if (companyStatusFilter.value) result = result.filter(c => c.status === companyStatusFilter.value)
  return result
})

const companyTotalPages = computed(() => Math.ceil(filteredCompanies.value.length / companyPageSize) || 1)
const pagedCompanies = computed(() => {
  const start = (companyPage.value - 1) * companyPageSize
  return filteredCompanies.value.slice(start, start + companyPageSize)
})

// ==================== 普通用户数据 ====================
const avatarColors = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4']
const normalUsers = ref([
  { id: 1001, name: '王开发', email: 'wangdev@yingchuang.com', phone: '13811110001', companyName: '影创科技有限公司', role: '超级管理员', quota: 50000, used: 32000, status: '活跃', lastLogin: '2026-06-03 09:15', createdAt: '2025-03-15', remark: '', avatarColor: avatarColors[0], recentOps: [{ time: '2026-06-03 09:15', typeLabel: '登录', typeClass: 'log-login', desc: '从 192.168.1.100 登录' }, { time: '2026-06-02 17:30', typeLabel: '修改', typeClass: 'log-update', desc: '修改了系统配置' }] },
  { id: 1002, name: '赵老板', email: 'zhao@yingchuang.com', phone: '13811110002', companyName: '影创科技有限公司', role: '公司管理员', quota: 100000, used: 80000, status: '活跃', lastLogin: '2026-06-03 08:42', createdAt: '2025-03-15', remark: '创始人', avatarColor: avatarColors[1], recentOps: [{ time: '2026-06-03 08:42', typeLabel: '登录', typeClass: 'log-login', desc: '从 192.168.1.101 登录' }] },
  { id: 1003, name: '杜总', email: 'du@manju.com', phone: '13811110003', companyName: '漫剧文化传媒有限公司', role: '公司管理员', quota: 80000, used: 55000, status: '活跃', lastLogin: '2026-06-02 22:10', createdAt: '2025-05-20', remark: '', avatarColor: avatarColors[2], recentOps: [] },
  { id: 1004, name: '刘总', email: 'liu@manju.com', phone: '13811110004', companyName: '漫剧文化传媒有限公司', role: '部门管理员', quota: 75000, used: 60000, status: '活跃', lastLogin: '2026-06-02 19:30', createdAt: '2025-05-25', remark: '', avatarColor: avatarColors[3], recentOps: [] },
  { id: 1005, name: '张经理', email: 'zhang@dianshang.com', phone: '13811110005', companyName: '电商视觉工作室', role: '部门管理员', quota: 60000, used: 42000, status: '活跃', lastLogin: '2026-06-03 10:05', createdAt: '2025-07-10', remark: '', avatarColor: avatarColors[4], recentOps: [] },
  { id: 1006, name: '马经理', email: 'ma@dianshang.com', phone: '13811110006', companyName: '电商视觉工作室', role: '普通用户', quota: 55000, used: 38000, status: '活跃', lastLogin: '2026-06-01 14:20', createdAt: '2025-07-15', remark: '', avatarColor: avatarColors[5], recentOps: [] },
  { id: 1007, name: '小关', email: 'xiaoguan@yingchuang.com', phone: '13811110007', companyName: '影创科技有限公司', role: '普通用户', quota: 40000, used: 35000, status: '活跃', lastLogin: '2026-06-03 11:30', createdAt: '2025-08-01', remark: '', avatarColor: avatarColors[6], recentOps: [] },
  { id: 1008, name: '小李', email: 'xiaoli@yingchuang.com', phone: '13811110008', companyName: '影创科技有限公司', role: '普通用户', quota: 35000, used: 28000, status: '活跃', lastLogin: '2026-05-30 16:45', createdAt: '2025-08-10', remark: '', avatarColor: avatarColors[7], recentOps: [] },
  { id: 1009, name: '小王', email: 'xiaowang@dianshang.com', phone: '13811110009', companyName: '电商视觉工作室', role: '普通用户', quota: 30000, used: 5000, status: '停用', lastLogin: '2026-04-15 09:00', createdAt: '2025-09-01', remark: '离职停用', avatarColor: avatarColors[0], recentOps: [] },
  { id: 1010, name: '小张', email: 'xiaozhang@manju.com', phone: '13811110010', companyName: '漫剧文化传媒有限公司', role: '普通用户', quota: 30000, used: 12000, status: '活跃', lastLogin: '2026-06-02 11:00', createdAt: '2025-10-01', remark: '', avatarColor: avatarColors[1], recentOps: [] }
])

const activeUserCount = computed(() => normalUsers.value.filter(u => u.status === '活跃').length)

const userSearch = ref('')
const userRoleFilter = ref('')
const userStatusFilter = ref('')
const userPage = ref(1)
const userPageSize = 8

const filteredUsers = computed(() => {
  let result = normalUsers.value
  if (userSearch.value.trim()) {
    const q = userSearch.value.toLowerCase()
    result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q))
  }
  if (userRoleFilter.value) result = result.filter(u => u.role === userRoleFilter.value)
  if (userStatusFilter.value) result = result.filter(u => u.status === userStatusFilter.value)
  return result
})

const userTotalPages = computed(() => Math.ceil(filteredUsers.value.length / userPageSize) || 1)
const pagedUsers = computed(() => {
  const start = (userPage.value - 1) * userPageSize
  return filteredUsers.value.slice(start, start + userPageSize)
})

// ==================== 操作日志数据 ====================
const operationLogs = ref([
  { id: 1, type: 'create', typeLabel: '新增', typeClass: 'log-create', description: '新增公司账号「未来数字科技」', operator: '王开发', target: '公司#4', ip: '192.168.1.100', time: '2026-06-03 10:30:15' },
  { id: 2, type: 'update', typeLabel: '修改', typeClass: 'log-update', description: '修改用户「小关」的配额为40000', operator: '王开发', target: '用户#1007', ip: '192.168.1.100', time: '2026-06-03 10:15:42' },
  { id: 3, type: 'delete', typeLabel: '删除', typeClass: 'log-delete', description: '删除用户「测试账号」', operator: '王开发', target: '用户#1099', ip: '192.168.1.100', time: '2026-06-03 09:50:08' },
  { id: 4, type: 'status', typeLabel: '状态变更', typeClass: 'log-status', description: '将用户「小王」的状态改为停用', operator: '王开发', target: '用户#1009', ip: '192.168.1.100', time: '2026-06-02 17:20:33' },
  { id: 5, type: 'create', typeLabel: '新增', typeClass: 'log-create', description: '新增普通账号「小张」', operator: '王开发', target: '用户#1010', ip: '192.168.1.100', time: '2026-06-02 14:05:21' },
  { id: 6, type: 'login', typeLabel: '登录', typeClass: 'log-login', description: '系统管理员登录系统', operator: '王开发', target: '-', ip: '192.168.1.100', time: '2026-06-02 09:00:00' },
  { id: 7, type: 'update', typeLabel: '修改', typeClass: 'log-update', description: '更新公司「影创科技」配额为200000', operator: '王开发', target: '公司#1', ip: '192.168.1.100', time: '2026-06-01 16:40:55' },
  { id: 8, type: 'create', typeLabel: '新增', typeClass: 'log-create', description: '新增公司账号「电商视觉工作室」', operator: '王开发', target: '公司#3', ip: '192.168.1.100', time: '2026-05-28 11:20:10' },
  { id: 9, type: 'status', typeLabel: '状态变更', typeClass: 'log-status', description: '将公司「未来数字科技」禁用', operator: '王开发', target: '公司#4', ip: '192.168.1.100', time: '2026-05-25 15:10:00' },
  { id: 10, type: 'update', typeLabel: '修改', typeClass: 'log-update', description: '修改系统设置：开启异常登录告警', operator: '王开发', target: '系统配置', ip: '192.168.1.100', time: '2026-05-20 09:30:00' }
])

const logSearch = ref('')
const logTypeFilter = ref('')
const logPage = ref(1)
const logPageSize = 8

const filteredLogs = computed(() => {
  let result = operationLogs.value
  if (logSearch.value.trim()) result = result.filter(l => l.description.toLowerCase().includes(logSearch.value.toLowerCase()))
  if (logTypeFilter.value) result = result.filter(l => l.type === logTypeFilter.value)
  return result
})

const logTotalPages = computed(() => Math.ceil(filteredLogs.value.length / logPageSize) || 1)
const pagedLogs = computed(() => {
  const start = (logPage.value - 1) * logPageSize
  return filteredLogs.value.slice(start, start + logPageSize)
})

// ==================== 系统设置数据 ====================
const settings = ref({
  newUserNotify: true, quotaAlert: true, abnormalLoginAlert: true,
  minPasswordLength: 8, maxLoginAttempts: 5, tokenExpiryHours: 24, defaultQuota: 30000, autoBackup: true
})

// ==================== 公司账号 CRUD ====================
const showCompanyModal = ref(false)
const editingCompany = ref(null)
const companyForm = ref({ name: '', creditCode: '', contact: '', phone: '', email: '', quota: '', address: '', remark: '' })

function openCompanyModal(company) {
  editingCompany.value = company || null
  companyForm.value = company ? { ...company } : { name: '', creditCode: '', contact: '', phone: '', email: '', quota: '', address: '', remark: '' }
  showCompanyModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function closeCompanyModal() { showCompanyModal.value = false; editingCompany.value = null }

function submitCompany() {
  if (!companyForm.value.name || !companyForm.value.creditCode || !companyForm.value.contact || !companyForm.value.phone || !companyForm.value.quota) { alert('请填写必填项'); return }
  if (editingCompany.value) {
    const idx = companyAccounts.value.findIndex(c => c.id === editingCompany.value.id)
    if (idx !== -1) { companyAccounts.value[idx] = { ...companyAccounts.value[idx], ...companyForm.value }; addLog('update', `修改公司账号「${companyForm.value.name}」`, `公司#${editingCompany.value.id}`) }
  } else {
    const newId = Math.max(...companyAccounts.value.map(c => c.id), 0) + 1
    companyAccounts.value.push({ id: newId, ...companyForm.value, quota: Number(companyForm.value.quota), used: 0, status: '启用', createdAt: new Date().toISOString().split('T')[0] })
    addLog('create', `新增公司账号「${companyForm.value.name}」`, `公司#${newId}`)
  }
  closeCompanyModal()
}

function toggleCompanyStatus(company) {
  company.status = company.status === '启用' ? '禁用' : '启用'
  addLog('status', `将公司「${company.name}」${company.status}`, `公司#${company.id}`)
}

// ==================== 删除确认 ====================
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const deleteType = ref('')

function deleteCompany(company) { deleteTarget.value = company; deleteType.value = 'company'; showDeleteConfirm.value = true; nextTick(() => { if (window.lucide) lucide.createIcons() }) }
function deleteUser(user) { deleteTarget.value = user; deleteType.value = 'user'; showDeleteConfirm.value = true; nextTick(() => { if (window.lucide) lucide.createIcons() }) }

function confirmDelete() {
  if (deleteType.value === 'company') {
    const idx = companyAccounts.value.findIndex(c => c.id === deleteTarget.value.id)
    if (idx !== -1) { addLog('delete', `删除公司账号「${deleteTarget.value.name}」`, `公司#${deleteTarget.value.id}`); companyAccounts.value.splice(idx, 1) }
  } else if (deleteType.value === 'user') {
    const idx = normalUsers.value.findIndex(u => u.id === deleteTarget.value.id)
    if (idx !== -1) { addLog('delete', `删除用户「${deleteTarget.value.name}」`, `用户#${deleteTarget.value.id}`); normalUsers.value.splice(idx, 1) }
  } else if (deleteType.value === 'announcement') {
    const idx = announcementList.value.findIndex(a => a.id === deleteTarget.value.id)
    if (idx !== -1) {
      addLog('delete', `删除公告「${deleteTarget.value.title}」`, `公告#${deleteTarget.value.id}`)
      announcementList.value.splice(idx, 1)
      deleteAnnouncementApi(deleteTarget.value.id).catch(() => {})
    }
  }
  showDeleteConfirm.value = false; deleteTarget.value = null; deleteType.value = ''
}

// ==================== 普通用户 CRUD ====================
const showUserModal = ref(false)
const editingUser = ref(null)
const userForm = ref({ name: '', email: '', phone: '', role: '普通用户', password: '', confirmPassword: '', companyId: '', quota: '', remark: '' })

function openUserModal(user) {
  editingUser.value = user || null
  if (user) {
    const mc = companyAccounts.value.find(c => c.name === user.companyName)
    userForm.value = { name: user.name, email: user.email, phone: user.phone, role: user.role, password: '', confirmPassword: '', companyId: mc ? String(mc.id) : '', quota: String(user.quota), remark: user.remark || '' }
  } else { userForm.value = { name: '', email: '', phone: '', role: '普通用户', password: '', confirmPassword: '', companyId: '', quota: '', remark: '' } }
  showUserModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function closeUserModal() { showUserModal.value = false; editingUser.value = null }

function submitUser() {
  if (!userForm.value.name || !userForm.value.email || !userForm.value.phone) { alert('请填写必填项'); return }
  if (!editingUser.value && (!userForm.value.password || userForm.value.password !== userForm.value.confirmPassword)) { alert('请正确输入密码'); return }
  if (editingUser.value) {
    const idx = normalUsers.value.findIndex(u => u.id === editingUser.value.id)
    if (idx !== -1) {
      const company = companyAccounts.value.find(c => c.id == userForm.value.companyId)
      normalUsers.value[idx] = { ...normalUsers.value[idx], name: userForm.value.name, email: userForm.value.email, phone: userForm.value.phone, role: userForm.value.role, companyName: company?.name || normalUsers.value[idx].companyName, quota: userForm.value.quota ? Number(userForm.value.quota) : normalUsers.value[idx].quota, remark: userForm.value.remark }
      addLog('update', `修改用户「${userForm.value.name}」的信息`, `用户#${editingUser.value.id}`)
    }
  } else {
    const newId = Math.max(...normalUsers.value.map(u => u.id), 0) + 1
    const company = companyAccounts.value.find(c => c.id == userForm.value.companyId)
    normalUsers.value.push({ id: newId, name: userForm.value.name, email: userForm.value.email, phone: userForm.value.phone, companyName: company?.name || null, role: userForm.value.role, quota: Number(userForm.value.quota) || settings.value.defaultQuota, used: 0, status: '活跃', lastLogin: '-', createdAt: new Date().toISOString().split('T')[0], remark: userForm.value.remark, avatarColor: avatarColors[newId % avatarColors.length], recentOps: [] })
    addLog('create', `新增普通账号「${userForm.value.name}」`, `用户#${newId}`)
  }
  closeUserModal()
}

function toggleUserStatus(user) { user.status = user.status === '活跃' ? '停用' : '活跃'; addLog('status', `将用户「${user.name}」${user.status}`, `用户#${user.id}`) }

// ==================== 用户详情 ====================
const showUserDetail = ref(false)
const selectedUser = ref(null)

function viewUserDetail(user) { selectedUser.value = user; showUserDetail.value = true; nextTick(() => { if (window.lucide) lucide.createIcons() }) }

// ==================== 辅助方法 ====================
function getStatusBadgeClass(s) { return s === '启用' || s === '活跃' ? 'status-active' : s === '禁用' ? 'status-expired' : 'status-warning' }
function getUserStatusClass(s) { return s === '活跃' ? 'status-active' : 'status-expired' }
function getRoleClass(r) { if (r === '超级管理员') return 'role-super'; if (r === '公司管理员') return 'role-company'; if (r === '部门管理员') return 'role-dept'; return 'role-normal' }

function addLog(type, desc, target) {
  operationLogs.value.unshift({
    id: operationLogs.value.length + 1, type,
    typeLabel: { create: '新增', update: '修改', delete: '删除', status: '状态变更', login: '登录' }[type],
    typeClass: `log-${type}`, description: desc, operator: '王开发', target, ip: '192.168.1.100',
    time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  })
}

function exportLogs() { alert(`导出 ${filteredLogs.value.length} 条操作日志`) }
function handleBackup() { alert('数据库备份任务已启动，预计需要 3-5 分钟') }
function handleClearCache() { alert('缓存清除完成，释放约 256MB 内存空间') }
function saveSettings() { alert('系统设置已保存成功') }

// ==================== 公告管理数据 ====================
const announcementList = ref([])
const annSearch = ref('')
const annCategoryFilter = ref('')
const annStatusFilter = ref('')
const annPage = ref(1)
const annPageSize = 8

const annCategoryLabels = { update: '功能更新', event: '活动', tutorial: '教程' }
function getAnnCategoryLabel(key) { return annCategoryLabels[key] || key }

const filteredAnnouncements = computed(() => {
  let result = announcementList.value
  if (annSearch.value.trim()) {
    const q = annSearch.value.toLowerCase()
    result = result.filter(a => a.title.toLowerCase().includes(q))
  }
  if (annCategoryFilter.value) result = result.filter(a => a.category === annCategoryFilter.value)
  if (annStatusFilter.value) result = result.filter(a => a.status === annStatusFilter.value)
  return result
})

const annTotalPages = computed(() => Math.ceil(filteredAnnouncements.value.length / annPageSize) || 1)
const pagedAnnouncements = computed(() => {
  const start = (annPage.value - 1) * annPageSize
  return filteredAnnouncements.value.slice(start, start + annPageSize)
})

const showAnnouncementModal = ref(false)
const editingAnnouncement = ref(null)
const announcementForm = ref({
  title: '', category: 'update', summary: '', content: '', cover_image: '', is_top: false, status: 'published'
})

async function fetchAnnouncements() {
  try {
    const res = await getAnnouncementsApi({ page: 1, page_size: 100 })
    if (isUnmounted.value) return
    const body = res.data
    const data = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
    announcementList.value = data.items || []
  } catch (e) {
    console.error('获取公告列表失败:', e)
  }
}

function openAnnouncementModal(ann) {
  editingAnnouncement.value = ann || null
  if (ann) {
    announcementForm.value = {
      title: ann.title, category: ann.category, summary: ann.summary,
      content: ann.content, cover_image: ann.cover_image || '', is_top: ann.is_top, status: ann.status
    }
  } else {
    announcementForm.value = { title: '', category: 'update', summary: '', content: '', cover_image: '', is_top: false, status: 'published' }
  }
  showAnnouncementModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function closeAnnouncementModal() {
  showAnnouncementModal.value = false
  editingAnnouncement.value = null
}

async function submitAnnouncement() {
  if (!announcementForm.value.title || !announcementForm.value.summary || !announcementForm.value.content) {
    alert('请填写必填项（标题、摘要、正文内容）')
    return
  }
  try {
    if (editingAnnouncement.value) {
      await updateAnnouncementApi(editingAnnouncement.value.id, announcementForm.value)
      addLog('update', `修改公告「${announcementForm.value.title}」`, `公告#${editingAnnouncement.value.id}`)
    } else {
      await createAnnouncementApi(announcementForm.value)
      addLog('create', `发布公告「${announcementForm.value.title}」`, '公告')
    }
    closeAnnouncementModal()
    await fetchAnnouncements()
  } catch (e) {
    alert('操作失败：' + e.message)
  }
}

async function toggleAnnouncementStatus(ann) {
  const newStatus = ann.status === 'published' ? 'draft' : 'published'
  try {
    await updateAnnouncementApi(ann.id, { status: newStatus })
    ann.status = newStatus
    addLog('status', `${newStatus === 'published' ? '发布' : '撤回'}公告「${ann.title}」`, `公告#${ann.id}`)
  } catch (e) {
    alert('操作失败：' + e.message)
  }
}

async function toggleAnnouncementTop(ann) {
  try {
    await updateAnnouncementApi(ann.id, { is_top: !ann.is_top })
    ann.is_top = !ann.is_top
  } catch (e) {
    alert('操作失败：' + e.message)
  }
}

function deleteAnnouncement(ann) {
  deleteTarget.value = ann
  deleteType.value = 'announcement'
  showDeleteConfirm.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// ==================== 模型管理 ====================
const vendorOptions = VENDOR_OPTIONS
const mediaTypeOptions = MEDIA_TYPE_OPTIONS
const statusOptions = STATUS_OPTIONS
const featureOptions = FEATURE_OPTIONS
const soundModeOptions = SOUND_MODE_OPTIONS
const uiFeatureOptions = FEATURE_UI_OPTIONS
const filteredUiFeatureOptions = computed(() => {
  if (!modelForm.value?.media_type) return []
  return uiFeatureOptions.filter(f => f.media_type === modelForm.value.media_type)
})

const modelList = ref([])
const modelSearch = ref('')
const modelVendorFilter = ref('')
const modelMediaTypeFilter = ref('')
const modelStatusFilter = ref('')
const modelEnabledFilter = ref('')
const modelPage = ref(1)
const modelPageSize = 10
const showDeletedModels = ref(false) // 回收站视图开关

// 克隆模型相关变量
const showCloneModal = ref(false)
const cloneSourceModel = ref(null)
const cloneForm = ref({
  new_model_id: '',
  display_name: '',
  model_name: '',
  model_version: '',
  price_per_request: null,
  price_per_second: null,
  price_multiplier: null,
  description: ''
})

function getModelStatusClass(s) {
  if (s === 'active') return 'status-active'
  if (s === 'deprecated') return 'status-warning'
  return 'status-expired'
}

const filteredModels = computed(() => {
  console.log('[模型筛选] 重新计算 - 原始数据:', modelList.value.length,
    '| 搜索:', modelSearch.value,
    '| 厂商:', modelVendorFilter.value,
    '| 类型:', modelMediaTypeFilter.value,
    '| 状态:', modelStatusFilter.value,
    '| 启停:', modelEnabledFilter.value)

  let result = [...modelList.value] // 创建副本避免修改原数组

  if (modelSearch.value && modelSearch.value.trim()) {
    const q = modelSearch.value.toLowerCase().trim()
    result = result.filter(m =>
      String(m.model_id || '').toLowerCase().includes(q) ||
      String(m.display_name || '').toLowerCase().includes(q) ||
      String(m.model_name || '').toLowerCase().includes(q)
    )
    console.log('[模型筛选] 搜索过滤后:', result.length)
  }

  if (modelVendorFilter.value) {
    result = result.filter(m => m.vendor === modelVendorFilter.value)
    console.log('[模型筛选] 厂商过滤后:', result.length)
  }

  if (modelMediaTypeFilter.value) {
    result = result.filter(m => m.media_type === modelMediaTypeFilter.value)
    console.log('[模型筛选] 类型过滤后:', result.length)
  }

  if (modelStatusFilter.value) {
    result = result.filter(m => m.status === modelStatusFilter.value)
    console.log('[模型筛选] 状态过滤后:', result.length)
  }

  if (modelEnabledFilter.value !== '' && modelEnabledFilter.value !== null && modelEnabledFilter.value !== undefined) {
    const val = modelEnabledFilter.value === 'true' || modelEnabledFilter.value === true
    result = result.filter(m => m.is_enabled === val)
    console.log('[模型筛选] 启停过滤后:', result.length)
  }

  console.log('[模型筛选] 最终结果:', result.length)
  return result
})

const modelTotalPages = computed(() => Math.ceil(filteredModels.value.length / modelPageSize) || 1)
const pagedModels = computed(() => {
  const start = (modelPage.value - 1) * modelPageSize
  return filteredModels.value.slice(start, start + modelPageSize)
})

async function fetchModels() {
  try {
    const res = await getAdminModelsApi({
      limit: 1000,
      include_deleted: showDeletedModels.value // 根据回收站开关决定是否显示软删模型
    })
    if (isUnmounted.value) return
    // 后端返回 { code, message, data: { items, total } } 包裹结构
    const body = res.data
    const data = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
    const items = data.items || []
    // 确保每条数据都有media_type字段，用于筛选
    modelList.value = items.map(m => ({
      ...m,
      media_type: m.media_type || (m.type || null)
    }))
    // 调试日志：输出各类型的模型数量
    const typeCount = {}
    modelList.value.forEach(m => { typeCount[m.media_type] = (typeCount[m.media_type] || 0) + 1 })
    console.log('[模型列表] 加载完成，类型分布:', typeCount, '总数:', modelList.value.length, '回收站:', showDeletedModels.value)
  } catch (e) {
    console.error('获取模型列表失败:', e)
    alert('获取模型列表失败：' + e.message)
  }
}

// 回收站视图切换
function toggleDeletedView() {
  modelPage.value = 1 // 重置页码
  fetchModels()
}

// ----- 新增/编辑 -----
const showModelModal = ref(false)
const editingModel = ref(null)
const defaultModelForm = () => ({
  model_id: '', model_name: '', model_version: '', display_name: '',
  vendor: 'vendor_a', vendor_display_name: '', media_type: 'image',
  supported_features: [],
  supported_resolutions_text: '',
  supported_aspect_ratios_text: '',
  sound_mode: null, ui_features: [],
  max_width: null, max_height: null, min_width: null, min_height: null,
  max_duration: null, max_fps: null,
  price_per_request: null, price_per_second: null, price_multiplier: 1.00,
  currency: 'CNY', price_tiers_text: '',
  status: 'active', is_enabled: true,
  availability_region: '', description: '', tagsText: ''
})
const modelForm = ref(defaultModelForm())

function openModelModal(model) {
  editingModel.value = model || null
  if (model) {
    modelForm.value = {
      ...defaultModelForm(),
      ...model,
      supported_features: [...(model.supported_features || [])],
      sound_mode: model.sound_mode || null,
      ui_features: [...(model.ui_features || [])],
      supported_resolutions_text: (model.supported_resolutions || []).join(','),
      supported_aspect_ratios_text: (model.supported_aspect_ratios || []).join(','),
      tagsText: (model.tags || []).join(','),
      price_tiers_text: model.price_tiers ? JSON.stringify(model.price_tiers, null, 2) : ''
    }
  } else {
    modelForm.value = defaultModelForm()
  }
  showModelModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function closeModelModal() {
  showModelModal.value = false
  editingModel.value = null
}

function buildModelPayload() {
  const f = modelForm.value
  const payload = {
    model_id: f.model_id,
    model_name: f.model_name,
    model_version: f.model_version,
    display_name: f.display_name,
    vendor: f.vendor,
    media_type: f.media_type,
    status: f.status,
    is_enabled: !!f.is_enabled
  }
  if (f.vendor_display_name) payload.vendor_display_name = f.vendor_display_name
  if (f.availability_region) payload.availability_region = f.availability_region
  if (f.description) payload.description = f.description
  if (f.currency) payload.currency = f.currency
  if (f.price_multiplier != null) payload.price_multiplier = Number(f.price_multiplier)

  // 数组字段
  // supported_features 允许为空数组（清空所有支持功能），始终发送
  payload.supported_features = [...(f.supported_features || [])]
  // sound_mode 允许为 null（非视频模型），始终发送以便清空
  payload.sound_mode = f.sound_mode
  // ui_features 允许为空数组（清空所有特色功能），始终发送
  payload.ui_features = [...(f.ui_features || [])]
  if (f.supported_resolutions_text && f.supported_resolutions_text.trim()) {
    payload.supported_resolutions = f.supported_resolutions_text.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (f.supported_aspect_ratios_text && f.supported_aspect_ratios_text.trim()) {
    payload.supported_aspect_ratios = f.supported_aspect_ratios_text.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (f.tagsText && f.tagsText.trim()) {
    payload.tags = f.tagsText.split(',').map(s => s.trim()).filter(Boolean)
  }

  // 数值字段 - 只在有有效值时才添加
  ;['max_width', 'max_height', 'min_width', 'min_height', 'max_duration', 'max_fps'].forEach(k => {
    const val = Number(f[k])
    if (f[k] !== null && f[k] !== '' && f[k] !== undefined && !isNaN(val)) {
      payload[k] = val
    }
  })

  // 定价
  const pricePerRequest = Number(f.price_per_request)
  if (f.price_per_request !== null && f.price_per_request !== '' && f.price_per_request !== undefined && !isNaN(pricePerRequest)) {
    payload.price_per_request = pricePerRequest
  }
  const pricePerSecond = Number(f.price_per_second)
  if (f.price_per_second !== null && f.price_per_second !== '' && f.price_per_second !== undefined && !isNaN(pricePerSecond)) {
    payload.price_per_second = pricePerSecond
  }

  // price_tiers
  if (f.price_tiers_text && f.price_tiers_text.trim()) {
    try {
      const parsed = JSON.parse(f.price_tiers_text)
      if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
        payload.price_tiers = parsed
      }
    } catch (e) {
      throw new Error('分级定价 JSON 格式错误：' + e.message)
    }
  }

  return payload
}

async function submitModel() {
  // 必填校验
  const f = modelForm.value
  if (!f.model_id || !f.model_name || !f.model_version || !f.display_name || !f.vendor || !f.media_type) {
    alert('请填写所有必填字段（model_id / model_name / model_version / display_name / vendor / media_type）')
    return
  }

  let payload
  try {
    payload = buildModelPayload()
  } catch (e) {
    alert(e.message)
    return
  }

  try {
    if (editingModel.value) {
      // PATCH：构建增量更新数据，只包含有意义的字段
      const { model_id, ...patchData } = payload
      // 移除值为null、undefined、空字符串的可选字段，避免422验证错误
      // 注意：sound_mode 允许为 null（非视频模型），需要保留以便清空
      const cleanPatchData = {}
      for (const [key, value] of Object.entries(patchData)) {
        if (key === 'sound_mode') {
          cleanPatchData[key] = value
        } else if (value !== null && value !== undefined && value !== '') {
          cleanPatchData[key] = value
        }
      }
      await updateAdminModelApi(editingModel.value.model_id, cleanPatchData)
      addLog('update', `修改模型「${f.display_name}」`, `模型#${editingModel.value.model_id}`)
    } else {
      // 新增模型：检查是否已存在同名模型
      const existingSameId = modelList.value.find(m => m.model_id === f.model_id)
      if (existingSameId) {
        const typeLabel = { image: '图片', video: '视频', audio: '音频' }
        if (existingSameId.media_type === f.media_type) {
          // 同名同类型：提示是否覆盖更新
          const confirmMsg = `模型ID「${f.model_id}」已存在（类型：${f.media_type}）。\n\n是否覆盖更新该模型的配置？`
          if (!confirm(confirmMsg)) return
        } else {
          // 同名不同类型：使用带后缀的ID存储，保持原始ID用于API调用
          const currentTypeLabel = typeLabel[f.media_type] || f.media_type
          const existingTypeLabel = typeLabel[existingSameId.media_type] || existingSameId.media_type
          const suffixMap = { image: '__img', video: '__vid', audio: '__aud' }
          const suffix = suffixMap[f.media_type] || `__${f.media_type}`
          const newModelId = f.model_id + suffix
          const suggestedDisplayName = `${f.display_name.replace(/\s*\([^)]*\)$/, '')} (${currentTypeLabel})`

          const confirmMsg =
            `═══ 模型多类型支持 ═══\n\n` +
            `模型ID「${f.model_id}」已被「${existingTypeLabel}」类型占用。\n\n` +
            `【系统处理】\n` +
            `• 存储ID自动改为：「${newModelId}」（满足数据库唯一约束）\n` +
            `• API调用ID保持为：「${f.model_id}」（确保后端能识别）\n` +
            `• 展示名改为：「${suggestedDisplayName}」\n\n` +
            `【效果】\n` +
            `• 前端列表会显示两条独立记录（图片/视频）\n` +
            `• 生成时自动使用正确的API ID\n` +
            `• 定价/特性可独立配置\n\n` +
            `是否确认创建？`

          if (!confirm(confirmMsg)) return

          // 应用新的存储ID和展示名
          payload.model_id = newModelId
          f.model_id = newModelId
          payload.display_name = suggestedDisplayName
          f.display_name = suggestedDisplayName
          // 在描述中标记原始API ID，用于GenerateView映射
          payload.description = `[api_model_id:${f.model_id.replace(suffix, '')}] ${f.description || ''}`
        }
      }
      await createAdminModelApi(payload)
      addLog('create', `新增模型「${payload.display_name}」`, `模型#${payload.model_id}`)
    }
    closeModelModal()
    await fetchModels()
  } catch (e) {
    console.error('提交模型失败:', e)
    alert('操作失败：' + (e.response?.data?.detail?.message || e.message))
  }
}

// ----- 启停 -----
async function toggleModelEnabled(m) {
  try {
    if (m.is_enabled) {
      await disableAdminModelApi(m.model_id)
      m.is_enabled = false
      addLog('status', `停用模型「${m.display_name}」`, `模型#${m.model_id}`)
    } else {
      await enableAdminModelApi(m.model_id)
      m.is_enabled = true
      addLog('status', `启用模型「${m.display_name}」`, `模型#${m.model_id}`)
    }
  } catch (e) {
    alert('操作失败：' + e.message)
  }
}

// ----- 删除 -----
async function deleteModel(m) {
  // 软删：设置 deleted_at、is_enabled=false、status=deprecated
  const confirmMsg = `确定要软删模型「${m.display_name}」吗？\n\n` +
    `• 模型ID: ${m.model_id}\n` +
    `• 类型: ${getMediaTypeLabel(m.media_type)}\n` +
    `• 软删后模型将进入回收站，可随时恢复\n` +
    `• 如需永久删除，请在回收站中执行"硬删"`
  if (!confirm(confirmMsg)) return

  try {
    const res = await deleteAdminModelApi(m.model_id, { force: false })
    if (isUnmounted.value) return
    // 更新本地列表中的模型状态（如果在回收站视图则保留，否则移除）
    if (!showDeletedModels.value) {
      const idx = modelList.value.findIndex(item => item.model_id === m.model_id)
      if (idx !== -1) modelList.value.splice(idx, 1)
    } else {
      // 在回收站视图，更新模型状态（替换整项以触发响应式更新）
      const idx = modelList.value.findIndex(item => item.model_id === m.model_id)
      if (idx !== -1) {
        modelList.value[idx] = {
          ...modelList.value[idx],
          deleted_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          is_enabled: false,
          status: 'deprecated'
        }
      }
    }
    addLog('delete', `软删模型「${m.display_name}」`, `模型#${m.model_id}`)
    alert('模型已软删，进入回收站')
  } catch (e) {
    console.error('软删模型失败:', e)
    alert('软删失败：' + (e.response?.data?.detail?.message || e.message))
  }
}

// 硬删：物理删除（仅限回收站中的模型）
async function hardDeleteModel(m) {
  if (!m.deleted_at) {
    alert('只能硬删已软删的模型，请先软删再执行硬删')
    return
  }
  const confirmMsg = `确定要硬删模型「${m.display_name}」吗？\n\n` +
    `• 模型ID: ${m.model_id}\n` +
    `• 硬删后数据将永久删除，不可恢复！\n` +
    `• 如果有任务正在使用此模型，硬删会失败`
  if (!confirm(confirmMsg)) return

  try {
    const res = await deleteAdminModelApi(m.model_id, { force: true })
    // 从本地列表中移除
    const idx = modelList.value.findIndex(item => item.model_id === m.model_id)
    if (idx !== -1) modelList.value.splice(idx, 1)
    addLog('delete', `硬删模型「${m.display_name}」`, `模型#${m.model_id}`)
    alert('模型已永久删除')
  } catch (e) {
    console.error('硬删模型失败:', e)
    alert('硬删失败：' + (e.response?.data?.detail?.message || e.message))
  }
}

// 恢复软删的模型
async function restoreModel(m) {
  if (!m.deleted_at) {
    alert('该模型未处于软删状态')
    return
  }
  const confirmMsg = `确定要恢复模型「${m.display_name}」吗？\n\n` +
    `• 模型ID: ${m.model_id}\n` +
    `• 恢复后模型将重新启用并变为 active 状态`
  if (!confirm(confirmMsg)) return

  try {
    const res = await restoreAdminModelApi(m.model_id)
    if (isUnmounted.value) return
    // 更新本地列表中的模型状态（替换整项以触发响应式更新）
    const idx = modelList.value.findIndex(item => item.model_id === m.model_id)
    if (idx !== -1) {
      modelList.value[idx] = {
        ...modelList.value[idx],
        deleted_at: null,
        is_enabled: true,
        status: 'active',
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      }
    }
    addLog('status', `恢复模型「${m.display_name}」`, `模型#${m.model_id}`)
    alert('模型已恢复')
    // 如果不在回收站视图，可能需要刷新列表
    if (!showDeletedModels.value) {
      fetchModels()
    }
  } catch (e) {
    console.error('恢复模型失败:', e)
    alert('恢复失败：' + (e.response?.data?.detail?.message || e.message))
  }
}

// ----- 克隆模型 -----
function openCloneModal(m) {
  cloneSourceModel.value = m
  cloneForm.value = {
    new_model_id: `${m.model_id}_clone`, // 默认加上 _clone 后缀
    display_name: `${m.display_name} (克隆)`,
    model_name: m.model_name,
    model_version: m.model_version,
    price_per_request: m.price_per_request,
    price_per_second: m.price_per_second,
    price_multiplier: m.price_multiplier,
    description: m.description
  }
  showCloneModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function closeCloneModal() {
  showCloneModal.value = false
  cloneSourceModel.value = null
}

async function submitClone() {
  if (!cloneForm.value.new_model_id || !cloneForm.value.new_model_id.trim()) {
    alert('请输入新模型ID')
    return
  }
  if (cloneForm.value.new_model_id === cloneSourceModel.value.model_id) {
    alert('新模型ID不能与源模型ID相同')
    return
  }

  try {
    const payload = {
      new_model_id: cloneForm.value.new_model_id.trim()
    }
    // 只添加非空字段
    if (cloneForm.value.display_name) payload.display_name = cloneForm.value.display_name
    if (cloneForm.value.model_name) payload.model_name = cloneForm.value.model_name
    if (cloneForm.value.model_version) payload.model_version = cloneForm.value.model_version
    if (cloneForm.value.price_per_request != null) payload.price_per_request = cloneForm.value.price_per_request
    if (cloneForm.value.price_per_second != null) payload.price_per_second = cloneForm.value.price_per_second
    if (cloneForm.value.price_multiplier != null) payload.price_multiplier = cloneForm.value.price_multiplier
    if (cloneForm.value.description) payload.description = cloneForm.value.description

    const res = await cloneAdminModelApi(cloneSourceModel.value.model_id, payload)
    if (isUnmounted.value) return
    const body = res.data
    const newModel = (body && body.code !== undefined && body.data !== undefined) ? body.data : body

    // 将新模型添加到列表（如果在回收站视图）
    if (showDeletedModels.value || !newModel.deleted_at) {
      modelList.value.unshift(newModel)
    }

    addLog('create', `克隆模型「${cloneSourceModel.value.display_name}」→「${newModel.display_name}」`, `模型#${newModel.model_id}`)
    alert(`克隆成功！新模型ID: ${newModel.model_id}\n\n新模型默认已停用，请在模型列表中启用`)
    closeCloneModal()
  } catch (e) {
    console.error('克隆模型失败:', e)
    alert('克隆失败：' + (e.response?.data?.detail?.message || e.message))
  }
}

// ----- 详情 -----
const showModelDetailModal = ref(false)
const selectedModelDetail = ref(null)

async function viewModelDetail(m) {
  try {
    const res = await getAdminModelDetailApi(m.model_id)
    if (isUnmounted.value) return
    const body = res.data
    selectedModelDetail.value = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
    showModelDetailModal.value = true
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  } catch (e) {
    alert('获取详情失败：' + e.message)
  }
}

// ----- 用量 -----
const showModelUsageModal = ref(false)
const selectedModelUsage = ref(null)
const usageDays = ref(30)
const currentUsageModelId = ref(null)

async function viewModelUsage(m) {
  currentUsageModelId.value = m.model_id
  try {
    const res = await getAdminModelUsageApi(m.model_id, { days: usageDays.value })
    if (isUnmounted.value) return
    const body = res.data
    selectedModelUsage.value = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
    showModelUsageModal.value = true
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  } catch (e) {
    alert('获取用量失败：' + e.message)
  }
}

async function reloadModelUsage() {
  if (!currentUsageModelId.value) return
  try {
    const res = await getAdminModelUsageApi(currentUsageModelId.value, { days: usageDays.value })
    if (isUnmounted.value) return
    const body = res.data
    selectedModelUsage.value = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
  } catch (e) {
    alert('刷新用量失败：' + e.message)
  }
}

// ----- 变更历史 -----
const showModelChangelogModal = ref(false)
const selectedModelChangelog = ref(null)

async function viewModelChangelog(m) {
  try {
    const res = await getAdminModelChangelogApi(m.model_id, { limit: 100 })
    if (isUnmounted.value) return
    const body = res.data
    selectedModelChangelog.value = (body && body.code !== undefined && body.data !== undefined) ? body.data : body
    showModelChangelogModal.value = true
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  } catch (e) {
    alert('获取变更历史失败：' + e.message)
  }
}

// ----- 同步 JSON -----
// ----- 搜索/筛选调试 -----
function onModelSearchChange() {
  console.log('[模型搜索] 输入:', modelSearch.value, '| 过滤结果:', filteredModels.value.length)
}

function onModelFilterChange(type, event) {
  const value = event.target.value
  console.log(`[模型筛选] ${type} =`, value,
    '| 厂商:', modelVendorFilter.value,
    '| 类型:', modelMediaTypeFilter.value,
    '| 状态:', modelStatusFilter.value,
    '| 启停:', modelEnabledFilter.value,
    '| 结果:', filteredModels.value.length)
}

async function handleSyncFromJson() {
  if (!confirm('确认从 JSON 重新灌入模型库？\n\nforce=false：保留人工配置，仅插入新模型\nforce=true：强制用 JSON 覆盖所有配置\n\n点击"确定"使用 force=false（推荐），点击"取消"放弃操作。如需 force=true，请改用浏览器控制台调用。')) return
  try {
    const res = await syncAdminModelsFromJsonApi({ force: false })
    const s = res.data.summary
    alert(`同步完成！\n\n腾讯云：插入 ${s.tencent.inserted}，更新 ${s.tencent.updated}，跳过 ${s.tencent.skipped}，错误 ${s.tencent.errors}\nToken Switch：插入 ${s.token_switch.inserted}，更新 ${s.token_switch.updated}，跳过 ${s.token_switch.skipped}，错误 ${s.token_switch.errors}`)
    addLog('update', '从 JSON 同步模型库', '模型库')
    await fetchModels()
  } catch (e) {
    alert('同步失败：' + e.message)
  }
}

onMounted(() => {
  nextTick(() => { if (window.lucide) lucide.createIcons() })
  fetchAnnouncements()
  fetchModels()
})

onUnmounted(() => {
  isUnmounted.value = true
})
</script>

<style scoped>
/* ===== 页面布局 ===== */
.admin-page { max-width: 1400px; }

.admin-tab-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; padding: 16px 20px;
  background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl);
}
.tabs-nav { display: flex; gap: 6px; }
.admin-tab {
  display: flex; align-items: center; padding: 8px 18px; border: none; border-radius: 10px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary); background: transparent;
  cursor: pointer; transition: all 0.2s ease;
}
.admin-tab:hover { color: #3b82f6; background: rgba(59,130,246,0.04); }
.admin-tab.active { color: #fff; background: linear-gradient(135deg,#6366f1,#8b5cf6); box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
.admin-tab.active:hover { color: #fff; }

.admin-user-info {
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700;
  color: var(--primary-color); padding: 6px 14px; background: rgba(99,102,241,0.06); border-radius: 10px;
}

/* ===== 统计卡片 ===== */
.stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
.stat-card {
  background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl);
  padding: 24px; display: flex; align-items: center; gap: 16px; transition: all 0.25s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.stat-icon-wrap { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-company .stat-icon-wrap { background: linear-gradient(135deg,#dbeafe,#bfdbfe); color: #2563eb; }
.stat-user .stat-icon-wrap { background: linear-gradient(135deg,#ede9fe,#ddd6fe); color: #7c3aed; }
.stat-active .stat-icon-wrap { background: linear-gradient(135deg,#dcfce7,#bbf7d0); color: #16a34a; }
.stat-log .stat-icon-wrap { background: linear-gradient(135deg,#fef3c7,#fde68a); color: #d97706; }
.stat-info { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 28px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.stat-label { font-size: 12.5px; color: var(--text-secondary); font-weight: 500; }

/* ===== 概览区域 ===== */
.overview-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.overview-card { background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl); padding: 24px; }
.card-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 18px; display: flex; align-items: center; }
.info-list { display: flex; flex-direction: column; gap: 12px; }
.info-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafafa; border-radius: 10px; }
.info-k { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.info-v { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.status-dot { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
.status-ok { background: #dcfce7; color: #16a34a; }
.status-ok::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #16a34a; display: inline-block; }

.log-list-compact { display: flex; flex-direction: column; gap: 8px; }
.log-item-compact { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fafafa; border-radius: 10px; transition: background 0.15s; }
.log-item-compact:hover { background: #f3f4f6; }
.log-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.log-create { background: #10b981; } .log-update { background: #3b82f6; } .log-delete { background: #ef4444; } .log-status { background: #f59e0b; } .log-login { background: #8b5cf6; }
.log-content-compact { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.log-desc { font-size: 13px; color: var(--text-primary); font-weight: 500; }
.log-time-sm { font-size: 11.5px; color: var(--text-tertiary); flex-shrink: 0; }

/* ===== 统计栏 ===== */
.company-stats-bar, .user-stats-bar { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
.company-stat, .user-stat { background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl); padding: 18px 20px; display: flex; align-items: center; gap: 12px; }
.cs-label, .us-label { font-size: 12.5px; color: var(--text-secondary); font-weight: 500; }
.cs-val, .us-val { font-size: 22px; font-weight: 800; color: var(--text-primary); }
.cs-green, .us-green { color: #10b981; } .cs-red { color: #ef4444; } .us-gray { color: #9ca3af; } .us-blue { color: #3b82f6; }

/* ===== 搜索操作栏（复用MemberView样式） ===== */
.search-action-bar { display: flex; flex-direction: column; margin-bottom: 20px; padding: 24px; background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl); }
.table-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.table-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  position: relative;
  z-index: 10;
}
.search-wrap-member {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  padding: 8px 14px;
  background: #f8fafc;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  position: relative;
  z-index: 11;
}
.search-input-member {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  cursor: text;
}
.filter-select-member {
  padding: 8px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  cursor: pointer;
  position: relative;
  z-index: 11;
}
.btn-add-new {
  display: flex; align-items: center; gap: 6px; padding: 8px 18px;
  background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; border-radius: 10px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
  box-shadow: 0 4px 12px rgba(99,102,241,0.25);
}
.btn-add-new:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.35); }
.export-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: white; border: 1.5px solid var(--border-light); border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease; white-space: nowrap; }
.export-btn:hover { background: #f8fafc; }

/* ===== 表格 ===== */
.account-table { width: 100%; border-collapse: collapse; }
.account-table th { padding: 12px 14px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-secondary); background: #f8fafc; border-bottom: 1.5px solid var(--border-light); white-space: nowrap; }
.account-table td { padding: 13px 14px; font-size: 13px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); }
.mono-text { font-family: 'SF Mono','Cascadia Code','Consolas',monospace; font-size: 12px; }
.text-secondary-small { font-size: 12px; color: var(--text-tertiary); }
.money-cell { font-weight: 600; font-variant-numeric: tabular-nums; }
.text-red { color: #ef4444; }
.text-green { color: #10b981; }

/* ===== 状态/角色标签 ===== */
.status-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.status-active { background: #dcfce7; color: #16a34a; }
.status-expired { background: #fee2e2; color: #dc2626; }
.status-warning { background: #fef3c7; color: #d97706; }

.role-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.role-super { background: #fef3c7; color: #92400e; }
.role-company { background: #dbeafe; color: #1e40af; }
.role-dept { background: #ede9fe; color: #7c3aed; }
.role-normal { background: #f1f5f9; color: #475569; }

.user-name-cell { display: flex; align-items: center; gap: 8px; }
.avatar-mini { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; flex-shrink: 0; }

/* ===== 操作按钮 ===== */
.action-buttons { display: flex; gap: 6px; }
.detail-btn { padding: 5px 14px; background: #dbeafe; color: #3b82f6; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.detail-btn:hover { background: #bfdbfe; }
.edit-btn-action { padding: 5px 12px; background: #eef2ff; color: #6366f1; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.edit-btn-action:hover { background: #ddd6fe; }
.toggle-btn { padding: 5px 12px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.disable-style { background: #fef3c7; color: #92400e; }
.disable-style:hover { background: #fde68a; }
.enable-style { background: #dcfce7; color: #16a34a; }
.enable-style:hover { background: #bbf7d0; }
.delete-btn-action { padding: 5px 12px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.delete-btn-action:hover { background: #fecaca; }

/* ===== 分页器 ===== */
.pagination-dept { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); }
.page-btn-dept { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1.5px solid var(--border-light); border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s ease; }
.page-btn-dept:not(:disabled):hover { border-color: var(--primary-color); color: var(--primary-color); }
.page-btn-dept:disabled { opacity: 0.4; cursor: not-allowed; }
.page-num-dept { min-width: 32px; height: 32px; padding: 0 10px; border: 1.5px solid var(--border-light); border-radius: 8px; background: white; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease; }
.page-num-dept:hover { border-color: var(--primary-color); color: var(--primary-color); }
.page-num-dept.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }

/* ===== 弹窗 ===== */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-container-detail, .modal-container-add { background: #fff; border-radius: 16px; width: 90%; max-width: 920px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal-container-add { max-width: 560px; }
.modal-lg { max-width: 640px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
.modal-title { font-size: 18px; font-weight: 700; color: #111827; }
.modal-close-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: 8px; cursor: pointer; color: #6b7280; transition: all 0.2s ease; }
.modal-close-btn:hover { background: #f3f4f6; color: #111827; }
.modal-body { padding: 24px; }

/* ===== 表单 ===== */
.form-group { margin-bottom: 18px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.form-select, .form-input {
  width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px;
  font-size: 14px; color: #111827; outline: none; transition: all 0.2s ease; box-sizing: border-box;
}
.form-select:focus, .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.form-textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #111827; outline: none; resize: vertical; transition: all 0.2s ease; box-sizing: border-box; font-family: inherit; }
.form-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.required { color: #ef4444; margin-left: 2px; }

/* ===== 详情网格 ===== */
.detail-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; margin-bottom: 24px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-full { grid-column: 1 / -1; }
.detail-label { font-size: 12px; color: #6b7280; font-weight: 500; }
.detail-value { font-size: 15px; font-weight: 600; color: #111827; }
.money-text { color: #111827; } .used-text { color: #ef4444; } .remain-text { color: #10b981; }
.detail-section-title { font-size: 15px; font-weight: 700; color: #111827; margin: 20px 0 12px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
.orders-table-wrap { overflow-x: auto; }
.orders-table { width: 100%; border-collapse: collapse; }
.orders-table th, .orders-table td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
.orders-table th { font-weight: 600; color: #6b7280; background: #f9fafb; }

/* ===== 日志类型标签 ===== */
.log-type-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.log-create { background: #dcfce7; color: #16a34a; }
.log-update { background: #dbeafe; color: #2563eb; }
.log-delete { background: #fee2e2; color: #dc2626; }
.log-status { background: #fef3c7; color: #d97706; }
.log-login { background: #ede9fe; color: #7c3aed; }

/* ===== 弹窗底部 ===== */
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #e5e7eb; }
.btn-cancel, .btn-submit, .btn-danger {
  padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.25s ease; border: none;
}
.btn-cancel { background: #f3f4f6; color: #374151; }
.btn-cancel:hover { background: #e5e7eb; }
.btn-submit { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.4); }
.btn-danger { background: linear-gradient(135deg,#ef4444,#dc2626); color: #fff; box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
.btn-danger:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(239,68,68,0.4); }

/* ===== 删除确认弹窗 ===== */
.modal-confirm {
  background: #fff; border-radius: 16px; padding: 32px; text-align: center;
  max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.confirm-icon-wrap { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.confirm-icon-wrap.danger { background: #fee2e2; }
.confirm-title { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; }
.confirm-desc { font-size: 14px; color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
.confirm-actions { display: flex; justify-content: center; gap: 12px; }

/* ===== 系统设置 ===== */
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.setting-section { background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl); padding: 24px; }
.section-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 18px; display: flex; align-items: center; }
.setting-items { display: flex; flex-direction: column; gap: 16px; }
.setting-form-items { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.setting-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
.setting-item:last-child { border-bottom: none; }
.setting-desc { display: flex; flex-direction: column; gap: 2px; }
.setting-name { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
.setting-hint { font-size: 11.5px; color: var(--text-tertiary); }
.setting-item-form { display: flex; flex-direction: column; gap: 4px; }

/* ===== 开关 ===== */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background: #d1d5db; border-radius: 24px; transition: 0.3s;
}
.slider::before {
  content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background: white; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.switch input:checked + .slider { background: #6366f1; }
.switch input:checked + .slider::before { transform: translateX(20px); }

/* ===== 设置操作按钮 ===== */
.setting-actions { display: flex; gap: 10px; margin-top: 8px; }
.btn-action-settings {
  display: flex; align-items: center; gap: 6px; padding: 9px 18px; border: none;
  border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
}
.btn-backup { background: linear-gradient(135deg,#dbeafe,#bfdbfe); color: #1e40af; }
.btn-backup:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.25); }
.btn-clear-cache { background: #fef3c7; color: #92400e; border: 1.5px solid #fde68a; }
.btn-clear-cache:hover { transform: translateY(-1px); background: #fde68a; }

/* ===== 设置保存栏 ===== */
.settings-footer { display: flex; justify-content: flex-end; padding: 20px 0; }
.btn-save-settings {
  display: flex; align-items: center; padding: 11px 32px;
  background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none;
  border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.25s ease; box-shadow: 0 4px 16px rgba(99,102,241,0.3);
}
.btn-save-settings:hover { transform: translateY(-2px); box-shadow: 0 6px 22px rgba(99,102,241,0.45); }

/* ===== 滚动条 ===== */
.modal-container-detail::-webkit-scrollbar, .modal-container-add::-webkit-scrollbar { width: 5px; }
.modal-container-detail::-webkit-scrollbar-thumb, .modal-container-add::-webkit-scrollbar-thumb { background: rgba(156,163,175,0.3); border-radius: 8px; }

/* ===== 公告管理样式 ===== */
.announcement-stats-bar {
  display: flex; gap: 16px; margin-bottom: 20px;
}
.ann-stat {
  flex: 1; background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl);
  padding: 18px 20px; display: flex; flex-direction: column; gap: 4px;
}
.ann-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
.ann-val { font-size: 24px; font-weight: 750; color: #111827; }
.ann-green { color: #16a34a; }
.ann-gray { color: #9ca3af; }
.ann-blue { color: #2563eb; }

.ann-category-badge {
  display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; white-space: nowrap;
}
.ann-cat-update { background: #dbeafe; color: #1d4ed8; }
.ann-cat-event { background: #dcfce7; color: #15803d; }
.ann-cat-tutorial { background: #fef3c7; color: #b45309; }

/* ===== 模型管理样式 ===== */
.model-stats-bar {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 20px;
}
.model-stat {
  background: white; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl);
  padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;
}
.ms-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.ms-val { font-size: 22px; font-weight: 800; color: var(--text-primary); }
.ms-green { color: #10b981; }
.ms-red { color: #ef4444; }
.ms-blue { color: #3b82f6; }
.ms-purple { color: #8b5cf6; }
.ms-amber { color: #f59e0b; }

.model-table th, .model-table td { font-size: 12.5px; }
.model-name-cell { display: flex; flex-direction: column; gap: 3px; }
.model-tags-mini { display: flex; gap: 4px; flex-wrap: wrap; }
.tag-mini {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; background: #eef2ff; color: #6366f1;
}
.vendor-badge {
  display: inline-block; padding: 3px 10px; border-radius: 6px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.vendor-vendor_a { background: #dbeafe; color: #1e40af; }
.vendor-vendor_b { background: #ede9fe; color: #6d28d9; }
.media-type-badge {
  display: inline-block; padding: 3px 10px; border-radius: 6px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.media-image { background: #fef3c7; color: #b45309; }
.media-video { background: #fee2e2; color: #b91c1c; }
.media-audio { background: #dcfce7; color: #15803d; }

.sound-mode-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.sound-mode-badge.sm-free { background: #dcfce7; color: #15803d; }
.sound-mode-badge.sm-forced-sound { background: #fef3c7; color: #92400e; }
.sound-mode-badge.sm-disabled-silent { background: #f3f4f6; color: #6b7280; }
.sound-mode-badge.sm-hidden { background: #f1f5f9; color: #94a3b8; }

.price-cell { min-width: 110px; }
.price-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.price-val { font-weight: 600; color: #111827; font-variant-numeric: tabular-nums; }
.price-mult {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; background: #fef3c7; color: #b45309;
}
.price-tiers-mini {
  font-size: 10.5px; color: #6b7280; margin-top: 2px;
}

.empty-row {
  text-align: center; padding: 32px 12px !important; color: #9ca3af; font-size: 13px;
}

/* 迷你开关 */
.switch.switch-mini { width: 36px; height: 20px; }
.switch.switch-mini .slider::before { width: 14px; height: 14px; left: 3px; bottom: 3px; }
.switch.switch-mini input:checked + .slider::before { transform: translateX(16px); }

/* ===== 模型弹窗扩展样式 ===== */
.modal-xl { max-width: 880px; }
.form-section-title {
  font-size: 14px; font-weight: 700; color: #111827;
  margin: 20px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;
  display: flex; align-items: center; gap: 6px;
}
.form-section-title:first-child { margin-top: 0; }
.form-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.form-hint-text { display: block; font-size: 11.5px; color: #9ca3af; margin-top: 4px; }

.checkbox-group {
  display: flex; flex-wrap: wrap; gap: 10px 16px;
  padding: 10px 14px; background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 10px;
}
.checkbox-item {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: #374151; cursor: pointer; user-select: none;
}
.checkbox-item input { cursor: pointer; }

.switch-label-text {
  margin-left: 12px; font-size: 13px; color: #374151; font-weight: 500;
}

/* ===== 用量统计 ===== */
.usage-controls {
  display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
}
.usage-days-select { width: auto; min-width: 140px; }
.usage-stats-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;
}
.usage-stat-card {
  background: #f8fafc; border: 1.5px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
}
.usage-stat-card.us-success { background: #ecfdf5; border-color: #a7f3d0; }
.usage-stat-card.us-fail { background: #fef2f2; border-color: #fecaca; }
.usage-stat-card.us-cost { background: #eff6ff; border-color: #bfdbfe; }
.usage-stat-card .us-label { font-size: 11.5px; color: #6b7280; font-weight: 500; }
.usage-stat-card .us-val { font-size: 20px; font-weight: 800; color: #111827; }

/* ===== 变更历史时间线 ===== */
.changelog-timeline { display: flex; flex-direction: column; gap: 16px; }
.changelog-item {
  display: flex; gap: 14px; padding: 14px 16px;
  background: #f8fafc; border-radius: 10px; border-left: 3px solid #e5e7eb;
}
.changelog-dot {
  width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex-shrink: 0;
  background: #9ca3af;
}
.cl-created { background: #10b981; }
.cl-updated { background: #3b82f6; }
.cl-enabled { background: #16a34a; }
.cl-disabled { background: #ef4444; }
.cl-deprecated { background: #f59e0b; }
.changelog-content { flex: 1; min-width: 0; }
.changelog-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
}
.changelog-time { font-size: 11.5px; color: #9ca3af; }
.changelog-desc { font-size: 13px; color: #111827; font-weight: 500; margin-bottom: 4px; }
.changelog-operator { font-size: 11.5px; color: #6b7280; }
.changelog-fields { margin-top: 8px; }
.changelog-fields summary {
  cursor: pointer; font-size: 12px; color: #6366f1; font-weight: 600;
  padding: 4px 0;
}
.changelog-json {
  background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 8px;
  font-size: 11.5px; font-family: 'SF Mono','Cascadia Code','Consolas',monospace;
  overflow-x: auto; margin-top: 6px; max-height: 240px;
}

/* ===== 回收站/软删模型样式 ===== */
.deleted-row { background: #fef2f2 !important; }
.deleted-row:hover { background: #fee2e2 !important; }
.deleted-badge {
  display: inline-block; margin-left: 6px;
  padding: 2px 6px; font-size: 10px; font-weight: 700;
  background: #ef4444; color: white; border-radius: 4px;
}
.checkbox-wrap {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; background: #f8fafc;
  border: 1.5px solid var(--border-light); border-radius: 10px;
  cursor: pointer; user-select: none;
}
.checkbox-wrap input[type="checkbox"] {
  width: 16px; height: 16px; accent-color: #6366f1; cursor: pointer;
}
.checkbox-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

/* ===== 克隆模型弹窗样式 ===== */
.clone-info-box {
  background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px;
  padding: 14px 16px; margin-bottom: 16px;
}
.clone-info-box .info-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.clone-info-box .info-row:last-child { margin-bottom: 0; }
.clone-info-box .info-label { color: #64748b; font-weight: 500; }
.clone-info-box .info-value { color: #0c4a6e; font-weight: 600; }
.clone-note {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: #fefce8; border: 1px solid #fde047;
  border-radius: 8px; margin-top: 16px; font-size: 12.5px; color: #854d0e;
}
</style>