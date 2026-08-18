<template>
  <AppLayout>
    <div class="assets-page">
      <div class="assets-tab-bar">
        <div class="tabs-nav">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['asset-tab', { active: activeTab === tab.key }]"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="storage-info-inline">
          <span class="storage-label-text">存储空间:</span>
          <span class="storage-value-bold">{{ storageUsed }} / {{ storageTotal }}</span>
          <a href="#" class="upgrade-link">升级空间</a>
        </div>
      </div>

      <div class="assets-toolbar">
        <div class="toolbar-left">
          <div class="type-filter-group">
            <button
              v-for="ft in currentTypeFilters"
              :key="ft.key"
              :class="['type-filter-btn', { active: activeTypeFilter === ft.key }]"
              @click="activeTypeFilter = ft.key"
            >
              <LucideIcon :name="ft.icon" svgStyle="width: 14px; height: 14px;" />
              {{ ft.label }}
            </button>
          </div>
          <button v-if="activeTab !== 'materials'" class="upload-btn-primary" @click="triggerUpload" :disabled="isUploading">
            <LucideIcon name="upload" svgStyle="width: 16px; height: 16px;" />
            {{ isUploading ? '上传中...' : '上传' }}
          </button>
        </div>
        <div class="toolbar-right">
          <div class="search-assets-wrap">
            <LucideIcon name="search" svgStyle="width: 15px; height: 15px; color: #9ca3af;" />
            <input
              type="text"
              :placeholder="'搜索' + currentTabLabel"
              class="search-assets-input"
              :value="searchKeyword"
              @input="handleSearch"
            >
          </div>
          <div class="view-toggle-group">
            <button
              :class="['view-toggle-btn', { active: activeView === 'grid' }]"
              @click="activeView = 'grid'"
            >
              <LucideIcon name="layout-grid" svgStyle="width: 17px; height: 17px;" />
            </button>
            <button
              :class="['view-toggle-btn', { active: activeView === 'list' }]"
              @click="activeView = 'list'"
            >
              <LucideIcon name="list" svgStyle="width: 17px; height: 17px;" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'all'" class="tab-content">
        <div class="folders-row">
          <div
            v-for="(folder, idx) in folders"
            :key="idx"
            :class="['folder-card', { 'trash-folder': idx === 4, 'folder-selected': selectedFolderIndex === idx }]"
            @click="handleFolderClick(idx, folder.name)"
          >
            <div
              class="folder-card-icon"
              :style="{ background: idx === 4 ? '#fef2f2' : '#eff6ff', color: idx === 4 ? '#ef4444' : '#3b82f6' }"
            >
              <LucideIcon :name="folder.icon" svgStyle="width: 28px; height: 28px;" />
            </div>
            <div class="folder-card-info">
              <span class="folder-card-name">{{ folder.name }}</span>
            </div>
          </div>
        </div>

        <h3 class="recent-files-title">最近文件</h3>

        <div v-if="isLoading" class="loading-indicator">
          <LucideIcon name="loader" svgStyle="width: 24px; height: 24px; color: #3b82f6; animation: spin 1s linear infinite;" />
          <span class="loading-text">加载中...</span>
        </div>

        <div v-else class="files-grid">
          <div v-for="(file, idx) in filteredFiles" :key="file.id || idx" :class="['file-card', 'file-' + file.type]" @click="openFilePreview(file)">
            <div class="file-actions">
              <button class="file-edit-btn" @click.stop="openEditModal(file)" title="编辑">
                <LucideIcon name="pencil" svgStyle="width: 14px; height: 14px;" />
              </button>
              <button class="file-download-btn" @click.stop="openDownloadModal(file)" title="下载">
                <LucideIcon name="download" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
            <button class="file-delete-btn-bottom" @click.stop="confirmDeleteMedia(file)" title="删除">
              <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
            </button>
            <div v-if="file.thumbnail" class="file-thumb">
              <img :src="file.thumbnail" :alt="file.name" @error="handleImageError">
              <div v-if="file.duration" class="file-duration-badge">{{ file.duration }}</div>
              <div v-if="file.type === 'video'" class="file-type-badge-video">
                <LucideIcon name="play-circle" svgStyle="width: 12px; height: 12px;" />
              </div>
              <div v-if="file.type === 'video'" class="video-play-overlay">
                <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              </div>
            </div>
            <div v-else class="file-thumb-placeholder" :class="'placeholder-' + file.type">
              <div v-if="file.type === 'audio'" class="placeholder-audio-content">
                <LucideIcon name="music" svgStyle="width: 28px; height: 28px; color: white;" />
                <span v-if="file.duration" class="audio-duration-sm">{{ file.duration }}</span>
              </div>
              <div v-else-if="file.type === 'image'" class="placeholder-image-content">
                <LucideIcon name="image" svgStyle="width: 28px; height: 28px; color: #6366f1;" />
              </div>
              <div v-else-if="file.type === 'video'" class="placeholder-video-content video-first-frame">
                <video :src="file.url" preload="metadata" muted playsinline @loadeddata="onVideoFrameLoaded($event)"></video>
                <div class="video-play-overlay">
                  <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
                </div>
                <span v-if="file.duration" class="file-duration-corner">{{ formatDuration(file.duration) }}</span>
              </div>
              <div v-else-if="file.type === 'project'" class="placeholder-project-content">
                <i v-if="file.name.includes('.aep')" style="font-size: 24px; font-weight: 800; color: #2563eb;">Ae</i>
                <i v-else style="font-size: 24px; font-weight: 800; color: #7e22ce;">Pr</i>
              </div>
            </div>
            <div class="file-info">
              <h4 class="file-name">{{ file.name }}</h4>
              <p class="file-meta">{{ file.date }}</p>
              <p class="file-size">{{ file.size }}</p>
              <p v-if="file.model_display_name" class="file-model-id">模型: {{ file.model_display_name }}</p>
            </div>
          </div>
          <div v-if="currentPage >= totalPages" class="file-card file-upload" @click="triggerUpload">
            <div class="upload-placeholder">
              <LucideIcon name="plus" svgStyle="width: 28px; height: 28px; color: #9ca3af;" />
              <span class="upload-text">上传文件</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'assets'" class="tab-content">
        <h3 class="recent-files-title">最近文件</h3>

        <div v-if="isLoading" class="loading-indicator">
          <LucideIcon name="loader" svgStyle="width: 24px; height: 24px; color: #3b82f6; animation: spin 1s linear infinite;" />
          <span class="loading-text">加载中...</span>
        </div>

        <div v-else class="files-grid">
          <div v-for="(file, idx) in filteredFiles" :key="file.id || idx" :class="['file-card', 'file-' + file.type]" @click="openFilePreview(file)">
            <div class="file-actions">
              <button class="file-edit-btn" @click.stop="openEditModal(file)" title="编辑">
                <LucideIcon name="pencil" svgStyle="width: 14px; height: 14px;" />
              </button>
              <button class="file-download-btn" @click.stop="openDownloadModal(file)" title="下载">
                <LucideIcon name="download" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
            <button class="file-delete-btn-bottom" @click.stop="confirmDeleteMedia(file)" title="删除">
              <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
            </button>
            <div v-if="file.thumbnail" class="file-thumb">
              <img :src="file.thumbnail" :alt="file.name" @error="handleImageError">
              <div v-if="file.duration" class="file-duration-badge">{{ file.duration }}</div>
              <div v-if="file.type === 'video'" class="file-type-badge-video">
                <LucideIcon name="play-circle" svgStyle="width: 12px; height: 12px;" />
              </div>
              <div v-if="file.type === 'video'" class="video-play-overlay">
                <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              </div>
            </div>
            <div v-else class="file-thumb-placeholder" :class="'placeholder-' + file.type">
              <div v-if="file.type === 'image'" class="placeholder-image-content">
                <LucideIcon name="image" svgStyle="width: 28px; height: 28px; color: #6366f1;" />
              </div>
              <div v-else-if="file.type === 'video'" class="placeholder-video-content video-first-frame">
                <video :src="file.url" preload="metadata" muted playsinline @loadeddata="onVideoFrameLoaded($event)"></video>
                <div class="video-play-overlay">
                  <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
                </div>
                <span v-if="file.duration" class="file-duration-corner">{{ formatDuration(file.duration) }}</span>
              </div>
              <div v-else-if="file.type === 'project'" class="placeholder-project-content">
                <i v-if="file.name.includes('.aep')" style="font-size: 24px; font-weight: 800; color: #2563eb;">Ae</i>
                <i v-else style="font-size: 24px; font-weight: 800; color: #7e22ce;">Pr</i>
              </div>
            </div>
            <div class="file-info">
              <h4 class="file-name">{{ file.name }}</h4>
              <p class="file-meta">{{ file.date }}</p>
              <p class="file-size">{{ file.size }}</p>
            </div>
          </div>
          <div v-if="currentPage >= totalPages" class="file-card file-upload" @click="triggerUpload">
            <div class="upload-placeholder">
              <LucideIcon name="plus" svgStyle="width: 28px; height: 28px; color: #9ca3af;" />
              <span class="upload-text">上传文件</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'materials'" class="tab-content">
        <div v-if="isLoading" class="loading-indicator">
          <LucideIcon name="loader" svgStyle="width: 24px; height: 24px; color: #3b82f6; animation: spin 1s linear infinite;" />
          <span class="loading-text">加载中...</span>
        </div>

        <div v-else class="files-grid">
          <div v-for="(file, idx) in filteredFiles" :key="file.id || idx" :class="['file-card', 'file-' + file.type]" @click="openFilePreview(file)">
            <div class="file-actions">
              <button class="file-edit-btn" @click.stop="openEditModal(file)" title="编辑">
                <LucideIcon name="pencil" svgStyle="width: 14px; height: 14px;" />
              </button>
              <button class="file-download-btn" @click.stop="openDownloadModal(file)" title="下载">
                <LucideIcon name="download" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
            <button class="file-delete-btn-bottom" @click.stop="confirmDeleteMedia(file)" title="删除">
              <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
            </button>
            <div v-if="file.thumbnail" class="file-thumb">
              <img :src="file.thumbnail" :alt="file.name" @error="handleImageError">
              <div v-if="file.duration" class="file-duration-badge">{{ file.duration }}</div>
              <div v-if="file.type === 'video'" class="file-type-badge-video">
                <LucideIcon name="play-circle" svgStyle="width: 12px; height: 12px;" />
              </div>
              <div v-if="file.type === 'video'" class="video-play-overlay">
                <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              </div>
            </div>
            <div v-else class="file-thumb-placeholder" :class="'placeholder-' + file.type">
              <div v-if="file.type === 'audio'" class="placeholder-audio-content">
                <LucideIcon name="music" svgStyle="width: 28px; height: 28px; color: white;" />
                <span v-if="file.duration" class="audio-duration-sm">{{ file.duration }}</span>
              </div>
              <div v-else-if="file.type === 'image'" class="placeholder-image-content">
                <LucideIcon name="image" svgStyle="width: 28px; height: 28px; color: #6366f1;" />
              </div>
              <div v-else-if="file.type === 'video'" class="placeholder-video-content video-first-frame">
                <video :src="file.url" preload="metadata" muted playsinline @loadeddata="onVideoFrameLoaded($event)"></video>
                <div class="video-play-overlay">
                  <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
                </div>
                <span v-if="file.duration" class="file-duration-corner">{{ formatDuration(file.duration) }}</span>
              </div>
            </div>
            <div class="file-info">
              <h4 class="file-name">{{ file.name }}</h4>
              <p class="file-meta">{{ file.date }}</p>
              <p class="file-size">{{ file.size }}</p>
              <p v-if="file.model_display_name" class="file-model-id">模型: {{ file.model_display_name }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'templates'" class="tab-content">
        <div v-if="isLoading" class="loading-indicator">
          <LucideIcon name="loader" svgStyle="width: 24px; height: 24px; color: #3b82f6; animation: spin 1s linear infinite;" />
          <span class="loading-text">加载中...</span>
        </div>

        <div v-else class="files-grid">
          <div v-for="(file, idx) in filteredFiles" :key="file.id || idx" :class="['file-card', 'file-' + file.type]" @click="openFilePreview(file)">
            <div class="file-actions">
              <button class="file-edit-btn" @click.stop="openEditModal(file)" title="编辑">
                <LucideIcon name="pencil" svgStyle="width: 14px; height: 14px;" />
              </button>
              <button class="file-download-btn" @click.stop="openDownloadModal(file)" title="下载">
                <LucideIcon name="download" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
            <button class="file-delete-btn-bottom" @click.stop="confirmDeleteMedia(file)" title="删除">
              <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
            </button>
            <div v-if="file.thumbnail" class="file-thumb">
              <img :src="file.thumbnail" :alt="file.name" @error="handleImageError">
              <div v-if="file.duration" class="file-duration-badge">{{ file.duration }}</div>
              <div v-if="file.type === 'video'" class="file-type-badge-video">
                <LucideIcon name="play-circle" svgStyle="width: 12px; height: 12px;" />
              </div>
              <div v-if="file.type === 'video'" class="video-play-overlay">
                <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              </div>
            </div>
            <div v-else class="file-thumb-placeholder" :class="'placeholder-' + file.type">
              <div v-if="file.type === 'audio'" class="placeholder-audio-content">
                <LucideIcon name="music" svgStyle="width: 28px; height: 28px; color: white;" />
                <span v-if="file.duration" class="audio-duration-sm">{{ file.duration }}</span>
              </div>
              <div v-else-if="file.type === 'image'" class="placeholder-image-content">
                <LucideIcon name="image" svgStyle="width: 28px; height: 28px; color: #6366f1;" />
              </div>
              <div v-else-if="file.type === 'video'" class="placeholder-video-content video-first-frame">
                <video :src="file.url" preload="metadata" muted playsinline @loadeddata="onVideoFrameLoaded($event)"></video>
                <div class="video-play-overlay">
                  <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
                </div>
              </div>
              <div v-else class="placeholder-template-content">
                <span class="template-tag">模板</span>
              </div>
            </div>
            <div class="file-info">
              <h4 class="file-name">{{ file.name }}</h4>
              <p class="file-meta">{{ file.date }}</p>
              <p class="file-size">{{ file.size }}</p>
            </div>
          </div>
          <div v-if="currentPage >= totalPages" class="file-card file-upload" @click="triggerUpload">
            <div class="upload-placeholder">
              <LucideIcon name="plus" svgStyle="width: 28px; height: 28px; color: #9ca3af;" />
              <span class="upload-text">上传文件</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'favorites'" class="tab-content">
        <div v-if="isLoading" class="loading-indicator">
          <LucideIcon name="loader" svgStyle="width: 24px; height: 24px; color: #3b82f6; animation: spin 1s linear infinite;" />
          <span class="loading-text">加载中...</span>
        </div>

        <div v-else class="files-grid">
          <div v-for="(file, idx) in filteredFiles" :key="file.id || idx" :class="['file-card', 'file-' + file.type]" @click="openFilePreview(file)">
            <div class="file-actions">
              <button class="file-edit-btn" @click.stop="openEditModal(file)" title="编辑">
                <LucideIcon name="pencil" svgStyle="width: 14px; height: 14px;" />
              </button>
              <button class="file-download-btn" @click.stop="openDownloadModal(file)" title="下载">
                <LucideIcon name="download" svgStyle="width: 14px; height: 14px;" />
              </button>
            </div>
            <button class="file-delete-btn-bottom" @click.stop="confirmDeleteMedia(file)" title="删除">
              <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
            </button>
            <div v-if="file.thumbnail" class="file-thumb">
              <img :src="file.thumbnail" :alt="file.name" @error="handleImageError">
              <div v-if="file.duration" class="file-duration-badge">{{ file.duration }}</div>
              <div v-if="file.type === 'video'" class="file-type-badge-video">
                <LucideIcon name="play-circle" svgStyle="width: 12px; height: 12px;" />
              </div>
              <div v-if="file.type === 'video'" class="video-play-overlay">
                <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              </div>
            </div>
            <div v-else class="file-thumb-placeholder" :class="'placeholder-' + file.type">
              <div v-if="file.type === 'audio'" class="placeholder-audio-content">
                <LucideIcon name="music" svgStyle="width: 28px; height: 28px; color: white;" />
                <span v-if="file.duration" class="audio-duration-sm">{{ file.duration }}</span>
              </div>
              <div v-else-if="file.type === 'image'" class="placeholder-image-content">
                <LucideIcon name="image" svgStyle="width: 28px; height: 28px; color: #6366f1;" />
              </div>
              <div v-else-if="file.type === 'video'" class="placeholder-video-content video-first-frame">
                <video :src="file.url" preload="metadata" muted playsinline @loadeddata="onVideoFrameLoaded($event)"></video>
                <div class="video-play-overlay">
                  <LucideIcon name="play-circle" svgStyle="width: 36px; height: 36px; color: white; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
                </div>
              </div>
            </div>
            <div class="file-info">
              <h4 class="file-name">{{ file.name }}</h4>
              <p class="file-meta">{{ file.date }}</p>
              <p class="file-size">{{ file.size }}</p>
            </div>
          </div>
          <div class="file-card file-upload" @click="triggerUpload">
            <div class="upload-placeholder">
              <LucideIcon name="plus" svgStyle="width: 28px; height: 28px; color: #9ca3af;" />
              <span class="upload-text">上传文件</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn page-arrow" @click="prevPage" :disabled="currentPage === 1">
          <LucideIcon name="chevron-left" svgStyle="width: 16px; height: 16px;" />
        </button>

        <template v-for="(page, idx) in visiblePages" :key="page === '...' ? `dots-${idx}` : page">
          <span v-if="page === '...'" class="page-dots">···</span>
          <button
            v-else
            :class="['page-btn page-num', { active: currentPage === page }]"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>

        <button class="page-btn page-arrow" @click="nextPage" :disabled="currentPage === totalPages">
          <LucideIcon name="chevron-right" svgStyle="width: 16px; height: 16px;" />
        </button>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden-file-input"
        accept="image/*,video/*,audio/*"
        @change="handleFileChange"
      >

      <Teleport to="body">
        <div v-if="isUploading || uploadQueue.length > 0" :class="['upload-modal-overlay', { 'overlay-completed': allCompleted && !isUploading }]" @click.self="handleOverlayClick">
          <div class="upload-modal">
            <div class="upload-modal-header">
              <h3>上传素材</h3>
              <span class="upload-modal-count">{{ completedCount }} / {{ uploadQueue.length }}</span>
            </div>
            <div class="upload-modal-body">
              <div v-for="(item, idx) in uploadQueue" :key="idx" class="upload-queue-item">
                <div class="upload-queue-icon">
                  <LucideIcon v-if="item.status === 'done'" name="check-circle" svgStyle="width: 20px; height: 20px; color: #22c55e;" />
                  <LucideIcon v-else-if="item.status === 'error'" name="x-circle" svgStyle="width: 20px; height: 20px; color: #ef4444;" />
                  <LucideIcon v-else-if="item.status === 'uploading'" name="loader" svgStyle="width: 20px; height: 20px; color: #3b82f6; animation: spin 1s linear infinite;" />
                  <LucideIcon v-else name="file" svgStyle="width: 20px; height: 20px; color: #9ca3af;" />
                </div>
                <div class="upload-queue-info">
                  <div class="upload-queue-name">{{ item.file.name }}</div>
                  <div class="upload-queue-status">
                    <span v-if="item.status === 'pending'" class="status-pending">等待中</span>
                    <span v-else-if="item.status === 'uploading'" class="status-uploading">上传中 {{ item.progress }}%</span>
                    <span v-else-if="item.status === 'creating'" class="status-uploading">入库中...</span>
                    <span v-else-if="item.status === 'done'" class="status-done">上传成功</span>
                    <span v-else-if="item.status === 'error'" class="status-error">{{ item.error || '上传失败' }}</span>
                  </div>
                  <div v-if="item.status === 'uploading'" class="upload-progress-bar">
                    <div class="upload-progress-fill" :style="{ width: item.progress + '%' }"></div>
                  </div>
                </div>
                <span class="upload-queue-size">{{ formatFileSize(item.file.size) }}</span>
              </div>
            </div>
            <div class="upload-modal-footer">
              <span v-if="isUploading" class="upload-modal-hint">正在上传，请稍候...</span>

              <template v-else-if="allCompleted && hasFailedItems">
                <button class="upload-modal-retry-btn" @click="retryFailedUploads">
                  重试失败项
                </button>
                <button class="upload-modal-close-btn" @click="closeUploadModal">
                  关闭
                </button>
              </template>

              <button
                v-else-if="allCompleted && !hasFailedItems"
                class="upload-modal-close-btn"
                @click="closeUploadModal"
              >关闭</button>

              <button
                v-else-if="uploadQueue.length > 0"
                class="upload-modal-close-btn"
                @click="closeUploadModal"
              >关闭</button>
            </div>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <Transition name="toast-fade">
          <div v-if="toastVisible" :class="['global-toast', 'toast-' + toastType]">
            <LucideIcon
              :name="toastType === 'success' ? 'check-circle' : toastType === 'error' ? 'alert-circle' : toastType === 'warning' ? 'alert-triangle' : 'info'"
              svgStyle="width: 18px; height: 18px;"
            />
            <span>{{ toastMessage }}</span>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <div v-if="showFilePreview" class="file-preview-overlay" @click.self="closeFilePreview">
          <div class="file-preview-content">
            <button class="file-preview-close" @click="closeFilePreview" title="关闭">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="file-preview-body">
              <img
                v-if="previewFile && previewFile.type === 'image'"
                :src="previewFile.thumbnail || previewFile.url"
                :alt="previewFile.name"
                class="file-preview-image"
              />
              <video
                v-else-if="previewFile && previewFile.type === 'video'"
                :src="previewFile.url || previewFile.thumbnail"
                class="file-preview-video"
                controls
                autoplay
              />
              <div v-else-if="previewFile && previewFile.type === 'audio'" class="file-preview-audio-wrapper">
                <div class="file-preview-audio-icon">
                  <LucideIcon name="music" svgStyle="width: 64px; height: 64px; color: #6366f1;" />
                </div>
                <audio :src="previewFile.url" controls autoplay class="file-preview-audio"></audio>
              </div>
              <div v-else class="file-preview-unsupported">
                <LucideIcon name="file-question" svgStyle="width: 48px; height: 48px; color: #9ca3af;" />
                <p>暂不支持预览此文件类型</p>
              </div>
            </div>
            <div v-if="previewFile" class="file-preview-info">
              <span class="file-preview-name">{{ previewFile.name }}</span>
              <span class="file-preview-meta">{{ previewFile.size }} · {{ previewFile.date }}</span>
              <div class="file-preview-actions">
                <button class="file-preview-action-btn" @click="openDownloadModal(previewFile)" title="下载">
                  <LucideIcon name="download" svgStyle="width: 16px; height: 16px;" />
                  <span>下载</span>
                </button>
                <button class="file-preview-action-btn" @click="openEditModal(previewFile)" title="编辑">
                  <LucideIcon name="pencil" svgStyle="width: 16px; height: 16px;" />
                  <span>编辑</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 编辑素材弹窗 -->
      <Teleport to="body">
        <div v-if="showEditModal" class="edit-modal-overlay" @click.self="closeEditModal">
          <div class="edit-modal-content">
            <div class="edit-modal-header">
              <h3>编辑素材</h3>
              <button class="edit-modal-close" @click="closeEditModal">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="edit-modal-body">
              <div class="edit-field">
                <label>名称</label>
                <input type="text" v-model="editForm.media_name" placeholder="素材名称" maxlength="255" />
              </div>
              <div class="edit-field">
                <label>描述</label>
                <textarea v-model="editForm.description" placeholder="描述内容" maxlength="2000" rows="3"></textarea>
              </div>
              <div class="edit-field">
                <label>分类</label>
                <input type="text" v-model="editForm.category" placeholder="业务分类" maxlength="50" />
              </div>
              <div class="edit-field">
                <label>标签</label>
                <div class="edit-tags-container">
                  <div class="edit-tags-list">
                    <span v-for="(tag, idx) in editForm.tags" :key="idx" class="edit-tag-item">
                      {{ tag }}
                      <button class="edit-tag-remove" @click="removeEditTag(idx)">×</button>
                    </span>
                  </div>
                  <input 
                    type="text" 
                    v-model="editTagInput" 
                    placeholder="添加标签后按回车" 
                    @keydown.enter="addEditTag"
                    maxlength="50"
                  />
                </div>
              </div>
            </div>
            <div class="edit-modal-footer">
              <button class="edit-cancel-btn" @click="closeEditModal">取消</button>
              <button class="edit-save-btn" @click="saveEdit" :disabled="editLoading">
                {{ editLoading ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 下载链接弹窗 -->
      <Teleport to="body">
        <div v-if="showDownloadModal" class="download-modal-overlay" @click.self="closeDownloadModal">
          <div class="download-modal-content">
            <div class="download-modal-header">
              <h3>文件下载</h3>
              <button class="download-modal-close" @click="closeDownloadModal">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="download-modal-body">
              <div class="download-file-info">
                <LucideIcon name="file" svgStyle="width: 32px; height: 32px; color: #6366f1;" />
                <div class="download-file-details">
                  <p class="download-file-name">{{ downloadFileData?.name }}</p>
                  <p class="download-file-size">{{ downloadFileData?.size }}</p>
                </div>
              </div>
              <div class="download-link-box">
                <input type="text" :value="downloadFileData?.url" readonly class="download-link-input" />
                <button class="download-copy-btn" @click="copyDownloadLink">
                  <LucideIcon name="copy" svgStyle="width: 16px; height: 16px;" />
                  复制链接
                </button>
              </div>
            </div>
            <div class="download-modal-footer">
              <button class="download-cancel-btn" @click="closeDownloadModal">关闭</button>
              <button class="download-direct-btn" @click="triggerDirectDownload">
                <LucideIcon name="download" svgStyle="width: 16px; height: 16px;" />
                直接下载
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 回收站弹窗 -->
      <Teleport to="body">
        <div v-if="showRecycleBinModal" class="recycle-modal-overlay" @click.self="closeRecycleBinModal">
          <div class="recycle-modal-content">
            <div class="recycle-modal-header">
              <h3>
                <LucideIcon name="trash-2" svgStyle="width: 20px; height: 20px; color: #ef4444;" />
                回收站
              </h3>
              <button class="recycle-modal-close" @click="closeRecycleBinModal">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="recycle-modal-body">
              <!-- 加载中 -->
              <div v-if="recycleBinLoading" class="recycle-loading">
                <LucideIcon name="loader" svgStyle="width: 32px; height: 32px; color: #6366f1; animation: spin 1s linear infinite;" />
                <span>加载中...</span>
              </div>
              <!-- 空回收站 -->
              <div v-else-if="recycleBinItems.length === 0" class="recycle-empty">
                <LucideIcon name="trash" svgStyle="width: 48px; height: 48px; color: #9ca3af;" />
                <p>回收站是空的</p>
                <p class="recycle-empty-tip">删除的素材将在7天后自动清理</p>
              </div>
              <!-- 回收站列表 -->
              <div v-else class="recycle-items-list">
                <div v-for="item in recycleBinItems" :key="item.media_id" class="recycle-item-card">
                  <div class="recycle-item-thumb">
                    <img v-if="item.thumbnail" :src="item.thumbnail" :alt="item.name" />
                    <div v-else class="recycle-item-placeholder">
                      <LucideIcon :name="item.type === 'video' ? 'video' : 'image'" svgStyle="width: 24px; height: 24px; color: #6366f1;" />
                    </div>
                  </div>
                  <div class="recycle-item-info">
                    <p class="recycle-item-name">{{ item.name }}</p>
                    <p class="recycle-item-meta">{{ item.size }} · 删除于 {{ item.date ? new Date(item.date).toLocaleDateString() : '未知' }}</p>
                    <p class="recycle-item-expire">将于 {{ item.permanent_delete_at ? new Date(item.permanent_delete_at).toLocaleDateString() : '7天后' }} 永久删除</p>
                  </div>
                  <div class="recycle-item-actions">
                    <button class="recycle-restore-btn" @click="restoreFromRecycleBin(item)">
                      <LucideIcon name="undo-2" svgStyle="width: 14px; height: 14px;" />
                      恢复
                    </button>
                    <button v-if="userStore.user?.user_type === 'admin' || userStore.user?.user_type === 'enterprise'" class="recycle-purge-btn" @click="purgeFromRecycleBin(item)">
                      <LucideIcon name="trash-2" svgStyle="width: 14px; height: 14px;" />
                      永久删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="recycle-modal-footer">
              <button class="recycle-close-btn" @click="closeRecycleBinModal">关闭</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import AppLayout from '../components/layout/AppLayout.vue'
import LucideIcon from '../components/LucideIcon.vue'
import { useUserStore } from '../stores/user'
import {
  uploadFileApi,
  createMediaApi,
  getMediaListApi,
  getMediaBySourceApi,
  getMediaByTypeApi,
  getRecycleBinApi,
  getMediaDetailApi,
  deleteMediaApi,
  restoreMediaApi,
  updateMediaApi,
  purgeMediaApi,
  reportMediaViewApi,
  reportMediaDownloadApi,
  reportMediaUseApi,
  detectMediaType,
  detectFormat
} from '../api/media'
import { downloadFile } from '../utils/download'

const userStore = useUserStore()
const canDelete = computed(() => userStore.user?.user_type === 'admin')

const activeTab = ref('all')
const activeView = ref('grid')
const activeTypeFilter = ref('all')
const selectedFolder = ref('all')
const storageUsed = ref('23.6GB')
const storageTotal = ref('100GB')

const isUnmounted = ref(false)

const currentPage = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)
const totalPages = ref(0)
const isLoading = ref(false)
const searchKeyword = ref('')
const selectedFolderIndex = ref(null) // 选中的文件夹索引（null表示未选中）

const mediaItems = ref([])

// 视频第一帧缩略图缓存（media_id -> dataURL）
const videoThumbCache = ref({})

const folderStats = ref({
  myVideos: 0,
  myImages: 0,
  projectFiles: 0,
  drafts: 0,
  recycleBin: 0
})

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'assets', label: '素材' },
  { key: 'materials', label: '资产' },
  { key: 'templates', label: '模板' },
  { key: 'favorites', label: '收藏夹' }
]

const assetTypeFilters = [
  { key: 'all', label: '全部', icon: 'layers' },
  { key: 'image', label: '图片', icon: 'image' },
  { key: 'video', label: '视频', icon: 'video' }
]

const mediaTypeFilters = [
  { key: 'all', label: '全部', icon: 'layers' },
  { key: 'image', label: '图片', icon: 'image' },
  { key: 'video', label: '视频', icon: 'video' },
  { key: 'audio', label: '音频', icon: 'music' }
]

const currentTypeFilters = computed(() => {
  return activeTab.value === 'assets' ? assetTypeFilters : mediaTypeFilters
})

const currentTabLabel = computed(() => {
  const tab = tabs.find(t => t.key === activeTab.value)
  return tab ? tab.label : '资产'
})

const currentFolders = computed(() => {
  switch (activeTab.value) {
    case 'assets': return ['我的视频', '我的图片', '项目文件', '草稿箱']
    case 'materials': return ['我的素材', '背景素材', '音效库', '图片素材']
    case 'templates': return ['视频模板', '图片模板', '音频模板']
    case 'favorites': return ['收藏的图片', '收藏的视频', '收藏的音频']
    default: return []
  }
})

function switchTab(tabKey) {
  console.log('[AssetsView] 切换标签页:', tabKey)
  activeTab.value = tabKey
  activeTypeFilter.value = 'all'
  selectedFolder.value = 'all'
  currentPage.value = 1
  loadMediaList()
}

const folders = computed(() => [
  { name: '我的视频', count: folderStats.value.myVideos, icon: 'folder' },
  { name: '我的图片', count: folderStats.value.myImages, icon: 'folder' },
  { name: '项目文件', count: folderStats.value.projectFiles, icon: 'folder' },
  { name: '草稿箱', count: folderStats.value.drafts, icon: 'folder' },
  { name: '回收站', count: folderStats.value.recycleBin, icon: 'trash-2' }
])

// 文件夹点击处理
function handleFolderClick(idx, folderName) {
  console.log('[AssetsView] 点击文件夹:', idx, folderName)
  
  // 回收站单独打开弹窗
  if (folderName === '回收站') {
    openRecycleBinModal()
    return
  }
  
  // 如果点击同一个文件夹，取消选中
  if (selectedFolderIndex.value === idx) {
    selectedFolderIndex.value = null
    activeTypeFilter.value = 'all'
    currentPage.value = 1
    loadMediaList()
    return
  }
  
  selectedFolderIndex.value = idx
  
  // 根据文件夹设置筛选类型
  if (folderName === '我的视频') {
    activeTypeFilter.value = 'video'
  } else if (folderName === '我的图片') {
    activeTypeFilter.value = 'image'
  } else {
    activeTypeFilter.value = 'all'
  }
  
  currentPage.value = 1
  loadMediaList()
}

// 格式化视频时长（秒）为可读字符串
function formatDuration(seconds) {
  const s = Number(seconds)
  if (!s || isNaN(s) || s <= 0) return ''
  if (s < 60) return `${Math.round(s)}秒`
  const m = Math.floor(s / 60)
  const rest = Math.round(s % 60)
  return `${m}分${rest.toString().padStart(2, '0')}秒`
}

// 根据当前 tab 和筛选器发起一次普通分页请求
// 注：翻页必须用普通端点（offset 是 DB 级偏移）；/stream 端点的 limit 是「本次目标总条数」，
// offset>=limit 时会返回空，不适合分页（仅适合首屏流式续拉）。
function fetchMediaBatch(params) {
  if (activeTab.value === 'all') {
    if (activeTypeFilter.value !== 'all') {
      return getMediaByTypeApi(activeTypeFilter.value, params)
    }
    return getMediaListApi(params)
  } else if (activeTab.value === 'assets' && activeTypeFilter.value !== 'all') {
    return getMediaByTypeApi(activeTypeFilter.value, { ...params, media_source: 'uploaded' })
  } else if (activeTab.value === 'assets') {
    return getMediaBySourceApi('uploaded', params)
  } else if (activeTab.value === 'materials') {
    if (activeTypeFilter.value !== 'all') {
      return getMediaByTypeApi(activeTypeFilter.value, { ...params, media_source: 'generated' })
    }
    return getMediaBySourceApi('generated', params)
  } else if (activeTab.value === 'templates' || activeTab.value === 'favorites') {
    return getMediaListApi({ ...params, category: activeTab.value })
  }
  return getMediaListApi(params)
}

async function loadMediaList() {
  console.log('[AssetsView] 开始加载素材列表:', {
    tab: activeTab.value,
    filter: activeTypeFilter.value,
    page: currentPage.value,
    keyword: searchKeyword.value
  })

  isLoading.value = true

  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const keyword = searchKeyword.value || undefined
    // 后端单次返回 5 条，前端发 2 次请求凑齐一页 10 条（5+5）
    const BATCH = 5

    // 第一批（5 条）：先渲染，提升首屏速度
    const res1 = await fetchMediaBatch({ limit: BATCH, offset, keyword })
    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过列表数据更新')
      return
    }

    console.log('[AssetsView] 第一批响应:', res1)

    const items1 = (res1 && res1.data && res1.data.items) || []
    const total = (res1 && res1.data && res1.data.total) || 0

    // 先显示第一批
    mediaItems.value = items1

    // total 是 DB 真实总数（V2 响应），用于分页 UI
    if (total > 0) {
      totalItems.value = total
      totalPages.value = Math.max(1, Math.ceil(total / pageSize.value))
    }

    // 第一批满 BATCH(5) 条且未凑够一页 pageSize(10) 条 → 续拉第二批
    // 第一批返回 <5 条说明已是末页，无需续拉
    if (items1.length >= BATCH && mediaItems.value.length < pageSize.value) {
      const res2 = await fetchMediaBatch({ limit: BATCH, offset: offset + BATCH, keyword })
      if (isUnmounted.value) {
        console.log('[AssetsView] 组件已卸载，跳过第二批数据处理')
        return
      }

      console.log('[AssetsView] 第二批响应:', res2)

      const items2 = (res2 && res2.data && res2.data.items) || []
      if (items2.length > 0) {
        mediaItems.value = [...items1, ...items2]
      }
    }

    // 超出总页数时回退到最后一页
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value
    }

    console.log('[AssetsView] 数据处理完成:', {
      itemCount: mediaItems.value.length,
      total: totalItems.value,
      totalPages: totalPages.value,
      currentPage: currentPage.value
    })

    // 处理当前页视频（缩略图生成 + 时长获取）
    processCurrentPageVideos()
  } catch (error) {
    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过错误处理')
      return
    }
    console.error('[AssetsView] 加载素材列表失败:', error)
    showToast('加载素材列表失败: ' + (error.message || '未知错误'), 'error')
    mediaItems.value = []
    totalItems.value = 0
    totalPages.value = 0
  } finally {
    if (!isUnmounted.value) {
      isLoading.value = false
    }
    console.log('[AssetsView] 加载完成')
  }
}

async function loadFolderStats() {
  console.log('[AssetsView] 开始加载文件夹统计信息')

  try {
    const [videosRes, imagesRes, recycleRes, allUploadedRes] = await Promise.all([
      getMediaByTypeApi('video', { media_source: 'uploaded', limit: 1 }),
      getMediaByTypeApi('image', { media_source: 'uploaded', limit: 1 }),
      getRecycleBinApi({ limit: 1 }),
      getMediaBySourceApi('uploaded', { limit: 1 })
    ])

    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过统计数据更新')
      return
    }

    console.log('[AssetsView] 统计API响应:', {
      videos: videosRes,
      images: imagesRes,
      recycle: recycleRes,
      allUploaded: allUploadedRes
    })

    folderStats.value = {
      myVideos: videosRes?.data?.total || 0,
      myImages: imagesRes?.data?.total || 0,
      projectFiles: 0,
      drafts: 0,
      recycleBin: recycleRes?.data?.total || 0
    }

    console.log('[AssetsView] 文件夹统计:', folderStats.value)
  } catch (error) {
    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过错误处理')
      return
    }
    console.error('[AssetsView] 加载文件夹统计失败:', error)
  }
}

async function handleDeleteMedia(mediaId) {
  console.log('[AssetsView] 删除素材:', mediaId)
  
  if (isUnmounted.value) return

  try {
    const res = await deleteMediaApi(mediaId)
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 删除响应:', res)
    showToast('素材已移入回收站', 'success')

    await loadMediaList()
    await loadFolderStats()
  } catch (error) {
    if (isUnmounted.value) return
    console.error('[AssetsView] 删除失败:', error)
    showToast('删除失败: ' + (error.message || '未知错误'), 'error')
  }
}

async function handleRestoreMedia(mediaId) {
  console.log('[AssetsView] 恢复素材:', mediaId)

  if (isUnmounted.value) return

  try {
    const res = await restoreMediaApi(mediaId)

    if (isUnmounted.value) return

    console.log('[AssetsView] 恢复响应:', res)
    showToast('素材已恢复', 'success')

    await loadMediaList()
    await loadFolderStats()
  } catch (error) {
    if (isUnmounted.value) return
    console.error('[AssetsView] 恢复失败:', error)
    showToast('恢复失败: ' + (error.message || '未知错误'), 'error')
  }
}

async function confirmDeleteMedia(file) {
  if (isUnmounted.value) return
  
  const mediaId = file.media_id || file.id
  if (!mediaId) {
    showToast('无法删除：文件ID缺失', 'error')
    return
  }
  
  // 权限检查：管理员/企业账号可以选择永久删除
  const userType = userStore.user?.user_type
  const canPurge = userType === 'admin' || userType === 'enterprise'
  
  if (canPurge) {
    // 管理员/企业账号：提供两种删除选项
    const choice = confirm(`「${file.name}」删除方式选择：

• 点击「确定」→ 移入回收站（7天内可恢复）
• 点击「取消」后再次确认 → 永久删除（不可恢复）

是否移入回收站？`)

    if (choice) {
      // 移入回收站
      await handleDeleteMedia(mediaId)
    } else {
      // 确认永久删除
      const confirmPurge = confirm(`⚠️ 警告：永久删除不可恢复！

确定要永久删除「${file.name}」吗？
此操作将立即删除素材记录，无法恢复！`)

      if (confirmPurge) {
        await handlePurgeMedia(mediaId)
      }
    }
  } else {
    // 员工账号：只能软删
    if (!confirm(`确定要删除「${file.name}」吗？删除后可在回收站恢复。`)) return
    await handleDeleteMedia(mediaId)
  }
}

function generateVideoThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const url = URL.createObjectURL(file)
    video.src = url

    let settled = false

    function cleanup() {
      URL.revokeObjectURL(url)
    }

    video.addEventListener('loadeddata', () => {
      const seekTime = video.duration && video.duration > 0.2 ? 0.1 : 0
      try {
        video.currentTime = seekTime
      } catch {
        grabFrame()
      }
    })

    function grabFrame() {
      if (settled) return
      settled = true
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const maxW = 320
        const vw = video.videoWidth || 320
        const vh = video.videoHeight || 180
        const scale = Math.min(1, maxW / vw)
        canvas.width = Math.round(vw * scale)
        canvas.height = Math.round(vh * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          cleanup()
          if (blob) {
            resolve({ blob, duration: video.duration || null })
          } else {
            reject(new Error('缩略图 blob 生成失败'))
          }
        }, 'image/jpeg', 0.8)
      } catch (e) {
        cleanup()
        reject(e)
      }
    }

    video.addEventListener('seeked', () => {
      grabFrame()
    })

    video.addEventListener('error', () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('视频加载失败，无法生成缩略图'))
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        cleanup()
        reject(new Error('生成缩略图超时'))
      }
    }, 5000)
  })
}

// 从视频URL生成第一帧缩略图（用于库中已存在但无缩略图的视频）
function generateThumbnailFromUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = videoUrl

    let settled = false

    function finish(dataURL) {
      if (settled) return
      settled = true
      resolve(dataURL)
    }

    video.addEventListener('loadeddata', () => {
      const seekTime = video.duration && video.duration > 0.2 ? 0.1 : 0
      try { video.currentTime = seekTime } catch { grabFrame() }
    })

    function grabFrame() {
      if (settled) return
      settled = true
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const maxW = 320
        const vw = video.videoWidth || 320
        const vh = video.videoHeight || 180
        const scale = Math.min(1, maxW / vw)
        canvas.width = Math.round(vw * scale)
        canvas.height = Math.round(vh * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.8))
      } catch (e) {
        reject(e)
      }
    }

    video.addEventListener('seeked', grabFrame)

    video.addEventListener('error', () => {
      if (settled) return
      settled = true
      reject(new Error('视频加载失败'))
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('生成缩略图超时'))
      }
    }, 8000)
  })
}

// 为列表中没有缩略图的视频异步生成第一帧预览
async function generateVideoThumbnails(items) {
  const videos = items.filter(it =>
    (it.media_type === 'video') &&
    !it.thumbnail_url &&
    it.media_url &&
    !videoThumbCache.value[it.media_id || it.id]
  )
  for (const v of videos) {
    const id = v.media_id || v.id
    try {
      const dataURL = await generateThumbnailFromUrl(v.media_url)
      videoThumbCache.value = { ...videoThumbCache.value, [id]: dataURL }
    } catch (e) {
      console.warn('[AssetsView] 视频缩略图生成失败:', id, e.message)
    }
  }
}

// 获取单个视频时长（秒），通过加载 metadata
function fetchVideoDuration(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    let settled = false
    const done = (val) => { if (!settled) { settled = true; resolve(val) } }
    video.addEventListener('loadedmetadata', () => done(video.duration || null))
    video.addEventListener('error', () => done(null))
    setTimeout(() => done(null), 5000)
  })
}

// 为列表中缺少 duration 的视频异步获取时长
async function loadVideoDurations(items) {
  const videos = items.filter(it =>
    (it.media_type === 'video') &&
    !it.duration &&
    it.media_url
  )
  for (const v of videos) {
    const dur = await fetchVideoDuration(v.media_url)
    if (dur && !isUnmounted.value) {
      // 替换整个 item 以触发响应式更新
      const idx = mediaItems.value.findIndex(it => (it.media_id || it.id) === (v.media_id || v.id))
      if (idx !== -1) {
        mediaItems.value[idx] = { ...mediaItems.value[idx], duration: dur }
      }
    }
  }
}

// 处理当前页视频：生成缩略图 + 获取时长（mediaItems 已是当前页数据）
function processCurrentPageVideos() {
  if (isUnmounted.value) return
  generateVideoThumbnails(mediaItems.value)
  loadVideoDurations(mediaItems.value)
}

function transformMediaItem(item) {
  const mediaType = item.media_type || 'image'
  const mediaId = item.media_id || item.id
  const cachedThumb = mediaType === 'video' ? videoThumbCache.value[mediaId] : null
  return {
    id: item.id || item.media_id,
    media_id: mediaId,
    name: item.media_name || '未命名',
    media_name: item.media_name || '未命名',
    type: mediaType,
    size: item.file_size ? formatFileSize(item.file_size) : '未知大小',
    date: item.created_at || new Date().toISOString(),
    thumbnail: item.thumbnail_url || cachedThumb || (mediaType === 'image' ? item.media_url : '') || '',
    url: item.media_url || item.thumbnail_url || '',
    media_url: item.media_url || '',
    duration: item.duration || null,
    width: item.width || null,
    height: item.height || null,
    format: item.format || '',
    mimeType: item.mime_type || '',
    description: item.description || '',
    category: item.category || '',
    tags: item.tags || [],
    view_count: item.view_count || 0,
    download_count: item.download_count || 0,
    use_count: item.use_count || 0,
    status: item.status || 'normal',
    model_id: item.model_id || null,
    generation_model: item.generation_model || null,
    model_display_name: item.generation_model || item.model_display_name || null,
    model_name: item.model_name || null,
    media_source: item.media_source || ''
  }
}

const filteredFiles = computed(() => {
  // mediaItems 已是当前页数据（按需加载），无需再切片
  return mediaItems.value.map(transformMediaItem)
})

function handleImageError(e) {
  e.target.closest('.file-thumb')?.classList.add('img-error')
}

// 视频第一帧加载后 seek 到 0.1 秒展示第一帧
function onVideoFrameLoaded(e) {
  const video = e.target
  try {
    if (video.duration > 0.2) {
      video.currentTime = 0.1
    }
  } catch (_) { /* ignore */ }
}

watch(activeTypeFilter, (newFilter) => {
  console.log('[AssetsView] 筛选器变化:', newFilter)
  currentPage.value = 1
  loadMediaList()
})

// 翻页时按需加载新页数据（服务端分页）
watch(currentPage, () => {
  loadMediaList()
})

// 分页滑动窗口：最多展示 12 项（含首尾页与省略号）
// 首尾页始终展示，当前页周围展示一个窗口，远端用 '...' 折叠
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const MAX_VISIBLE = 12

  if (total <= MAX_VISIBLE) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages = []
  // 首页固定
  pages.push(1)

  // 当前页周围的窗口（8 项）
  let start = Math.max(2, current - 3)
  let end = Math.min(total - 1, current + 3)

  // 接近首页：窗口左移贴边
  if (current <= 5) {
    start = 2
    end = Math.min(total - 1, MAX_VISIBLE - 3) // 9
  }
  // 接近末页：窗口右移贴边
  if (current >= total - 4) {
    end = total - 1
    start = Math.max(2, total - (MAX_VISIBLE - 4)) // total - 8
  }

  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('...')

  // 末页固定
  pages.push(total)
  return pages
})

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function prevPage() {
  console.log('[AssetsView] 上一页')
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  console.log('[AssetsView] 下一页')
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function handleSearch(e) {
  console.log('[AssetsView] 搜索:', e.target.value)
  searchKeyword.value = e.target.value
  currentPage.value = 1
  loadMediaList()
}

const fileInputRef = ref(null)
const isUploading = ref(false)
const uploadQueue = ref([])

const completedCount = computed(() => {
  return uploadQueue.value.filter(i => i.status === 'done' || i.status === 'error').length
})

const hasFailedItems = computed(() => {
  return uploadQueue.value.some(i => i.status === 'error')
})

const allCompleted = computed(() => {
  return uploadQueue.value.length > 0 && uploadQueue.value.every(i => i.status === 'done' || i.status === 'error')
})

const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('info')

function showToast(msg, type = 'info') {
  if (isUnmounted.value) return
  
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  setTimeout(() => {
    if (!isUnmounted.value) {
      toastVisible.value = false
    }
  }, 3000)
}

// ========== 文件预览功能 ==========
const showFilePreview = ref(false)
const previewFile = ref(null)

function openFilePreview(file) {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 打开文件预览:', file)
  previewFile.value = file
  showFilePreview.value = true
  
  // 上报浏览次数
  if (file.id || file.media_id) {
    reportMediaViewApi(file.media_id || file.id).catch(err => {
      console.warn('[AssetsView] 上报浏览次数失败:', err)
    })
  }
  
  nextTick(() => {
    if (!isUnmounted.value && window.lucide) {
      lucide.createIcons()
    }
  })
}

function closeFilePreview() {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 关闭文件预览')
  showFilePreview.value = false
  previewFile.value = null
}

// ========== 文件下载弹窗功能 ==========
const showDownloadModal = ref(false)
const downloadFileData = ref(null)

function openDownloadModal(file) {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 打开下载弹窗:', file)
  
  const url = file.url || file.thumbnail || file.media_url
  if (!url) {
    showToast('无法获取文件下载地址', 'error')
    return
  }
  
  downloadFileData.value = {
    name: file.name || file.media_name || '未知文件',
    url: url,
    size: file.size || '未知大小',
    media_id: file.media_id || file.id,
    type: file.type || file.media_type || ''
  }
  showDownloadModal.value = true
  
  nextTick(() => {
    if (!isUnmounted.value && window.lucide) {
      lucide.createIcons()
    }
  })
}

// ========== 回收站弹窗功能 ==========
const showRecycleBinModal = ref(false)
const recycleBinItems = ref([])
const recycleBinLoading = ref(false)

async function openRecycleBinModal() {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 打开回收站弹窗')
  showRecycleBinModal.value = true
  recycleBinLoading.value = true
  
  try {
    const res = await getRecycleBinApi({ limit: 50, offset: 0 })
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 回收站完整响应:', JSON.stringify(res, null, 2))
    console.log('[AssetsView] res.data:', res?.data)
    console.log('[AssetsView] res.data.items 类型:', typeof res?.data?.items, '是否是数组:', Array.isArray(res?.data?.items), '长度:', res?.data?.items?.length)
    console.log('[AssetsView] res.data.total:', res?.data?.total)
    
    const items = res?.data?.items || []
    console.log('[AssetsView] 准备映射的 items:', items.length, '个')
    if (items.length > 0) {
      console.log('[AssetsView] 第一个 item 原始数据:', items[0])
    }
    
    recycleBinItems.value = items.map(item => ({
      id: item.id || item.media_id,
      media_id: item.media_id || item.id,
      name: item.media_name || '未命名',
      type: item.media_type || 'image',
      size: item.file_size ? formatFileSize(item.file_size) : '未知',
      date: item.deleted_at || item.created_at || '',
      thumbnail: item.thumbnail_url || (item.media_type === 'image' ? item.media_url : '') || '',
      url: item.media_url || '',
      status: item.status || 'deleted',
      deleted_at: item.deleted_at || '',
      permanent_delete_at: item.permanent_delete_at || ''
    }))
    
    recycleBinLoading.value = false
    
    nextTick(() => {
      if (!isUnmounted.value && window.lucide) {
        lucide.createIcons()
      }
    })
  } catch (err) {
    if (isUnmounted.value) return
    
    console.error('[AssetsView] 加载回收站失败:', err)
    recycleBinLoading.value = false
    recycleBinItems.value = []
    showToast('加载回收站失败', 'error')
  }
}

function closeRecycleBinModal() {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 关闭回收站弹窗')
  showRecycleBinModal.value = false
  recycleBinItems.value = []
}

async function restoreFromRecycleBin(item) {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 恢复回收站项目:', item)
  
  if (!confirm(`确定要恢复「${item.name}」吗？`)) return
  
  const mediaId = item.media_id || item.id
  
  try {
    const res = await restoreMediaApi(mediaId)
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 恢复成功:', res)
    showToast('素材已恢复', 'success')

    // 刷新回收站列表
    await openRecycleBinModal()
    // 刷新主文件列表
    await loadMediaList()
    // 刷新统计数据
    loadFolderStats().catch(() => {})
  } catch (err) {
    if (isUnmounted.value) return
    
    console.error('[AssetsView] 恢复失败:', err)
    showToast('恢复失败: ' + (err.message || '未知错误'), 'error')
  }
}

async function purgeFromRecycleBin(item) {
  if (isUnmounted.value) return
  
  // 权限检查
  const userType = userStore.user?.user_type
  if (userType !== 'admin' && userType !== 'enterprise') {
    showToast('无权限永久删除', 'error')
    return
  }
  
  console.log('[AssetsView] 永久删除回收站项目:', item)
  
  if (!confirm(`⚠️ 永久删除不可恢复！\n\n确定要永久删除「${item.name}」吗？`)) return
  
  const mediaId = item.media_id || item.id
  
  try {
    const res = await purgeMediaApi(mediaId)
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 永久删除成功:', res)
    showToast('已永久删除', 'success')
    
    // 刷新回收站列表
    await openRecycleBinModal()
    // 刷新统计数据
    loadFolderStats().catch(() => {})
  } catch (err) {
    if (isUnmounted.value) return
    
    console.error('[AssetsView] 永久删除失败:', err)
    showToast('永久删除失败: ' + (err.message || '未知错误'), 'error')
  }
}

function closeDownloadModal() {
  if (isUnmounted.value) return
  
  showDownloadModal.value = false
  downloadFileData.value = null
}

function copyDownloadLink() {
  if (!downloadFileData.value?.url) return
  
  navigator.clipboard.writeText(downloadFileData.value.url).then(() => {
    showToast('下载链接已复制到剪贴板', 'success')
  }).catch(err => {
    console.error('[AssetsView] 复制失败:', err)
    showToast('复制失败', 'error')
  })
}

async function triggerDirectDownload() {
  if (!downloadFileData.value?.url) return

  console.log('[AssetsView] 直接下载:', downloadFileData.value.url)

  const url = downloadFileData.value.url
  const fileName = downloadFileData.value.name
  const fileType = downloadFileData.value.type || ''

  // 上报下载次数
  if (downloadFileData.value.media_id) {
    reportMediaDownloadApi(downloadFileData.value.media_id).catch(err => {
      console.warn('[AssetsView] 上报下载次数失败:', err)
    })
  }

  showToast('正在准备下载...', 'success')

  const ok = await downloadFile(url, fileName, fileType)

  if (ok) {
    showToast('下载已开始', 'success')
  } else {
    showToast('下载链接已打开，如未自动下载请右键保存', 'warning')
  }
  closeDownloadModal()
}

// ========== 素材编辑功能 ==========
const showEditModal = ref(false)
const editingFile = ref(null)
const editForm = ref({
  media_name: '',
  description: '',
  category: '',
  tags: []
})
const editTagInput = ref('')
const editLoading = ref(false)

function openEditModal(file) {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 打开编辑弹窗:', file)
  editingFile.value = file
  editForm.value = {
    media_name: file.name || file.media_name || '',
    description: file.description || '',
    category: file.category || '',
    tags: file.tags || []
  }
  editTagInput.value = ''
  showEditModal.value = true
  
  nextTick(() => {
    if (!isUnmounted.value && window.lucide) {
      lucide.createIcons()
    }
  })
}

function closeEditModal() {
  if (isUnmounted.value) return
  
  showEditModal.value = false
  editingFile.value = null
}

function addEditTag() {
  const tag = editTagInput.value.trim()
  if (tag && !editForm.value.tags.includes(tag)) {
    editForm.value.tags.push(tag)
    editTagInput.value = ''
  }
}

function removeEditTag(index) {
  editForm.value.tags.splice(index, 1)
}

async function saveEdit() {
  if (isUnmounted.value) return
  if (!editingFile.value) return
  
  const mediaId = editingFile.value.media_id || editingFile.value.id
  if (!mediaId) {
    showToast('无法获取素材ID', 'error')
    return
  }
  
  editLoading.value = true
  console.log('[AssetsView] 保存编辑:', { mediaId, ...editForm.value })
  
  try {
    const res = await updateMediaApi(mediaId, {
      media_name: editForm.value.media_name,
      description: editForm.value.description,
      category: editForm.value.category,
      tags: editForm.value.tags
    })
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 编辑成功:', res)
    showToast('素材已更新', 'success')
    closeEditModal()
    
    // 刷新列表
    loadMediaList().catch(() => {})
  } catch (err) {
    if (isUnmounted.value) return
    
    console.error('[AssetsView] 编辑失败:', err)
    showToast('更新失败: ' + (err.message || '未知错误'), 'error')
  } finally {
    if (!isUnmounted.value) {
      editLoading.value = false
    }
  }
}

// ========== 永久删除功能 ==========
async function handlePurgeMedia(mediaId) {
  if (isUnmounted.value) return
  
  // 权限检查：只有管理员和企业账号可以永久删除
  const userType = userStore.user?.user_type
  if (userType !== 'admin' && userType !== 'enterprise') {
    showToast('无权限永久删除素材', 'error')
    return
  }
  
  console.log('[AssetsView] 永久删除素材:', mediaId)
  
  try {
    const res = await purgeMediaApi(mediaId)
    
    if (isUnmounted.value) return
    
    console.log('[AssetsView] 永久删除成功:', res)
    showToast('素材已永久删除', 'success')
    
    // 刷新列表
    loadMediaList().catch(() => {})
    loadFolderStats().catch(() => {})
  } catch (err) {
    if (isUnmounted.value) return
    
    console.error('[AssetsView] 永久删除失败:', err)
    showToast('永久删除失败: ' + (err.message || '未知错误'), 'error')
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(2) + 'MB'
}

function triggerUpload() {
  if (isUploading.value) {
    showToast('正在上传中，请稍候', 'warning')
    return
  }
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  const MAX_SIZE = 50 * 1024 * 1024
  const validFiles = []
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      showToast(`文件「${file.name}」超过 50MB 限制`, 'error')
      continue
    }
    validFiles.push(file)
  }

  if (validFiles.length === 0) {
    e.target.value = ''
    return
  }

  uploadQueue.value = validFiles.map(file => ({
    file,
    status: 'pending',
    progress: 0,
    error: ''
  }))

  e.target.value = ''

  processUploadQueue()
}

async function processUploadQueue() {
  console.log('[AssetsView] processUploadQueue 开始')
  
  if (isUnmounted.value) {
    console.log('[AssetsView] 组件已卸载，跳过上传队列处理')
    return
  }
  
  isUploading.value = true

  let successCount = 0
  let failCount = 0

  try {
    for (let i = 0; i < uploadQueue.value.length; i++) {
      if (isUnmounted.value) {
        console.log('[AssetsView] 组件已卸载，中断上传队列处理')
        return
      }
      
      let item = uploadQueue.value[i]
      if (item.status === 'done' || item.status === 'error') continue

      try {
        uploadQueue.value[i] = { ...item, status: 'uploading', progress: 0 }
        item = uploadQueue.value[i]

        const uploadRes = await uploadFileApi(item.file, true, (progressEvent) => {
          if (progressEvent.total && !isUnmounted.value) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            if (!isUnmounted.value) {
              uploadQueue.value[i] = { ...uploadQueue.value[i], progress: pct }
            }
          }
        })

        if (isUnmounted.value) {
          console.log('[AssetsView] 组件已卸载，跳过入库处理')
          return
        }

        console.log('[AssetsView] 上传文件成功，响应:', uploadRes)
        const fileUrl = uploadRes.data.url

        uploadQueue.value[i] = { ...uploadQueue.value[i], status: 'creating' }
        item = uploadQueue.value[i]
        const mediaType = detectMediaType(item.file)
        const format = detectFormat(item.file)

        const mediaData = {
          media_type: mediaType,
          media_source: 'uploaded',
          media_name: item.file.name.replace(/\.[^.]+$/, '').slice(0, 255) || '未命名素材',
          media_url: fileUrl,
          file_size: item.file.size,
          format: format,
          mime_type: item.file.type || '',
        }

        if (mediaType === 'image') {
          mediaData.thumbnail_url = fileUrl
        }

        if (mediaType === 'video') {
          try {
            console.log('[AssetsView] 开始生成视频缩略图:', item.file.name)
            const { blob: thumbBlob, duration } = await generateVideoThumbnail(item.file)
            if (!isUnmounted.value) {
              const thumbFile = new File([thumbBlob], item.file.name.replace(/\.[^.]+$/, '') + '_thumb.jpg', { type: 'image/jpeg' })
              const thumbRes = await uploadFileApi(thumbFile, false)
              console.log('[AssetsView] 视频缩略图上传成功:', thumbRes.data.url)
              mediaData.thumbnail_url = thumbRes.data.url
              if (duration) {
                mediaData.duration = duration
              }
            }
          } catch (thumbErr) {
            console.warn('[AssetsView] 生成视频缩略图失败，跳过:', thumbErr.message || thumbErr)
          }
        }

        console.log('[AssetsView] 创建素材记录，数据:', mediaData)
        const createRes = await createMediaApi(mediaData)
        console.log('[AssetsView] 创建素材成功，响应:', createRes)

        if (isUnmounted.value) {
          console.log('[AssetsView] 组件已卸载，跳过成功状态更新')
          return
        }

        console.log('[AssetsView] ✅ 素材上传入库完成，media_id:', createRes.data.media_id)

        uploadQueue.value[i] = {
          ...item,
          status: 'done',
          progress: 100
        }
        successCount++
      } catch (err) {
        if (isUnmounted.value) {
          console.log('[AssetsView] 组件已卸载，跳过错误处理')
          return
        }
        
        console.error('[AssetsView] 单文件上传失败 - 详细错误:', {
          error: err,
          message: err.message,
          status: err.status,
          code: err.code,
          rawData: err.rawData,
          file: item.file.name
        })

        let errorMsg = '上传失败'
        if (err.status === 401) {
          errorMsg = '认证失败，请重新登录'
          console.error('[AssetsView] 401认证失败，可能是token过期或无效')
        } else if (err.status === 403) {
          errorMsg = '无权限上传'
          console.error('[AssetsView] 403权限不足')
        } else if (err.status === 422) {
          errorMsg = '文件格式不正确'
          console.error('[AssetsView] 422参数验证失败:', err.rawData)
        } else if (err.status === 500) {
          errorMsg = '服务器错误，请稍后重试'
          console.error('[AssetsView] 500服务器内部错误')
        } else if (err.code === 'NETWORK_ERROR') {
          errorMsg = '网络连接失败'
        } else if (err.code === 'TIMEOUT_ERROR') {
          errorMsg = '上传超时'
        } else if (err.message) {
          errorMsg = err.message
        }

        uploadQueue.value[i] = {
          ...item,
          status: 'error',
          error: errorMsg,
          progress: 100
        }
        console.log('[AssetsView] 已更新队列项状态为error, index=', i)
        failCount++
      }
    }

    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过结果提示')
      return
    }

    if (successCount > 0 && failCount === 0) {
      showToast(`成功上传 ${successCount} 个素材`, 'success')
      console.log('[AssetsView] 上传全部成功，重新加载数据')
      loadMediaList().catch(() => {})
      loadFolderStats().catch(() => {})
      setTimeout(() => {
        if (!isUnmounted.value && uploadQueue.value.length > 0 && uploadQueue.value.every(i => i.status === 'done')) {
          closeUploadModal()
        }
      }, 1500)
    } else if (successCount > 0 && failCount > 0) {
      showToast(`上传完成：${successCount} 成功，${failCount} 失败`, 'warning')
      console.log('[AssetsView] 部分上传成功，重新加载数据')
      loadMediaList().catch(() => {})
      loadFolderStats().catch(() => {})
    } else if (failCount > 0) {
      showToast(`上传失败 ${failCount} 个素材`, 'error')
    }
  } catch (outerErr) {
    if (isUnmounted.value) {
      console.log('[AssetsView] 组件已卸载，跳过外层错误处理')
      return
    }
    
    console.error('[AssetsView] 上传队列严重错误:', outerErr)
    showToast('上传过程发生错误', 'error')

    uploadQueue.value.forEach((item, idx) => {
      if (item.status === 'uploading' || item.status === 'creating' || item.status === 'pending') {
        uploadQueue.value[idx] = { ...item, status: 'error', error: '上传中断', progress: 100 }
        failCount++
      }
    })
  } finally {
    if (!isUnmounted.value) {
      console.log('[AssetsView] processUploadQueue 结束，isUploading=false')
      isUploading.value = false
    }
  }
}

function closeUploadModal() {
  uploadQueue.value = []
}

function handleOverlayClick() {
  if (isUploading.value) {
    console.log('[AssetsView] 上传中，不允许点击背景关闭')
    return
  }
  if (isUnmounted.value) return
  
  if (allCompleted.value) {
    console.log('[AssetsView] 点击背景关闭弹窗')
    closeUploadModal()
  }
}

function retryFailedUploads() {
  if (isUnmounted.value) return
  
  console.log('[AssetsView] 重试失败的上传项')

  uploadQueue.value = uploadQueue.value.map(item => {
    if (item.status === 'error') {
      return { ...item, status: 'pending', progress: 0, error: null }
    }
    return item
  })

  if (!isUploading.value && !isUnmounted.value) {
    processUploadQueue()
  }
}

onMounted(async () => {
  console.log('[AssetsView] 组件挂载，开始初始化')

  try {
    console.log('[AssetsView] 开始并行加载数据')
    await Promise.all([
      loadFolderStats(),
      loadMediaList()
    ])
    console.log('[AssetsView] 数据加载完成')
  } catch (error) {
    console.error('[AssetsView] 初始化失败:', error)
  }
})

onUnmounted(() => {
  console.log('[AssetsView] 组件卸载，设置 isUnmounted=true')
  isUnmounted.value = true
  showFilePreview.value = false
  toastVisible.value = false
  uploadQueue.value = []
  previewFile.value = null
})
</script>

<style scoped>
.assets-page {
  display: flex;
  flex-direction: column;
}

.assets-tab-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  gap: 16px;
}

.tabs-nav {
  display: flex;
  gap: 4px;
}

.asset-tab {
  padding: 9px 18px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}

.asset-tab:hover {
  color: #3b82f6;
}

.asset-tab.active {
  color: #3b82f6;
  font-weight: 700;
}

.asset-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2.5px;
  background: #3b82f6;
  border-radius: 2px;
}

.storage-info-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.storage-label-text {
  color: #9ca3af;
}

.storage-value-bold {
  font-weight: 700;
  color: #111827;
}

.upgrade-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.assets-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.folder-select {
  padding: 9px 32px 9px 14px;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 10px;
  font-size: 13px;
  color: #111827;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

.type-filter-group {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}

.type-filter-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-filter-btn:hover {
  color: #3b82f6;
}

.type-filter-btn.active {
  background: white;
  color: #3b82f6;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.upload-btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.upload-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-assets-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 10px;
}

.search-assets-input {
  border: none;
  outline: none;
  font-size: 13px;
  color: #111827;
  width: 140px;
  background: transparent;
}

.search-assets-input::placeholder {
  color: #d1d5db;
}

.view-toggle-group {
  display: flex;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 10px;
  overflow: hidden;
}

.view-toggle-btn {
  width: 38px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-toggle-btn + .view-toggle-btn {
  border-left: 1.5px solid rgba(229, 231, 235, 0.7);
}

.view-toggle-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.04);
}

.view-toggle-btn.active {
  background: rgba(59, 130, 246, 0.08);
  color: #3b82f6;
}

.folders-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.folder-card {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  padding: 20px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.folder-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.06);
  border-color: rgba(99, 102, 241, 0.25);
}

.folder-card.folder-selected {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
  box-shadow: 0 4px 12px -2px rgb(99 102 241 / 0.2);
}

.folder-card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.folder-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.folder-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.folder-card-count {
  font-size: 12px;
  color: #9ca3af;
}

.trash-folder .folder-card-icon {
  background: #fef2f2 !important;
  color: #ef4444 !important;
}

.recent-files-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 18px;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
}

.loading-text {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 30px;
}

.file-card {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.file-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.file-thumb {
  position: relative;
  aspect-ratio: 16/10;
  overflow: hidden;
}

.file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-thumb.img-error img {
  display: none;
}

.file-thumb.img-error::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,#e0e7ff,#c7d2fe);
}

.file-duration-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.72);
  color: white;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
}

/* 资产卡片右下角视频时长 */
.file-duration-corner {
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: rgba(99, 102, 241, 0.9);
  color: white;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}

.file-type-badge-video {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 26px;
  height: 26px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111827;
}

.video-play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.85;
}

.file-card:hover .video-play-overlay {
  opacity: 1;
}

.file-thumb-placeholder {
  aspect-ratio: 16/10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-image {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
}

.placeholder-image-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-video {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
}

.placeholder-video-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-first-frame {
  width: 100%;
  height: 100%;
  padding: 0;
  position: relative;
}

.video-first-frame video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
}

.file-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
  z-index: 5;
}

.file-card:hover .file-delete-btn {
  opacity: 1;
}

.file-delete-btn:hover {
  background: rgba(220, 38, 38, 1);
}

.placeholder-audio {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.placeholder-audio-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
}

.audio-duration-sm {
  position: absolute;
  bottom: -18px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 6px;
  border-radius: 4px;
}

.placeholder-template {
  background: #f8fafc;
  border: 1.5px dashed rgba(229, 231, 235, 0.7);
}

.placeholder-template-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.template-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 10px;
  font-weight: 700;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 8px;
  border-radius: 4px;
}

.placeholder-project {
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
}

.placeholder-project-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.file-upload {
  border-style: dashed;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.file-upload:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.03);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-text {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.file-info {
  padding: 12px 14px;
}

.file-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 2px;
}

.file-size {
  font-size: 11px;
  color: #9ca3af;
}

.file-model-id {
  font-size: 11px;
  color: #6366f1;
  margin-top: 2px;
  word-break: break-all;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 10px 0 20px;
  max-width: 100%;
  overflow-x: auto;
}

.page-btn {
  min-width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1.5px solid rgba(229, 231, 235, 0.7);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: #e5e7eb;
  color: #9ca3af;
}

.page-num.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-arrow {
  padding: 0 8px;
}

.page-dots {
  min-width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  letter-spacing: 1px;
  color: #9ca3af;
  user-select: none;
}

.hidden-file-input {
  display: none;
}

.upload-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}
</style>

<style>
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.upload-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.upload-modal-overlay.overlay-completed {
  pointer-events: none;
}

.upload-modal-overlay.overlay-completed .upload-modal {
  pointer-events: auto;
}

.upload-modal {
  background: white;
  border-radius: 16px;
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.upload-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.upload-modal-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.upload-modal-count {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
}

.upload-modal-body {
  padding: 12px 24px;
  overflow-y: auto;
  flex: 1;
}

.upload-queue-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.upload-queue-item:last-child {
  border-bottom: none;
}

.upload-queue-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.upload-queue-info {
  flex: 1;
  min-width: 0;
}

.upload-queue-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.upload-queue-status {
  font-size: 12px;
  margin-bottom: 4px;
}

.upload-queue-status .status-pending { color: #9ca3af; }
.upload-queue-status .status-uploading { color: #3b82f6; }
.upload-queue-status .status-done { color: #22c55e; font-weight: 600; }
.upload-queue-status .status-error { color: #ef4444; }

.upload-progress-bar {
  width: 100%;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.upload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.upload-queue-size {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
  margin-top: 2px;
}

.upload-modal-footer {
  padding: 14px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.upload-modal-hint {
  font-size: 13px;
  color: #9ca3af;
}

.upload-modal-close-btn {
  padding: 7px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-modal-close-btn:hover {
  background: #2563eb;
}

.upload-modal-retry-btn {
  padding: 7px 20px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 10px;
}

.upload-modal-retry-btn:hover {
  background: #d97706;
}

.global-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  z-index: 10000;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.15);
  background: white;
  color: #111827;
}

.global-toast.toast-success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.global-toast.toast-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.global-toast.toast-warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.global-toast.toast-info {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.file-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: #1a1a2e;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.file-preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: background 0.2s;
}

.file-preview-close:hover {
  background: rgba(239, 68, 68, 0.8);
}

.file-preview-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  max-height: 80vh;
  overflow: hidden;
}

.file-preview-image {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
}

.file-preview-video {
  max-width: 90vw;
  max-height: 80vh;
}

.file-preview-audio-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 60px 40px;
}

.file-preview-audio-icon {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-audio {
  width: 400px;
  max-width: 90vw;
}

.file-preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 40px;
  color: #9ca3af;
}

.file-preview-unsupported p {
  font-size: 14px;
  margin: 0;
}

.file-preview-info {
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.file-preview-name {
  color: white;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-meta {
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
}

.file-card {
  cursor: pointer;
}

.file-card.file-upload {
  cursor: pointer;
}

/* 文件操作按钮 */
.file-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 2;
}

.file-card:hover .file-actions {
  opacity: 1;
}

.file-edit-btn,
.file-download-btn,
.file-delete-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.file-edit-btn {
  background: rgba(99, 102, 241, 0.9);
  color: white;
}

.file-edit-btn:hover {
  background: #6366f1;
}

.file-download-btn {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.file-download-btn:hover {
  background: #3b82f6;
}

.file-delete-btn {
  background: rgba(239, 68, 68, 0.9);
  color: white;
}

.file-delete-btn:hover {
  background: #ef4444;
}

/* 删除按钮在卡片右下角 */
.file-delete-btn-bottom {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(239, 68, 68, 0.85);
  color: white;
  opacity: 0;
  transition: all 0.2s;
  z-index: 2;
}

.file-card:hover .file-delete-btn-bottom {
  opacity: 1;
}

.file-delete-btn-bottom:hover {
  background: #ef4444;
}

/* 预览弹窗操作按钮 */
.file-preview-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.file-preview-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background: rgba(99, 102, 241, 0.8);
  color: white;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.file-preview-action-btn:hover {
  background: #6366f1;
}

.file-preview-action-btn span {
  font-weight: 500;
}

/* 编辑弹窗 */
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  width: 420px;
  max-width: 90vw;
  overflow: hidden;
}

.edit-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-modal-header h3 {
  color: white;
  font-size: 16px;
  margin: 0;
}

.edit-modal-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-modal-close:hover {
  color: white;
}

.edit-modal-body {
  padding: 20px;
}

.edit-field {
  margin-bottom: 16px;
}

.edit-field label {
  display: block;
  color: #9ca3af;
  font-size: 13px;
  margin-bottom: 6px;
}

.edit-field input,
.edit-field textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.edit-field input:focus,
.edit-field textarea:focus {
  border-color: #6366f1;
}

.edit-tags-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.edit-tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 4px;
  color: #a5b4fc;
  font-size: 13px;
}

.edit-tag-remove {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.edit-tag-remove:hover {
  color: #ef4444;
}

.edit-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-cancel-btn,
.edit-save-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
}

.edit-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.edit-save-btn {
  background: #6366f1;
  color: white;
}

.edit-save-btn:hover {
  background: #4f46e5;
}

.edit-save-btn:disabled {
  background: rgba(99, 102, 241, 0.5);
  cursor: not-allowed;
}

/* 下载弹窗 */
.download-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
}

.download-modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  width: 450px;
  max-width: 90vw;
  overflow: hidden;
}

.download-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.download-modal-header h3 {
  color: white;
  font-size: 16px;
  margin: 0;
}

.download-modal-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.download-modal-close:hover {
  color: white;
}

.download-modal-body {
  padding: 20px;
}

.download-file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 16px;
}

.download-file-details {
  flex: 1;
}

.download-file-name {
  color: white;
  font-size: 14px;
  margin: 0 0 4px 0;
  font-weight: 600;
}

.download-file-size {
  color: #9ca3af;
  font-size: 12px;
  margin: 0;
}

.download-link-box {
  display: flex;
  gap: 8px;
}

.download-link-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: #9ca3af;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-copy-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #6366f1;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.download-copy-btn:hover {
  background: #4f46e5;
}

.download-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.download-cancel-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  transition: all 0.2s;
}

.download-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.download-direct-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  background: #3b82f6;
  color: white;
  transition: background 0.2s;
}

.download-direct-btn:hover {
  background: #2563eb;
}

/* 回收站弹窗 */
.recycle-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10003;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recycle-modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.recycle-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.recycle-modal-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-size: 16px;
  margin: 0;
}

.recycle-modal-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recycle-modal-close:hover {
  color: white;
}

.recycle-modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.recycle-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: #9ca3af;
}

.recycle-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 8px;
  color: #9ca3af;
}

.recycle-empty p {
  margin: 0;
  font-size: 14px;
}

.recycle-empty-tip {
  font-size: 12px;
  color: #6b7280;
}

.recycle-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recycle-item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.recycle-item-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recycle-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recycle-item-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recycle-item-info {
  flex: 1;
}

.recycle-item-name {
  color: white;
  font-size: 14px;
  margin: 0 0 4px 0;
  font-weight: 500;
}

.recycle-item-meta {
  color: #9ca3af;
  font-size: 12px;
  margin: 0 0 2px 0;
}

.recycle-item-expire {
  color: #f59e0b;
  font-size: 12px;
  margin: 0;
}

.recycle-item-actions {
  display: flex;
  gap: 8px;
}

.recycle-restore-btn,
.recycle-purge-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.recycle-restore-btn {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.recycle-restore-btn:hover {
  background: rgba(34, 197, 94, 0.3);
}

.recycle-purge-btn {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.recycle-purge-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.recycle-modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.recycle-close-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  transition: all 0.2s;
}

.recycle-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
