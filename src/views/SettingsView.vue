<template>
  <AppLayout>
    <div class="settings-page">
      <!-- 页面标题 -->
      <div class="page-header-settings">
        <button class="back-btn" @click="$router.push('/profile')">
          <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
          返回
        </button>
        <div>
          <h2 class="page-title">账户设置</h2>
          <p class="page-subtitle">管理您的个人信息与账户安全</p>
        </div>
      </div>

      <!-- 设置主体内容 -->
      <div class="settings-page-inner">
        <!-- 左侧导航 -->
        <nav class="settings-nav">
          <div class="settings-nav-card">
            <button v-for="sec in settingsSections" :key="sec.key"
              :class="['settings-nav-item', { active: activeSection === sec.key }]"
              @click="selectSection(sec.key)">
              <i :data-lucide="sec.icon" class="nav-item-icon"></i>
              {{ sec.label }}
            </button>
          </div>
        </nav>

        <!-- 右侧内容区 -->
        <div class="settings-content">

          <!-- ========== 个人资料 ========== -->
          <div v-if="activeSection === 'profile'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #eef2ff;">
                  <i data-lucide="user" style="width: 20px; height: 20px; color: #3b82f6;"></i>
                </div>
                <div>
                  <div class="section-title">个人资料</div>
                  <div class="section-desc">管理您的头像、昵称和个人信息</div>
                </div>
              </div>
              <button class="section-action-btn" @click="saveProfile">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                保存
              </button>
            </div>

            <div class="profile-edit-card">
              <div class="profile-avatar-edit">
                <img :src="profileData.avatar" class="profile-avatar-large" alt="">
                <div class="avatar-edit-overlay">
                  <i data-lucide="camera" style="width: 13px; height: 13px; color: white;"></i>
                </div>
              </div>
              <div class="profile-form">
                <div class="profile-form-group">
                  <label class="profile-form-label">昵称</label>
                  <input type="text" v-model="profileData.name" class="profile-form-input">
                </div>
                <div class="profile-form-group">
                  <label class="profile-form-label">性别</label>
                  <select v-model="profileData.gender" class="profile-form-select">
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="保密">保密</option>
                  </select>
                </div>
                <div class="profile-form-group">
                  <label class="profile-form-label">生日</label>
                  <input type="date" v-model="profileData.birthday" class="profile-form-input">
                </div>
                <div class="profile-form-group">
                  <label class="profile-form-label">地区</label>
                  <input type="text" v-model="profileData.region" class="profile-form-input" placeholder="请输入所在地区">
                </div>
                <div class="profile-form-group">
                  <label class="profile-form-label">行业</label>
                  <input type="text" v-model="profileData.industry" class="profile-form-input" placeholder="请输入所在行业">
                </div>
                <div class="profile-form-group full-width">
                  <label class="profile-form-label">个人简介</label>
                  <textarea v-model="profileData.bio" class="profile-form-textarea" placeholder="介绍一下自己吧..."></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== 手机绑定 ========== -->
          <div v-if="activeSection === 'phone'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #eef2ff;">
                  <i data-lucide="smartphone" style="width: 20px; height: 20px; color: #3b82f6;"></i>
                </div>
                <div>
                  <div class="section-title">手机绑定</div>
                  <div class="section-desc">管理您的手机号码，用于登录验证和安全通知</div>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #eef2ff;">
                  <i data-lucide="smartphone" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">当前手机号</span>
                  <span class="setting-row-desc">{{ phoneData.current }}</span>
                </div>
              </div>
              <div class="setting-row-right">
                <span :class="['permission-badge', phoneData.verified ? 'granted' : 'denied']">
                  <i :data-lucide="phoneData.verified ? 'check-circle' : 'x-circle'" style="width: 12px; height: 12px;"></i>
                  {{ phoneData.verified ? '已验证' : '未验证' }}
                </span>
                <button class="setting-row-action" @click="changePhone">更换手机号</button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #f0fdf4;">
                  <i data-lucide="calendar" style="width: 18px; height: 18px; color: #10b981;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">绑定时间</span>
                  <span class="setting-row-desc">{{ phoneData.bindTime }}</span>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fef3c7;">
                  <i data-lucide="shield-check" style="width: 18px; height: 18px; color: #f59e0b;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">安全提示</span>
                  <span class="setting-row-desc">手机号是您账户安全的重要保障，建议保持绑定状态</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== 邮箱绑定 ========== -->
          <div v-if="activeSection === 'email'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #eef2ff;">
                  <i data-lucide="mail" style="width: 20px; height: 20px; color: #3b82f6;"></i>
                </div>
                <div>
                  <div class="section-title">邮箱绑定</div>
                  <div class="section-desc">管理您的邮箱地址，用于接收重要通知和找回密码</div>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #eef2ff;">
                  <i data-lucide="mail" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">当前邮箱</span>
                  <span class="setting-row-desc">{{ emailData.current }}</span>
                </div>
              </div>
              <div class="setting-row-right">
                <span :class="['permission-badge', emailData.verified ? 'granted' : 'denied']">
                  <i :data-lucide="emailData.verified ? 'check-circle' : 'x-circle'" style="width: 12px; height: 12px;"></i>
                  {{ emailData.verified ? '已验证' : '未验证' }}
                </span>
                <button class="setting-row-action" @click="changeEmail">更换邮箱</button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #f0fdf4;">
                  <i data-lucide="calendar" style="width: 18px; height: 18px; color: #10b981;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">绑定时间</span>
                  <span class="setting-row-desc">{{ emailData.bindTime }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ========== 密码设置 ========== -->
          <div v-if="activeSection === 'password'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #eef2ff;">
                  <i data-lucide="key-round" style="width: 20px; height: 20px; color: #3b82f6;"></i>
                </div>
                <div>
                  <div class="section-title">密码设置</div>
                  <div class="section-desc">定期更换密码可以有效保护您的账户安全</div>
                </div>
              </div>
            </div>

            <div class="password-form">
              <div class="password-form-group">
                <label class="password-form-label">当前密码</label>
                <div class="password-input-wrap">
                  <input :type="passwordData.showCurrent ? 'text' : 'password'" v-model="passwordData.currentPassword" class="password-input" placeholder="请输入当前密码">
                  <button class="password-toggle" @click="passwordData.showCurrent = !passwordData.showCurrent">
                    <i :data-lucide="passwordData.showCurrent ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
              </div>

              <div class="password-form-group">
                <label class="password-form-label">新密码</label>
                <div class="password-input-wrap">
                  <input :type="passwordData.showNew ? 'text' : 'password'" v-model="passwordData.newPassword" class="password-input" placeholder="请输入新密码（至少8位）" @input="checkPasswordStrength">
                  <button class="password-toggle" @click="passwordData.showNew = !passwordData.showNew">
                    <i :data-lucide="passwordData.showNew ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
                <div v-if="passwordData.newPassword" class="password-strength">
                  <div class="strength-bar">
                    <div :class="['strength-segment', { 'filled-weak': passwordStrength.level >= 1, 'filled-medium': passwordStrength.level >= 2, 'filled-strong': passwordStrength.level >= 3 }]"></div>
                    <div :class="['strength-segment', { 'filled-medium': passwordStrength.level >= 2, 'filled-strong': passwordStrength.level >= 3 }]"></div>
                    <div :class="['strength-segment', { 'filled-strong': passwordStrength.level >= 3 }]"></div>
                  </div>
                  <span :class="['strength-text', passwordStrength.class]">{{ passwordStrength.text }}</span>
                </div>
              </div>

              <div class="password-form-group">
                <label class="password-form-label">确认新密码</label>
                <div class="password-input-wrap">
                  <input :type="passwordData.showConfirm ? 'text' : 'password'" v-model="passwordData.confirmPassword" class="password-input" placeholder="请再次输入新密码">
                  <button class="password-toggle" @click="passwordData.showConfirm = !passwordData.showConfirm">
                    <i :data-lucide="passwordData.showConfirm ? 'eye-off' : 'eye'" style="width: 16px; height: 16px;"></i>
                  </button>
                </div>
              </div>

              <button class="password-submit-btn" @click="changePassword">
                <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                确认修改
              </button>
            </div>
          </div>

          <!-- ========== 通知设置 ========== -->
          <div v-if="activeSection === 'notification'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #fef3c7;">
                  <i data-lucide="bell" style="width: 20px; height: 20px; color: #f59e0b;"></i>
                </div>
                <div>
                  <div class="section-title">通知设置</div>
                  <div class="section-desc">管理您接收的通知类型和方式</div>
                </div>
              </div>
              <button class="section-action-btn" @click="saveNotification">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                保存
              </button>
            </div>

            <div class="notify-category">
              <div class="notify-category-title">应用内通知</div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #eef2ff;">
                    <i data-lucide="bell-ring" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">系统通知</span>
                    <span class="setting-row-desc">系统公告、维护通知等</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.systemNotify }]" @click="toggleNotify('systemNotify')"></button>
              </div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #fef3c7;">
                    <i data-lucide="shopping-cart" style="width: 18px; height: 18px; color: #f59e0b;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">订单通知</span>
                    <span class="setting-row-desc">购买、续费、退款等订单信息</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.orderNotify }]" @click="toggleNotify('orderNotify')"></button>
              </div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #fdf4ff;">
                    <i data-lucide="party-popper" style="width: 18px; height: 18px; color: #a855f7;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">活动通知</span>
                    <span class="setting-row-desc">优惠活动、新品上线等</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.activityNotify }]" @click="toggleNotify('activityNotify')"></button>
              </div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #f0fdf4;">
                    <i data-lucide="refresh-cw" style="width: 18px; height: 18px; color: #10b981;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">更新通知</span>
                    <span class="setting-row-desc">产品更新、功能优化等</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.updateNotify }]" @click="toggleNotify('updateNotify')"></button>
              </div>
            </div>

            <div class="notify-category">
              <div class="notify-category-title">邮件通知</div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #eef2ff;">
                    <i data-lucide="mail" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">邮件总开关</span>
                    <span class="setting-row-desc">控制是否接收所有邮件通知</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.emailNotify }]" @click="toggleNotify('emailNotify')"></button>
              </div>
            </div>

            <div class="notify-category">
              <div class="notify-category-title">推送通知</div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #eef2ff;">
                    <i data-lucide="smartphone" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">推送总开关</span>
                    <span class="setting-row-desc">控制是否接收所有推送通知</span>
                  </div>
                </div>
                <button :class="['toggle-switch', { active: notificationData.pushNotify }]" @click="toggleNotify('pushNotify')"></button>
              </div>
            </div>
          </div>

          <!-- ========== 隐私设置 ========== -->
          <div v-if="activeSection === 'privacy'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #dcfce7;">
                  <i data-lucide="shield" style="width: 20px; height: 20px; color: #10b981;"></i>
                </div>
                <div>
                  <div class="section-title">隐私设置</div>
                  <div class="section-desc">控制您的个人信息可见性和数据使用</div>
                </div>
              </div>
              <button class="section-action-btn" @click="savePrivacy">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                保存
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #eef2ff;">
                  <i data-lucide="user" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">个人资料可见性</span>
                  <span class="setting-row-desc">控制谁可以查看您的个人资料</span>
                </div>
              </div>
              <div class="setting-row-right">
                <select v-model="privacyData.profileVisible" class="profile-form-select" style="width: auto;">
                  <option value="public">公开</option>
                  <option value="friends">仅好友</option>
                  <option value="private">私密</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fef3c7;">
                  <i data-lucide="video" style="width: 18px; height: 18px; color: #f59e0b;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">作品可见性</span>
                  <span class="setting-row-desc">控制谁可以查看您的作品</span>
                </div>
              </div>
              <div class="setting-row-right">
                <select v-model="privacyData.worksVisible" class="profile-form-select" style="width: auto;">
                  <option value="public">公开</option>
                  <option value="friends">仅好友</option>
                  <option value="private">私密</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #f0fdf4;">
                  <i data-lucide="search" style="width: 18px; height: 18px; color: #10b981;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">允许被搜索</span>
                  <span class="setting-row-desc">其他用户可以通过用户名或ID搜索到您</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: privacyData.allowSearch }]" @click="togglePrivacy('allowSearch')"></button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fdf4ff;">
                  <i data-lucide="sparkles" style="width: 18px; height: 18px; color: #a855f7;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">允许推荐给他人</span>
                  <span class="setting-row-desc">允许系统将您推荐给其他可能感兴趣的用户</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: privacyData.allowRecommend }]" @click="togglePrivacy('allowRecommend')"></button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fee2e2;">
                  <i data-lucide="activity" style="width: 18px; height: 18px; color: #dc2626;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">显示在线状态</span>
                  <span class="setting-row-desc">让其他用户看到您是否在线</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: privacyData.showOnlineStatus }]" @click="togglePrivacy('showOnlineStatus')"></button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #dbeafe;">
                  <i data-lucide="bar-chart-3" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">显示活动动态</span>
                  <span class="setting-row-desc">在主页显示您的最近活动</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: privacyData.showActivity }]" @click="togglePrivacy('showActivity')"></button>
            </div>
          </div>

          <!-- ========== 偏好设置 ========== -->
          <div v-if="activeSection === 'preference'" class="settings-section">
            <div class="section-header">
              <div class="section-header-left">
                <div class="section-icon-wrap" style="background: #fce7f3;">
                  <i data-lucide="palette" style="width: 20px; height: 20px; color: #ec4899;"></i>
                </div>
                <div>
                  <div class="section-title">偏好设置</div>
                  <div class="section-desc">自定义您的使用体验</div>
                </div>
              </div>
              <button class="section-action-btn" @click="savePreference">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                保存
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #eef2ff;">
                  <i data-lucide="globe" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">语言</span>
                  <span class="setting-row-desc">选择界面显示语言</span>
                </div>
              </div>
              <div class="setting-row-right">
                <select v-model="preferenceData.language" class="profile-form-select" style="width: auto;">
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fef3c7;">
                  <i data-lucide="sun" style="width: 18px; height: 18px; color: #f59e0b;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">主题模式</span>
                  <span class="setting-row-desc">选择界面主题风格</span>
                </div>
              </div>
              <div class="setting-row-right">
                <select v-model="preferenceData.theme" class="profile-form-select" style="width: auto;">
                  <option value="light">浅色模式</option>
                  <option value="dark">深色模式</option>
                  <option value="auto">跟随系统</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #f0fdf4;">
                  <i data-lucide="type" style="width: 18px; height: 18px; color: #10b981;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">字体大小</span>
                  <span class="setting-row-desc">调整界面文字大小</span>
                </div>
              </div>
              <div class="setting-row-right">
                <select v-model="preferenceData.fontSize" class="profile-form-select" style="width: auto;">
                  <option value="small">小</option>
                  <option value="medium">中</option>
                  <option value="large">大</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #eef2ff;">
                  <i data-lucide="save" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">自动保存</span>
                  <span class="setting-row-desc">编辑时自动保存草稿</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: preferenceData.autoSave }]" @click="togglePreference('autoSave')"></button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fdf4ff;">
                  <i data-lucide="image" style="width: 18px; height: 18px; color: #a855f7;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">高清导出</span>
                  <span class="setting-row-desc">默认导出高清视频</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: preferenceData.hdExport }]" @click="togglePreference('hdExport')"></button>
            </div>

            <div class="setting-row">
              <div class="setting-row-left">
                <div class="setting-row-icon" style="background: #fee2e2;">
                  <i data-lucide="droplet" style="width: 18px; height: 18px; color: #dc2626;"></i>
                </div>
                <div class="setting-row-info">
                  <span class="setting-row-label">水印</span>
                  <span class="setting-row-desc">在导出的视频上添加水印</span>
                </div>
              </div>
              <button :class="['toggle-switch', { active: preferenceData.watermark }]" @click="togglePreference('watermark')"></button>
            </div>

            <!-- 网站个性化（企业账号专属） -->
            <div v-if="userStore.user?.user_type === 'enterprise'" class="site-customization-section">
              <div class="notify-category-title" style="margin-top: 20px;">网站个性化 <span class="enterprise-only-tag">企业专属</span></div>
              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #fef3c7;">
                    <i data-lucide="image" style="width: 18px; height: 18px; color: #f59e0b;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">网站图标</span>
                    <span class="setting-row-desc">上传自定义网站图标（favicon），建议尺寸 32x32 或 64x64</span>
                  </div>
                </div>
                <div class="setting-row-right">
                  <div v-if="preferenceData.site_favicon" class="favicon-preview">
                    <img :src="preferenceData.site_favicon" alt="favicon" class="favicon-img">
                  </div>
                  <button class="setting-row-action" @click="triggerFaviconUpload">上传图标</button>
                  <input ref="faviconInput" type="file" accept="image/*" style="display: none;" @change="handleFaviconUpload">
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-row-left">
                  <div class="setting-row-icon" style="background: #eef2ff;">
                    <i data-lucide="type" style="width: 18px; height: 18px; color: #3b82f6;"></i>
                  </div>
                  <div class="setting-row-info">
                    <span class="setting-row-label">网站标题</span>
                    <span class="setting-row-desc">自定义浏览器标签页显示的标题</span>
                  </div>
                </div>
                <div class="setting-row-right">
                  <input type="text" v-model="preferenceData.site_title" class="site-title-input" placeholder="请输入网站标题">
                </div>
              </div>

              <div class="site-customization-actions">
                <button class="site-save-btn" @click="saveSiteCustomization">
                  <i data-lucide="save" style="width: 14px; height: 14px;"></i>
                  保存网站设置
                </button>
              </div>
            </div>
          </div>

          <!-- 登出按钮 -->
          <div class="logout-section">
            <button class="logout-btn" @click="handleLogout">
              <i data-lucide="log-out" style="width: 16px; height: 16px;"></i>
              退出登录
            </button>
          </div>

        </div>
      </div>

      <!-- Toast 提示 -->
      <div :class="['toast', { show: toast.show, success: toast.type === 'success' }]">
        <i :data-lucide="toast.type === 'success' ? 'check-circle' : 'alert-circle'" class="toast-icon" style="width: 18px; height: 18px;"></i>
        {{ toast.message }}
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { userData } from '../data/userData'
import { useUserStore } from '../stores/user'
import { useAppStore } from '../stores/app'
import { getSiteCustomizationApi, saveSiteCustomizationApi, uploadFaviconApi } from '../api/profile'

// 防止组件卸载后异步回调修改 state
const isUnmounted = ref(false)
let iconTimer = null

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const appStore = useAppStore()

const activeSection = ref('profile')

const settingsSections = ref([
  { key: 'profile', label: '个人资料', icon: 'user' },
  { key: 'phone', label: '手机绑定', icon: 'smartphone' },
  { key: 'email', label: '邮箱绑定', icon: 'mail' },
  { key: 'password', label: '密码设置', icon: 'key-round' },
  { key: 'notification', label: '通知设置', icon: 'bell' },
  { key: 'privacy', label: '隐私设置', icon: 'shield' },
  { key: 'preference', label: '偏好设置', icon: 'palette' }
])

const profileData = reactive({
  avatar: userData.user.avatar,
  name: userData.user.name,
  gender: '男',
  birthday: '1995-06-15',
  bio: userData.user.bio,
  region: '北京',
  industry: '互联网/科技'
})

const phoneData = reactive({
  current: '138****8888',
  verified: true,
  bindTime: '2024-03-15'
})

const emailData = reactive({
  current: 'creator@example.com',
  verified: true,
  bindTime: '2024-03-16'
})

const passwordData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  showCurrent: false,
  showNew: false,
  showConfirm: false
})

const notificationData = reactive({
  systemNotify: true,
  orderNotify: true,
  activityNotify: false,
  updateNotify: true,
  emailNotify: true,
  pushNotify: true
})

const privacyData = reactive({
  profileVisible: 'public',
  worksVisible: 'public',
  allowSearch: true,
  allowRecommend: true,
  showOnlineStatus: false,
  showActivity: true
})

const preferenceData = reactive({
  language: 'zh-CN',
  theme: 'light',
  fontSize: 'medium',
  autoSave: true,
  hdExport: false,
  watermark: true,
  site_favicon: '',
  site_title: ''
})

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
})

const passwordStrength = computed(() => {
  const pwd = passwordData.newPassword
  if (!pwd) return { level: 0, text: '', class: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  if (score <= 1) return { level: 1, text: '弱', class: 'weak' }
  if (score <= 2) return { level: 2, text: '中', class: 'medium' }
  return { level: 3, text: '强', class: 'strong' }
})

const selectSection = (key) => {
  activeSection.value = key
  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

const showToast = (message, type = 'success') => {
  toast.show = true
  toast.message = message
  toast.type = type
  setTimeout(() => {
    toast.show = false
  }, 2500)
}

const saveProfile = () => {
  showToast('个人资料已保存')
}

const changePhone = () => {
  showToast('手机号修改验证码已发送')
}

const changeEmail = () => {
  showToast('邮箱验证链接已发送')
}

const checkPasswordStrength = () => {
}

const changePassword = () => {
  if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
    showToast('请填写完整密码信息', 'error')
    return
  }
  if (passwordData.newPassword !== passwordData.confirmPassword) {
    showToast('两次输入的密码不一致', 'error')
    return
  }
  if (passwordData.newPassword.length < 8) {
    showToast('密码长度不能少于8位', 'error')
    return
  }
  passwordData.currentPassword = ''
  passwordData.newPassword = ''
  passwordData.confirmPassword = ''
  showToast('密码修改成功')
}

const toggleNotify = (key) => {
  notificationData[key] = !notificationData[key]
}

const saveNotification = () => {
  showToast('通知设置已保存')
}

const togglePrivacy = (key) => {
  privacyData[key] = !privacyData[key]
}

const savePrivacy = () => {
  showToast('隐私设置已保存')
}

const togglePreference = (key) => {
  preferenceData[key] = !preferenceData[key]
}

const savePreference = () => {
  showToast('偏好设置已保存')
}

const faviconInput = ref(null)

const triggerFaviconUpload = () => {
  faviconInput.value?.click()
}

const handleFaviconUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await uploadFaviconApi(formData)
    if (isUnmounted.value) return
    preferenceData.site_favicon = res.data.url
    showToast('图标上传成功')
    nextTick(() => {
      if (window.lucide) lucide.createIcons()
    })
  } catch (e) {
    showToast('图标上传失败', 'error')
  }
}

const saveSiteCustomization = async () => {
  try {
    await saveSiteCustomizationApi({
      favicon_url: preferenceData.site_favicon,
      site_title: preferenceData.site_title
    })
    // 通过 appStore 持久化并应用（写入 localStorage + 更新浏览器标签页）
    appStore.setSiteCustomization({
      favicon_url: preferenceData.site_favicon,
      site_title: preferenceData.site_title
    })
    showToast('网站个性化设置已保存')
  } catch (e) {
    showToast('保存失败', 'error')
  }
}

const handleLogout = async () => {
  await userStore.logout()
  showToast('已退出登录')
  setTimeout(() => {
    router.push('/login')
  }, 800)
}

onMounted(async () => {
  // 支持通过 ?section= 深链定位到指定设置项（如 TopNav 的“修改密码”入口）
  const section = route.query.section
  if (typeof section === 'string' && settingsSections.value.some(s => s.key === section)) {
    activeSection.value = section
  }
  // 企业账号从后端获取网站个性化设置
  if (userStore.user?.user_type === 'enterprise') {
    try {
      const res = await getSiteCustomizationApi()
      if (isUnmounted.value) return
      preferenceData.site_favicon = res.data.favicon_url || ''
      preferenceData.site_title = res.data.site_title || ''
      // 同步到 appStore（持久化）
      if (res.data.favicon_url || res.data.site_title) {
        appStore.setSiteCustomization({
          favicon_url: res.data.favicon_url,
          site_title: res.data.site_title
        })
      }
    } catch (e) {
      // 后端获取失败，使用 appStore 本地缓存
      preferenceData.site_favicon = appStore.siteFavicon
      preferenceData.site_title = appStore.siteTitle
    }
  }
  iconTimer = setTimeout(() => {
    if (isUnmounted.value) return
    if (window.lucide) lucide.createIcons()
  }, 100)
})

onUnmounted(() => {
  isUnmounted.value = true
  if (iconTimer) {
    clearTimeout(iconTimer)
    iconTimer = null
  }
})
</script>

<style scoped>
.settings-page {
  max-width: none;
  width: 100%;
}

.page-header-settings {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(59, 130, 246, 0.04);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.settings-page-inner {
  display: flex;
  gap: 20px;
  min-height: 100%;
}

.settings-nav {
  width: 200px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: flex-start;
}

.settings-nav-card {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 8px;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  position: relative;
}

.settings-nav-item:hover {
  color: #3b82f6;
}

.settings-nav-item.active {
  color: #3b82f6;
  font-weight: 600;
  position: relative;
}

.settings-nav-item.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
  border-radius: 1px;
}

.settings-nav-item.active .nav-item-icon {
  color: #3b82f6;
}

.nav-item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.settings-nav-item:hover .nav-item-icon {
  color: #3b82f6;
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-section {
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 28px;
  margin-bottom: 16px;
  transition: all 0.25s ease;
}

.settings-section:hover {
  box-shadow: var(--shadow-md);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.section-action-btn {
  padding: 7px 16px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.section-action-btn:hover {
  border-color: var(--primary-color);
  background: rgba(59, 130, 246, 0.04);
}

.profile-edit-card {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.profile-avatar-edit {
  position: relative;
  flex-shrink: 0;
}

.profile-avatar-large {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.15);
}

.avatar-edit-overlay {
  position: absolute;
  bottom: 0;
  right: -4px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px solid white;
  transition: transform 0.2s ease;
}

.avatar-edit-overlay:hover {
  transform: scale(1.1);
}

.profile-form {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.profile-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-form-group.full-width {
  grid-column: 1 / -1;
}

.profile-form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.profile-form-input {
  padding: 9px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  outline: none;
  transition: all 0.25s ease;
}

.profile-form-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.profile-form-textarea {
  padding: 9px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  outline: none;
  resize: vertical;
  min-height: 72px;
  font-family: inherit;
  transition: all 0.25s ease;
}

.profile-form-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.profile-form-select {
  padding: 9px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  outline: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

.profile-form-select:focus {
  border-color: var(--primary-color);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-row:first-child {
  padding-top: 0;
}

.setting-row-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.setting-row-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.setting-row-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.setting-row-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.setting-row-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.setting-row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.setting-row-value {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.setting-row-action {
  padding: 6px 14px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.setting-row-action:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #d1d5db;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
  border: none;
  padding: 0;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.toggle-switch.active::after {
  left: 22px;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.strength-bar {
  display: flex;
  gap: 4px;
}

.strength-segment {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #e5e7eb;
  transition: background 0.3s ease;
}

.strength-segment.filled-weak {
  background: #ef4444;
}

.strength-segment.filled-medium {
  background: #f59e0b;
}

.strength-segment.filled-strong {
  background: #10b981;
}

.strength-text {
  font-size: 11px;
  font-weight: 600;
}

.strength-text.weak {
  color: #ef4444;
}

.strength-text.medium {
  color: #f59e0b;
}

.strength-text.strong {
  color: #10b981;
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 400px;
}

.password-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.password-form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.password-input-wrap {
  position: relative;
}

.password-input {
  width: 100%;
  padding: 9px 40px 9px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  outline: none;
  transition: all 0.25s ease;
}

.password-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 2px;
  display: flex;
  align-items: center;
}

.password-toggle:hover {
  color: var(--text-secondary);
}

.password-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
  align-self: flex-start;
}

.password-submit-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
}

.notify-category {
  margin-bottom: 20px;
}

.notify-category:last-child {
  margin-bottom: 0;
}

.notify-category-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.permission-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.permission-badge.granted {
  background: #dcfce7;
  color: #15803d;
}

.permission-badge.denied {
  background: #fee2e2;
  color: #dc2626;
}

.logout-section {
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: white;
  border: 1.5px solid #fecaca;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.25s ease;
}

.logout-btn:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  padding: 12px 20px;
  background: white;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  transform: translateX(120%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast.show {
  transform: translateX(0);
}

.toast.success {
  border-color: #bbf7d0;
}

.toast.success .toast-icon {
  color: #10b981;
}

/* 网站个性化 */
.site-customization-section {
  border-top: 1px solid var(--border-subtle);
  margin-top: 16px;
  padding-top: 8px;
}

.enterprise-only-tag {
  display: inline-block;
  padding: 1px 8px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: #92400e;
  margin-left: 6px;
  vertical-align: middle;
}

.favicon-preview {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.favicon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.site-title-input {
  padding: 7px 12px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  background: white;
  outline: none;
  width: 200px;
  transition: all 0.2s ease;
}

.site-title-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.site-customization-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.site-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.site-save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}
</style>