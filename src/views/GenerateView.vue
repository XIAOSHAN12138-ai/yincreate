<template>
  <AppLayout>
    <!-- AI生成页面主容器 - 即梦AI风格 -->
    <div class="generate-page-jimeng">
      <!-- 左侧对话历史侧边栏 -->
      <aside class="jimeng-left-sidebar">
        <!-- 顶部：开启创作 -->
        <div class="sidebar-header">
          <span class="sidebar-title">开启创作</span>
        </div>

        <!-- 新对话按钮 -->
        <button class="new-chat-btn" @click="startNewChat">
          <i data-lucide="plus-square" style="width: 16px; height: 16px;"></i>
          新对话
        </button>

        <!-- 最近对话列表 -->
        <div class="recent-section">
          <div class="recent-label">最近</div>
          <div class="conversation-list">
            <div
              v-for="conv in conversationHistory"
              :key="conv.id"
              :class="['conversation-item', { active: activeConversationId === conv.id, archived: conv.status === 'archived' }]"
              @click="selectConversation(conv.id)"
            >
              <div class="conv-thumb">
                <img
                  v-if="conv.thumbnail && inferTypeFromUrl(conv.thumbnail) === 'image'"
                  :src="conv.thumbnail"
                  alt=""
                  @error="handleThumbError($event)"
                />
                <video
                  v-else-if="conv.thumbnail && inferTypeFromUrl(conv.thumbnail) === 'video'"
                  :src="conv.thumbnail"
                  preload="metadata"
                  muted
                  playsinline
                  @loadeddata="onConvVideoFrameLoaded($event)"
                ></video>
                <div class="conv-thumb-placeholder">
                  <i data-lucide="image" style="width: 18px; height: 18px;"></i>
                </div>
              </div>
              <div class="conv-info">
                <!-- 重命名模式 -->
                <input
                  v-if="renamingId === conv.id"
                  ref="renameInputRef"
                  class="conv-title-input"
                  :value="conv.title"
                  @click.stop
                  @keyup.enter="confirmRename(conv.id, $event.target.value)"
                  @keyup.escape="cancelRename()"
                  @blur="confirmRename(conv.id, $event.target.value)"
                >
                <span v-else class="conv-title" @dblclick.stop="startRename(conv.id)" :title="conv.status === 'archived' ? '已归档' : ''">{{ conv.title }}</span>
                <span class="conv-meta">{{ (conv.generation_count ?? conv.cards?.length) || 0 }} 次生成 · {{ formatConvTime(conv.time) }}</span>
              </div>
              <span v-if="conv.status === 'archived'" class="conv-status-badge">已归档</span>
              <div class="conv-actions" v-if="conv.status !== 'archived' && renamingId !== conv.id">
                <button class="conv-rename-btn" @click.stop="startRename(conv.id)" title="重命名">
                  <i data-lucide="pencil" style="width: 12px; height: 12px;"></i>
                </button>
                <button class="conv-delete-btn" @click.stop="deleteConversation(conv.id)" title="归档对话">
                  <i data-lucide="archive" style="width: 12px; height: 12px;"></i>
                </button>
              </div>
            </div>
            <div v-if="conversationHistory.length === 0" class="no-conversations">
              暂无历史对话
            </div>
            <div v-if="conversationsCapped" class="conv-capped-notice" title="本轮已加载前 500 条，更早的对话需另行加载">
              <i data-lucide="info" style="width: 12px; height: 12px;"></i>
              <span>还有更多对话，本轮已截断</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 主内容区域 -->
      <main class="jimeng-main-area">
        <!-- ====== 未交互状态：欢迎页 ====== -->
        <div v-if="!hasInteracted" class="jimeng-welcome">
          <h1 class="welcome-title">你好，想创作什么？</h1>

          <!-- 输入卡片 -->
          <div class="input-card">
            <!-- 输入区：上传 + 文字输入 -->
            <div class="input-card-body">
              <!-- 左侧上传区域（+号触发下拉菜单，双上传框时隐藏） -->
              <div v-if="!isDualUploadFeature" class="upload-dropdown" :class="{ open: isUploadDropdownOpen }">
                <div class="upload-zone" @click.stop="toggleUploadDropdown" title="上传素材">
                  <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
                </div>
                <div v-if="isUploadDropdownOpen" class="upload-menu" @click.stop>
                  <div class="upload-menu-section">
                    <div class="upload-section-title">本地上传</div>
                    <button class="upload-option" @click="handleUploadType('image')">
                      <i data-lucide="image-plus" style="width: 16px; height: 16px;"></i>
                      上传图片
                    </button>
                    <button class="upload-option" @click="handleUploadType('video')">
                      <i data-lucide="video-plus" style="width: 16px; height: 16px;"></i>
                      上传视频
                    </button>
                    <button class="upload-option" @click="handleUploadType('audio')">
                      <i data-lucide="music-plus" style="width: 16px; height: 16px;"></i>
                      上传音频
                    </button>
                  </div>
                  <div class="upload-menu-divider"></div>
                  <div class="upload-menu-section">
                    <button class="upload-option" @click="handleUploadFromCloud()">
                      <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                      从云资料库选择
                    </button>
                  </div>
                </div>
              </div>

              <!-- 中间文字输入区 -->
              <div class="prompt-editor-wrapper" ref="editorWrapperRef">
                <div
                  class="prompt-input"
                  contenteditable="true"
                  :placeholder="promptPlaceholder"
                  @input="onPromptInput"
                  @keydown="onPromptKeydown"
                  ref="promptEditorRef"
                ></div>

                <!-- @提及下拉列表 -->
                <Teleport to="body">
                  <div
                    v-if="showAtMentionDropdown"
                    class="at-mention-dropdown"
                    :style="mentionDropdownStyle"
                    @mousedown.prevent
                  >
                    <div class="at-mention-header">选择要引用的素材</div>
                    <div class="at-mention-list">
                      <div
                        v-for="(file, idx) in atMentionCandidates"
                        :key="'cand-' + idx"
                        :class="['at-mention-item', { active: activeMentionIndex === idx }]"
                        @click="selectAtMention(file)"
                        @mouseenter="activeMentionIndex = idx"
                      >
                        <div class="mention-thumb-wrap">
                          <img
                            v-if="file.type === 'image'"
                            :src="convertBase64ToBlobUrl(file.url)"
                            class="mention-thumb"
                          />
                          <video
                            v-else-if="file.type === 'video'"
                            :src="file.url"
                            class="mention-thumb"
                            muted
                          />
                          <div v-else class="mention-thumb audio-thumb">
                            <i data-lucide="music" style="width: 16px; height: 16px;"></i>
                          </div>
                          <span :class="['mention-type-icon', file.type]">
                            {{ file.type === 'video' ? '▶' : (file.type === 'audio' ? '🎵' : '🖼') }}
                          </span>
                        </div>
                        <div class="mention-info">
                          <span class="mention-name">{{ file.name || (file.type === 'video' ? '视频' : (file.type === 'audio' ? '音频' : '图片')) }}</span>
                          <span class="mention-type-label">{{ getFileTypeLabel(file.type) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="atMentionCandidates.length === 0" class="at-mention-empty">
                      暂无可引用素材，请先上传图片、视频或音频
                    </div>
                  </div>
                </Teleport>
              </div>
            </div>

            <!-- 双上传框（首尾帧/主体+参考图） -->
            <div v-if="isDualUploadFeature && dualUploadConfig" class="dual-upload-bar">
              <div class="dual-upload-slot-wrap">
                <div class="dual-upload-slot" @click.stop="dualUploadDropdown = dualUploadDropdown === 'slot1' ? null : 'slot1'">
                  <template v-if="dualUploadSlots.slot1">
                    <img v-if="dualUploadSlots.slot1.type === 'image'" :src="convertBase64ToBlobUrl(dualUploadSlots.slot1.url)" class="dual-upload-preview" />
                    <video v-else-if="dualUploadSlots.slot1.type === 'video'" :src="dualUploadSlots.slot1.url" class="dual-upload-preview" muted />
                    <button class="dual-upload-remove" @click.stop="removeDualUpload('slot1')" title="删除">
                      <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                    <div class="dual-upload-badge">{{ dualUploadConfig.slot1.label }}</div>
                  </template>
                  <template v-else>
                    <i :data-lucide="dualUploadConfig.slot1.accept.includes('video') ? 'video' : 'image-plus'" style="width: 20px; height: 20px; color: #9ca3af;"></i>
                    <span class="dual-upload-placeholder">{{ dualUploadConfig.slot1.label }}</span>
                  </template>
                </div>
                <div v-if="dualUploadDropdown === 'slot1'" class="dual-upload-menu" @click.stop>
                  <button class="upload-option" @click="handleDualUpload('slot1', dualUploadConfig.slot1.accept)">
                    <i data-lucide="upload" style="width: 16px; height: 16px;"></i>
                    本地上传
                  </button>
                  <div class="upload-menu-divider"></div>
                  <button class="upload-option" @click="handleDualUploadFromCloud('slot1')">
                    <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                    从云资料库选择
                  </button>
                </div>
              </div>
              <div class="dual-upload-slot-wrap">
                <div class="dual-upload-slot" @click.stop="dualUploadDropdown = dualUploadDropdown === 'slot2' ? null : 'slot2'">
                  <template v-if="dualUploadSlots.slot2">
                    <img v-if="dualUploadSlots.slot2.type === 'image'" :src="convertBase64ToBlobUrl(dualUploadSlots.slot2.url)" class="dual-upload-preview" />
                    <video v-else-if="dualUploadSlots.slot2.type === 'video'" :src="dualUploadSlots.slot2.url" class="dual-upload-preview" muted />
                    <button class="dual-upload-remove" @click.stop="removeDualUpload('slot2')" title="删除">
                      <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                    <div class="dual-upload-badge">{{ dualUploadConfig.slot2.label }}</div>
                  </template>
                  <template v-else>
                    <i :data-lucide="dualUploadConfig.slot2.accept.includes('video') ? 'video' : (dualUploadConfig.slot2.accept.includes('audio') ? 'music' : 'image-plus')" style="width: 20px; height: 20px; color: #9ca3af;"></i>
                    <span class="dual-upload-placeholder">{{ dualUploadConfig.slot2.label }}</span>
                  </template>
                </div>
                <div v-if="dualUploadDropdown === 'slot2'" class="dual-upload-menu" @click.stop>
                  <button class="upload-option" @click="handleDualUpload('slot2', dualUploadConfig.slot2.accept)">
                    <i data-lucide="upload" style="width: 16px; height: 16px;"></i>
                    本地上传
                  </button>
                  <div class="upload-menu-divider"></div>
                  <button class="upload-option" @click="handleDualUploadFromCloud('slot2')">
                    <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                    从云资料库选择
                  </button>
                </div>
              </div>
            </div>

            <!-- 媒体素材栏（双上传框模式下隐藏） -->
            <div v-if="!isDualUploadFeature && (uploadedFiles.length > 0 || referencedFiles.length > 0)" class="media-bar">
              <div v-if="uploadedFiles.length > 0" class="media-section">
                <div class="section-label">
                  <i data-lucide="upload" style="width: 13px; height: 13px;"></i>
                  上传素材
                  <span class="section-count">{{ uploadedFiles.length }}</span>
                </div>
                <div class="media-items-row">
                  <div
                    v-for="(file, index) in uploadedFiles"
                    :key="file.object_id || ('up-' + index)"
                    class="media-item draggable-item"
                    :class="[`type-${file.type}`]"
                    draggable="true"
                    @dragstart="onDragStart(file, index, 'upload')"
                    @dragend="onDragEnd"
                    @click.stop="clickToReference(file)"
                  >
                    <img
                      v-if="file.type === 'image'"
                      :src="convertBase64ToBlobUrl(file.url)"
                      :alt="file.name"
                      class="preview-thumb"
                    />
                    <video
                      v-else-if="file.type === 'video'"
                      :src="file.url"
                      class="preview-thumb"
                      muted
                    />
                    <div v-else-if="file.type === 'audio'" class="audio-preview">
                      <i data-lucide="music" style="width: 18px; height: 18px;"></i>
                      <span>{{ file.name }}</span>
                    </div>
                    <button class="remove-file-btn" @click.stop="removeUploadedFile(index)" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button
                      v-if="file.type === 'image' || file.type === 'video'"
                      class="preview-icon-btn"
                      @click.stop="openFilePreview(file)"
                      title="放大查看"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </button>
                    <div class="file-type-badge">{{ getFileTypeLabel(file.type) }}</div>
                    <div class="drag-hint-overlay">
                      <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                      点击引用
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="uploadedFiles.length > 0 && referencedFiles.length > 0"
                class="media-bar-divider"
              ></div>
              <div v-if="referencedFiles.length > 0" class="media-section ref-section">
                <div class="section-label">
                  <i data-lucide="at-sign" style="width: 13px; height: 13px;"></i>
                  @ 引用素材
                  <span class="section-count">{{ referencedFiles.length }}</span>
                </div>
                <div class="media-items-row">
                  <div
                    v-for="refFile in referencedFiles"
                    :key="'ref-' + refFile.atId"
                    class="media-item ref-item"
                    :class="[`type-${refFile.type}`, { active: activeAtTagId === refFile.atId }]"
                    @click="focusAtTagById(refFile.atId)"
                  >
                    <img
                      v-if="refFile.type === 'image'"
                      :src="convertBase64ToBlobUrl(refFile.url)"
                      :alt="refFile.name"
                      class="preview-thumb"
                    />
                    <video
                      v-else-if="refFile.type === 'video'"
                      :src="refFile.url"
                      class="preview-thumb"
                      muted
                    />
                    <div v-else-if="refFile.type === 'audio'" class="audio-preview ref-audio-preview">
                      <i data-lucide="music" style="width: 16px; height: 16px;"></i>
                    </div>
                    <div class="ref-at-badge">@{{ refFile.atLabel }}</div>
                    <button class="remove-ref-btn" @click.stop="removeReferencedFile(refFile.atId)" title="取消引用">
                      <i data-lucide="x" style="width: 11px; height: 11px;"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="input-card-footer">
              <!-- 左侧：生成类型 + 模型 + 参数选项 -->
              <div class="footer-options">
                <!-- 生成类型选择器 -->
                <div
                  class="option-chip type-chip"
                  :class="{ open: isTypeDropdownOpen }"
                  @click="toggleTypeDropdown"
                  ref="typeTriggerRef"
                >
                  <i :data-lucide="selectedTypeIcon" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedTypeLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isTypeDropdownOpen"
                      class="select-dropdown type-dropdown-menu"
                      :style="typeDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="type in generateTypes"
                        :key="type.id"
                        :class="['select-option', { active: selectedType === type.id }]"
                        @click.stop="selectType(type)"
                      >
                        <i :data-lucide="type.icon" style="width: 16px; height: 16px; margin-right: 8px;"></i>
                        {{ type.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 模型选择器 -->
                <div
                  class="option-chip model-chip"
                  :class="{ open: isModelDropdownOpen }"
                  @click="toggleModelDropdown"
                  ref="modelTriggerRef"
                >
                  <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedModelName }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div v-if="isModelDropdownOpen" class="select-dropdown model-dropdown-menu" :style="modelDropdownPos" @click.stop>
                      <div
                        v-for="model in models"
                        :key="model.id"
                        :class="['select-option', { active: selectedModel === model.id }, { 'default-model-option': model.is_default }]"
                        @click.stop="selectModel(model)"
                      >
                        <div class="model-option-main">
                          <span class="model-name">
                            {{ model.name }}
                            <span v-if="model.is_default" class="default-badge">推荐</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 特色功能选择器 -->
                <div
                  class="option-chip feature-chip"
                  :class="{ open: isFeatureDropdownOpen }"
                  @click="toggleFeatureDropdown"
                  ref="featureTriggerRef"
                >
                  <i data-lucide="wand-2" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedFeatureLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isFeatureDropdownOpen"
                      class="select-dropdown feature-dropdown-menu"
                      :style="featureDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="feature in currentFeatures"
                        :key="feature.id"
                        :class="['select-option', { active: selectedFeature === feature.id }]"
                        @click.stop="selectFeature(feature)"
                      >
                        {{ feature.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 画面比例 -->
                <div
                  class="option-chip ratio-chip"
                  :class="{ open: isRatioDropdownOpen }"
                  @click="toggleRatioDropdown"
                  ref="ratioTriggerRef"
                >
                  <i data-lucide="crop" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedRatio }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isRatioDropdownOpen"
                      class="select-dropdown ratio-dropdown-menu"
                      :style="ratioDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="ratio in availableAspectRatios"
                        :key="ratio"
                        :class="['select-option', { active: selectedRatio === ratio }]"
                        @click.stop="selectRatio(ratio)"
                      >
                        {{ ratio }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 视频时长（仅视频模式） -->
                <div
                  v-if="selectedType === 'video'"
                  class="option-chip duration-chip"
                  :class="{ open: isDurationDropdownOpen }"
                  @click="toggleDurationDropdown"
                  ref="durationTriggerRef"
                >
                  <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                  <span>{{ videoDuration }}s</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isDurationDropdownOpen"
                      class="select-dropdown duration-dropdown-menu"
                      :style="durationDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="dur in videoDurationOptions"
                        :key="dur"
                        :class="['select-option', { active: videoDuration === dur }]"
                        @click="selectDuration(dur)"
                      >
                        {{ dur }} 秒
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 画质 -->
                <div
                  class="option-chip quality-chip"
                  :class="{ open: isQualityDropdownOpen }"
                  @click="toggleQualityDropdown"
                  ref="qualityTriggerRef"
                >
                  <span>{{ selectedQualityLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isQualityDropdownOpen"
                      class="select-dropdown quality-dropdown-menu"
                      :style="qualityDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="quality in availableQualities"
                        :key="quality.id"
                        :class="['select-option', { active: selectedQuality === quality.id }]"
                        @click.stop="selectQuality(quality)"
                      >
                        {{ quality.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 声音开关（视频生成时显示） -->
                <button
                  v-if="showSoundToggle"
                  :class="['option-chip sound-chip', { active: videoSoundEnabled, disabled: soundToggleDisabled }]"
                  :disabled="soundToggleDisabled"
                  @click="handleSoundToggle"
                  :title="soundToggleDisabled ? (videoSoundEnabled ? '当前模型仅支持有声' : '当前模型仅支持无声') : (videoSoundEnabled ? '点击关闭声音' : '点击开启声音')"
                >
                  <!-- 有声图标 -->
                  <svg v-if="videoSoundEnabled" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  <!-- 无声图标 -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  <span class="sound-label">{{ videoSoundEnabled ? '有声' : '无声' }}</span>
                </button>

                <!-- 图片生成高级参数（图片生成时显示） -->
                <!-- 生成数量 -->
                <div
                  v-if="showImageAdvancedParams"
                  class="option-chip count-chip"
                  :class="{ open: isImageCountDropdownOpen }"
                  @click="toggleImageCountDropdown"
                  ref="imageCountTriggerRef"
                >
                  <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageCount }}张</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageCountDropdownOpen"
                      class="select-dropdown count-dropdown-menu"
                      :style="imageCountDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="cnt in imageCountOptions"
                        :key="cnt"
                        :class="['select-option', { active: imageCount === cnt }]"
                        @click.stop="selectImageCount(cnt)"
                      >
                        {{ cnt }} 张
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 输出格式（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip format-chip"
                  :class="{ open: isImageFormatDropdownOpen }"
                  @click="toggleImageFormatDropdown"
                  ref="imageFormatTriggerRef"
                >
                  <i data-lucide="file-image" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageOutputFormat.toUpperCase() }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageFormatDropdownOpen"
                      class="select-dropdown format-dropdown-menu"
                      :style="imageFormatDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="fmt in imageOutputFormatOptions"
                        :key="fmt.id"
                        :class="['select-option', { active: imageOutputFormat === fmt.id }]"
                        @click.stop="selectImageFormat(fmt)"
                      >
                        {{ fmt.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 输出质量（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip img-quality-chip"
                  :class="{ open: isImageQualityDropdownOpen }"
                  @click="toggleImageQualityDropdown"
                  ref="imageQualityTriggerRef"
                >
                  <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageOutputQualityOptions.find(q => q.id === imageOutputQuality)?.label || '自动' }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageQualityDropdownOpen"
                      class="select-dropdown img-quality-dropdown-menu"
                      :style="imageQualityDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="q in imageOutputQualityOptions"
                        :key="q.id"
                        :class="['select-option', { active: imageOutputQuality === q.id }]"
                        @click.stop="selectImageOutputQuality(q)"
                      >
                        {{ q.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 背景设置（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip background-chip"
                  :class="{ open: isImageBackgroundDropdownOpen }"
                  @click="toggleImageBackgroundDropdown"
                  ref="imageBackgroundTriggerRef"
                >
                  <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageBackgroundOptions.find(b => b.id === imageBackground)?.label || '自动' }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageBackgroundDropdownOpen"
                      class="select-dropdown background-dropdown-menu"
                      :style="imageBackgroundDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="bg in imageBackgroundOptions"
                        :key="bg.id"
                        :class="['select-option', { active: imageBackground === bg.id }]"
                        @click.stop="selectImageBackground(bg)"
                      >
                        {{ bg.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 水印开关（千问/万象模型） -->
                <button
                  v-if="showImageAdvancedParams && isQwenWanModel"
                  :class="['option-chip watermark-chip', { active: imageWatermark }]"
                  @click="toggleImageWatermark"
                  :title="imageWatermark ? '点击关闭水印' : '点击开启水印'"
                >
                  <i data-lucide="droplet" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageWatermark ? '水印' : '无水印' }}</span>
                </button>
              </div>

              <!-- 右侧：积分消耗 + 字数 + 发送 -->
              <div class="footer-right">
                <span v-if="estimatedPrice" class="price-estimate-mini" :class="{ loading: estimatingPrice, 'price-insufficient': isInsufficientCredits }">
                  <i data-lucide="coins" style="width: 12px; height: 12px;"></i>
                  约 {{ estimatedPrice.estimated_cost }} 积分
                </span>
                <span v-else-if="estimatingPrice" class="price-estimate-mini loading">计算中...</span>
                <span class="char-count-mini">{{ prompt.length }} / 2000</span>
                <button
                  class="send-btn"
                  :disabled="!canGenerate || isGenerating"
                  @click="handleGenerate"
                >
                  <i data-lucide="arrow-up" style="width: 18px; height: 18px;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ====== 已交互状态：结果展示 + 输入框 ====== -->
        <div v-else class="jimeng-interaction">
          <!-- 结果展示区域 -->
          <div class="results-area" ref="canvasContainer" @scroll="onResultsScroll">
            <!-- 向上滚动加载更多指示器 -->
            <div v-if="currentConv && currentConv.messagesLoading" class="messages-load-more-top">
              <i data-lucide="loader-2" style="width: 14px; height: 14px;"></i>
              <span>加载中...</span>
            </div>
            <div v-else-if="currentConv && currentConv.messagesHasMore" class="messages-load-more-hint">
              <span>向上滚动加载更多</span>
            </div>
            <div v-else-if="currentConv && currentConv.messagesCapped" class="messages-load-more-hint" title="本轮已加载前 500 条消息，更早的消息需另行加载">
              <i data-lucide="info" style="width: 12px; height: 12px;"></i>
              <span>还有更多消息，本轮已截断</span>
            </div>
            <!-- 已生成的结果卡片（历史对话） -->
            <div v-for="card in generatedCards" :key="card.id" class="result-card-group" :id="'card-' + card.id">
              <!-- 每张卡片内的信息栏 -->
              <div class="card-topbar">
                <!-- 缩略图区域 -->
                <div v-if="card.uploadedInputFiles && card.uploadedInputFiles.length > 0" class="card-thumb-strip">
                  <div v-for="(file, fi) in card.uploadedInputFiles" :key="fi" class="card-thumb-item">
                    <button
                      v-if="file.type === 'image'"
                      class="card-thumb-preview-btn"
                      type="button"
                      :aria-label="`放大预览上传图片 ${fi + 1}`"
                      title="放大预览"
                      @click="openFilePreview(file)"
                    >
                      <img :src="convertBase64ToBlobUrl(file.url)" :alt="file.name || `上传图片 ${fi + 1}`" class="card-thumb-img" />
                      <span class="card-thumb-zoom-icon" aria-hidden="true">
                        <i data-lucide="maximize-2" style="width: 12px; height: 12px;"></i>
                      </span>
                    </button>
                    <button
                      v-else-if="file.type === 'video'"
                      class="card-thumb-preview-btn card-thumb-video"
                      type="button"
                      :aria-label="`播放上传视频 ${fi + 1}`"
                      title="播放视频"
                      @click="openFilePreview(file)"
                    >
                      <video
                        :src="file.url"
                        :poster="file.thumbnail || file.thumbnail_url || file.cover_url || ''"
                        class="card-thumb-img"
                        preload="metadata"
                        muted
                        playsinline
                        @loadeddata="onConvVideoFrameLoaded($event)"
                      ></video>
                      <span class="card-thumb-zoom-icon" aria-hidden="true">
                        <i data-lucide="play" style="width: 13px; height: 13px;"></i>
                      </span>
                    </button>
                    <button
                      v-else
                      class="card-thumb-preview-btn card-thumb-file"
                      type="button"
                      :aria-label="`播放上传音频 ${fi + 1}`"
                      title="播放音频"
                      @click="openFilePreview(file)"
                    >
                      <i data-lucide="music" style="width: 14px; height: 14px;"></i>
                      <span class="card-thumb-zoom-icon" aria-hidden="true">
                        <i data-lucide="play" style="width: 13px; height: 13px;"></i>
                      </span>
                    </button>
                  </div>
                </div>
                <div class="topbar-context" @click="togglePromptExpand(card.id)" :class="{ 'is-expanded': expandedCardIds[card.id] }">
                  <span class="context-prompt" :class="{ 'is-truncated': !expandedCardIds[card.id] }">{{ card.prompt || '新对话' }}</span>
                  <button v-if="card.prompt && card.prompt.length > 50" class="context-expand-btn" @click.stop="togglePromptExpand(card.id)">
                    <i :data-lucide="expandedCardIds[card.id] ? 'chevron-up' : 'chevron-down'" style="width: 14px; height: 14px;"></i>
                  </button>
                  <span class="context-sep">|</span>
                  <span class="context-model">{{ getModelNameById(card.model) }}</span>
                  <span class="context-sep">|</span>
                  <span class="context-feature">{{ getFeatureLabelByCard(card) }}</span>
                  <span class="context-sep">|</span>
                  <span class="context-ratio">{{ card.ratio || '16:9' }}</span>
                  <template v-if="card.type === 'video' && card.duration">
                    <span class="context-sep">|</span>
                    <span class="context-duration">{{ card.duration }}s</span>
                  </template>
                  <span class="context-sep">|</span>
                  <span class="context-quality">{{ getQualityLabelByCard(card) }}</span>
                  <template v-if="card.createdAt">
                    <span class="context-sep">|</span>
                    <span class="context-time">{{ formatCardTime(card.createdAt) }}</span>
                  </template>
                </div>
              </div>

              <!-- 图片/视频结果网格 -->
              <div v-if="card.results && card.results.length > 0" class="result-grid">
                <div v-for="(result, idx) in card.results" :key="idx" class="result-grid-item">
                  <div class="result-media-wrap">
                    <img
                      v-if="result.type === 'image'"
                      :src="convertBase64ToBlobUrl(result.url)"
                      :alt="'生成图片 ' + (idx + 1)"
                      class="result-img"
                    />
                    <video
                      v-else-if="result.type === 'video' && !card.loadingVideo"
                      :src="result.displayUrl || result.url"
                      controls
                      class="result-video"
                      @loadeddata="onVideoLoaded(card)"
                    ></video>
                    <div v-else-if="result.type === 'video' && card.loadingVideo" class="video-loading-overlay">
                      <div class="spinner-small"></div>
                    </div>
                    <!-- 悬浮操作按钮 -->
                    <div class="result-hover-actions">
                      <button class="result-action-btn" @click="previewResult(result)" title="放大预览">
                        <i data-lucide="maximize-2" style="width: 14px; height: 14px;"></i>
                      </button>
                      <button class="result-action-btn" @click="downloadResult(result, idx)" title="下载">
                        <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                      </button>
                      <button class="result-action-btn" @click="useAsInput(result)" title="作为输入">
                        <i data-lucide="repeat" style="width: 14px; height: 14px;"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="card.status === 'failed'" class="card-placeholder-inline card-failed">
                <i data-lucide="alert-circle" style="width: 24px; height: 24px;"></i>
                <span>生成失败</span>
                <button class="retry-btn" @click="regenerateFromCard(card)">重试</button>
              </div>
              <div v-else class="card-placeholder-inline">
                <i data-lucide="loader" style="width: 24px; height: 24px;"></i>
                <span>{{ card.progress && card.progress > 0 ? `生成中... (${card.progress}%)` : '生成中...' }}</span>
              </div>

              <!-- 操作按钮行 -->
              <div class="result-actions-row">
                <button class="result-action-chip" @click="editPrompt(card)">
                  <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                  重新编辑
                </button>
                <button class="result-action-chip" @click="regenerateFromCard(card)">
                  <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
                  再次生成
                </button>
                <div class="result-feedback-group">
                  <button class="result-feedback-btn" :class="{ active: card.feedback === 'like' }" @click="toggleFeedback(card, 'like')" title="赞">
                    <i data-lucide="thumbs-up" style="width: 14px; height: 14px;"></i>
                  </button>
                  <button class="result-feedback-btn" :class="{ active: card.feedback === 'dislike' }" @click="toggleFeedback(card, 'dislike')" title="踩">
                    <i data-lucide="thumbs-down" style="width: 14px; height: 14px;"></i>
                  </button>
                </div>
                <button class="result-action-chip more-btn">
                  <i data-lucide="more-horizontal" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-if="generatedCards.length === 0 && !isGenerating" class="results-empty">
              <i data-lucide="image" style="width: 48px; height: 48px; color: #d1d5db;"></i>
              <p>暂无生成结果</p>
            </div>
          </div>

          <!-- 底部输入卡片（与欢迎态复用相同结构） -->
          <div class="input-card input-card-bottom">
            <div class="input-card-body">
              <div v-if="!isDualUploadFeature" class="upload-dropdown" :class="{ open: isUploadDropdownOpen }">
                <div class="upload-zone" @click.stop="toggleUploadDropdown" title="上传素材">
                  <i data-lucide="plus" style="width: 24px; height: 24px;"></i>
                </div>
                <div v-if="isUploadDropdownOpen" class="upload-menu" @click.stop>
                  <div class="upload-menu-section">
                    <div class="upload-section-title">本地上传</div>
                    <button class="upload-option" @click="handleUploadType('image')">
                      <i data-lucide="image-plus" style="width: 16px; height: 16px;"></i>
                      上传图片
                    </button>
                    <button class="upload-option" @click="handleUploadType('video')">
                      <i data-lucide="video-plus" style="width: 16px; height: 16px;"></i>
                      上传视频
                    </button>
                    <button class="upload-option" @click="handleUploadType('audio')">
                      <i data-lucide="music-plus" style="width: 16px; height: 16px;"></i>
                      上传音频
                    </button>
                  </div>
                  <div class="upload-menu-divider"></div>
                  <div class="upload-menu-section">
                    <button class="upload-option" @click="handleUploadFromCloud()">
                      <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                      从云资料库选择
                    </button>
                  </div>
                </div>
              </div>
              <div class="prompt-editor-wrapper" ref="editorWrapperRefBottom">
                <!-- 达到最大对话次数提示 -->
                <div v-if="hasReachedMaxRounds" class="max-rounds-notice">
                  <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
                  <span>当前对话已达最大次数（{{ MAX_CONVERSATION_ROUNDS }}次），无法继续输入</span>
                  <button class="max-rounds-new-btn" @click="startNewChat">
                    <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                    新建对话
                  </button>
                </div>
                <div
                  class="prompt-input"
                  :contenteditable="!hasReachedMaxRounds"
                  :class="{ 'is-disabled': hasReachedMaxRounds }"
                  :placeholder="promptPlaceholder"
                  @input="onPromptInput"
                  @keydown="onPromptKeydown"
                  ref="promptEditorRefBottom"
                ></div>
                <!-- @提及下拉列表（底部输入卡片） -->
                <Teleport to="body">
                  <div
                    v-if="showAtMentionDropdown"
                    class="at-mention-dropdown"
                    :style="mentionDropdownStyle"
                    @mousedown.prevent
                  >
                    <div class="at-mention-header">选择要引用的素材</div>
                    <div class="at-mention-list">
                      <div
                        v-for="(file, idx) in atMentionCandidates"
                        :key="'candb-' + idx"
                        :class="['at-mention-item', { active: activeMentionIndex === idx }]"
                        @click="selectAtMention(file)"
                        @mouseenter="activeMentionIndex = idx"
                      >
                        <div class="mention-thumb-wrap">
                          <img
                            v-if="file.type === 'image'"
                            :src="convertBase64ToBlobUrl(file.url)"
                            class="mention-thumb"
                          />
                          <video
                            v-else-if="file.type === 'video'"
                            :src="file.url"
                            class="mention-thumb"
                            muted
                          />
                          <div v-else class="mention-thumb audio-thumb">
                            <i data-lucide="music" style="width: 16px; height: 16px;"></i>
                          </div>
                          <span :class="['mention-type-icon', file.type]">
                            {{ file.type === 'video' ? '▶' : (file.type === 'audio' ? '🎵' : '🖼') }}
                          </span>
                        </div>
                        <div class="mention-info">
                          <span class="mention-name">{{ file.name || (file.type === 'video' ? '视频' : (file.type === 'audio' ? '音频' : '图片')) }}</span>
                          <span class="mention-type-label">{{ getFileTypeLabel(file.type) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="atMentionCandidates.length === 0" class="at-mention-empty">
                      暂无可引用素材，请先上传图片、视频或音频
                    </div>
                  </div>
                </Teleport>
              </div>
            </div>

            <!-- 双上传框（首尾帧/主体+参考图） -->
            <div v-if="isDualUploadFeature && dualUploadConfig" class="dual-upload-bar">
              <div class="dual-upload-slot-wrap">
                <div class="dual-upload-slot" @click.stop="dualUploadDropdown = dualUploadDropdown === 'slot1' ? null : 'slot1'">
                  <template v-if="dualUploadSlots.slot1">
                    <img v-if="dualUploadSlots.slot1.type === 'image'" :src="convertBase64ToBlobUrl(dualUploadSlots.slot1.url)" class="dual-upload-preview" />
                    <video v-else-if="dualUploadSlots.slot1.type === 'video'" :src="dualUploadSlots.slot1.url" class="dual-upload-preview" muted />
                    <button class="dual-upload-remove" @click.stop="removeDualUpload('slot1')" title="删除">
                      <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                    <div class="dual-upload-badge">{{ dualUploadConfig.slot1.label }}</div>
                  </template>
                  <template v-else>
                    <i :data-lucide="dualUploadConfig.slot1.accept.includes('video') ? 'video' : 'image-plus'" style="width: 20px; height: 20px; color: #9ca3af;"></i>
                    <span class="dual-upload-placeholder">{{ dualUploadConfig.slot1.label }}</span>
                  </template>
                </div>
                <div v-if="dualUploadDropdown === 'slot1'" class="dual-upload-menu" @click.stop>
                  <button class="upload-option" @click="handleDualUpload('slot1', dualUploadConfig.slot1.accept)">
                    <i data-lucide="upload" style="width: 16px; height: 16px;"></i>
                    本地上传
                  </button>
                  <div class="upload-menu-divider"></div>
                  <button class="upload-option" @click="handleDualUploadFromCloud('slot1')">
                    <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                    从云资料库选择
                  </button>
                </div>
              </div>
              <div class="dual-upload-slot-wrap">
                <div class="dual-upload-slot" @click.stop="dualUploadDropdown = dualUploadDropdown === 'slot2' ? null : 'slot2'">
                  <template v-if="dualUploadSlots.slot2">
                    <img v-if="dualUploadSlots.slot2.type === 'image'" :src="convertBase64ToBlobUrl(dualUploadSlots.slot2.url)" class="dual-upload-preview" />
                    <video v-else-if="dualUploadSlots.slot2.type === 'video'" :src="dualUploadSlots.slot2.url" class="dual-upload-preview" muted />
                    <button class="dual-upload-remove" @click.stop="removeDualUpload('slot2')" title="删除">
                      <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                    <div class="dual-upload-badge">{{ dualUploadConfig.slot2.label }}</div>
                  </template>
                  <template v-else>
                    <i :data-lucide="dualUploadConfig.slot2.accept.includes('video') ? 'video' : (dualUploadConfig.slot2.accept.includes('audio') ? 'music' : 'image-plus')" style="width: 20px; height: 20px; color: #9ca3af;"></i>
                    <span class="dual-upload-placeholder">{{ dualUploadConfig.slot2.label }}</span>
                  </template>
                </div>
                <div v-if="dualUploadDropdown === 'slot2'" class="dual-upload-menu" @click.stop>
                  <button class="upload-option" @click="handleDualUpload('slot2', dualUploadConfig.slot2.accept)">
                    <i data-lucide="upload" style="width: 16px; height: 16px;"></i>
                    本地上传
                  </button>
                  <div class="upload-menu-divider"></div>
                  <button class="upload-option" @click="handleDualUploadFromCloud('slot2')">
                    <i data-lucide="cloud" style="width: 16px; height: 16px;"></i>
                    从云资料库选择
                  </button>
                </div>
              </div>
            </div>

            <!-- 媒体素材栏（双上传框模式下隐藏） -->
            <div v-if="!isDualUploadFeature && (uploadedFiles.length > 0 || referencedFiles.length > 0)" class="media-bar">
              <div v-if="uploadedFiles.length > 0" class="media-section">
                <div class="section-label">
                  <i data-lucide="upload" style="width: 13px; height: 13px;"></i>
                  上传素材
                  <span class="section-count">{{ uploadedFiles.length }}</span>
                </div>
                <div class="media-items-row">
                  <div
                    v-for="(file, index) in uploadedFiles"
                    :key="file.object_id || ('upb-' + index)"
                    class="media-item draggable-item"
                    :class="[`type-${file.type}`]"
                    draggable="true"
                    @dragstart="onDragStart(file, index, 'upload')"
                    @dragend="onDragEnd"
                    @click.stop="clickToReference(file)"
                  >
                    <img v-if="file.type === 'image'" :src="convertBase64ToBlobUrl(file.url)" :alt="file.name" class="preview-thumb" />
                    <video v-else-if="file.type === 'video'" :src="file.url" class="preview-thumb" muted />
                    <div v-else-if="file.type === 'audio'" class="audio-preview">
                      <i data-lucide="music" style="width: 18px; height: 18px;"></i>
                      <span>{{ file.name }}</span>
                    </div>
                    <button class="remove-file-btn" @click.stop="removeUploadedFile(index)" title="删除">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button
                      v-if="file.type === 'image' || file.type === 'video'"
                      class="preview-icon-btn"
                      @click.stop="openFilePreview(file)"
                      title="放大查看"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </button>
                    <div class="file-type-badge">{{ getFileTypeLabel(file.type) }}</div>
                    <div class="drag-hint-overlay">
                      <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                      点击引用
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="uploadedFiles.length > 0 && referencedFiles.length > 0" class="media-bar-divider"></div>
              <div v-if="referencedFiles.length > 0" class="media-section ref-section">
                <div class="section-label">
                  <i data-lucide="at-sign" style="width: 13px; height: 13px;"></i>
                  @ 引用素材
                  <span class="section-count">{{ referencedFiles.length }}</span>
                </div>
                <div class="media-items-row">
                  <div
                    v-for="refFile in referencedFiles"
                    :key="'refb-' + refFile.atId"
                    class="media-item ref-item"
                    :class="[`type-${refFile.type}`, { active: activeAtTagId === refFile.atId }]"
                    @click="focusAtTagById(refFile.atId)"
                  >
                    <img v-if="refFile.type === 'image'" :src="convertBase64ToBlobUrl(refFile.url)" :alt="refFile.name" class="preview-thumb" />
                    <video v-else-if="refFile.type === 'video'" :src="refFile.url" class="preview-thumb" muted />
                    <div v-else-if="refFile.type === 'audio'" class="audio-preview ref-audio-preview">
                      <i data-lucide="music" style="width: 16px; height: 16px;"></i>
                    </div>
                    <div class="ref-at-badge">@{{ refFile.atLabel }}</div>
                    <button class="remove-ref-btn" @click.stop="removeReferencedFile(refFile.atId)" title="取消引用">
                      <i data-lucide="x" style="width: 11px; height: 11px;"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="input-card-footer">
              <div class="footer-options">
                <div class="option-chip type-chip" :class="{ open: isTypeDropdownOpen }" @click="toggleTypeDropdown" ref="typeTriggerRef2">
                  <i :data-lucide="selectedTypeIcon" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedTypeLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isTypeDropdownOpen"
                      class="select-dropdown type-dropdown-menu"
                      :style="typeDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="type in generateTypes"
                        :key="type.id"
                        :class="['select-option', { active: selectedType === type.id }]"
                        @click.stop="selectType(type)"
                      >
                        <i :data-lucide="type.icon" style="width: 16px; height: 16px; margin-right: 8px;"></i>
                        {{ type.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div class="option-chip model-chip" :class="{ open: isModelDropdownOpen }" @click="toggleModelDropdown" ref="modelTriggerRef2">
                  <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedModelName }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div v-if="isModelDropdownOpen" class="select-dropdown model-dropdown-menu" :style="modelDropdownPos" @click.stop>
                      <div
                        v-for="model in models"
                        :key="model.id"
                        :class="['select-option', { active: selectedModel === model.id }, { 'default-model-option': model.is_default }]"
                        @click.stop="selectModel(model)"
                      >
                        <div class="model-option-main">
                          <span class="model-name">
                            {{ model.name }}
                            <span v-if="model.is_default" class="default-badge">推荐</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div class="option-chip feature-chip" :class="{ open: isFeatureDropdownOpen }" @click="toggleFeatureDropdown" ref="featureTriggerRef2">
                  <i data-lucide="wand-2" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedFeatureLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isFeatureDropdownOpen"
                      class="select-dropdown feature-dropdown-menu"
                      :style="featureDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="feature in currentFeatures"
                        :key="feature.id"
                        :class="['select-option', { active: selectedFeature === feature.id }]"
                        @click.stop="selectFeature(feature)"
                      >
                        {{ feature.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div class="option-chip ratio-chip" :class="{ open: isRatioDropdownOpen }" @click="toggleRatioDropdown" ref="ratioTriggerRef2">
                  <i data-lucide="crop" style="width: 14px; height: 14px;"></i>
                  <span>{{ selectedRatio }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isRatioDropdownOpen"
                      class="select-dropdown ratio-dropdown-menu"
                      :style="ratioDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="ratio in availableAspectRatios"
                        :key="ratio"
                        :class="['select-option', { active: selectedRatio === ratio }]"
                        @click.stop="selectRatio(ratio)"
                      >
                        {{ ratio }}
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div v-if="selectedType === 'video'" class="option-chip duration-chip" :class="{ open: isDurationDropdownOpen }" @click="toggleDurationDropdown" ref="durationTriggerRef2">
                  <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                  <span>{{ videoDuration }}s</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isDurationDropdownOpen"
                      class="select-dropdown duration-dropdown-menu"
                      :style="durationDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="dur in videoDurationOptions"
                        :key="dur"
                        :class="['select-option', { active: videoDuration === dur }]"
                        @click="selectDuration(dur)"
                      >
                        {{ dur }} 秒
                      </div>
                    </div>
                  </Teleport>
                </div>
                <div class="option-chip quality-chip" :class="{ open: isQualityDropdownOpen }" @click="toggleQualityDropdown" ref="qualityTriggerRef2">
                  <span>{{ selectedQualityLabel }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isQualityDropdownOpen"
                      class="select-dropdown quality-dropdown-menu"
                      :style="qualityDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="quality in availableQualities"
                        :key="quality.id"
                        :class="['select-option', { active: selectedQuality === quality.id }]"
                        @click.stop="selectQuality(quality)"
                      >
                        {{ quality.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>
                <button
                  v-if="showSoundToggle"
                  :class="['option-chip sound-chip', { active: videoSoundEnabled, disabled: soundToggleDisabled }]"
                  :disabled="soundToggleDisabled"
                  @click="handleSoundToggle"
                  :title="soundToggleDisabled ? (videoSoundEnabled ? '当前模型仅支持有声' : '当前模型仅支持无声') : (videoSoundEnabled ? '点击关闭声音' : '点击开启声音')"
                >
                  <!-- 有声图标 -->
                  <svg v-if="videoSoundEnabled" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                  <!-- 无声图标 -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  <span class="sound-label">{{ videoSoundEnabled ? '有声' : '无声' }}</span>
                </button>

                <!-- 图片生成高级参数（图片生成时显示） -->
                <!-- 生成数量 -->
                <div
                  v-if="showImageAdvancedParams"
                  class="option-chip count-chip"
                  :class="{ open: isImageCountDropdownOpen }"
                  @click="toggleImageCountDropdown"
                  ref="imageCountTriggerRef"
                >
                  <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageCount }}张</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageCountDropdownOpen"
                      class="select-dropdown count-dropdown-menu"
                      :style="imageCountDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="cnt in imageCountOptions"
                        :key="cnt"
                        :class="['select-option', { active: imageCount === cnt }]"
                        @click.stop="selectImageCount(cnt)"
                      >
                        {{ cnt }} 张
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 输出格式（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip format-chip"
                  :class="{ open: isImageFormatDropdownOpen }"
                  @click="toggleImageFormatDropdown"
                  ref="imageFormatTriggerRef"
                >
                  <i data-lucide="file-image" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageOutputFormat.toUpperCase() }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageFormatDropdownOpen"
                      class="select-dropdown format-dropdown-menu"
                      :style="imageFormatDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="fmt in imageOutputFormatOptions"
                        :key="fmt.id"
                        :class="['select-option', { active: imageOutputFormat === fmt.id }]"
                        @click.stop="selectImageFormat(fmt)"
                      >
                        {{ fmt.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 输出质量（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip img-quality-chip"
                  :class="{ open: isImageQualityDropdownOpen }"
                  @click="toggleImageQualityDropdown"
                  ref="imageQualityTriggerRef"
                >
                  <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageOutputQualityOptions.find(q => q.id === imageOutputQuality)?.label || '自动' }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageQualityDropdownOpen"
                      class="select-dropdown img-quality-dropdown-menu"
                      :style="imageQualityDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="q in imageOutputQualityOptions"
                        :key="q.id"
                        :class="['select-option', { active: imageOutputQuality === q.id }]"
                        @click.stop="selectImageOutputQuality(q)"
                      >
                        {{ q.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 背景设置（GPT模型） -->
                <div
                  v-if="showImageAdvancedParams && isGptImageModel"
                  class="option-chip background-chip"
                  :class="{ open: isImageBackgroundDropdownOpen }"
                  @click="toggleImageBackgroundDropdown"
                  ref="imageBackgroundTriggerRef"
                >
                  <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageBackgroundOptions.find(b => b.id === imageBackground)?.label || '自动' }}</span>
                  <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                  <Teleport to="body">
                    <div
                      v-if="isImageBackgroundDropdownOpen"
                      class="select-dropdown background-dropdown-menu"
                      :style="imageBackgroundDropdownPos"
                      @click.stop
                    >
                      <div
                        v-for="bg in imageBackgroundOptions"
                        :key="bg.id"
                        :class="['select-option', { active: imageBackground === bg.id }]"
                        @click.stop="selectImageBackground(bg)"
                      >
                        {{ bg.label }}
                      </div>
                    </div>
                  </Teleport>
                </div>

                <!-- 水印开关（千问/万象模型） -->
                <button
                  v-if="showImageAdvancedParams && isQwenWanModel"
                  :class="['option-chip watermark-chip', { active: imageWatermark }]"
                  @click="toggleImageWatermark"
                  :title="imageWatermark ? '点击关闭水印' : '点击开启水印'"
                >
                  <i data-lucide="droplet" style="width: 14px; height: 14px;"></i>
                  <span>{{ imageWatermark ? '水印' : '无水印' }}</span>
                </button>
              </div>
              <div class="footer-right">
                <span v-if="estimatedPrice" class="price-estimate-mini" :class="{ loading: estimatingPrice, 'price-insufficient': isInsufficientCredits }">
                  <i data-lucide="coins" style="width: 12px; height: 12px;"></i>
                  约 {{ estimatedPrice.estimated_cost }} 积分
                </span>
                <span v-else-if="estimatingPrice" class="price-estimate-mini loading">计算中...</span>
                <span class="char-count-mini">{{ prompt.length }} / 2000</span>
                <button class="send-btn" :disabled="!canGenerate || isGenerating" @click="handleGenerate">
                  <i data-lucide="arrow-up" style="width: 18px; height: 18px;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 云资料库选择弹窗 -->
    <Teleport to="body">
      <div v-if="showCloudModal" class="cloud-modal-overlay" @click.self="closeCloudModal">
        <div class="cloud-modal-content">
          <div class="cloud-modal-header">
            <h3 class="cloud-modal-title">从云资料库选择素材</h3>
            <button class="cloud-modal-close" @click="closeCloudModal">×</button>
          </div>
          <div class="cloud-modal-body">
            <!-- 加载中 -->
            <div v-if="cloudLoading" class="cloud-loading">
              <i data-lucide="loader" style="width: 32px; height: 32px; color: #3b82f6; animation: spin 1s linear infinite;"></i>
              <p>加载中...</p>
            </div>
            <!-- 空状态 -->
            <div v-else-if="filteredCloudAssets.length === 0" class="cloud-empty">
              <i data-lucide="cloud-off" style="width: 32px; height: 32px; color: #9ca3af;"></i>
              <p>暂无云资产素材</p>
              <p style="font-size: 12px; color: #9ca3af;">请先在资产页面上传素材</p>
            </div>
            <!-- 资产列表 -->
            <div v-else class="cloud-assets-grid">
              <div v-for="asset in filteredCloudAssets" :key="asset.id" class="cloud-asset-card" @click="selectCloudAsset(asset)">
                <div class="cloud-asset-thumb">
                  <img v-if="asset.type === 'image' && asset.thumbnail" :src="asset.thumbnail" :alt="asset.name" />
                  <div v-else-if="asset.type === 'video'" class="cloud-asset-video-wrap">
                    <video
                      :src="`${asset.url}#t=0.1`"
                      class="cloud-asset-video"
                      preload="metadata"
                      muted
                      playsinline
                      @loadeddata="onCloudVideoFirstFrame($event)"
                      @error="onCloudVideoError($event)"
                    ></video>
                    <div class="cloud-asset-play-overlay">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div v-else-if="asset.type === 'audio'" class="cloud-asset-placeholder">
                    <i data-lucide="music" style="width: 28px; height: 28px;"></i>
                  </div>
                  <div v-else class="cloud-asset-placeholder">
                    <i data-lucide="file" style="width: 28px; height: 28px;"></i>
                  </div>
                </div>
                <div class="cloud-asset-info">
                  <span class="cloud-asset-name">{{ asset.name }}</span>
                  <span class="cloud-asset-size">{{ asset.size }}</span>
                </div>
              </div>
            </div>
            <!-- 自动续拉加载提示（5 条/批，直到加载完全部） -->
            <div v-if="!cloudLoading && filteredCloudAssets.length > 0 && cloudLoadingMore" class="cloud-load-more">
              <i data-lucide="loader" style="width: 16px; height: 16px; color: #3b82f6; animation: spin 1s linear infinite;"></i>
              <span>加载中...</span>
            </div>
            <div v-else-if="!cloudLoading && filteredCloudAssets.length > 0 && !cloudHasMore && !cloudLoadingMore" class="cloud-load-more cloud-load-more-end">
              <span>已加载全部</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 媒体预览弹窗 -->
    <Teleport to="body">
      <div v-if="showPreviewModal" class="preview-modal-overlay" @click.self="closePreviewModal">
        <div class="preview-modal-content">
          <button class="preview-modal-close" @click="closePreviewModal" title="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="preview-modal-body">
            <img
              v-if="previewFile && previewFile.type === 'image'"
              :src="convertBase64ToBlobUrl(previewFile.url)"
              :alt="previewFile.name"
              class="preview-image"
            />
            <video
              v-else-if="previewFile && previewFile.type === 'video'"
              :src="previewFile.url"
              :poster="previewFile.thumbnail || previewFile.thumbnail_url || previewFile.cover_url || ''"
              class="preview-video"
              controls
              autoplay
            />
            <div v-else-if="previewFile && previewFile.type === 'audio'" class="preview-audio-panel">
              <div class="preview-audio-icon">
                <i data-lucide="music" style="width: 32px; height: 32px;"></i>
              </div>
              <audio :src="previewFile.url" class="preview-audio" controls autoplay />
            </div>
          </div>
          <div v-if="previewFile" class="preview-modal-info">
            <span class="preview-file-name">{{ previewFile.name || '未命名文件' }}</span>
            <span class="preview-file-type">{{ getFileTypeLabel(previewFile.type) }}</span>
          </div>
        </div>
      </div>
    </Teleport>

  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { userData } from '../data/userData'
import { useUserStore } from '../stores/user'
import { estimatePriceApi, getTaskChargeInfoApi } from '../api/profile'
import { getBillingTaskDetailApi } from '../api/billing'
import request, { safeMessage } from '../utils/request'
import {
  createConversationApi,
  listConversationsApi,
  streamConversationsApi,
  getConversationApi,
  updateConversationApi,
  streamMessagesApi,
  postMessageApi
} from '../api/conversation'
import { getMediaListApi, getMediaStreamApi } from '../api/media'
import { getStorage, getStorageWithExpiry, setStorage, setStorageWithExpiry } from '../utils/storage'
import { downloadFile } from '../utils/download'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// ========== 生成参数缓存（用于历史对话恢复） ==========
const GEN_PARAMS_STORAGE_KEY = 'szg_gen_params'

function saveCardGenParams(conversationId, taskId, params) {
  if (!conversationId || !taskId) return
  try {
    const all = JSON.parse(localStorage.getItem(GEN_PARAMS_STORAGE_KEY) || '{}')
    const convKey = String(conversationId)
    if (!all[convKey]) all[convKey] = {}
    // 保留已有 prompt（避免 finalizeGenerationSuccess 写入时 placeholderCard.prompt 已被清空）
    const existing = all[convKey][String(taskId)] || {}
    all[convKey][String(taskId)] = {
      model: params.model || existing.model || '',
      feature: params.feature || existing.feature || '',
      ratio: params.ratio || existing.ratio || '',
      quality: params.quality || existing.quality || '',
      duration: params.duration ?? existing.duration ?? 0,
      type: params.type || existing.type || 'image',
      prompt: params.prompt || existing.prompt || ''
    }
    localStorage.setItem(GEN_PARAMS_STORAGE_KEY, JSON.stringify(all))
  } catch (e) {
    console.warn('保存生成参数缓存失败:', e)
  }
}

function loadCardGenParams(conversationId, taskId) {
  if (!conversationId || !taskId) return null
  try {
    const all = JSON.parse(localStorage.getItem(GEN_PARAMS_STORAGE_KEY) || '{}')
    return all[String(conversationId)]?.[String(taskId)] || null
  } catch (e) {
    return null
  }
}

// 获取当前 conversation 在 localStorage 缓存中的所有 taskId
// 用于恢复进行中任务（流式端点不返回 generation_task_id，改从缓存检测）
function getAllCachedTaskIds(conversationId) {
  if (!conversationId) return []
  try {
    const all = JSON.parse(localStorage.getItem(GEN_PARAMS_STORAGE_KEY) || '{}')
    return Object.keys(all[String(conversationId)] || {})
  } catch (e) {
    return []
  }
}

// ========== 即梦AI风格新增状态 ==========
const hasInteracted = ref(false)
const activeConversationId = ref(null)
const conversationHistory = ref([])
const renamingId = ref(null) // 正在重命名的对话 ID
const renameInputRef = ref(null) // 重命名输入框 ref

// 单个对话窗口最大对话次数（生成轮数）
const MAX_CONVERSATION_ROUNDS = 100

// 对话列表流式加载是否被硬截断（X-Conversation-Stream-Capped）
const conversationsCapped = ref(false)

// 当前对话对象（computed，自动跟随 activeConversationId）
const currentConv = computed(() =>
  conversationHistory.value.find(c => c.id === activeConversationId.value) || null
)

// 是否已达最大对话次数
const hasReachedMaxRounds = computed(() => {
  const conv = currentConv.value
  if (!conv) return false
  const count = Math.max(conv.generation_count || 0, conv.cards?.length || 0)
  return count >= MAX_CONVERSATION_ROUNDS
})

// ========== 积分相关状态（使用 store） ==========
const remainingPoints = computed(() => userStore.remainingPoints)
const estimatedPrice = ref(null) // { estimated_cost, currency, breakdown, note }
const estimatingPrice = ref(false)

// 积分是否不足
const isInsufficientCredits = computed(() => {
  if (!estimatedPrice.value || remainingPoints.value === '--') return false
  const cost = Number(estimatedPrice.value.estimated_cost) || 0
  const remain = Number(remainingPoints.value) || 0
  return cost > remain
})

const currentConversationTitle = computed(() => {
  const conv = conversationHistory.value.find(c => c.id === activeConversationId.value)
  return conv ? conv.title : '新对话'
})

const expandedCardIds = reactive({})
function togglePromptExpand(cardId) {
  const card = generatedCards.value.find(c => c.id === cardId)
  if (card && card.prompt && card.prompt.length > 50) {
    expandedCardIds[cardId] = !expandedCardIds[cardId]
  }
}

// 当前对话的结果卡片（computed 自动跟随活跃对话）
const generatedCards = computed({
  get() {
    const conv = conversationHistory.value.find(c => c.id === activeConversationId.value)
    return conv ? conv.cards : []
  },
  set(val) {
    const conv = conversationHistory.value.find(c => c.id === activeConversationId.value)
    if (conv) conv.cards = val
  }
})

function startNewChat() {
  hasInteracted.value = false
  activeConversationId.value = null
  prompt.value = ''
  if (promptEditorRef.value) promptEditorRef.value.innerHTML = ''
  if (promptEditorRefBottom.value) promptEditorRefBottom.value.innerHTML = ''
  uploadedFiles.value = []
  referencedFiles.value = []
  atTags.value = []
  activeAtTagId.value = null
  atImageCounter = 0
  atVideoCounter = 0
  atAudioCounter = 0
}

async function selectConversation(id) {
  if (id === activeConversationId.value) return
  activeConversationId.value = id
  hasInteracted.value = true
  // 切换对话时清空输入区（卡片由 computed 自动切换）
  prompt.value = ''
  if (promptEditorRef.value) promptEditorRef.value.innerHTML = ''
  if (promptEditorRefBottom.value) promptEditorRefBottom.value.innerHTML = ''
  uploadedFiles.value = []
  referencedFiles.value = []
  atTags.value = []
  activeAtTagId.value = null
  atImageCounter = 0
  atVideoCounter = 0
  atAudioCounter = 0
  // 按需加载对话详情（loaded 为 false 时从 API 获取）
  const conv = conversationHistory.value.find(c => c.id === id)
  if (conv && !conv.loaded) {
    await loadConversationDetail(id)
  }
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

async function deleteConversation(id) {
  const idx = conversationHistory.value.findIndex(c => c.id === id)
  if (idx === -1) return
  conversationHistory.value.splice(idx, 1)
  if (activeConversationId.value === id) {
    activeConversationId.value = null
    hasInteracted.value = conversationHistory.value.length > 0
    if (conversationHistory.value.length > 0) {
      selectConversation(conversationHistory.value[0].id)
    }
  }
  // 后端无 DELETE 端点，使用归档代替
  try {
    await updateConversationApi(id, { status: 'archived' })
  } catch (e) {
    console.warn('归档对话失败:', e)
  }
}

// ========== 对话重命名 ==========
function startRename(id) {
  renamingId.value = id
  nextTick(() => {
    const input = document.querySelector('.conv-title-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

async function confirmRename(id, newTitle) {
  const trimmed = (newTitle || '').trim()
  if (!trimmed || trimmed === '未命名对话') {
    cancelRename()
    return
  }
  try {
    const res = await updateConversationApi(id, { title: trimmed })
    if (isUnmounted.value) return
    const conv = conversationHistory.value.find(c => c.id === id)
    if (conv && res.data) {
      conv.title = res.data.title || trimmed
    }
  } catch (e) {
    console.warn('重命名失败:', e)
  } finally {
    if (!isUnmounted.value) renamingId.value = null
  }
}

function cancelRename() {
  renamingId.value = null
}

function handleThumbError(e) {
  e.target.style.display = 'none'
}

// 对话缩略图视频加载后 seek 到 0.1 秒展示第一帧
function onConvVideoFrameLoaded(e) {
  const video = e.target
  try {
    if (video.duration > 0.2) {
      video.currentTime = 0.1
    }
  } catch (_) { /* ignore */ }
}

function formatConvTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function triggerUpload() {
  handleUploadType(selectedType.value === 'video' ? 'image' : 'image')
}

function toggleUploadDropdown() {
  // 文生图模式下禁止上传，弹窗提示
  if (isTextToImageMode.value) {
    showToast('当前为文生图，不可上传素材！', 'warning')
    return
  }
  isUploadDropdownOpen.value = !isUploadDropdownOpen.value
}

function editPrompt(card) {
  prompt.value = card.prompt || ''
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (editor) editor.innerHTML = card.prompt || ''
}

function regenerateFromCard(card) {
  prompt.value = card.prompt || ''
  handleGenerate()
}

async function toggleFeedback(card, type) {
  const newFeedback = card.feedback === type ? null : type
  card.feedback = newFeedback
  // 发送反馈到后端
  try {
    await apiFetch(`/api/v1/cards/${card.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: newFeedback })
    })
  } catch (e) {
    console.warn('反馈提交失败:', e)
  }
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// ========== 原有状态和逻辑 ==========
const prompt = ref('')
const selectedType = ref('image')
const selectedModel = ref('')
const selectedRatio = ref('16:9')
const selectedQuality = ref('1080p')
const selectedFeature = ref('')
const isGenerating = ref(false)
const uploadedFiles = ref([])
const referencedFiles = ref([])
const atTags = ref([])
const activeAtTagId = ref(null)
let atImageCounter = 0
let atVideoCounter = 0
let atAudioCounter = 0
const showAtMentionDropdown = ref(false)
const atMentionCandidates = ref([])

// 双上传框配置：需要双上传的特色功能
const dualUploadFeatureConfig = {
  'first-last-frame': { slot1: { key: 'first_frame', label: '首帧', accept: 'image/*' }, slot2: { key: 'last_frame', label: '尾帧', accept: 'image/*' } },
  'ai-outfit': { slot1: { key: 'subject', label: '原始视频', accept: 'video/*' }, slot2: { key: 'reference', label: '参考图', accept: 'image/*' } },
  'scene-replace': { slot1: { key: 'subject', label: '原始视频', accept: 'video/*' }, slot2: { key: 'reference', label: '参考图', accept: 'image/*' } },
  'style-replace': { slot1: { key: 'subject', label: '原始视频', accept: 'video/*' }, slot2: { key: 'reference', label: '参考图', accept: 'image/*' } },
  'effect-copy': { slot1: { key: 'subject', label: '原始视频', accept: 'video/*' }, slot2: { key: 'reference', label: '参考图', accept: 'image/*' } },
  'motion-imitate': { slot1: { key: 'subject', label: '原始视频', accept: 'video/*' }, slot2: { key: 'reference', label: '参考视频', accept: 'video/*' } },
  'lip-sync': { slot1: { key: 'lip_sync_video', label: '原始视频', accept: 'video/*' }, slot2: { key: 'lip_sync_audio', label: '音频文件', accept: 'audio/*' } }
}

const dualUploadSlots = ref({ slot1: null, slot2: null })
const dualUploadDropdown = ref(null) // 'slot1' | 'slot2' | null
const currentDualUploadSlot = ref(null) // 记录从云资料库选择时对应的双上传slot

const isDualUploadFeature = computed(() => {
  return selectedType.value === 'video' && selectedFeature.value && dualUploadFeatureConfig[selectedFeature.value]
})

const dualUploadConfig = computed(() => {
  return isDualUploadFeature.value ? dualUploadFeatureConfig[selectedFeature.value] : null
})

// 文生图模式：图片类型下未选功能（默认即文生图）或主动选择「文生图」功能（纯文字生成，不需要素材）
const isTextToImageMode = computed(() => {
  return selectedType.value === 'image' && (selectedFeature.value === '' || selectedFeature.value === 'text2img')
})

// 图片类型下需要素材的功能：选了非「文生图」的功能（参考图、风格转换、局部重绘等）
const isImageFeatureRequiringAssets = computed(() => {
  return selectedType.value === 'image' && selectedFeature.value !== '' && selectedFeature.value !== 'text2img'
})
const activeMentionIndex = ref(0)
const mentionDropdownStyle = ref({})
const videoSoundEnabled = ref(false)
const videoDuration = ref(5)

// 图片生成高级参数
const imageBackground = ref('auto') // transparent / opaque / auto (GPT模型)
const imageOutputFormat = ref('png') // png / jpeg / webp (GPT模型)
const imageOutputQuality = ref('auto') // low / medium / high / auto (GPT模型)
const imageWatermark = ref(false) // 是否添加水印 (千问/万象模型)
const imageCount = ref(1) // 生成数量 1-10
const videoDurationOptions = computed(() => {
  const model = models.value.find(m => m.id === selectedModel.value)
  // 优先使用模型的 valid_durations 字段（如 Seedance 仅支持 5/10/11）
  if (model?.valid_durations && model.valid_durations.length > 0) {
    return model.valid_durations
  }
  const maxDur = model?.max_duration || 15
  const arr = []
  for (let i = 1; i <= maxDur; i++) arr.push(i)
  return arr
})
const expandedCardId = ref(null)

// 媒体预览相关状态
const previewFile = ref(null)
const showPreviewModal = ref(false)

const generateTypes = [
  { id: 'image', label: '图片生成', icon: 'image' },
  { id: 'video', label: '视频生成', icon: 'video' },
  { id: 'audio', label: '音频生成', icon: 'music' },
  { id: 'digital-human', label: '数字人', icon: 'user' }
]

const selectedTypeIcon = computed(() => {
  const t = generateTypes.find(g => g.id === selectedType.value)
  return t ? t.icon : 'image'
})

const selectedTypeLabel = computed(() => {
  const t = generateTypes.find(g => g.id === selectedType.value)
  return t ? t.label : '图片生成'
})

const promptPlaceholder = computed(() => {
  if (selectedType.value === 'image') {
    return '上传参考图、输入文字或 @ 主体，描述你想生成的图片。'
  } else if (selectedType.value === 'video') {
    return '上传最多12个参考素材，输入文字或 @ 参考内容，自由组合图、文、音、视频多元素，定义精彩互动。例如：@图片1 模仿 @视频1 的动作，音色参考 @音频1。'
  }
  return '输入你的创作描述...'
})

const canGenerate = computed(() => {
  // 已达最大对话次数，禁止继续生成
  if (hasReachedMaxRounds.value) return false
  if (prompt.value.trim().length === 0) return false
  // 积分不足时禁用生成按钮（有预估价格且超过剩余积分）
  if (estimatedPrice.value && remainingPoints.value !== '--') {
    const cost = Number(estimatedPrice.value.estimated_cost) || 0
    const remain = Number(remainingPoints.value) || 0
    if (cost > remain) return false
  }
  return true
})

const showSoundToggle = computed(() => {
  if (selectedType.value !== 'video') return false
  // sound_mode 为 'hidden' 时隐藏声音开关
  const model = models.value.find(m => m.id === selectedModel.value)
  if (model?.sound_mode === 'hidden') return false
  return true
})

// 图片模型类型检测
const isGptImageModel = computed(() => {
  if (selectedType.value !== 'image') return false
  const model = models.value.find(m => m.id === selectedModel.value)
  if (!model) return false
  const modelId = (model.id || model.name || '').toLowerCase()
  // GPT图像模型: gpt-image-1, gpt-image-1.5, chatgpt-image-latest, dall-e-2, dall-e-3
  return modelId.includes('gpt-image') || modelId.includes('chatgpt-image') || modelId.includes('dall-e')
})

const isQwenWanModel = computed(() => {
  if (selectedType.value !== 'image') return false
  const model = models.value.find(m => m.id === selectedModel.value)
  if (!model) return false
  const modelId = (model.id || model.name || '').toLowerCase()
  // 千问/万象模型: qwen-vl-max, wan2.1-t2i-turbo 等
  return modelId.includes('qwen') || modelId.includes('wan')
})

// 图片生成参数选项
const imageBackgroundOptions = [
  { id: 'auto', label: '自动' },
  { id: 'opaque', label: '不透明' },
  { id: 'transparent', label: '透明' }
]

const imageOutputFormatOptions = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPEG' },
  { id: 'webp', label: 'WebP' }
]

const imageOutputQualityOptions = [
  { id: 'auto', label: '自动' },
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' }
]

const imageCountOptions = computed(() => {
  const model = models.value.find(m => m.id === selectedModel.value)
  // GPT模型最多10张,其他模型默认最多4张
  const maxCount = isGptImageModel.value ? 10 : 4
  const options = []
  for (let i = 1; i <= maxCount; i++) options.push(i)
  return options
})

// 是否显示图片高级参数
const showImageAdvancedParams = computed(() => selectedType.value === 'image')

const soundToggleMode = computed(() => {
  if (selectedType.value !== 'video') return 'hidden'
  const model = models.value.find(m => m.id === selectedModel.value)
  if (!model) return 'disabled-silent'
  // 优先读取模型对象的 sound_mode 字段
  if (model.sound_mode) return model.sound_mode
  // 降级：兼容旧数据，保留原有的字符串匹配逻辑
  const name = (model.name || model.id || '').toLowerCase()
  const id = (model.id || '').toLowerCase()
  const isFreeChoice =
    (name.includes('gv') && name.includes('3.1')) ||
    (name.includes('kling') && (name.includes('2.6') || name.includes('3.0'))) ||
    (id.includes('kling') && (id.includes('2.6') || id.includes('3.0') || id.includes('2_6') || id.includes('3_0'))) ||
    (name.includes('seedance') && name.includes('2.0')) ||
    (id.includes('seedance') && id.includes('2.0'))
  if (isFreeChoice) return 'free'
  if (name.includes('happyhorse') || id.includes('happyhorse')) return 'forced-sound'
  return 'disabled-silent'
})

const soundToggleDisabled = computed(() => soundToggleMode.value !== 'free')

// ========== 下拉框状态 ==========
const isTypeDropdownOpen = ref(false)
const isModelDropdownOpen = ref(false)
const isRatioDropdownOpen = ref(false)
const isQualityDropdownOpen = ref(false)
const isFeatureDropdownOpen = ref(false)
const isDurationDropdownOpen = ref(false)
const isUploadDropdownOpen = ref(false)
// 图片生成高级参数下拉框
const isImageCountDropdownOpen = ref(false)
const isImageFormatDropdownOpen = ref(false)
const isImageQualityDropdownOpen = ref(false)
const isImageBackgroundDropdownOpen = ref(false)
const typeDropdownPos = ref({})
const modelDropdownPos = ref({})
const ratioDropdownPos = ref({})
const qualityDropdownPos = ref({})
const featureDropdownPos = ref({})
const durationDropdownPos = ref({})
// 图片生成高级参数下拉框位置
const imageCountDropdownPos = ref({})
const imageFormatDropdownPos = ref({})
const imageQualityDropdownPos = ref({})
const imageBackgroundDropdownPos = ref({})

const typeTriggerRef = ref(null)
const typeTriggerRef2 = ref(null)
const modelTriggerRef = ref(null)
const modelTriggerRef2 = ref(null)
const ratioTriggerRef = ref(null)
const ratioTriggerRef2 = ref(null)
const qualityTriggerRef = ref(null)
const qualityTriggerRef2 = ref(null)
const featureTriggerRef = ref(null)
const featureTriggerRef2 = ref(null)
const durationTriggerRef = ref(null)
const durationTriggerRef2 = ref(null)
// 图片生成高级参数触发ref
const imageCountTriggerRef = ref(null)
const imageFormatTriggerRef = ref(null)
const imageQualityTriggerRef = ref(null)
const imageBackgroundTriggerRef = ref(null)
const editorWrapperRef = ref(null)
const editorWrapperRefBottom = ref(null)
const promptEditorRef = ref(null)
const promptEditorRefBottom = ref(null)
const canvasContainer = ref(null)
let mentionAnchorRange = null

// ========== 模型数据 ==========
const models = ref([])
const imageModels = ref([])
const videoModels = ref([])
const digitalHumanModels = ref([])
const audioModels = ref([])

const defaultModel = { id: '', name: '默认模型', description: '系统自动选择最优模型', is_default: true }

const defaultAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '5:4', '4:5', '21:9']
// 根据当前模型的 supported_aspect_ratios 字段过滤可选比例；未设置时降级为默认列表
const availableAspectRatios = computed(() => {
  const model = models.value.find(m => m.id === selectedModel.value)
  if (!model) return defaultAspectRatios
  if (model.supported_aspect_ratios && model.supported_aspect_ratios.length > 0) {
    return model.supported_aspect_ratios
  }
  return defaultAspectRatios
})
const qualities = [
  { id: '480p', label: '480p' },
  { id: '720p', label: '720P' },
  { id: '1080p', label: '1080P' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' }
]

const selectedModelName = computed(() => {
  if (!selectedModel.value) return '默认模型'
  const model = models.value.find(m => m.id === selectedModel.value)
  return model ? model.name : '默认模型'
})

const selectedQualityLabel = computed(() => {
  const quality = availableQualities.value.find(q => q.id === selectedQuality.value)
  return quality ? quality.label : '2K'
})

// 根据当前模型是否有分辨率变体，过滤可选的分辨率列表
const availableQualities = computed(() => {
  const model = models.value.find(m => m.id === selectedModel.value)
  if (!model) return qualities
  // 优先使用模型的 supported_resolutions 字段
  if (model.supported_resolutions && model.supported_resolutions.length > 0) {
    const supportedLower = model.supported_resolutions.map(r => String(r).toLowerCase())
    const matched = qualities.filter(q => supportedLower.includes(q.id))
    // 匹配到标准分辨率（480p/720p/1080p/2k/4k）则返回过滤结果
    if (matched.length > 0) return matched
    // 未匹配（如图片模型的 WxH 格式 256x256/1024x1024）：提取宽像素值转换为 256P/512P/1024P 格式
    return model.supported_resolutions.map(r => {
      const label = String(r)
      const pxMatch = label.match(/^(\d+)x\d+$/)
      const displayLabel = pxMatch ? `${pxMatch[1]}P` : label
      return { id: label.toLowerCase(), label: displayLabel }
    })
  }
  // 降级：使用 _resolutionVariants
  if (model._hasResolutionVariants && model._resolutionVariants) {
    const supportedKeys = Object.keys(model._resolutionVariants)
    return qualities.filter(q => supportedKeys.includes(q.id))
  }
  return qualities
})

function getModelNameById(modelId) {
  if (!modelId) return '默认模型'
  // 在所有类型的模型列表中查找，避免切换类型后历史卡片的模型名显示为"默认模型"
  const allModels = [
    ...imageModels.value,
    ...videoModels.value,
    ...digitalHumanModels.value,
    ...audioModels.value
  ]
  // 先直接匹配 id
  let model = allModels.find(m => m.id === modelId)
  // 再匹配 name/display_name（流式端点返回的是 ai_models.display_name）
  if (!model) {
    model = allModels.find(m => m.name === modelId || m.display_name === modelId)
  }
  if (model) return model.name
  // 再检查是否是某个合并模型的分辨率变体（如 happyhorse-1.0-r2v-1080p）
  const variantModel = allModels.find(m =>
    m._hasResolutionVariants && m._resolutionVariants &&
    Object.values(m._resolutionVariants).includes(modelId)
  )
  return variantModel ? variantModel.name : '默认模型'
}

// 格式化卡片创建时间：支持 ISO 字符串（后端 created_at）和时间戳（前端 Date.now()）
function formatCardTime(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (isNaN(d.getTime())) return ''
  // 同一天只显示 HH:mm，跨天显示 MM-DD HH:mm，跨年显示 YYYY-MM-DD HH:mm
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const sameYear = d.getFullYear() === now.getFullYear()
  const sameDay = sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (sameYear) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getQualityLabelByCard(card) {
  if (card.quality) {
    // 大小写不敏感匹配
    const qualityLower = card.quality.toLowerCase()
    const quality = qualities.find(q => q.id.toLowerCase() === qualityLower)
    if (quality) return quality.label
    // 如果没匹配到，直接返回原始值（后端可能返回自定义格式）
    return card.quality
  }
  return '2K'
}

// 后端 API feature 值 → 中文标签映射（卡片存储的是 API 值，如 image_reference / text_to_image）
const apiFeatureLabelMap = {
  // 图片
  text_to_image: '文生图',
  image_reference: '参考图',
  // 视频
  text_to_video: '全能参考',
  global_reference: '全能参考',
  multi_reference: '智能多帧',
  // 数字人
  digital_human: '数字人播报'
}

function getFeatureLabelByCard(card) {
  if (!card.feature) return card.type === 'video' ? '全能参考' : '文生图'
  // 优先匹配后端 API feature 值
  if (apiFeatureLabelMap[card.feature]) return apiFeatureLabelMap[card.feature]
  // 其次匹配 UI feature id（部分功能如 style-transfer 直接透传 UI id）
  const features = featureMap[card.type] || []
  const feature = features.find(f => f.id === card.feature)
  return feature ? feature.label : (card.type === 'video' ? '全能参考' : '文生图')
}

const featureMap = {
  image: [
    { id: 'text2img', label: '文生图' },
    { id: 'reference', label: '参考图' },
    { id: 'style-transfer', label: '风格转换' },
    { id: 'inpaint', label: '局部重绘' },
    { id: 'outpaint', label: '扩图' },
    { id: 'erase', label: '消除笔' },
    { id: 'face-swap', label: 'AI换脸' },
    { id: 'outfit-change', label: 'AI换装' }
  ],
  video: [
    { id: 'all-reference', label: '全能参考' },
    { id: 'video-expand', label: '视频扩写' },
    { id: 'first-last-frame', label: '首尾帧' },
    { id: 'smart-multi-frame', label: '智能多帧' },
    { id: 'first-frame-gen', label: '首帧生成' },
    { id: 'motion-imitate', label: '动作模仿' },
    { id: 'lip-sync', label: '对口型' },
    { id: 'ai-outfit', label: 'AI换装' },
    { id: 'scene-replace', label: '场景替换' },
    { id: 'local-adjust', label: '局部调整' },
    { id: 'style-replace', label: '风格替换' },
    { id: 'effect-copy', label: '特效复刻' },
    { id: 'item-fix', label: '物品修复' },
    { id: 'color-restore', label: '色彩还原' },
    { id: 'smart-remove', label: '智能消除' }
  ],
  'digital-human': [
    { id: 'talking-head', label: '数字人播报' },
    { id: 'lip-sync', label: '对口型' },
    { id: 'face-swap', label: 'AI换脸' },
    { id: 'voice-clone', label: '声音克隆' },
    { id: 'emotion-control', label: '情感控制' },
    { id: 'gesture-control', label: '手势控制' }
  ]
}

const currentFeatures = computed(() => {
  const allFeatures = featureMap[selectedType.value] || []
  const model = models.value.find(m => m.id === selectedModel.value)
  // 如果模型有 ui_features 字段，则只显示该模型支持的功能
  if (model && model.ui_features && model.ui_features.length > 0) {
    return allFeatures.filter(f => model.ui_features.includes(f.id))
  }
  return allFeatures
})
const selectedFeatureLabel = computed(() => {
  if (!selectedFeature.value) return selectedType.value === 'video' ? '全能参考' : '文生图'
  const allFeatures = currentFeatures.value
  const feature = allFeatures.find(f => f.id === selectedFeature.value)
  return feature ? feature.label : (selectedType.value === 'video' ? '全能参考' : '文生图')
})

// ========== 下拉框切换函数 ==========
function toggleTypeDropdown() {
  isTypeDropdownOpen.value = !isTypeDropdownOpen.value
  closeOtherDropdowns('type')
  if (isTypeDropdownOpen.value) positionDropdown('type', typeTriggerRef.value || typeTriggerRef2.value, typeDropdownPos)
}
function toggleModelDropdown() {
  isModelDropdownOpen.value = !isModelDropdownOpen.value
  closeOtherDropdowns('model')
  if (isModelDropdownOpen.value) positionDropdown('model', modelTriggerRef.value || modelTriggerRef2.value, modelDropdownPos)
}
function toggleRatioDropdown() {
  isRatioDropdownOpen.value = !isRatioDropdownOpen.value
  closeOtherDropdowns('ratio')
  if (isRatioDropdownOpen.value) positionDropdown('ratio', ratioTriggerRef.value || ratioTriggerRef2.value, ratioDropdownPos)
}
function toggleQualityDropdown() {
  isQualityDropdownOpen.value = !isQualityDropdownOpen.value
  closeOtherDropdowns('quality')
  if (isQualityDropdownOpen.value) positionDropdown('quality', qualityTriggerRef.value || qualityTriggerRef2.value, qualityDropdownPos)
}
function toggleFeatureDropdown() {
  isFeatureDropdownOpen.value = !isFeatureDropdownOpen.value
  closeOtherDropdowns('feature')
  if (isFeatureDropdownOpen.value) positionDropdown('feature', featureTriggerRef.value || featureTriggerRef2.value, featureDropdownPos)
}
function toggleDurationDropdown() {
  isDurationDropdownOpen.value = !isDurationDropdownOpen.value
  closeOtherDropdowns('duration')
  if (isDurationDropdownOpen.value) positionDropdown('duration', durationTriggerRef.value || durationTriggerRef2.value, durationDropdownPos)
}

// 图片生成高级参数下拉框切换函数
function toggleImageCountDropdown() {
  isImageCountDropdownOpen.value = !isImageCountDropdownOpen.value
  closeOtherDropdowns('imageCount')
  if (isImageCountDropdownOpen.value) positionDropdown('imageCount', imageCountTriggerRef.value, imageCountDropdownPos)
}

function toggleImageFormatDropdown() {
  isImageFormatDropdownOpen.value = !isImageFormatDropdownOpen.value
  closeOtherDropdowns('imageFormat')
  if (isImageFormatDropdownOpen.value) positionDropdown('imageFormat', imageFormatTriggerRef.value, imageFormatDropdownPos)
}

function toggleImageQualityDropdown() {
  isImageQualityDropdownOpen.value = !isImageQualityDropdownOpen.value
  closeOtherDropdowns('imageQuality')
  if (isImageQualityDropdownOpen.value) positionDropdown('imageQuality', imageQualityTriggerRef.value, imageQualityDropdownPos)
}

function toggleImageBackgroundDropdown() {
  isImageBackgroundDropdownOpen.value = !isImageBackgroundDropdownOpen.value
  closeOtherDropdowns('imageBackground')
  if (isImageBackgroundDropdownOpen.value) positionDropdown('imageBackground', imageBackgroundTriggerRef.value, imageBackgroundDropdownPos)
}

function closeOtherDropdowns(keep) {
  if (keep !== 'type') isTypeDropdownOpen.value = false
  if (keep !== 'model') isModelDropdownOpen.value = false
  if (keep !== 'ratio') isRatioDropdownOpen.value = false
  if (keep !== 'quality') isQualityDropdownOpen.value = false
  if (keep !== 'feature') isFeatureDropdownOpen.value = false
  if (keep !== 'duration') isDurationDropdownOpen.value = false
  if (keep !== 'upload') isUploadDropdownOpen.value = false
  // 图片生成高级参数下拉框
  if (keep !== 'imageCount') isImageCountDropdownOpen.value = false
  if (keep !== 'imageFormat') isImageFormatDropdownOpen.value = false
  if (keep !== 'imageQuality') isImageQualityDropdownOpen.value = false
  if (keep !== 'imageBackground') isImageBackgroundDropdownOpen.value = false
}

function positionDropdown(name, triggerRef, posRef) {
  nextTick(() => {
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const estimatedHeight = 280
      const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

      if (openUpward) {
        posRef.value = {
          position: 'fixed',
          left: `${rect.left}px`,
          width: `${Math.max(rect.width, 180)}px`,
          bottom: `${window.innerHeight - rect.top + 4}px`,
          zIndex: 99999,
          maxHeight: `${Math.min(280, spaceAbove - 20)}px`
        }
      } else {
        posRef.value = {
          position: 'fixed',
          left: `${rect.left}px`,
          width: `${Math.max(rect.width, 180)}px`,
          top: `${rect.bottom + 4}px`,
          zIndex: 99999,
          maxHeight: `${Math.min(280, window.innerHeight - rect.bottom - 20)}px`
        }
      }
    }
  })
}

function selectType(type) {
  selectedType.value = type.id
  selectedFeature.value = ''
  clearDualUploadSlots()
  isTypeDropdownOpen.value = false
  updateModelsByType()
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function selectModel(model) {
  selectedModel.value = model.id
  isModelDropdownOpen.value = false
  // 如果模型有分辨率变体，自动切换到该模型支持的默认分辨率
  if (model._hasResolutionVariants && model._resolutionVariants) {
    const supportedKeys = Object.keys(model._resolutionVariants)
    if (!supportedKeys.includes(selectedQuality.value)) {
      selectedQuality.value = supportedKeys.includes('1080p') ? '1080p' : supportedKeys[0]
    }
  } else if (model.supported_resolutions && model.supported_resolutions.length > 0) {
    // 无变体但有 supported_resolutions（如 gpt-image-2 的 WxH 格式）
    const supportedLower = model.supported_resolutions.map(r => String(r).toLowerCase())
    // 优先 1080p
    if (supportedLower.includes('1080p')) {
      // 仅保留被新模型支持的标准分辨率，避免残留旧模型的 WxH 格式（如 1024x1024）
      // availableQualities 在匹配到标准分辨率时会过滤掉 WxH 值，故 WxH 残留值需重置
      const isStandardSupported = qualities.some(q => q.id === selectedQuality.value && supportedLower.includes(q.id))
      if (!isStandardSupported) {
        selectedQuality.value = '1080p'
      }
    } else {
      // 不支持 1080p，选最大分辨率（WxH 格式取最大宽度）
      let maxRes = model.supported_resolutions[0]
      let maxPx = 0
      for (const r of model.supported_resolutions) {
        const label = String(r)
        const pxMatch = label.match(/^(\d+)x\d+$/)
        const px = pxMatch ? parseInt(pxMatch[1], 10) : 0
        if (px > maxPx) {
          maxPx = px
          maxRes = label
        }
      }
      selectedQuality.value = maxRes.toLowerCase()
    }
  } else {
    // 模型无分辨率信息：清理非标准残留值（如旧模型的 WxH 格式 1024x1024），保留标准分辨率
    if (!qualities.some(q => q.id === selectedQuality.value)) {
      selectedQuality.value = '1080p'
    }
  }
  // 如果模型有 supported_aspect_ratios，且当前比例不在支持列表内，自动修正
  if (model.supported_aspect_ratios && model.supported_aspect_ratios.length > 0) {
    if (!model.supported_aspect_ratios.includes(selectedRatio.value)) {
      selectedRatio.value = model.supported_aspect_ratios.includes('16:9')
        ? '16:9'
        : model.supported_aspect_ratios[0]
    }
  } else if (!defaultAspectRatios.includes(selectedRatio.value)) {
    // 模型未设置比例：清理非法残留值，回退默认
    selectedRatio.value = '16:9'
  }
  // 如果当前时长超过模型最大时长，自动修正
  if (model.max_duration && videoDuration.value > model.max_duration) {
    videoDuration.value = model.max_duration
  }
  // 如果模型有特定时长列表（如 Seedance 仅支持 5/10/11），自动修正到最接近的合法值
  if (model.valid_durations && model.valid_durations.length > 0) {
    if (!model.valid_durations.includes(videoDuration.value)) {
      videoDuration.value = model.valid_durations.reduce((prev, curr) =>
        Math.abs(curr - videoDuration.value) < Math.abs(prev - videoDuration.value) ? curr : prev
      )
    }
  }
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function selectRatio(ratio) {
  selectedRatio.value = ratio
  isRatioDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function selectQuality(quality) {
  selectedQuality.value = quality.id
  isQualityDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function selectFeature(feature) {
  selectedFeature.value = feature.id
  isFeatureDropdownOpen.value = false
  isUploadDropdownOpen.value = false
  clearDualUploadSlots()
  // 文生图为纯文字生成：选中后清空已有素材并禁止上传
  if (feature.id === 'text2img') {
    clearAllInputAssets()
  }
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}
function selectDuration(dur) {
  videoDuration.value = dur
  isDurationDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// 图片生成高级参数选择函数
function selectImageCount(cnt) {
  imageCount.value = cnt
  isImageCountDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function selectImageFormat(fmt) {
  imageOutputFormat.value = fmt.id
  isImageFormatDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function selectImageOutputQuality(q) {
  imageOutputQuality.value = q.id
  isImageQualityDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function selectImageBackground(bg) {
  imageBackground.value = bg.id
  isImageBackgroundDropdownOpen.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function toggleImageWatermark() {
  imageWatermark.value = !imageWatermark.value
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function getDefaultImageModels() {
  return [
    { id: 'image_5.0_lite', name: '图片5.0 Lite', description: '指令响应更精准', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD' },
    { id: 'image_5.0', name: '图片5.0', description: '全能王者', is_new: true, is_vip: true, free_trial: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD' },
    { id: 'hunyuan_1_5', name: 'Hunyuan 1.5', description: '混元大模型', vendor: 'vendor_a', vendor_name: '腾讯云 VOD' },
    { id: 'gpt-image-2', name: 'GPT Image 2', description: 'text_to_image', vendor: 'vendor_b', vendor_name: 'Token Switch' }
  ]
}

function getDefaultVideoModels() {
  return [
    {
      id: 'kling_3_0', name: 'Kling 3.0', description: '高质量视频生成', vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 10, supported_resolutions: ['720P', '1080P', '2K'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen', 'lip-sync', 'ai-outfit', 'scene-replace']
    },
    {
      id: 'kling_3_0_omni', name: 'Kling 3.0 Omni', description: '全能视频生成', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 8, supported_resolutions: ['720P', '1080P'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen']
    },
    {
      id: 'kling_2_6', name: 'Kling 2.6', description: '高性价比视频生成', vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 10, supported_resolutions: ['720P', '1080P'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen', 'lip-sync']
    },
    {
      id: 'gv_3_1', name: 'GV3.1', description: '通用视频生成', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 10, supported_resolutions: ['720P', '1080P', '2K'],
      ui_features: ['all-reference', 'first-frame-gen']
    },
    {
      id: 'seedance_2.0', name: 'Seedance 2.0', description: '标准版多模态参考', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 10, valid_durations: [5, 10], supported_resolutions: ['720P', '1080P'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen']
    },
    {
      id: 'seedance_2.0_fast_vip', name: 'Seedance 2.0 Fast VIP+', description: '极速推理', is_new: true, is_vip: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 11, valid_durations: [5, 10, 11], supported_resolutions: ['720P', '1080P'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen']
    },
    {
      id: 'seedance_2.0_fast', name: 'Seedance 2.0 Fast', description: '高性价比', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD',
      sound_mode: 'free', max_duration: 11, valid_durations: [5, 10, 11], supported_resolutions: ['720P', '1080P'],
      ui_features: ['all-reference', 'first-last-frame', 'first-frame-gen']
    },
    {
      id: 'happyhorse-1.0-video-edit-720p', name: 'HappyHorse Video Edit 720p', description: '视频编辑', vendor: 'vendor_b', vendor_name: 'Token Switch',
      sound_mode: 'forced-sound', max_duration: 10, supported_resolutions: ['720P'],
      ui_features: ['all-reference']
    },
    {
      id: 'happyhorse-1.0-video-edit-1080p', name: 'HappyHorse Video Edit 1080p', description: '视频编辑', vendor: 'vendor_b', vendor_name: 'Token Switch',
      sound_mode: 'forced-sound', max_duration: 10, supported_resolutions: ['1080P'],
      ui_features: ['all-reference']
    },
    {
      id: 'happyhorse-1.0-r2v-720p', name: 'HappyHorse R2V 720p', description: '图生视频', vendor: 'vendor_b', vendor_name: 'Token Switch',
      sound_mode: 'forced-sound', max_duration: 10, supported_resolutions: ['720P'],
      ui_features: ['all-reference']
    },
    {
      id: 'happyhorse-1.0-r2v-1080p', name: 'HappyHorse R2V 1080p', description: '图生视频', vendor: 'vendor_b', vendor_name: 'Token Switch',
      sound_mode: 'forced-sound', max_duration: 10, supported_resolutions: ['1080P'],
      ui_features: ['all-reference']
    }
  ]
}

function getDefaultAudioModels() {
  return [
    { id: 'audio_1.0', name: '音频生成 1.0', description: '高质量音频生成', is_new: true, vendor: 'vendor_a', vendor_name: '腾讯云 VOD' },
    { id: 'music-gen-2.0', name: '音乐生成 2.0', description: '专业音乐创作', is_new: true, is_vip: true, vendor: 'vendor_b', vendor_name: 'Token Switch' }
  ]
}

function updateModelsByType() {
  console.log('🔄 切换生成类型:', selectedType.value, {
    image: imageModels.value.length,
    video: videoModels.value.length,
    digitalHuman: digitalHumanModels.value.length
  })

  switch (selectedType.value) {
    case 'image':
      models.value = [...imageModels.value]
      break
    case 'video':
      models.value = [...videoModels.value]
      break
    case 'digital-human':
      models.value = [...digitalHumanModels.value]
      break
    case 'audio':
      models.value = [...audioModels.value]
      break
    default:
      models.value = [...videoModels.value]
  }

  selectedModel.value = ''
  console.log('✅ 模型列表已更新, 当前模型数量:', models.value.length, `(${selectedType.value})`)
}

async function initModels() {
  console.log('🚀 开始初始化模型列表...')

  // 先尝试从 localStorage 缓存加载，实现秒开
  const CACHE_KEY = 'model_config_cache'
  const CACHE_TTL = 30 * 60 * 1000
  const cachedData = getStorageWithExpiry(CACHE_KEY) || getStorage(CACHE_KEY + '_fallback')
  if (cachedData) {
    const cached = classifyModels(cachedData)
    imageModels.value = cached.image.length > 0 ? cached.image : mergeResolutionVariants(getDefaultImageModels())
    videoModels.value = cached.video.length > 0 ? cached.video : mergeResolutionVariants(getDefaultVideoModels())
    digitalHumanModels.value = cached.digitalHuman.length > 0 ? cached.digitalHuman : []
    audioModels.value = cached.audio?.length > 0 ? cached.audio : getDefaultAudioModels()
    updateModelsByType()
    console.log('📦 使用缓存模型配置秒开')
  }

  const isConnected = await testApiConnection()

  if (!isConnected) {
    console.warn('⚠️ API 未连通，将使用默认硬编码模型')
    if (!cachedData) {
      showToast('无法连接到后端服务，使用默认模型', 'warning')
      imageModels.value = mergeResolutionVariants(getDefaultImageModels())
      videoModels.value = mergeResolutionVariants(getDefaultVideoModels())
      digitalHumanModels.value = []
      audioModels.value = getDefaultAudioModels()
      updateModelsByType()
    } else {
      showToast('使用缓存模型配置', 'info')
    }
  } else {
    const fetchedModels = await fetchModels()
    // 写入缓存
    setStorageWithExpiry(CACHE_KEY, fetchedModels, CACHE_TTL)
    setStorage(CACHE_KEY + '_fallback', fetchedModels)

    const classified = classifyModels(fetchedModels)

    imageModels.value = classified.image.length > 0 ? classified.image : mergeResolutionVariants(getDefaultImageModels())
    videoModels.value = classified.video.length > 0 ? classified.video : mergeResolutionVariants(getDefaultVideoModels())
    digitalHumanModels.value = classified.digitalHuman.length > 0 ? classified.digitalHuman : []
    audioModels.value = classified.audio?.length > 0 ? classified.audio : getDefaultAudioModels()

    updateModelsByType()
  }

  console.log('✅ 模型列表初始化完成:', {
    图片生成: imageModels.value.length,
    视频生成: videoModels.value.length,
    数字人: digitalHumanModels.value.length,
    当前显示: models.value.length,
    总计: imageModels.value.length + videoModels.value.length + digitalHumanModels.value.length
  })
}

// 切换生成类型时自动更新模型列表
watch(selectedType, (newType) => {
  console.log('🔄 切换生成类型:', newType)
  selectedModel.value = ''
  selectedFeature.value = ''
  uploadedFiles.value = []
  clearDualUploadSlots()
  updateModelsByType()
  console.log('✅ 模型列表已更新, 当前模型数量:', models.value.length, `(${newType})`)
})

// 切换模型时根据声音模式自动调整状态
watch(soundToggleMode, (mode) => {
  if (mode === 'forced-sound') {
    videoSoundEnabled.value = true
  } else if (mode === 'disabled-silent') {
    videoSoundEnabled.value = false
  }
  // mode === 'free' 时不干预，保留用户选择
})

// ========== 文件上传 ==========
function handleUploadType(fileType) {
  // 文生图模式下禁止上传
  if (isTextToImageMode.value) return
  isUploadDropdownOpen.value = false
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  switch (fileType) {
    case 'image': input.accept = 'image/*'; break
    case 'video': input.accept = 'video/*'; break
    case 'audio': input.accept = 'audio/*'; break
    default: input.accept = 'image/*,video/*,audio/*'
  }
  input.onchange = async (e) => {
    const files = Array.from(e.target.files)
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = (event) => {
        let detectedType = fileType
        if (file.type.startsWith('image/')) detectedType = 'image'
        else if (file.type.startsWith('video/')) detectedType = 'video'
        else if (file.type.startsWith('audio/')) detectedType = 'audio'
        uploadedFiles.value.push({
          type: detectedType,
          url: event.target.result,
          purpose: 'reference',
          object_id: `${detectedType}_${uploadedFiles.value.length + 1}`,
          name: file.name
        })
      }
      reader.readAsDataURL(file)
    }
    nextTick(() => { if (window.lucide) lucide.createIcons() })
  }
  input.click()
}

// 云资料库数据（从后端获取，5 条/批流式自动加载直到完成）
const cloudAssets = ref([])
const cloudLoading = ref(false)        // 首屏加载（遮罩 loading）
const cloudLoadingMore = ref(false)    // 后台自动续拉中（底部 loading）
const cloudHasMore = ref(false)        // 后端是否还有下一批
const cloudNextOffset = ref(0)         // 下一批续拉 offset
// 自动加载循环令牌：每次开弹窗自增，旧循环检测到 token 变化即退出
let cloudLoadToken = 0
const showCloudModal = ref(false)
const cloudModalFileType = ref('image')

// 云资料库视频首帧加载完成：尝试 seek 到 0.1s 以确保首帧可见；失败则保留 placeholder
function onCloudVideoFirstFrame(e) {
  const video = e.target
  try {
    // 某些浏览器需主动 seek 才能渲染首帧
    if (video.currentTime === 0) {
      video.currentTime = 0.1
    }
  } catch (_) {}
}

// 云资料库视频加载失败：回退为 video 图标占位符，避免空白
function onCloudVideoError(e) {
  const video = e.target
  const wrap = video?.parentElement
  if (!wrap) return
  wrap.classList.add('cloud-asset-video-failed')
  // 用占位图标替换 video 节点，避免一直显示空白
  const placeholder = document.createElement('div')
  placeholder.className = 'cloud-asset-placeholder'
  placeholder.innerHTML = '<i data-lucide="video" style="width: 28px; height: 28px;"></i>'
  wrap.replaceChild(placeholder, video)
  // 移除播放按钮叠加层
  const overlay = wrap.querySelector('.cloud-asset-play-overlay')
  if (overlay) overlay.remove()
  if (window.lucide) lucide.createIcons()
}

// 将后端 MediaListItem 转为云资料库卡片所需结构
function transformCloudAsset(item) {
  return {
    id: item.media_id || item.id,
    media_id: item.media_id || null,  // Seedance 素材库引用所需（见 SEEDANCE_RESOURCE_LIBRARY.md §2）
    type: item.media_type || 'image',
    name: item.media_name || '未命名',
    url: item.media_url || '',
    thumbnail: item.thumbnail_url || item.media_url || '',
    size: item.file_size ? formatCloudFileSize(item.file_size) : '未知',
    duration: item.duration || null
  }
}

// 重置云资料库分页状态（打开弹窗时调用）
function resetCloudAssetsState() {
  cloudAssets.value = []
  cloudHasMore.value = false
  cloudNextOffset.value = 0
}

// 从后端加载云资产：首批 5 条快速渲染，之后自动续拉直到 has_more=false
async function loadCloudAssets() {
  console.log('[GenerateView] 加载云资产（自动续拉直到完成）')
  // 自增 token，使之前未完成的循环失效
  const token = ++cloudLoadToken
  resetCloudAssetsState()
  cloudLoading.value = true
  try {
    // limit=0 表示请求全部（后端按 5 条/批返回，最多 500 条硬上限）
    // 此时后端 has_more 才会持续为 true 直到全部加载完（含 500 截断）
    // 注：若用 limit=5，后端 has_more 只表示「本次目标 5 条内是否还有下一批」，
    // 返回 5 条后 has_more=false，循环会提前终止。
    const STREAM_LIMIT_ALL = 0
    const res1 = await getMediaStreamApi({ limit: STREAM_LIMIT_ALL, offset: 0 })
    if (isUnmounted.value || token !== cloudLoadToken) return
    console.log('[GenerateView] 云资产首批响应:', res1)

    const data1 = res1?.data || {}
    const items1 = Array.isArray(data1.items) ? data1.items : []
    cloudAssets.value = items1.map(transformCloudAsset)
    cloudHasMore.value = !!data1.has_more
    cloudNextOffset.value = typeof data1.next_offset === 'number' ? data1.next_offset : 0
    console.log('[GenerateView] 云资产首批:', cloudAssets.value.length, 'has_more:', cloudHasMore.value, 'total_available:', data1.total_available)

    // 首屏渲染完成，关闭遮罩 loading
    if (!isUnmounted.value && token === cloudLoadToken) cloudLoading.value = false

    // 自动续拉剩余批次，直到 has_more=false（DB 耗尽或触达 500 硬上限）
    while (cloudHasMore.value) {
      if (isUnmounted.value || token !== cloudLoadToken) return
      cloudLoadingMore.value = true
      const offset = cloudNextOffset.value
      const res = await getMediaStreamApi({ limit: STREAM_LIMIT_ALL, offset })
      if (isUnmounted.value || token !== cloudLoadToken) return

      const data = res?.data || {}
      const items = Array.isArray(data.items) ? data.items : []
      if (items.length > 0) {
        cloudAssets.value = [...cloudAssets.value, ...items.map(transformCloudAsset)]
      }
      cloudHasMore.value = !!data.has_more
      cloudNextOffset.value = typeof data.next_offset === 'number' ? data.next_offset : 0
      console.log('[GenerateView] 云资产续拉:', items.length, '累计:', cloudAssets.value.length, 'has_more:', cloudHasMore.value)
    }
  } catch (err) {
    console.error('[GenerateView] 加载云资产失败:', err)
    if (!isUnmounted.value && token === cloudLoadToken) {
      // 仅首批失败才清空；续拉失败保留已加载部分
      if (cloudAssets.value.length === 0) {
        cloudHasMore.value = false
      }
    }
  } finally {
    if (!isUnmounted.value && token === cloudLoadToken) {
      cloudLoading.value = false
      cloudLoadingMore.value = false
    }
  }
}

function formatCloudFileSize(bytes) {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

function handleUploadFromCloud() {
  // 文生图模式下禁止上传
  if (isTextToImageMode.value) return
  isUploadDropdownOpen.value = false
  cloudModalFileType.value = null
  showCloudModal.value = true
  // 每次打开弹窗时从后端加载最新数据
  loadCloudAssets()
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function closeCloudModal() {
  showCloudModal.value = false
}

function selectCloudAsset(asset) {
  console.log('[GenerateView] 选择云资产:', asset)
  // 优先使用 url，其次 thumbnail
  const assetUrl = asset.url || asset.thumbnail || ''

  // 如果是从双上传框的云资料库选择，直接填入对应slot
  if (currentDualUploadSlot.value) {
    const slotKey = currentDualUploadSlot.value
    const config = dualUploadConfig.value
    const slotConfig = config ? config[slotKey] : null
    dualUploadSlots.value[slotKey] = {
      type: asset.type,
      url: assetUrl,
      purpose: slotConfig ? slotConfig.key : slotKey,
      object_id: slotConfig ? `${slotConfig.key}_1` : `${slotKey}_1`,
      media_id: asset.media_id || null,  // 透传素材库 media_id，供 Seedance 资源化（见 SEEDANCE_RESOURCE_LIBRARY.md §2）
      name: asset.name,
      fromCloud: true
    }
    currentDualUploadSlot.value = null
    showCloudModal.value = false
    nextTick(() => { if (window.lucide) lucide.createIcons() })
    return
  }
  uploadedFiles.value.push({
    type: asset.type,
    url: assetUrl,
    purpose: 'reference',
    object_id: `cloud_${asset.id}`,
    media_id: asset.media_id || null,  // 透传素材库 media_id，供 Seedance 资源化（见 SEEDANCE_RESOURCE_LIBRARY.md §2）
    name: asset.name,
    fromCloud: true
  })
  showCloudModal.value = false
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

const filteredCloudAssets = computed(() => {
  if (!cloudModalFileType.value) return cloudAssets.value
  return cloudAssets.value.filter(a => a.type === cloudModalFileType.value)
})

function removeUploadedFile(index) {
  const removed = uploadedFiles.value.splice(index, 1)[0]
  if (removed && removed.object_id) {
    referencedFiles.value.filter(r => r.sourceId === removed.object_id).forEach(ref => removeAtTag(ref.atId))
  }
  resequenceAtTags()
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// ========== 媒体预览功能 ==========
function openFilePreview(file) {
  previewFile.value = file
  showPreviewModal.value = true
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function closePreviewModal() {
  showPreviewModal.value = false
  previewFile.value = null
}

// 预览生成结果
function previewResult(result) {
  const file = {
    type: result.type,
    url: result.displayUrl || result.url,
    name: `生成结果_${Date.now()}`
  }
  openFilePreview(file)
}

// ========== 双上传框功能 ==========
function handleDualUpload(slotKey, accept) {
  dualUploadDropdown.value = null
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept || 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      let detectedType = 'image'
      if (file.type.startsWith('video/')) detectedType = 'video'
      else if (file.type.startsWith('audio/')) detectedType = 'audio'
      const config = dualUploadConfig.value
      const slotConfig = config ? config[slotKey] : null
      dualUploadSlots.value[slotKey] = {
        type: detectedType,
        url: event.target.result,
        purpose: slotConfig ? slotConfig.key : slotKey,
        object_id: slotConfig ? `${slotConfig.key}_1` : `${slotKey}_1`,
        name: file.name
      }
      nextTick(() => { if (window.lucide) lucide.createIcons() })
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function handleDualUploadFromCloud(slotKey) {
  dualUploadDropdown.value = null
  currentDualUploadSlot.value = slotKey
  handleUploadFromCloud()
}

function removeDualUpload(slotKey) {
  dualUploadSlots.value[slotKey] = null
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function clearDualUploadSlots() {
  dualUploadSlots.value = { slot1: null, slot2: null }
}

// 清空所有输入素材（上传文件、引用文件、双上传框、@标签），保留 prompt 文字
function clearAllInputAssets() {
  uploadedFiles.value = []
  referencedFiles.value = []
  clearDualUploadSlots()
  atTags.value = []
  activeAtTagId.value = null
  atImageCounter = 0
  atVideoCounter = 0
  atAudioCounter = 0
  // 移除编辑器中残留的 @ 标签 DOM 元素，并同步 prompt 文本
  const editors = [promptEditorRef.value, promptEditorRefBottom.value]
  for (const editor of editors) {
    if (!editor) continue
    editor.querySelectorAll('[data-at-id]').forEach(el => el.remove())
  }
  const activeEditor = promptEditorRef.value || promptEditorRefBottom.value
  if (activeEditor) prompt.value = activeEditor.innerText
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// 声音按钮点击：使用内联SVG，无需调用 lucide.createIcons
function handleSoundToggle() {
  if (soundToggleDisabled.value) return
  videoSoundEnabled.value = !videoSoundEnabled.value
}

/** 删除后重新编排@标签编号，保持连续 */
function resequenceAtTags() {
  let imgSeq = 0, vidSeq = 0, audSeq = 0
  for (const tag of atTags.value) {
    if (tag.type === 'video') {
      vidSeq++
      const newLabel = `视频${vidSeq}`
      tag.label = newLabel; tag.fullTag = `@${newLabel}`
      const ref = referencedFiles.value.find(r => r.atId === tag.id)
      if (ref) { ref.atLabel = newLabel; ref.atTag = `@${newLabel}` }
      const domEl = document.querySelector(`[data-at-id="${tag.id}"] .at-tag-card-badge`)
      if (domEl) domEl.textContent = tag.fullTag
    } else if (tag.type === 'audio') {
      audSeq++
      const newLabel = `音频${audSeq}`
      tag.label = newLabel; tag.fullTag = `@${newLabel}`
      const ref = referencedFiles.value.find(r => r.atId === tag.id)
      if (ref) { ref.atLabel = newLabel; ref.atTag = `@${newLabel}` }
      const domEl = document.querySelector(`[data-at-id="${tag.id}"] .at-tag-card-badge`)
      if (domEl) domEl.textContent = tag.fullTag
    } else {
      imgSeq++
      const newLabel = `图片${imgSeq}`
      tag.label = newLabel; tag.fullTag = `@${newLabel}`
      const ref = referencedFiles.value.find(r => r.atId === tag.id)
      if (ref) { ref.atLabel = newLabel; ref.atTag = `@${newLabel}` }
      const domEl = document.querySelector(`[data-at-id="${tag.id}"] .at-tag-card-badge`)
      if (domEl) domEl.textContent = tag.fullTag
    }
  }
  atImageCounter = imgSeq; atVideoCounter = vidSeq; atAudioCounter = audSeq
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (editor) prompt.value = editor.innerText.replace(/\u200B/g, '')
}

function getFileTypeLabel(type) {
  return { image: '图片', video: '视频', audio: '音频' }[type] || type
}

// ========== @提及功能 ==========
function closeMentionDropdown() {
  showAtMentionDropdown.value = false
  mentionAnchorRange = null
  activeMentionIndex.value = 0
}

function getTextBeforeCursor(editor, range) {
  const container = range.startContainer
  const offset = range.startOffset
  if (container.nodeType === Node.TEXT_NODE) {
    let text = container.textContent.slice(0, offset)
    let node = container
    while ((node = node.previousSibling)) {
      if (node.nodeType === Node.TEXT_NODE) text = node.textContent + text
      else if (node.nodeType === Node.ELEMENT_NODE) text = node.textContent + text
    }
    let parent = container.parentNode
    while (parent && parent !== editor) {
      let prev = parent.previousSibling
      while (prev) { text = prev.textContent + text; prev = prev.previousSibling }
      parent = parent.parentNode
    }
    return text
  }
  return ''
}

function checkAtMention(e) {
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (!editor) { closeMentionDropdown(); return }
  const selection = window.getSelection()
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) { closeMentionDropdown(); return }

  // 填充候选列表（排除已引用的文件）
  const referencedIds = new Set(referencedFiles.value.map(r => r.sourceId))
  let candidates = uploadedFiles.value.filter(f => !referencedIds.has(f.object_id))
  // 双上传框模式下，上传下拉被隐藏，将 slot 文件也纳入 @ 候选
  if (isDualUploadFeature.value) {
    const slotFiles = [dualUploadSlots.value.slot1, dualUploadSlots.value.slot2].filter(Boolean)
    const slotCandidates = slotFiles
      .filter(f => !referencedIds.has(f.object_id))
      .map(f => ({ ...f, name: f.name || (f.type === 'video' ? '原始视频' : '参考素材') }))
    candidates = [...candidates, ...slotCandidates]
  }
  atMentionCandidates.value = candidates

  const range = selection.getRangeAt(0)
  const textBeforeCaret = getTextBeforeCursor(editor, range)
  const atMatch = textBeforeCaret.match(/@(\w*)$/)

  if (atMatch && atMentionCandidates.value.length > 0) {
    mentionAnchorRange = range.cloneRange()
    mentionAnchorRange.setStart(range.startContainer, range.startOffset - atMatch[0].length)

    const rect = range.getBoundingClientRect()
    showAtMentionDropdown.value = true
    activeMentionIndex.value = 0

    const estimatedHeight = 240
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < estimatedHeight + 20 && spaceAbove > spaceBelow

    if (openUpward) {
      mentionDropdownStyle.value = {
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 6}px`,
        left: `${rect.left + 8}px`,
        width: `${Math.min(rect.width - 16, 360)}px`,
        zIndex: 99999,
        maxHeight: `${Math.min(estimatedHeight, spaceAbove - 20)}px`
      }
    } else {
      mentionDropdownStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 6}px`,
        left: `${rect.left + 8}px`,
        width: `${Math.min(rect.width - 16, 360)}px`,
        zIndex: 99999,
        maxHeight: `${Math.min(estimatedHeight, window.innerHeight - rect.bottom - 20)}px`
      }
    }
  } else {
    closeMentionDropdown()
  }
}

function selectAtMention(file) {
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (!editor) { closeMentionDropdown(); return }

  // 删除输入的@字符，保留光标位置
  if (mentionAnchorRange) {
    try {
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(mentionAnchorRange)
      mentionAnchorRange.deleteContents()
    } catch (_) {}
  }

  // 创建引用记录（编号 = 当前同类型标签数 + 1，不依赖全局计数器）
  const typeKeyMap = { image: '图片', video: '视频', audio: '音频' }
  const typeKey = typeKeyMap[file.type] || '图片'
  const existingCount = atTags.value.filter(t => t.type === file.type).length
  const counter = existingCount + 1
  const atLabel = `${typeKey}${counter}`
  const atId = `at_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const refEntry = {
    ...file,
    atId,
    atLabel,
    atTag: `@${atLabel}`,
    sourceId: file.object_id,
  }
  referencedFiles.value.push(refEntry)

  const newAtTag = {
    id: atId,
    type: file.type,
    label: atLabel,
    fullTag: `@${atLabel}`,
    refEntry
  }
  atTags.value.push(newAtTag)

  // 插入带缩略图的标签到编辑器
  insertAtTagToPrompt(newAtTag)
  closeMentionDropdown()

  nextTick(() => {
    editor.focus()
    if (window.lucide) lucide.createIcons()
  })
}

function insertAtTagToPrompt(tag) {
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (!editor) return

  // 芯片式HTML：标签 + 关闭按钮（无图标，避免乱码）
  const innerHtml = `
    <span class="at-tag-card-badge">${tag.fullTag}</span>
    <button class="at-tag-close" data-at-id="${tag.id}" title="取消引用"></button>
  `

  const selection = window.getSelection()

  if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.className = `at-tag-inline at-tag-${tag.type}`
    span.contentEditable = 'false'
    span.dataset.atId = tag.id
    span.innerHTML = innerHtml
    range.insertNode(span)
    // 在span后插入零宽空格，确保光标有位置可落
    const zwsp = document.createTextNode('\u200B')
    range.setStartAfter(span)
    range.insertNode(zwsp)
    range.setStartAfter(zwsp)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } else {
    editor.innerHTML += `<span class="at-tag-inline at-tag-${tag.type}" contenteditable="false" data-at-id="${tag.id}">${innerHtml}</span>\u200B`
  }

  activeAtTagId.value = tag.id
  prompt.value = editor.innerText.replace(/\u200B/g, '')

  nextTick(() => bindInlineCloseButtons())
}

function bindInlineCloseButtons() {
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (!editor) return
  editor.querySelectorAll('.at-tag-close').forEach(btn => {
    if (btn._bound) return
    btn._bound = true
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const atId = btn.dataset.atId
      if (atId) removeAtTag(atId)
    })
  })
}

function removeAtTag(atId) {
  // 从标签列表中移除
  const tagIdx = atTags.value.findIndex(t => t.id === atId)
  if (tagIdx !== -1) atTags.value.splice(tagIdx, 1)

  // 从引用列表中移除
  const refIdx = referencedFiles.value.findIndex(r => r.atId === atId)
  if (refIdx !== -1) referencedFiles.value.splice(refIdx, 1)

  // 从编辑器DOM中移除
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (editor) {
    const el = editor.querySelector(`[data-at-id="${atId}"]`)
    if (el) el.remove()
    prompt.value = editor.innerText
  }

  if (activeAtTagId.value === atId) activeAtTagId.value = null

  // 重置计数器
  recalcCounters()

  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function recalcCounters() {
  let maxVideo = 0, maxImage = 0, maxAudio = 0
  for (const t of atTags.value) {
    if (t.type === 'video') {
      const n = parseInt(t.label.replace('视频', ''), 10) || 0
      if (n > maxVideo) maxVideo = n
    } else if (t.type === 'audio') {
      const n = parseInt(t.label.replace('音频', ''), 10) || 0
      if (n > maxAudio) maxAudio = n
    } else if (t.type === 'image') {
      const n = parseInt(t.label.replace('图片', ''), 10) || 0
      if (n > maxImage) maxImage = n
    }
  }
  atVideoCounter = maxVideo
  atImageCounter = maxImage
  atAudioCounter = maxAudio
}

function focusAtTagById(atId) {
  activeAtTagId.value = atId
  const el = document.querySelector(`[data-at-id="${atId}"]`)
  if (el) { el.classList.add('at-tag-inline-highlight'); setTimeout(() => el.classList.remove('at-tag-inline-highlight'), 1000) }
}

function clickToReference(file) {
  if (!uploadedFiles.value.some(f => f.object_id === file.object_id)) uploadedFiles.value.push({ ...file })
  atMentionCandidates.value = [file]
  showAtMentionDropdown.value = true
  activeMentionIndex.value = 0
  selectAtMention(file)
}

function onPromptInput(e) {
  const editor = e.target
  const text = editor.innerText || ''
  if (text.length <= 2000) { prompt.value = text.replace(/\u200B/g, '') }
  else { editor.innerText = text.slice(0, 2000); prompt.value = text.slice(0, 2000) }
  checkAtMention(e)
  syncRemovedAtTags(editor)
}

/** 同步清理：编辑器中已被删除的@标签DOM，同步移除referencedFiles和atTags */
function syncRemovedAtTags(editor) {
  if (!editor || atTags.value.length === 0) return
  const domAtIds = new Set()
  editor.querySelectorAll('[data-at-id]').forEach(el => { domAtIds.add(el.dataset.atId) })
  const removed = atTags.value.filter(t => !domAtIds.has(t.id))
  if (removed.length === 0) return
  for (const tag of removed) {
    removeAtTag(tag.id)
  }
}

function onPromptKeydown(e) {
  if (showAtMentionDropdown.value) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeMentionIndex.value = Math.min(activeMentionIndex.value + 1, atMentionCandidates.value.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeMentionIndex.value = Math.max(activeMentionIndex.value - 1, 0) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (atMentionCandidates.value[activeMentionIndex.value]) selectAtMention(atMentionCandidates.value[activeMentionIndex.value]) }
    else if (e.key === 'Escape') showAtMentionDropdown.value = false
    return
  }
  if (e.key === '@') { nextTick(() => checkAtMention(e)); return }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canGenerate.value && !isGenerating.value) handleGenerate() }
}

function onDragStart() {}
function onDragEnd() {}

// ========== 生成请求 ==========

let globalModels = {
  image_models: [],
  video_models: [],
  voices: []
}

async function testApiConnection() {
  try {
    const { data } = await request.get('/api/v1/models')
    return data.code === 200
  } catch (error) {
    console.error('API 连通性测试失败:', error)
    return false
  }
}

async function fetchModels() {
  try {
    const { data } = await request.get('/api/v1/models')
    if (isUnmounted.value) return
    if (data.code !== 200) throw new Error(safeMessage(data.message, '获取模型列表失败'))

    globalModels = data.data || { image_models: [], video_models: [], voices: [] }
    console.log('✅ 模型列表获取成功:', globalModels)

    if (data.data?.summary) {
      const s = data.data.summary
      console.log('📊 模型统计:',
        `图片=${s.total_image_models}, 视频=${s.total_video_models}, 音色=${s.total_voices}`,
        '| 厂商:', s.vendors?.join(', '))
    }

    return globalModels
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error)
    if (!isUnmounted.value) showToast('获取模型列表失败，请检查后端服务', 'error')
    return { image_models: [], video_models: [], voices: [] }
  }
}

// 分辨率后缀匹配规则（从 ID 或 name 末尾提取）
// 需与 qualities / RESOLUTION_OPTIONS 保持一致：480p/720P/1080P/2K/4K
const RESOLUTION_SUFFIX_RE = /[-_](480p|720p|1080p|2k|4k)$/i

/**
 * 从模型ID/名称中提取基础名和分辨率
 * @returns {{ baseId: string, resolution: string|null }} 或 null（无分辨率后缀）
 */
function parseResolutionVariant(modelId, modelName) {
  const idStr = String(modelId || '')
  // 优先从 id 提取
  let match = idStr.match(RESOLUTION_SUFFIX_RE)
  if (match) {
    return { baseId: idStr.slice(0, -match[0].length), resolution: match[1].toLowerCase() }
  }
  // 其次从 name 提取
  const nameStr = String(modelName || '')
  match = nameStr.match(RESOLUTION_SUFFIX_RE)
  if (match) {
    return { baseId: idStr || nameStr.slice(0, -match[0].length), resolution: match[1].toLowerCase() }
  }
  return null
}

// 分辨率 key 规范化（统一为小写，用于内部映射匹配）
function normalizeResKey(r) {
  return String(r || '').toLowerCase()
}

// 小写 key → 标准大写展示格式（与 qualities 对齐）
const RES_KEY_TO_LABEL = { '480p': '480P', '720p': '720P', '1080p': '1080P', '2k': '2K', '4k': '4K' }

/**
 * 从模型对象提取其代表的单一分辨率。
 * 后端按分辨率拆分模型时，每个变体的 supported_resolutions / supported_quality 为单值数组；
 * 多值数组通常是汇总条目，不作为单一变体来源。
 * @returns {string|null} 小写分辨率 key，如 '720p'；无法确定时返回 null
 */
function extractSingleResolution(m) {
  if (Array.isArray(m.supported_resolutions) && m.supported_resolutions.length === 1) {
    return normalizeResKey(m.supported_resolutions[0])
  }
  if (Array.isArray(m.supported_quality) && m.supported_quality.length === 1) {
    return normalizeResKey(m.supported_quality[0])
  }
  return null
}

/**
 * 将同一基础模型的不同分辨率变体合并为一个模型对象。
 * 支持两种后端拆分方式：
 *   1. 旧式：模型 ID/name 带分辨率后缀（如 happyhorse-1.0-r2v-720p）
 *   2. 新式：相同 model id 多条记录，每条 supported_resolutions 为单值（如 kling_1_6 × 5）
 * 合并后挂载 _resolutionVariants: { [resolution]: originalModelId }，supported_resolutions 为全集
 */
function mergeResolutionVariants(modelList) {
  const groupMap = new Map() // baseKey -> { merged: Model, variants: Map<resolution, rawModel> }
  const noSuffix = [] // 无 ID 后缀的模型，待按 id 二次分组

  // 第一阶段：ID/name 后缀分组（兼容旧式 -720p 命名）
  for (const m of modelList) {
    const parsed = parseResolutionVariant(m.id, m.name)
    if (parsed && parsed.resolution) {
      const base = parsed.baseId
      if (!groupMap.has(base)) {
        // 第一个变体作为合并模板
        const merged = { ...m }
        // 清理显示名称中的分辨率后缀
        for (const field of ['name', 'display_name']) {
          if (merged[field]) {
            merged[field] = String(merged[field]).replace(RESOLUTION_SUFFIX_RE, '').trim()
          }
        }
        merged._resolutionVariants = {}
        merged._hasResolutionVariants = true
        merged._baseModelId = base
        // supported_resolutions 后面用所有变体的并集覆盖，先清空避免用第一条的单值
        merged.supported_resolutions = []
        groupMap.set(base, { merged, variants: new Map() })
      }
      const group = groupMap.get(base)
      group.variants.set(parsed.resolution, m)
      group.merged._resolutionVariants[parsed.resolution] = m.id
      // 保存各变体的价格字段，供前端本地计价使用
      if (!group.merged._variantPriceData) group.merged._variantPriceData = {}
      group.merged._variantPriceData[parsed.resolution] = {
        price_per_request: m.price_per_request,
        price_per_second: m.price_per_second,
        price_tiers: m.price_tiers,
        price_multiplier: m.price_multiplier,
        currency: m.currency
      }
      // 累加该变体声明的分辨率到全集（标准大写格式）
      const resList = Array.isArray(m.supported_resolutions) && m.supported_resolutions.length > 0
        ? m.supported_resolutions
        : (m.supported_quality || [parsed.resolution])
      for (const r of resList) {
        const key = normalizeResKey(r)
        const label = RES_KEY_TO_LABEL[key] || String(r).toUpperCase()
        if (!group.merged.supported_resolutions.includes(label)) {
          group.merged.supported_resolutions.push(label)
        }
      }
    } else {
      noSuffix.push(m)
    }
  }

  // 第一阶段结束后，对 supported_resolutions 按 qualities 顺序排序
  for (const g of groupMap.values()) {
    if (g.merged._hasResolutionVariants && Array.isArray(g.merged.supported_resolutions)) {
      const order = ['480P', '720P', '1080P', '2K', '4K']
      g.merged.supported_resolutions.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    }
  }

  // 第二阶段：对无后缀模型按 id 分组（后端按分辨率拆分，同 id 多条）
  const idGroups = new Map() // id -> [models]
  for (const m of noSuffix) {
    const key = String(m.id || m.name || '')
    if (!key) continue
    if (!idGroups.has(key)) idGroups.set(key, [])
    idGroups.get(key).push(m)
  }

  for (const [id, group] of idGroups) {
    if (group.length === 1) {
      // 单条，无分辨率变体，直接保留
      groupMap.set('__plain__' + id, { merged: group[0], variants: new Map() })
      continue
    }
    // 同 id 多条 → 按分辨率合并
    const merged = { ...group[0] }
    const allResKeys = new Set()
    const variants = {}
    const variantPriceData = {}
    for (const m of group) {
      // 收集每个变体声明的所有分辨率（取并集，汇总条目也会被纳入）
      const resList = Array.isArray(m.supported_resolutions) && m.supported_resolutions.length > 0
        ? m.supported_resolutions
        : (m.supported_quality || [])
      resList.forEach(r => allResKeys.add(normalizeResKey(r)))
      // 单值条目作为明确的变体映射
      const singleRes = extractSingleResolution(m)
      if (singleRes) {
        variants[singleRes] = m.id
        // 保存该变体的价格字段
        variantPriceData[singleRes] = {
          price_per_request: m.price_per_request,
          price_per_second: m.price_per_second,
          price_tiers: m.price_tiers,
          price_multiplier: m.price_multiplier,
          currency: m.currency
        }
      }
    }
    // 用全集补全 variants（同 id 情况下映射值相同，后端按 model + resolution 计费）
    for (const r of allResKeys) {
      if (!variants[r]) variants[r] = id
    }
    if (Object.keys(variants).length > 0) {
      merged._resolutionVariants = variants
      merged._hasResolutionVariants = true
      merged._baseModelId = id
      if (Object.keys(variantPriceData).length > 0) {
        merged._variantPriceData = variantPriceData
      }
      merged.supported_resolutions = Array.from(allResKeys)
        .map(r => RES_KEY_TO_LABEL[r] || r.toUpperCase())
        // 按 qualities 顺序排序，便于展示
        .sort((a, b) => {
          const order = ['480P', '720P', '1080P', '2K', '4K']
          return order.indexOf(a) - order.indexOf(b)
        })
    }
    groupMap.set('__id__' + id, { merged, variants: new Map() })
  }

  return Array.from(groupMap.values()).map(g => g.merged)
}

function classifyModels(fetchedModels) {
  const result = {
    image: [],
    video: [],
    digitalHuman: []
  }

  if (!fetchedModels) return result

  // 过滤：确保图片列表只包含真正的图片模型
  // 后端可能将支持多类型的模型放入了错误的分类
  const rawImage = (fetchedModels.image_models || [])
    .filter(m => {
      // 排除已停用的模型
      if (m.is_enabled === false) return false
      // 排除明确标记为视频的模型
      if (m.media_type === 'video') {
        console.log(`[模型分类] 排除视频模型「${m.id || m.name}」from image_models (media_type=video)`)
        return false
      }
      
      
      return true
    })
    .map(m => ({
      ...m,
      inputType: 'text',
      categoryLabel: '文本输入'
    }))
  const rawVideo = (fetchedModels.video_models || [])
    .filter(m => m.is_enabled !== false)
    .map(m => ({
      ...m,
      inputType: 'text',
      categoryLabel: '文本输入'
    }))
  const rawDigitalHuman = (fetchedModels.voices || [])
    .filter(m => m.is_enabled !== false)
    .map(m => ({
      ...m,
      inputType: 'audio',
      categoryLabel: '音频输入',
      _isDigitalHuman: true
    }))

  // 合并分辨率变体后再赋值
  result.image = mergeResolutionVariants(rawImage)
  result.video = mergeResolutionVariants(rawVideo)
  result.digitalHuman = rawDigitalHuman

  console.log('📊 模型分类完成（使用后端分类）:', {
    图片生成: result.image.length,
    视频生成: result.video.length,
    数字人: result.digitalHuman.length
  })

  // 打印合并信息便于调试
  for (const m of [...result.image, ...result.video]) {
    if (m._hasResolutionVariants) {
      console.log(`  📐 合并模型 "${m.name}" 分辨率变体:`, m._resolutionVariants)
    }
  }

  return result
}

const qualityMap = {
  '480p': '480P',
  '720p': '720P',
  '1080p': '1080P',
  '2k': '2K',
  '4k': '4K'
}

function getCurrentParams() {
  const scene = Array.from(document.querySelectorAll('.scene-controls')).find(s => {
    return window.getComputedStyle(s).display !== 'none'
  })

  let sceneType = 'image'
  if (scene) {
    if (scene.classList.contains('video-scene')) sceneType = 'video'
    else if (scene.classList.contains('digital-human-scene')) sceneType = 'digital-human'
  }

  let ratio = selectedRatio.value
  let resolution = qualityMap[selectedQuality.value] || selectedQuality.value || '1080P'

  return { sceneType, ratio, resolution }
}

// ========== 价格估算函数（必须在变量声明之后） ==========

/**
 * 在 price_tiers 中按分辨率查找价格（大小写不敏感）
 * @returns {number|null} 匹配到的价格，或 null
 */
function findTierPrice(tiers, resolution) {
  if (!tiers || typeof tiers !== 'object') return null
  const resLower = String(resolution).toLowerCase()
  for (const [key, value] of Object.entries(tiers)) {
    if (String(key).toLowerCase() === resLower) {
      const v = Number(value)
      if (!isNaN(v)) return v
    }
  }
  // 兜底 default 键
  for (const dk of ['default', 'Default', 'DEFAULT']) {
    if (tiers[dk] != null) {
      const v = Number(tiers[dk])
      if (!isNaN(v)) return v
    }
  }
  return null
}

/**
 * 根据模型自带的价格字段在前端本地计算积分消耗
 * @returns {number|null} 算出的积分，或 null（字段不可用，需走后端）
 */
function calculateLocalPrice(model, outputType, resolution, duration) {
  // 如果模型有分辨率变体，优先使用对应变体的价格字段
  let priceData = model
  if (model._variantPriceData) {
    const resLower = String(resolution).toLowerCase()
    // 精确匹配
    if (model._variantPriceData[resLower]) {
      priceData = model._variantPriceData[resLower]
    } else {
      // 尝试大小写不敏感匹配
      for (const [key, value] of Object.entries(model._variantPriceData)) {
        if (String(key).toLowerCase() === resLower && value) {
          priceData = value
          break
        }
      }
    }
  }

  const multiplier = Number(priceData.price_multiplier) || 1

  if (outputType === 'image') {
    // price_tiers 优先
    const tierPrice = findTierPrice(priceData.price_tiers, resolution)
    if (tierPrice !== null) return tierPrice * multiplier
    // 回退 price_per_request
    if (priceData.price_per_request != null) {
      const v = Number(priceData.price_per_request)
      if (!isNaN(v)) return v * multiplier
    }
    return null
  }

  if (outputType === 'video') {
    const dur = duration || 5
    const tierPrice = findTierPrice(priceData.price_tiers, resolution)
    if (tierPrice !== null) return tierPrice * dur * multiplier
    if (priceData.price_per_second != null) {
      const v = Number(priceData.price_per_second)
      if (!isNaN(v)) return v * dur * multiplier
    }
    return null
  }

  // digital_human / audio → 按次
  if (priceData.price_per_request != null) {
    const v = Number(priceData.price_per_request)
    if (!isNaN(v)) return v * multiplier
  }
  return null
}

async function fetchEstimatedPrice() {
  if (!selectedModel.value) { estimatedPrice.value = null; return }
  const currentModel = models.value.find(m => m.id === selectedModel.value)
  if (!currentModel) { estimatedPrice.value = null; return }

  const params = getCurrentParams()
  let outputType = selectedType.value === 'digital-human' ? 'digital_human' : selectedType.value

  // 与 buildGenerateRequest 保持一致：分辨率变体模型要走实际 model_id，否则后端按展示名查不到
  let submitModelValue
  if (currentModel._hasResolutionVariants && currentModel._resolutionVariants) {
    const targetRes = String(selectedQuality.value || '').toLowerCase()
    const variantModelId = currentModel._resolutionVariants[targetRes]
    if (variantModelId) {
      submitModelValue = String(variantModelId).trim()
    } else {
      const firstVariant = Object.values(currentModel._resolutionVariants)[0]
      submitModelValue = String(firstVariant || currentModel.id || '').trim()
    }
  } else {
    submitModelValue = String(currentModel.id || currentModel.name || '').trim()
  }

  const requestParams = {
    model: submitModelValue,
    output_type: outputType,
    parameters: {
      resolution: params.resolution || '1080P'
    }
  }

  if (outputType === 'video') {
    requestParams.parameters.duration = videoDuration.value
    // 仅在模型支持音频开关(free 模式)时发送 with_audio 参数
    // forced-sound 模型原生有声，disabled-silent 模型不支持音频
    if (soundToggleMode.value === 'free') {
      requestParams.parameters.with_audio = videoSoundEnabled.value
    }
  }
  if (outputType === 'image') {
    requestParams.parameters.count = 1
  }

  // 优先尝试前端本地计算（使用模型自带价格字段）
  const localCost = calculateLocalPrice(currentModel, outputType, params.resolution, videoDuration.value)
  if (localCost !== null) {
    console.log('[价格估算] 使用本地价格字段计算:', localCost, {
      price_per_request: currentModel.price_per_request,
      price_per_second: currentModel.price_per_second,
      price_tiers: currentModel.price_tiers,
      price_multiplier: currentModel.price_multiplier
    })
    estimatedPrice.value = {
      estimated_cost: parseFloat(localCost.toFixed(2)),
      currency: currentModel.currency || 'POINTS',
      breakdown: {},
      note: '实际扣费以生成结果为准'
    }
    return
  }

  console.log('[价格估算] 模型无本地价格字段，走后端估算接口:', JSON.stringify(requestParams))
  console.log('[价格估算] currentModel 关键字段:', {
    id: currentModel.id, name: currentModel.name,
    price_per_request: currentModel.price_per_request,
    price_per_second: currentModel.price_per_second,
    price_tiers: currentModel.price_tiers,
    price_multiplier: currentModel.price_multiplier
  })

  estimatingPrice.value = true
  try {
    const res = await estimatePriceApi(requestParams)
    if (isUnmounted.value) return
    console.log('[价格估算] 后端响应:', JSON.stringify(res))
    // estimatePriceApi 已通过 unwrap 解包，res 即 { estimated_cost, currency, breakdown, note }
    // 不能再用 res.data（解包后无 data 字段，会导致价格不更新、残留旧值）
    if (res && res.estimated_cost !== undefined) {
      estimatedPrice.value = res
    }
  } catch (e) {
    console.warn('价格估算失败:', e)
    if (!isUnmounted.value) estimatedPrice.value = null
  } finally {
    if (!isUnmounted.value) estimatingPrice.value = false
  }
}

// 防抖的价格估算
let priceDebounceTimer = null
function debouncedFetchPrice() {
  clearTimeout(priceDebounceTimer)
  priceDebounceTimer = setTimeout(() => {
    if (isUnmounted.value) return
    fetchEstimatedPrice()
  }, 500)
}

// 监听参数变化自动估算价格
watch([selectedModel, selectedType, selectedQuality, videoDuration, videoSoundEnabled], () => {
  debouncedFetchPrice()
})

function buildGenerateRequest() {
  const currentModel = models.value.find(m => m.id === selectedModel.value)
  if (!currentModel) throw new Error('请先选择模型')

  const params = getCurrentParams()
  let outputType
  if (selectedType.value === 'image') outputType = 'image'
  else if (selectedType.value === 'digital-human') outputType = 'digital_human'
  else outputType = 'video'

  // 如果模型有分辨率变体，根据用户选择的分辨率自动切换到对应的模型ID
  let submitModelValue
  if (currentModel._hasResolutionVariants && currentModel._resolutionVariants) {
    const targetRes = String(selectedQuality.value || '').toLowerCase()
    const variantModelId = currentModel._resolutionVariants[targetRes]
    if (variantModelId) {
      submitModelValue = String(variantModelId).trim()
      console.log(`📐 分辨率变体自动切换: "${currentModel.name}" → ${targetRes} → model="${variantModelId}"`)
    } else {
      // 找不到对应分辨率的变体，使用默认（第一个变体或原始ID）
      const firstVariant = Object.values(currentModel._resolutionVariants)[0]
      submitModelValue = String(firstVariant || currentModel.id || '').trim()
      console.warn(`⚠️ 模型 "${currentModel.name}" 无 ${targetRes} 分辨率变体，使用默认: "${submitModelValue}"`)
    }
  } else {
    submitModelValue = String(currentModel.id || '').trim()
  }
  const hasAtReferences = referencedFiles.value.length > 0

  let allInputFiles
  if (isDualUploadFeature.value) {
    // 双上传框模式：始终包含 slot1/slot2 文件
    allInputFiles = []
    if (dualUploadSlots.value.slot1) {
      allInputFiles.push({
        type: dualUploadSlots.value.slot1.type,
        url: dualUploadSlots.value.slot1.url,
        purpose: dualUploadSlots.value.slot1.purpose,
        object_id: dualUploadSlots.value.slot1.object_id,
        media_id: dualUploadSlots.value.slot1.media_id || null
      })
    }
    if (dualUploadSlots.value.slot2) {
      allInputFiles.push({
        type: dualUploadSlots.value.slot2.type,
        url: dualUploadSlots.value.slot2.url,
        purpose: dualUploadSlots.value.slot2.purpose,
        object_id: dualUploadSlots.value.slot2.object_id,
        media_id: dualUploadSlots.value.slot2.media_id || null
      })
    }
    // 如果有 @ 引用文件，也一并加入（排除已在 slot 中的）
    if (hasAtReferences) {
      const slotIds = new Set(allInputFiles.map(f => f.object_id))
      const refFiles = referencedFiles.value
        .filter(ref => !slotIds.has(ref.object_id))
        .map(ref => ({
          type: ref.type, url: ref.url, purpose: 'reference', object_id: ref.object_id || String(ref.sourceId || ''),
          media_id: ref.media_id || null
        }))
      allInputFiles.push(...refFiles)
    }
  } else if (hasAtReferences) {
    allInputFiles = referencedFiles.value.map(ref => ({
      type: ref.type, url: ref.url, purpose: 'reference', object_id: ref.object_id || String(ref.sourceId || ''),
      media_id: ref.media_id || null
    }))
  } else {
    allInputFiles = [...uploadedFiles.value]
  }

  const uiFeature = selectedFeature.value || ''

  const getAutoFeature = () => {
    if (outputType === 'image') return allInputFiles.length > 0 ? 'image_reference' : 'text_to_image'
    if (outputType === 'digital_human') return 'digital_human'
    if (allInputFiles.length === 0) return 'text_to_video'
    if (allInputFiles.length === 1) return 'global_reference'
    return 'multi_reference'
  }

  const specialVideoFeatures = ['first-last-frame', 'smart-multi-frame', 'first-frame-gen', 'motion-imitate', 'lip-sync', 'ai-outfit', 'scene-replace', 'local-adjust', 'style-replace', 'effect-copy', 'item-fix', 'color-restore', 'smart-remove', 'video-expand']

  let feature
  if (!uiFeature || uiFeature === '') {
    feature = getAutoFeature()
  } else {
    if (outputType === 'image') {
      if (uiFeature === 'text2img') feature = 'text_to_image'
      else if (uiFeature === 'reference') feature = 'image_reference'
      else feature = uiFeature
    } else if (outputType === 'video') {
      if (uiFeature === 'all-reference') {
        feature = getAutoFeature()
      } else if (specialVideoFeatures.includes(uiFeature)) {
        feature = allInputFiles.length >= 2 ? 'multi_reference' : (allInputFiles.length === 1 ? 'global_reference' : 'text_to_video')
      } else {
        feature = getAutoFeature()
      }
    } else if (outputType === 'digital_human') {
      feature = 'digital_human'
    } else {
      feature = getAutoFeature()
    }
  }

  if (outputType === 'video' && allInputFiles.length >= 2 && !['first-last-frame'].includes(uiFeature)) {
    if (feature !== 'multi_reference') feature = 'multi_reference'
  }

  console.log('[feature调试]', { selectedType: selectedType.value, outputType, uiFeature, allInputFilesLen: allInputFiles.length, feature })

  let finalPrompt = String(prompt.value || '').trim()
  if (referencedFiles.value.length > 0 && finalPrompt.includes('@')) {
    const tagToObjectId = {}
    for (const ref of referencedFiles.value) {
      const tag = String(ref.atTag || '')
      const oid = String(ref.object_id || '')
      if (tag && oid) tagToObjectId[tag] = `<<<${oid}>>>`
    }
    finalPrompt = finalPrompt.replace(/@\S+/g, (match) => tagToObjectId[match] || match)
  }

  // 处理模型ID：如果带多类型后缀（如 __img/__vid），自动去除以使用原始API ID
  let apiModelId = String(submitModelValue || '')
  const suffixPattern = /__(img|vid|aud)$/
  if (suffixPattern.test(apiModelId)) {
    apiModelId = apiModelId.replace(suffixPattern, '')
    console.log(`[模型ID映射] ${submitModelValue} → ${apiModelId}`)
  }

  const defaultApiFeature = outputType === 'image' ? 'text_to_image' : (outputType === 'digital_human' ? 'digital_human' : 'text_to_video')

  const request = {
    output_type: String(outputType || 'image'),
    model: apiModelId,
    vendor: String(currentModel.vendor || currentModel?.vendor || 'vendor_a'),
    feature: String(feature || defaultApiFeature),
    parameters: {},
    prompt: finalPrompt,
    input_files: allInputFiles.map((f) => {
      const item = {
        type: String(f.type || 'image'), url: String(f.url || ''),
        purpose: String(f.purpose || 'reference'),
        object_id: String(f.object_id || `file_${f.type}_${Math.random().toString(36).slice(2, 6)}`)
      }
      // Seedance 素材库引用：透传 media_id（见 SEEDANCE_RESOURCE_LIBRARY.md §2/§3）
      if (f.media_id) item.media_id = String(f.media_id)
      return item
    })
  }

  if (outputType === 'image') {
    // 图片生成基础参数
    request.parameters = {
      resolution: params.resolution,
      ratio: params.ratio,
      count: imageCount.value || 1
    }

    // GPT图像模型专属参数
    const modelIdLower = apiModelId.toLowerCase()
    if (modelIdLower.includes('gpt-image') || modelIdLower.includes('chatgpt-image') || modelIdLower.includes('dall-e')) {
      request.parameters.quality = imageOutputQuality.value
      request.parameters.output_format = imageOutputFormat.value
      request.parameters.background = imageBackground.value
      // 多图参考时添加 references 字段
      if (allInputFiles.length > 0) {
        request.parameters.references = allInputFiles.map(f => ({
          type: f.type || 'image',
          url: f.url
        }))
      }
    }

    // 千问/万象模型参数
    if (modelIdLower.includes('qwen') || modelIdLower.includes('wan')) {
      request.parameters.watermark = imageWatermark.value
      // size 格式转换: WxH -> W*H (千问/万象使用星号)
      if (params.resolution) {
        const resMatch = params.resolution.match(/(\d+)[pP]/i)
        if (resMatch) {
          const baseHeight = parseInt(resMatch[1])
          // 根据 ratio 计算尺寸
          const ratioParts = params.ratio.split(':')
          if (ratioParts.length === 2) {
            const wRatio = parseInt(ratioParts[0])
            const hRatio = parseInt(ratioParts[1])
            const width = Math.round(baseHeight * wRatio / hRatio)
            request.parameters.size = `${width}*${baseHeight}`
          }
        }
      }
    }
  }
  else if (outputType === 'video') {
    // ===== 统一视频生成接口参数构建 =====
    request.parameters = {
      resolution: params.resolution,
      duration: videoDuration.value,
      ratio: params.ratio
    }

    // 仅在模型支持音频开关(free 模式)时发送 sound/audio_generation 参数
    // forced-sound 模型(如 happyhorse)原生有声：后端会按模型默认行为处理，
    //   发送 sound=true 反而会触发后端 supports_audio 校验并拒绝
    // disabled-silent 模型不支持音频，也不发送
    const modelSoundMode = currentModel.sound_mode || soundToggleMode.value
    console.log('🔊 音频参数判断:', {
      modelId: currentModel.id,
      modelName: currentModel.name,
      sound_mode: currentModel.sound_mode,
      soundToggleMode: soundToggleMode.value,
      videoSoundEnabled: videoSoundEnabled.value,
      willSendAudio: modelSoundMode === 'free'
    })
    if (modelSoundMode === 'free') {
      request.parameters.sound = videoSoundEnabled.value
      request.parameters.audio_generation = videoSoundEnabled.value
    }

    const modelIdLower = apiModelId.toLowerCase()
    const isSeedance = modelIdLower.includes('seedance')

    // Seedance 2.0 专属参数
    if (isSeedance) {
      request.parameters.generate_audio = videoSoundEnabled.value
      request.parameters.watermark = false
    }

    // 根据功能映射统一API参数
    const featureVal = uiFeature

    // 首末帧：使用 start_frame / end_frame 顶层参数
    if (featureVal === 'first-last-frame' && isDualUploadFeature.value) {
      if (dualUploadSlots.value.slot1) request.parameters.start_frame = dualUploadSlots.value.slot1.url
      if (dualUploadSlots.value.slot2) request.parameters.end_frame = dualUploadSlots.value.slot2.url
    }

    // 对口型：scene_type = "lip_sync"
    else if (featureVal === 'lip-sync') {
      request.parameters.scene_type = 'lip_sync'
      const videoFile = allInputFiles.find(f => f.type === 'video')
      const audioFile = allInputFiles.find(f => f.type === 'audio')
      if (videoFile) request.parameters.lip_sync_video = videoFile.url
      if (audioFile) request.parameters.lip_sync_audio = audioFile.url
    }

    // 动作控制：scene_type = "motion_control"
    else if (featureVal === 'motion-imitate') {
      request.parameters.scene_type = 'motion_control'
      request.parameters.character_orientation = 'image'
      request.parameters.keep_original_sound = 'no'
    }

    // 特效模板：scene_type = "template_effect"
    else if (featureVal === 'effect-copy') {
      request.parameters.scene_type = 'template_effect'
    }

    // 智能分镜：multi_shot = true
    else if (featureVal === 'smart-multi-frame') {
      request.parameters.multi_shot = true
      request.parameters.shot_type = 'customize'
    }

    // 为 references 添加 role 字段（Seedance 2.0 多模态参考）
    if (allInputFiles.length > 0 && featureVal !== 'first-last-frame') {
      request.parameters.references = allInputFiles.map(f => {
        const ref = { url: f.url, type: f.type || 'image' }
        if (f.object_id) ref.object_id = f.object_id
        // Seedance 素材库引用：透传 media_id，后端会用 Asset://tkres_xxx 改写（见 SEEDANCE_RESOURCE_LIBRARY.md §2/§3）
        if (f.media_id) ref.media_id = f.media_id
        // 根据 purpose 推断 role
        if (f.purpose === 'first_frame') ref.role = 'first_frame'
        else if (f.purpose === 'last_frame') ref.role = 'last_frame'
        else if (f.type === 'image') ref.role = 'reference_image'
        else if (f.type === 'video') ref.role = 'reference_video'
        else if (f.type === 'audio') ref.role = 'reference_audio'
        return ref
      })
    }
  }
  else if (outputType === 'digital_human') request.parameters = { voice_id: currentModel.id || '', action_description: '' }

  if (request.vendor === 'vendor_b' && allInputFiles.length > 0) {
    request.input = { media: allInputFiles.map((file, index) => {
      const media = { type: String(file.type || 'image'), url: String(file.url || ''), purpose: String(file.purpose || 'reference'), object_id: String(file.object_id || `media_${index + 1}`) }
      // Seedance 素材库引用：透传 media_id（见 SEEDANCE_RESOURCE_LIBRARY.md §2/§3）
      if (file.media_id) media.media_id = String(file.media_id)
      // 添加 role 字段（Seedance 2.0 多模态参考）
      if (file.purpose === 'first_frame') media.role = 'first_frame'
      else if (file.purpose === 'last_frame') media.role = 'last_frame'
      else if (file.type === 'image') media.role = 'reference_image'
      else if (file.type === 'video') media.role = 'reference_video'
      else if (file.type === 'audio') media.role = 'reference_audio'
      return media
    }) }
  }
  return request
}

function extractResultFromData(data) {
  // data 可能是对象、字符串或 null
  if (typeof data === 'string') {
    throw new Error(data)
  }
  if (!data || data.code !== 200) {
    // 后端返回错误：message 可能是 string / dict / null，用 safeMessage 兜底
    console.warn('🔍 生成失败响应:', data)
    // 尝试多个字段：message、error、detail
    const errMsg = safeMessage(data?.message ?? data?.error ?? data?.detail ?? data, '生成失败')
    throw new Error(errMsg)
  }
  const resultData = data.data
  if (!resultData) throw new Error('未获取到结果数据')
  const taskInfo = { taskId: resultData.task_id, type: resultData.type, status: resultData.status, progress: resultData.progress }
  let results = []

  // 尝试从多种可能的响应结构中提取结果
  const r = resultData.result || resultData.results || resultData.output || resultData.data || resultData

  // 图片结果：支持 images 数组、image 单个对象、image_url 字符串
  if (r.images && Array.isArray(r.images)) {
    r.images.forEach(img => {
      if (typeof img === 'string') results.push({ type: 'image', url: img, id: `img_${results.length}` })
      else if (img.url) results.push({ type: 'image', url: img.url, id: img.id || `img_${results.length}` })
    })
  }
  if (r.image && !r.images) {
    if (typeof r.image === 'string') results.push({ type: 'image', url: r.image, id: 'img_0' })
    else if (r.image.url) results.push({ type: 'image', url: r.image.url, id: r.image.id || 'img_0' })
  }
  if (r.image_url && results.length === 0) {
    const urls = Array.isArray(r.image_url) ? r.image_url : [r.image_url]
    urls.forEach((u, i) => { if (typeof u === 'string') results.push({ type: 'image', url: u, id: `img_${i}` }) })
  }

  // 视频结果
  if (r.video) {
    const v = r.video
    results.push({ type: 'video', url: v.url || v.video_url || '', id: v.id || taskInfo.taskId, thumbnail: v.thumbnail || v.cover_url || '' })
  }
  if (r.video_url && !r.video) {
    results.push({ type: 'video', url: r.video_url, id: taskInfo.taskId })
  }
  if (r.videos && Array.isArray(r.videos)) {
    r.videos.forEach((v, i) => {
      const url = typeof v === 'string' ? v : (v.url || v.video_url || '')
      if (url) results.push({ type: 'video', url, id: v.id || `vid_${i}`, thumbnail: v.thumbnail || v.cover_url || '' })
    })
  }

  // 通用 URL 列表（不确定类型时按 output_type 判断）
  if (results.length === 0 && r.urls && Array.isArray(r.urls)) {
    const defaultType = resultData.output_type || resultData.type || 'image'
    r.urls.forEach((u, i) => {
      if (typeof u === 'string') results.push({ type: defaultType === 'video' ? 'video' : 'image', url: u, id: `res_${i}` })
    })
  }

  // 最终兜底：如果 resultData 本身就是 URL 或包含 url 字段
  if (results.length === 0 && typeof r === 'string' && (r.startsWith('http') || r.startsWith('blob:'))) {
    results.push({ type: resultData.output_type === 'video' ? 'video' : 'image', url: r, id: taskInfo.taskId })
  }
  if (results.length === 0 && r.url && typeof r.url === 'string') {
    results.push({ type: resultData.output_type === 'video' ? 'video' : 'image', url: r.url, id: r.id || taskInfo.taskId })
  }

  console.log('🔍 提取结果:', { resultsCount: results.length, results })
  return { ...taskInfo, results }
}

async function processVideoResults(card) {
  for (const result of card.results) {
    if (result.type === 'video' && result.url && result.url.includes('neolink.com')) {
      if (isUnmounted.value) return
      card.loadingVideo = true
      try {
        const blobUrl = await fetchProtectedVideo(result.url)
        if (isUnmounted.value) return
        result.displayUrl = blobUrl
      } catch (error) {
        if (!isUnmounted.value) result.displayUrl = result.url
      } finally {
        if (!isUnmounted.value) card.loadingVideo = false
      }
    }
  }
}

function onVideoLoaded(card) {}

async function fetchProtectedVideo(url) {
  const response = await fetch(url, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } })
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

function convertBase64ToBlobUrl(base64Data) {
  if (!base64Data) return ''
  if (base64Data.startsWith('blob:')) return base64Data
  if (base64Data.startsWith('http') || base64Data.startsWith('//')) return base64Data
  try {
    // 从 data URL 中解析真实 MIME 类型，避免写死 image/png 导致 jpg/webp/视频/音频显示异常
    let mimeType = 'image/png'
    const commaIdx = base64Data.indexOf(',')
    if (base64Data.startsWith('data:') && commaIdx > 0) {
      const header = base64Data.slice(5, commaIdx) // 形如 image/png;base64
      const semiIdx = header.indexOf(';')
      mimeType = semiIdx > 0 ? header.slice(0, semiIdx) : header
    }
    const byteCharacters = atob(base64Data.split(',')[1] || base64Data)
    const byteArray = new Uint8Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i)
    const blob = new Blob([byteArray], { type: mimeType })
    return URL.createObjectURL(blob)
  } catch { return base64Data }
}

async function handleGenerate() {
  if (!canGenerate.value || isGenerating.value) return
  if (!selectedModel.value) { showToast('请先选择模型', 'warning'); return }

  // prompt 校验
  const trimmedPrompt = (prompt.value || '').trim()
  if (!trimmedPrompt) { showToast('请输入生成提示词', 'warning'); return }

  // 积分余额校验
  if (estimatedPrice.value && remainingPoints.value !== '--') {
    const cost = Number(estimatedPrice.value.estimated_cost) || 0
    const remain = Number(remainingPoints.value) || 0
    if (cost > remain) {
      showToast(`积分不足，需要 ${cost} 积分，当前剩余 ${remain} 积分`, 'error')
      return
    }
  }

  const modelCheck = models.value.find(m => m.id === selectedModel.value)
  if (modelCheck && modelCheck.vendor === 'vendor_b') {
    const modelId = (modelCheck.id || modelCheck.name || '').toLowerCase()
    const modelName = (modelCheck.name || '').toLowerCase()
    const isI2VModel = modelId.includes('i2v') || modelName.includes('image.to.video')
    if (isI2VModel && uploadedFiles.value.length === 0 && referencedFiles.value.length === 0) {
      showToast('I2V（图生视频）模型需要上传参考图片', 'warning'); return
    }
  }

  // 图片类型下选择了需要素材的功能（参考图/风格转换/局部重绘等），但未上传素材则拦截
  if (isImageFeatureRequiringAssets.value &&
      uploadedFiles.value.length === 0 &&
      referencedFiles.value.length === 0 &&
      !dualUploadSlots.value.slot1 && !dualUploadSlots.value.slot2) {
    showToast('未上传素材，请重试', 'warning'); return
  }

  isGenerating.value = true
  hasInteracted.value = true

  // 先构建请求体（依赖当前输入状态）， requestBody 中包含处理后的正确值
  let requestBody
  try {
    requestBody = buildGenerateRequest()
    requestBody = JSON.parse(JSON.stringify(requestBody))
  } catch (e) {
    isGenerating.value = false
    showToast(e.message, 'warning')
    return
  }

  // 创建占位卡片（使用 requestBody 中处理后的值，确保显示正确）
  const placeholderCard = {
    id: Date.now(),
    title: prompt.value.slice(0, 30) + (prompt.value.length > 30 ? '...' : ''),
    prompt: prompt.value,
    type: requestBody.output_type === 'digital_human' ? 'digital-human' : requestBody.output_type,
    model: requestBody.model,
    quality: requestBody.parameters?.resolution || selectedQuality.value,
    feature: requestBody.feature,
    ratio: requestBody.parameters?.ratio || selectedRatio.value,
    duration: requestBody.parameters?.duration || videoDuration.value,
    taskId: null,
    results: [],
    status: 'generating',
    loadingVideo: false,
    createdAt: Date.now(),
    uploadedInputFiles: [
      ...uploadedFiles.value,
      ...Object.values(dualUploadSlots.value).filter(f => f !== null)
    ]
  }

  // 立即追加占位卡片到当前对话
  let convId = activeConversationId.value
  if (!convId) {
    // 先通过 API 创建对话，获取后端分配的 conversation_id
    try {
      const res = await createConversationApi({ title: placeholderCard.title || '未命名对话' })
      if (isUnmounted.value) return
      const apiConv = unwrapResponse(res.data)
      convId = apiConv.conversation_id || apiConv.id
    } catch (e) {
      console.warn('创建对话失败，使用临时 ID:', e)
      if (isUnmounted.value) return
      convId = `conv_${Date.now()}`
    }
    activeConversationId.value = convId
    conversationHistory.value.unshift({
      id: convId,
      title: placeholderCard.title,
      thumbnail: '',
      type: placeholderCard.type,
      time: Date.now(),
      status: 'active',
      message_count: 0,
      generation_count: 1,
      cards: [placeholderCard],
      loaded: true,
      messagesNextOffset: 0,
      messagesHasMore: false,
      messagesLoading: false,
      messagesCapped: false,
      allMessages: []
    })
  } else {
    const conv = conversationHistory.value.find(c => c.id === convId)
    if (conv) {
      conv.cards.push(placeholderCard)
      conv.generation_count = (conv.generation_count || 0) + 1
      conv.title = placeholderCard.title
      conv.time = Date.now()
    }
  }

  // 将 conversation_id 附加到请求体，后端会自动写 user/assistant 消息
  requestBody.conversation_id = convId

  // 立即清空输入框
  prompt.value = ''
  if (promptEditorRef.value) promptEditorRef.value.innerHTML = ''
  if (promptEditorRefBottom.value) promptEditorRefBottom.value.innerHTML = ''
  uploadedFiles.value = []
  referencedFiles.value = []
  clearDualUploadSlots()
  atTags.value = []
  activeAtTagId.value = null
  atImageCounter = 0
  atVideoCounter = 0
  atAudioCounter = 0
  selectedFeature.value = ''

  scrollToCanvasBottom()
  nextTick(() => { if (window.lucide) lucide.createIcons() })

  try {
    const totalSize = JSON.stringify(requestBody).length
    // 异步模式：后端立即返回 task_id（不阻塞等待生成完成），超时设为 60s 足够
    const timeoutMs = 60000
    console.log(`📤 发送生成请求(异步)... (大小: ${(totalSize / 1024).toFixed(1)}KB, 超时: ${timeoutMs / 1000}s)`)
    console.log('📤 请求参数:', { output_type: requestBody.output_type, model: requestBody.model, feature: requestBody.feature, prompt_len: requestBody.prompt?.length, files: requestBody.input_files?.length })
    console.log('📤 完整请求体:', JSON.parse(JSON.stringify(requestBody)))
    console.log('📤 parameters 详情:', JSON.parse(JSON.stringify(requestBody.parameters || {})))

    const response = await request.post('/api/v1/generate?sync=false', requestBody, { timeout: timeoutMs })

    console.log('📥 收到响应:', response.data)

    const result = extractResultFromData(response.data)

    // 异步模式：理想情况下后端立即返回 task_id + status=processing；
    // 但有些上游任务（如部分图片模型）可能在异步接口里直接完成，需要兼容两种情况
    const isImmediateDone = result.status === 'completed' || result.status === 'failed'
    const taskId = result.taskId
    const cardType = placeholderCard.type

    // 更新占位卡片的 taskId（无论是否已完成，都先把 taskId 写回，便于后续轮询/重试）
    const initialConv = conversationHistory.value.find(c => c.id === convId)
    const initialCard = initialConv?.cards.find(c => c.id === placeholderCard.id)
    if (initialCard) initialCard.taskId = taskId
    else placeholderCard.taskId = taskId

    // 立即保存生成参数到缓存：防止路由切换导致组件销毁重建后参数丢失
    // （finalizeGenerationSuccess 也会写缓存，但那是在任务完成后才执行，
    //   如果用户在生成过程中切换页面，就需要这里提前写入）
    if (taskId) {
      saveCardGenParams(convId, taskId, {
        model: placeholderCard.model,
        feature: placeholderCard.feature,
        ratio: placeholderCard.ratio,
        quality: placeholderCard.quality,
        duration: placeholderCard.duration,
        type: placeholderCard.type,
        prompt: placeholderCard.prompt
      })
    }

    // 释放生成锁：让用户可以继续输入/切换对话，后台轮询不阻塞 UI
    isGenerating.value = false

    if (isImmediateDone) {
      // 上游同步完成（罕见）：直接走完成流程
      await finalizeGenerationSuccess({
        taskId, result, convId, placeholderCard, cardType
      })
    } else if (taskId) {
      // 异步模式主路径：启动后台轮询，不 await
      pollTaskUntilDone({ taskId, convId, cardId: placeholderCard.id, cardType })
        .catch(err => console.error('🚨 轮询异常:', err))
    } else {
      // 既没完成也没拿到 task_id：当作失败处理
      throw new Error('未获取到任务ID，无法跟踪生成状态')
    }
  } catch (error) {
    console.error('❌ 生成失败:', error)
    // 生成失败时，更新占位卡片状态（通过 reactive proxy 更新）
    const failConv = conversationHistory.value.find(c => c.id === convId)
    const failCard = failConv?.cards.find(c => c.id === placeholderCard.id)
    if (failCard) {
      failCard.status = 'failed'
      failCard.results = []
    } else {
      placeholderCard.status = 'failed'
      placeholderCard.results = []
    }
    // 确保 error.message 是 string，防止后端返回非标准结构导致二次崩溃
    const errMsg = humanizeSeedanceError(safeMessage(error?.message, error?.status ? `请求失败 (${error.status})` : '未知错误'))
    showToast(`生成失败: ${errMsg}`, 'error')
  } finally {
    // 异步模式下，isGenerating 已经在拿到 task_id 后释放；
    // 这里再保险设一次 false（同步完成路径或异常路径仍需要它）
    isGenerating.value = false
  }
}

/**
 * 异步轮询任务状态直到完成/失败。
 * - 不阻塞调用方：内部循环 + setTimeout 间隔
 * - 组件卸载或对话切换都不影响轮询；通过 conversationHistory + cardId 重新定位卡片
 * - 完成后走与同步路径一致的收尾流程（更新卡片、扣费、缩略图、视频后处理）
 *
 * @param {{ taskId: string, convId: string, cardId: number, cardType: string }} opts
 */
async function pollTaskUntilDone({ taskId, convId, cardId, cardType }) {
  const POLL_INTERVAL_MS = 5000        // 每 5 秒轮询一次
  const MAX_POLL_DURATION_MS = 20 * 60 * 1000  // 硬性 20 分钟超时（按实际经过时间计算，不受 API 耗时影响）
  const MAX_CONSECUTIVE_ERRORS = 3     // 连续查询失败 3 次（15s）就标 failed，避免任务被后端清理后还一直转圈

  // 终态失败：除 failed/error 外，cancelled/timeout/expired/aborted/refunded 等也按失败处理
  const FAILED_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled', 'timeout', 'timed_out', 'expired', 'aborted', 'refunded'])

  let consecutiveErrors = 0
  const startTime = Date.now()

  // 使用 while 循环，以实际经过时间作为超时判断依据
  while (true) {
    // 硬性 20 分钟超时：无论后端返回什么状态，超过 20 分钟直接报错
    if (Date.now() - startTime >= MAX_POLL_DURATION_MS) {
      console.error(`⏰ 轮询超时（20 分钟）: task=${taskId}`)
      const timeoutConv = conversationHistory.value.find(c => c.id === convId)
      const timeoutCard = timeoutConv?.cards.find(c => c.id === cardId)
      if (timeoutCard) {
        timeoutCard.status = 'failed'
        timeoutCard.results = []
        timeoutCard.progress = null
      }
      showToast('生成超时（超过 20 分钟未完成），请稍后重试', 'error')
      return
    }

    // 组件卸载：停止轮询（卡片 reactive 已失效，继续写会告警）
    if (isUnmounted.value) {
      console.log(`🛑 轮询停止（组件已卸载）: task=${taskId}`)
      return
    }

    let pollData
    let taskGone = false
    try {
      // getTaskChargeInfoApi 走 /api/v1/tasks/{task_id}/status，返回 body.data
      // 结构：{ status, progress?, result?, charge_info? }
      pollData = await getTaskChargeInfoApi(taskId)
    } catch (e) {
      // 任务不存在（404 等）→ 后端已清理该任务记录，说明它早就结束了
      // 不能再按"网络瞬时错误"继续等，否则卡片永远转圈
      const status = e?.status || e?.response?.status
      const code = e?.code || e?.response?.data?.code
      if (status === 404 || status === 410 || code === 'TASK_NOT_FOUND' || code === 'NOT_FOUND') {
        console.warn(`🗑️ 任务不存在（task=${taskId}），按失败处理`)
        taskGone = true
      } else {
        consecutiveErrors++
        const elapsedSec = Math.round((Date.now() - startTime) / 1000)
        console.warn(`⏳ 轮询失败 (已轮询 ${elapsedSec}s, 连续失败 ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, e?.message || e)
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // 连续多次查询都失败（可能是后端持续不可达或任务被清理），强制标 failed
          console.error(`❌ 轮询连续失败 ${consecutiveErrors} 次，强制标记 failed: task=${taskId}`)
          const failConv = conversationHistory.value.find(c => c.id === convId)
          const failCard = failConv?.cards.find(c => c.id === cardId)
          if (failCard && failCard.status === 'generating') {
            failCard.status = 'failed'
            failCard.results = []
            failCard.progress = null
          }
          showToast('生成失败：无法查询任务状态', 'error')
          return
        }
        await sleep(POLL_INTERVAL_MS)
        continue
      }
    }

    if (taskGone) {
      // 任务已被后端清理：按 failed 处理（避免卡片永远转圈）
      const failConv = conversationHistory.value.find(c => c.id === convId)
      const failCard = failConv?.cards.find(c => c.id === cardId)
      if (failCard && failCard.status === 'generating') {
        failCard.status = 'failed'
        failCard.results = []
        failCard.progress = null
      }
      showToast('生成失败：任务不存在', 'error')
      return
    }

    if (!pollData) {
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    // 成功拿到响应：重置连续错误计数
    consecutiveErrors = 0

    const status = pollData.status
    const progress = typeof pollData.progress === 'number' ? pollData.progress : null

    // 写回进度（如果后端给了）
    if (progress !== null) {
      const pConv = conversationHistory.value.find(c => c.id === convId)
      const pCard = pConv?.cards.find(c => c.id === cardId)
      if (pCard && pCard.status === 'generating') pCard.progress = progress
    }

    if (status === 'completed') {
      // 包装成 extractResultFromData 兼容的结构，复用同一套结果提取逻辑
      const wrappedData = {
        code: 200,
        data: {
          task_id: taskId,
          type: cardType,
          status: 'completed',
          progress: 100,
          result: pollData.result
        }
      }
      const result = extractResultFromData(wrappedData)
      // 如果没有提取到 results，兜底用 result 数组
      if (!result.results || result.results.length === 0) {
        result.results = Array.isArray(pollData.result) ? pollData.result : []
      }

      await finalizeGenerationSuccess({
        taskId,
        result,
        convId,
        placeholderCard: { id: cardId, type: cardType, model: undefined, feature: undefined, ratio: undefined, quality: undefined, duration: undefined },
        cardType,
        chargeInfo: pollData.charge_info || null
      })
      return
    }

    if (status && FAILED_STATUSES.has(status)) {
      console.error(`❌ 任务失败 (${status}): task=${taskId}`)
      const failConv = conversationHistory.value.find(c => c.id === convId)
      const failCard = failConv?.cards.find(c => c.id === cardId)
      if (failCard) {
        failCard.status = 'failed'
        failCard.results = []
        failCard.progress = null
      }
      const errMsg = humanizeSeedanceError(safeMessage(pollData.message ?? pollData.error, `生成失败（${status}）`))
      showToast(`生成失败: ${errMsg}`, 'error')
      return
    }

    // 仍在处理中：等待下一轮
    await sleep(POLL_INTERVAL_MS)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 生成成功后的统一收尾流程（同步完成路径与异步轮询完成路径共用）。
 * - 更新占位卡片为 completed + 写入结果
 * - 缓存生成参数
 * - 查询/写入扣费明细
 * - 更新对话缩略图
 * - 处理 vendor_b 受保护视频
 *
 * @param {{ taskId: string, result: object, convId: string, placeholderCard: object, cardType: string, chargeInfo?: object|null }} opts
 */
async function finalizeGenerationSuccess({ taskId, result, convId, placeholderCard, cardType, chargeInfo }) {
  const targetConv = conversationHistory.value.find(c => c.id === convId)
  const targetCard = targetConv?.cards.find(c => c.id === placeholderCard.id)
  if (targetCard) {
    targetCard.taskId = taskId
    targetCard.results = result.results
    targetCard.status = 'completed'
    targetCard.progress = null
  } else {
    placeholderCard.taskId = taskId
    placeholderCard.results = result.results
    placeholderCard.status = 'completed'
  }

  // 缓存生成参数（异步路径下 placeholderCard 只有 id/type，其他字段从已写入的卡片读取）
  // 防御：model 为空时跳过缓存写入，避免空值污染缓存导致后续恢复显示"默认模型"
  const cacheCard = targetCard || placeholderCard
  if (cacheCard.model) {
    saveCardGenParams(convId, taskId, {
      model: cacheCard.model,
      feature: cacheCard.feature,
      ratio: cacheCard.ratio,
      quality: cacheCard.quality,
      duration: cacheCard.duration,
      type: cacheCard.type || cardType
    })
  }

  // 扣费明细：异步轮询路径直接用 pollData.charge_info；同步路径走 getTaskChargeInfoApi
  // 注意：直接修改 userPoints.remaining 可能不触发响应式更新，需替换整个对象
  let ci = chargeInfo
  if (!ci && taskId) {
    try {
      const chargeData = await getTaskChargeInfoApi(taskId)
      ci = chargeData?.charge_info
    } catch (e) {
      // charge_info 查询失败不影响主流程，降级为刷新积分接口
      ci = null
    }
  }

  if (ci && ci.balance_after !== undefined && ci.balance_after !== null) {
    showToast(`扣费 ${ci.cost} 元，余额 ${ci.balance_after} 元`, 'success')
    // 替换整个对象确保触发响应式更新（直接改属性可能不生效）
    if (userStore.userPoints) {
      userStore.userPoints = { ...userStore.userPoints, remaining: ci.balance_after }
    } else {
      userStore.fetchPoints()
    }
  } else {
    // charge_info 不存在或无效，刷新积分接口确保数据最新
    userStore.fetchPoints()
  }

  // 后端已通过 conversation_id 自动写入 user/assistant 消息
  // 更新对话缩略图（用 convId 而非 activeConversationId，因为用户可能已切换到其他对话）
  const thumbConv = conversationHistory.value.find(c => c.id === convId)
  if (thumbConv) {
    thumbConv.thumbnail = (targetCard?.results?.[0]?.url || placeholderCard.results?.[0]?.url) || thumbConv.thumbnail
    thumbConv.time = Date.now()
  }

  console.log('💳 已添加结果卡片, 当前对话卡片数:', generatedCards.value.length)

  const videoCard = targetCard || placeholderCard
  if (videoCard.results.some(r => r.type === 'video')) await processVideoResults(videoCard)

  scrollToCanvasBottom()
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

function scrollToCanvasBottom() {
  nextTick(() => {
    // 优先滚动到最后一张卡片
    const cards = document.querySelectorAll('.result-card-group')
    if (cards.length > 0) {
      const lastCard = cards[cards.length - 1]
      lastCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      const el = canvasContainer.value
      if (el) { el.scrollTop = el.scrollHeight }
    }
  })
}

function useAsInput(result) {
  addFileFromHistory({ type: result.type, url: result.displayUrl || result.url, name: `生成结果_${Date.now()}` })
}

// ========== 下载/保存结果 ==========
async function downloadResult(result, idx) {
  const url = result.displayUrl || result.url
  if (!url) return

  const fileType = result.type || ''
  const fileName = `generate_${Date.now()}_${idx + 1}.${fileType === 'video' ? 'mp4' : 'png'}`
  const ok = await downloadFile(url, fileName, fileType)
  if (!ok) {
    console.warn('下载可能未成功（跨域资源），已尝试打开链接')
  }
}

// ========== 文件历史管理 ==========
const fileHistory = ref([])

function addFileFromHistory(file) {
  fileHistory.value.push(file)
  uploadedFiles.value.push({
    type: file.type,
    url: file.url,
    purpose: 'reference',
    object_id: `${file.type}_${uploadedFiles.value.length + 1}`,
    name: file.name || `文件_${Date.now()}`
  })
}

// ========== 移除引用素材（区别于removeAtTag）==========
function removeReferencedFile(atId) {
  // 从引用列表中移除
  referencedFiles.value = referencedFiles.value.filter(r => r.atId !== atId)
  // 从编辑器中移除对应的@标签DOM
  const editor = promptEditorRef.value || promptEditorRefBottom.value
  if (editor) {
    const tagEl = editor.querySelector(`[data-at-id="${atId}"]`)
    if (tagEl) tagEl.remove()
  }
  atTags.value = atTags.value.filter(t => t !== atId)
  if (activeAtTagId.value === atId) activeAtTagId.value = null
  nextTick(() => { if (window.lucide) lucide.createIcons() })
}

// ========== Toast 提示 ==========
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('info')

// Seedance 素材库资源化错误识别（见 SEEDANCE_RESOURCE_LIBRARY.md §7.3）
// 后端会在错误信息中透传 [SeedanceResource] 日志关键字，前端转成用户可读提示
function humanizeSeedanceError(msg) {
  if (!msg || typeof msg !== 'string') return msg
  if (msg.includes('media_id 不存在') || msg.includes('跳过资源化')) {
    return '引用的素材已删除或不存在，请从素材库重新选择'
  }
  if (msg.includes('Neolink 资源同步失败') || msg.includes('资源同步')) {
    return '素材资源同步超时，请稍后再试'
  }
  return msg
}

function showToast(msg, type = 'info') {
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    if (isUnmounted.value) return
    toastVisible.value = false
  }, 3000)
}

// ========== 获取认证 Token ==========
function getAuthToken() {
  const stored = localStorage.getItem('szg_access_token')
  if (stored) {
    try { return JSON.parse(stored) } catch { return stored }
  }
  return ''
}

// ========== 通用 API 请求（非对话模块使用） ==========
async function apiFetch(path, options = {}) {
  try {
    const method = (options.method || 'GET').toLowerCase()
    const config = { ...options }
    delete config.method
    delete config.headers
    if (options.body) {
      config.data = JSON.parse(options.body)
      delete config.body
    }
    const res = await request[method](path, config.data, config)
    const data = res.data
    if (data.code !== 200) throw new Error(safeMessage(data.message, '请求失败'))
    return data.data
  } catch (e) {
    console.warn(`API ${path} 失败:`, e.message)
    return null
  }
}

// ========== 对话管理 API（对接 CONVERSATION_API 文档） ==========

/**
 * 解包 API 响应：兼容 { code, data } 包装和直接返回业务数据两种格式
 */
function unwrapResponse(resData) {
  if (resData && resData.code === 200 && resData.data !== undefined) {
    return resData.data
  }
  return resData
}

/**
 * 把后端 ConversationListItem（4 字段精简项）映射为前端 conversation 对象。
 * 精简项没有 message_count / generation_count / thumbnail 等字段，保留 existing 的值。
 */
function _mapConvListItem(c, existing) {
  const id = c.conversation_id || c.id
  // 流式端点用 last_message_at；老端点用 updated_at/created_at
  const timeSource = c.last_message_at || c.updated_at || c.created_at
  return {
    id,
    title: c.title || existing?.title || '未命名对话',
    type: existing?.type || '',
    thumbnail: c.thumbnail || c.preview_url || c.cover_url || c.last_result_url || existing?.thumbnail || '',
    time: timeSource ? new Date(timeSource).getTime() : (existing?.time || Date.now()),
    status: c.status || existing?.status || 'active',
    message_count: c.message_count ?? existing?.message_count ?? 0,
    generation_count: c.generation_count ?? existing?.generation_count ?? 0,
    total_quota_used: c.total_quota_used ?? existing?.total_quota_used ?? 0,
    cards: existing?.cards || [],
    loaded: existing?.loaded || false,
    // 消息分页加载状态
    messagesNextOffset: existing?.messagesNextOffset || 0,
    messagesHasMore: existing?.messagesHasMore || false,
    messagesLoading: false,
    messagesCapped: existing?.messagesCapped || false,
    allMessages: existing?.allMessages || []
  }
}

/**
 * 从后端加载对话列表（流式首屏加载）
 * GET /api/v1/conversations/stream?limit=10&offset=0
 * 首屏目标 10 条，每批 5 条，has_more=true 时续拉下一批。
 * 看到响应头 X-Conversation-Stream-Capped: true → 提示用户还有更多。
 */
async function loadConversationsFromAPI() {
  try {
    const existingMap = new Map()
    for (const conv of conversationHistory.value) {
      existingMap.set(conv.id, conv)
    }

    const hasActiveCards = (conv) => {
      return conv && Array.isArray(conv.cards) && conv.cards.some(c =>
        c && (c.status === 'generating' || c.status === 'failed')
      )
    }

    const mergedItems = []
    let offset = 0
    let hasMore = true
    let capped = false
    const TARGET_LIMIT = 10

    // 循环拉取直到 has_more=false 或已拿到 TARGET_LIMIT 条
    while (hasMore && offset < TARGET_LIMIT) {
      if (isUnmounted.value) return false
      const res = await streamConversationsApi({ limit: TARGET_LIMIT, offset })
      if (isUnmounted.value) return false
      const data = unwrapResponse(res.data)
      if (!data || !data.items) break

      // 检测硬截断标记（响应头或响应体 capped 字段）
      if (data.capped === true) capped = true
      const capHeader = res.headers?.['x-conversation-stream-capped']
      if (capHeader === 'true' || capHeader === true) capped = true

      mergedItems.push(...data.items)

      hasMore = !!data.has_more
      offset = (typeof data.next_offset === 'number') ? data.next_offset : (offset + (data.returned || 0))

      // 本批返回 0 条说明已无数据
      if (!data.returned || data.returned === 0) break
    }

    conversationsCapped.value = capped

    if (mergedItems.length === 0 && conversationHistory.value.length > 0) return true

    // 增量合并：保留本地已有对话的 cards 和 loaded 状态（尤其是 generating/failed 卡片）
    conversationHistory.value = mergedItems.map(c => {
      const id = c.conversation_id || c.id
      const existing = existingMap.get(id)
      // 如果本地有正在生成/失败的卡片，保留本地 cards 和 loaded 状态
      if (existing && hasActiveCards(existing)) {
        const mapped = _mapConvListItem(c, existing)
        return { ...existing, ...mapped, cards: existing.cards, loaded: existing.loaded }
      }
      return _mapConvListItem(c, existing)
    })
    return true
  } catch (e) {
    console.warn('加载对话列表失败:', e)
    return false
  }
}

/**
 * 从消息列表恢复对话卡片
 * GET /api/v1/conversations/{id}/messages
 * 消息中 role=assistant 且有 result_video_url 的条目映射为卡片
 *
 * 防御性兜底：超时/网络错误时自动重试 1 次（不修改核心逻辑，只做容错）。
 * 4xx/5xx 等业务错误不会触发重试。
 */
async function loadConversationDetail(id) {
  const conv = conversationHistory.value.find(c => c.id === id)
  if (!conv) return false

  // 设置加载中状态
  conv.loading = true

  const MAX_RETRY = 1
  const RETRY_DELAY_MS = 1000

  try {
    let attempt = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await _loadConversationDetailOnce(id, conv)
      } catch (e) {
        const isRetriable = e.code === 'TIMEOUT_ERROR' || e.code === 'NETWORK_ERROR'
        if (isRetriable && attempt < MAX_RETRY) {
          attempt++
          // 重试间隔，期间 conv.loading 保持 true，UI 仍展示加载态
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
          continue
        }
        throw e
      }
    }
  } catch (e) {
    console.warn('加载对话详情失败:', e)
    // 加载失败也标记为已尝试加载，避免重复请求
    conv.loaded = true
    return false
  } finally {
    conv.loading = false
  }
}

/**
 * 单次执行实际加载逻辑（被 loadConversationDetail 包装用于重试，请勿在此处加 UI 状态管理）。
 * 返回值：
 *   true  - 加载成功
 *   false - 数据无效（msgData/conv 为空），不重试
 *
 * 关键修复：刷新页面后，generating 中的任务后端尚未写入 assistant 消息，
 * 仅恢复已完成任务会让用户以为"等待中的卡片凭空消失"。
 * 这里会同时扫描 user 消息中的 generation_task_id，逐个查询后端任务状态：
 *   - completed / failed：直接以对应状态恢复
 *   - 仍在处理中：恢复为 generating 卡片，并启动后台轮询
 */
async function _loadConversationDetailOnce(id, conv) {
  // 先获取对话详情更新标题等
  const detailRes = await getConversationApi(id)
  if (isUnmounted.value) return false
  const detail = unwrapResponse(detailRes.data)
  if (conv && detail) {
    conv.title = detail.title || conv.title
    conv.status = detail.status || conv.status
    conv.generation_count = detail.generation_count ?? conv.generation_count
    conv.message_count = detail.message_count ?? conv.message_count
  }

  // 首次加载：只调流式端点（后端已补充 content/generation_task_id/result_task_id/created_at/duration/output_type）
  const streamRes = await streamMessagesApi(id, { limit: 3, offset: 0 })
    .catch(e => ({ data: { items: [], total_available: 0, has_more: false, next_offset: 0 }, _err: e }))
  if (isUnmounted.value) return false

  // 流式端点数据（后端已补充完整字段）
  const streamData = unwrapResponse(streamRes.data)
  const streamItems = Array.isArray(streamData?.items) ? streamData.items : []

  console.log('📋 [流式端点] 首次加载响应:', {
    conversationId: id,
    rawItems: streamItems,
    total_available: streamData?.total_available,
    has_more: streamData?.has_more,
    next_offset: streamData?.next_offset,
    capped: streamData?.capped
  })

  if (!conv) return false

  // 用流式端点 total_available 校正 message_count
  if (streamData?.total_available !== undefined && streamData.total_available !== conv.message_count) {
    conv.message_count = streamData.total_available
  }

  // 归一化流式端点数据（DESC → reverse → ASC），后端现已返回完整字段
  const messages = [...streamItems].reverse().map(_normalizeStreamItem)

  console.log('📋 [归一化后] messages:', messages.map(m => ({
    message_id: m.message_id,
    role: m.role,
    content: m.content?.slice(0, 30),
    model: m.model,
    feature: m.feature,
    ratio: m.ratio,
    quality: m.quality,
    duration: m.duration,
    output_type: m.output_type,
    generation_task_id: m.generation_task_id,
    result_task_id: m.result_task_id,
    created_at: m.created_at
  })))

  // 存储已加载消息，用于后续分页加载时重建卡片
  conv.allMessages = messages
  conv.messagesNextOffset = streamData?.next_offset ?? streamItems.length
  conv.messagesHasMore = !!streamData?.has_more
  conv.messagesLoading = false

  // 检测硬截断标记
  const msgCapped = streamData?.capped === true ||
    streamRes?.headers?.['x-message-stream-capped'] === 'true' ||
    streamRes?.headers?.['x-message-stream-capped'] === true
  conv.messagesCapped = msgCapped

  // 切换对话（不刷新页面）时，conv.cards 中可能已经有同 taskId 的本地占位卡片，
  // 这里建立 taskId → 本地卡片 的索引，便于后续按 taskId 复用而不是重复创建
  const localCardByTaskId = new Map()
  for (const c of (conv.cards || [])) {
    if (c && c.taskId) localCardByTaskId.set(c.taskId, c)
  }

  const cards = []
  // messages 已在上面通过 stream 端点 + reverse + normalize 得到（ASC 顺序）
  // 已通过 assistant 消息处理过的 taskId，避免与 user 消息恢复逻辑重复
  const seenTaskIds = new Set()
  // 仅在 user 消息中出现、尚未被 assistant 消化的 taskId → 需要查后端状态恢复
  const pendingTaskQueries = []

  // 第一遍：处理所有 assistant 消息（已完成的生成任务）
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.result_task_id) {
      // 找到对应的 user 消息：优先按 taskId 匹配，流式端点无 taskId 时回退到邻接配对
      let userMsg = messages.slice(0, i).reverse().find(m => m.role === 'user' && m.generation_task_id === msg.result_task_id)
      if (!userMsg) {
        // 邻接配对：最近的未配对 user 消息
        userMsg = messages.slice(0, i).reverse().find(m => m.role === 'user' && !m._paired)
        if (userMsg) userMsg._paired = true
      }
      // 从 user 消息的 attachments 字段恢复上传文件
      const uploadedInputFiles = buildAttachmentsFromUserMsg(userMsg)
      // 构建 results 数组（会根据 URL 扩展名自动判断类型）
      const cardResults = buildResultsFromMessage(msg)
      // 根据第一个结果的类型确定卡片类型
      const cardType = cardResults.length > 0 ? cardResults[0].type : 'image'
      // 从后端消息流式端点读取生成参数（model_name 已 normalize 为 model）
      // duration / output_type 流式端点不返回，fallback 到 localStorage 缓存
      const backendParams = {
        model: userMsg?.model || msg?.model || '',
        feature: userMsg?.feature || msg?.feature || '',
        ratio: userMsg?.ratio || msg?.ratio || '',
        quality: userMsg?.quality || msg?.quality || '',
        duration: userMsg?.duration || msg?.duration || 0,
        type: userMsg?.output_type || msg?.output_type || ''
      }
      const cachedParams = loadCardGenParams(id, msg.result_task_id)
      const resolvedModel = backendParams.model || cachedParams?.model || ''

      // 复用本地已有同 taskId 的卡片（避免重复创建导致 v-for key 冲突）
      const existing = localCardByTaskId.get(msg.result_task_id)
      if (existing) {
        // 原地更新已有卡片的内容（保留 id 以保持 v-for key 稳定）
        existing.title = (userMsg?.content || '').slice(0, 30) + ((userMsg?.content || '').length > 30 ? '...' : '')
        existing.prompt = userMsg?.content || existing.prompt || ''
        existing.type = backendParams.type || cachedParams?.type || cardType
        existing.model = resolvedModel || existing.model || ''
        existing.feature = backendParams.feature || cachedParams?.feature || existing.feature || ''
        existing.ratio = backendParams.ratio || cachedParams?.ratio || existing.ratio || ''
        existing.quality = backendParams.quality || cachedParams?.quality || existing.quality || ''
        existing.duration = backendParams.duration || cachedParams?.duration || existing.duration || 0
        existing.results = cardResults
        existing.status = 'completed'
        existing.loadingVideo = false
        existing.createdAt = existing.createdAt || msg.created_at || userMsg?.created_at || null
        existing.uploadedInputFiles = uploadedInputFiles.length ? uploadedInputFiles : existing.uploadedInputFiles
        cards.push(existing)
      } else {
        const card = {
          id: `task_${msg.result_task_id}`,
          title: (userMsg?.content || '').slice(0, 30) + ((userMsg?.content || '').length > 30 ? '...' : ''),
          prompt: userMsg?.content || '',
          type: backendParams.type || cachedParams?.type || cardType,
          model: resolvedModel,
          feature: backendParams.feature || cachedParams?.feature || '',
          ratio: backendParams.ratio || cachedParams?.ratio || '',
          quality: backendParams.quality || cachedParams?.quality || '',
          duration: backendParams.duration || cachedParams?.duration || 0,
          taskId: msg.result_task_id,
          results: cardResults,
          status: 'completed',
          loadingVideo: false,
          createdAt: msg.created_at || userMsg?.created_at || null,
          uploadedInputFiles: uploadedInputFiles
        }
        // 立即 push 到 conv.cards（保持和第三遍恢复逻辑一致）
        _applyRecoveredCards(conv, [card])
        localCardByTaskId.set(card.taskId, card)
        cards.push(card)
      }
      seenTaskIds.add(msg.result_task_id)

      // 兜底：如果流式端点的 model_name 为 null（任务未关联或后端数据缺失），
      // 异步从 billing 任务详情接口获取 model_name（不阻塞恢复流程）
      const modelTarget = cards[cards.length - 1]
      if (!modelTarget?.model && msg.result_task_id) {
        getBillingTaskDetailApi(msg.result_task_id).then(taskDetail => {
          if (isUnmounted.value) return
          if (taskDetail?.model_name) {
            modelTarget.model = taskDetail.model_name
            saveCardGenParams(id, msg.result_task_id, {
              model: modelTarget.model,
              feature: modelTarget.feature,
              ratio: modelTarget.ratio,
              quality: modelTarget.quality,
              duration: modelTarget.duration,
              type: modelTarget.type || cardType
            })
          }
        }).catch(e => console.warn(`⚠️ 获取任务详情失败(task=${msg.result_task_id}):`, e?.message || e))
      }
    }
  }

  // 第二遍：收集还没有对应 assistant 消息的 taskId（即"刷新页面时还在 generating 的任务"）
  // 来源 1：消息列表中的 generation_task_id（流式端点不返回此字段，老端点会返回）
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'user' && msg.generation_task_id && !seenTaskIds.has(msg.generation_task_id)) {
      if (!pendingTaskQueries.some(q => q.taskId === msg.generation_task_id)) {
        pendingTaskQueries.push({ taskId: msg.generation_task_id, userMsg: msg, messageIndex: i })
      }
    }
  }
  // 来源 2：localStorage 缓存中的 taskId（流式端点不返回 generation_task_id，改从缓存检测）
  // 生成请求发出后已立即写入缓存（saveCardGenParams），这里遍历当前 conversation 的所有缓存 taskId
  const cachedTaskIds = getAllCachedTaskIds(id)
  for (const taskId of cachedTaskIds) {
    if (seenTaskIds.has(taskId)) continue // 已有 assistant 回复 → 已完成，跳过
    if (pendingTaskQueries.some(q => q.taskId === taskId)) continue // 已收集，跳过
    // 从缓存恢复参数，构建 userMsg 占位（第三遍会从后端查询任务状态）
    const cached = loadCardGenParams(id, taskId)
    pendingTaskQueries.push({
      taskId,
      userMsg: {
        content: cached?.prompt || '',
        model: cached?.model || '',
        feature: cached?.feature || '',
        ratio: cached?.ratio || '',
        quality: cached?.quality || '',
        duration: cached?.duration || 0,
        output_type: cached?.type || ''
      },
      messageIndex: -1
    })
  }

  // 第三遍：逐个查询后端任务状态（避免并发过高，按顺序请求足够；任务通常 < 10 个）
  // 注意：每个 task 的 baseCard 立即 push 到 conv.cards，让 finalize/轮询能定位到
  for (const { taskId, userMsg } of pendingTaskQueries) {
    if (isUnmounted.value) return false
    const uploadedInputFiles = buildAttachmentsFromUserMsg(userMsg)
    const backendParams = {
      model: userMsg?.model || '',
      feature: userMsg?.feature || '',
      ratio: userMsg?.ratio || '',
      quality: userMsg?.quality || '',
      duration: userMsg?.duration || 0,
      type: userMsg?.output_type || ''
    }
    const cachedParams = loadCardGenParams(id, taskId)
    const cardType = backendParams.type || cachedParams?.type || 'image'

    // 复用本地已有同 taskId 的卡片（避免重复创建）
    let baseCard = localCardByTaskId.get(taskId)
    const isReusingLocal = !!baseCard
    if (!baseCard) {
      baseCard = {
        id: `task_${taskId}`,
        title: (userMsg?.content || '').slice(0, 30) + ((userMsg?.content || '').length > 30 ? '...' : ''),
        prompt: userMsg?.content || '',
        type: cardType,
        model: backendParams.model || cachedParams?.model || '',
        feature: backendParams.feature || cachedParams?.feature || '',
        ratio: backendParams.ratio || cachedParams?.ratio || '',
        quality: backendParams.quality || cachedParams?.quality || '',
        duration: backendParams.duration || cachedParams?.duration || 0,
        taskId: taskId,
        results: [],
        status: 'generating',
        progress: null,
        loadingVideo: false,
        createdAt: userMsg?.created_at || null,
        uploadedInputFiles: uploadedInputFiles
      }
      // 立即把 baseCard 同步加入 conv.cards（这样后续 finalize / pollTaskUntilDone 能按 id 找到）
      _applyRecoveredCards(conv, [baseCard])
      localCardByTaskId.set(taskId, baseCard)
    } else {
      // 复用本地卡片：补全参数，但保留原 status（避免覆盖正在显示的 failed 等）
      if (!baseCard.type) baseCard.type = cardType
      if (!baseCard.model) baseCard.model = backendParams.model || cachedParams?.model || ''
      if (!baseCard.feature) baseCard.feature = backendParams.feature || cachedParams?.feature || ''
      if (!baseCard.ratio) baseCard.ratio = backendParams.ratio || cachedParams?.ratio || ''
      if (!baseCard.quality) baseCard.quality = backendParams.quality || cachedParams?.quality || ''
      if (!baseCard.duration) baseCard.duration = backendParams.duration || cachedParams?.duration || 0
      if (!baseCard.prompt) baseCard.prompt = userMsg?.content || ''
      if (!baseCard.title) baseCard.title = (userMsg?.content || '').slice(0, 30) + ((userMsg?.content || '').length > 30 ? '...' : '')
      if (!baseCard.createdAt) baseCard.createdAt = userMsg?.created_at || null
      if (!baseCard.uploadedInputFiles || baseCard.uploadedInputFiles.length === 0) {
        baseCard.uploadedInputFiles = uploadedInputFiles
      }
    }
    cards.push(baseCard)

    let taskStatus = null
    let pollData = null
    let taskMissing = false // 任务已被后端清理（404/410/任务不存在）
    try {
      pollData = await getTaskChargeInfoApi(taskId)
      if (isUnmounted.value) return false
      taskStatus = pollData?.status
    } catch (e) {
      // 任务不存在（404/410 等）→ 后端已清理该任务记录，说明它早就结束了（多半是失败/超时/取消）
      // 必须按 failed 处理，否则卡片永远停在"生成中"
      const status = e?.status || e?.response?.status
      const code = e?.code || e?.response?.data?.code
      if (status === 404 || status === 410 || code === 'TASK_NOT_FOUND' || code === 'NOT_FOUND') {
        console.warn(`🗑️ 恢复对话时任务不存在（task=${taskId}），按 failed 处理`)
        taskMissing = true
      } else {
        console.warn(`⏳ 恢复对话时查询任务状态失败: task=${taskId}`, e?.message || e)
      }
    }

    // 如果 model 为空（后端消息不返回 model 字段，缓存也可能不存在），
    // 从 billing 任务详情接口获取 model_name（后端 generation_tasks 表存储了 model 信息）
    if (!baseCard.model && !taskMissing) {
      try {
        const taskDetail = await getBillingTaskDetailApi(taskId)
        if (isUnmounted.value) return false
        if (taskDetail?.model_name) {
          baseCard.model = taskDetail.model_name
          // 同步写入缓存，避免下次刷新再次查询
          saveCardGenParams(id, taskId, {
            model: baseCard.model,
            feature: baseCard.feature,
            ratio: baseCard.ratio,
            quality: baseCard.quality,
            duration: baseCard.duration,
            type: baseCard.type || cardType
          })
        }
      } catch (e) {
        // billing 详情接口失败（404 任务不存在 / 403 无权访问 / 其他错误），
        // 说明任务在后端已不可查 → 任务已失败或被清理，按 failed 处理
        console.warn(`🗑️ 获取任务详情失败（task=${taskId}），按 failed 处理:`, e?.message || e)
        taskMissing = true
      }
    }

    // 扩充后的失败状态集合：cancelled / timeout / expired / aborted / refunded 等都按 failed 处理
    const FAILED_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled', 'timeout', 'timed_out', 'expired', 'aborted', 'refunded'])
    const isFailed = taskMissing || (taskStatus && FAILED_STATUSES.has(taskStatus))

    if (taskStatus === 'completed' && pollData) {
      // 后端已完成但 assistant 消息可能还没写（罕见时序问题），用 task status 数据兜底
      const wrappedData = {
        code: 200,
        data: {
          task_id: taskId,
          type: cardType,
          status: 'completed',
          progress: 100,
          result: pollData.result
        }
      }
      const result = extractResultFromData(wrappedData)
      const cardResults = result.results?.length
        ? result.results
        : (Array.isArray(pollData.result) ? pollData.result : [])
      // 直接更新卡片状态，不调用 finalizeGenerationSuccess
      // 原因：finalizeGenerationSuccess 会把 cacheCard.model 写入 localStorage 缓存，
      // 但恢复路径中 baseCard.model 可能为空（后端消息不返回 model 字段），
      // 空值写入缓存后会污染后续恢复，导致已完成卡片的 model 显示为"默认模型"。
      // model 缓存应由 handleGenerate 的 finalizeGenerationSuccess 在生成完成时写入（此时 model 有值）。
      if (baseCard.status === 'generating' || baseCard.status === 'failed') {
        baseCard.results = cardResults
        baseCard.status = 'completed'
        baseCard.progress = null
      }
      // 视频后处理（与 finalizeGenerationSuccess 一致）
      if (baseCard.results.some(r => r.type === 'video')) {
        processVideoResults(baseCard).catch(() => {})
      }
      // 更新缩略图
      const thumbConv = conversationHistory.value.find(c => c.id === id)
      if (thumbConv && cardResults.length > 0) {
        thumbConv.thumbnail = cardResults[0].thumbnail || cardResults[0].url || thumbConv.thumbnail
        thumbConv.time = Date.now()
      }
      // 扣费明细
      if (pollData.charge_info?.balance_after !== undefined) {
        if (userStore.userPoints) {
          userStore.userPoints = { ...userStore.userPoints, remaining: pollData.charge_info.balance_after }
        } else {
          userStore.fetchPoints()
        }
      }
    } else if (isFailed) {
      // 任务已失败/被清理/被取消：直接更新 baseCard 的 reactive 状态
      if (baseCard.status === 'generating') {
        baseCard.status = 'failed'
        baseCard.results = []
        baseCard.progress = null
      }
    } else if (taskStatus) {
      // 其他明确的状态（如 'pending' / 'processing' / 'queued'）：保留 generating，启动轮询
      if (typeof pollData?.progress === 'number' && baseCard.status === 'generating') {
        baseCard.progress = pollData.progress
      }
      if (!isReusingLocal) {
        pollTaskUntilDone({ taskId, convId: id, cardId: baseCard.id, cardType })
          .catch(err => console.error('🚨 恢复轮询异常:', err))
      }
    } else {
      // taskStatus 为 null（查询失败但非 404）：保守按 generating 处理，启动轮询
      if (!isReusingLocal) {
        pollTaskUntilDone({ taskId, convId: id, cardId: baseCard.id, cardType })
          .catch(err => console.error('🚨 恢复轮询异常:', err))
      }
    }
  }

  // 保留尚未同步到后端的卡片（生成中/生成失败，本地 taskId 为 null 或未在恢复列表中），避免切换对话后丢失
  const recoveredTaskIds = new Set(cards.map(c => c.taskId).filter(Boolean))
  const pendingCards = (conv.cards || []).filter(c =>
    (c.status === 'generating' || c.status === 'failed') &&
    !recoveredTaskIds.has(c.taskId)
  )
  // 此时所有 conv.cards 已包含：assistant 消息恢复的卡片 + 第三遍恢复的卡片 + 上述未同步的本地卡片
  // 🔍 打印重建后的卡片数据（用于验证生成参数是否正确恢复）
  console.log('🃏 重建后的卡片:', conv.cards)
  console.table(conv.cards.map(c => ({
    id: c.id,
    taskId: c.taskId,
    status: c.status,
    model: c.model,
    feature: c.feature,
    ratio: c.ratio,
    quality: c.quality,
    duration: c.duration,
    type: c.type,
    prompt: (c.prompt || '').slice(0, 20),
    createdAt: c.createdAt,
    resultsCount: c.results?.length || 0
  })))

  // 缩略图：只采用第一张已完成卡片的封面（避免被 generating 卡片的空 results 覆盖）
  const firstCompletedCard = cards.find(c => c.status === 'completed' && c.results?.length > 0)
  conv.thumbnail = firstCompletedCard
    ? (firstCompletedCard.results[0].thumbnail || firstCompletedCard.results[0].url || '')
    : conv.thumbnail

  // 标记已加载完成
  conv.loaded = true
  return true
}

/**
 * 从一批消息中重建卡片并前插到 conv.cards（用于向上滚动加载更多历史消息）。
 * 仅处理 assistant 消息（已完成的生成任务），不查后端任务状态（旧消息早已完成）。
 * 复用 conv.allMessages 查找 user 消息配对，避免分批次加载时丢失 prompt。
 */
function _prependCardsFromMessages(messages, conv, id) {
  if (!conv || !Array.isArray(conv.cards)) return

  const localCardByTaskId = new Map()
  for (const c of conv.cards) {
    if (c && c.taskId) localCardByTaskId.set(c.taskId, c)
  }

  const newCards = []
  // 记录本批次中已配对的 user 消息索引（邻接配对用）
  const pairedUserIndices = new Set()
  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx]
    if (msg.role !== 'assistant' || !msg.result_task_id) continue
    if (localCardByTaskId.has(msg.result_task_id)) continue

    // 在已加载的全部消息中查找对应的 user 消息：优先按 taskId，回退到邻接配对
    let userMsg = conv.allMessages.find(m =>
      m.role === 'user' && m.generation_task_id === msg.result_task_id
    )
    if (!userMsg) {
      // 邻接配对：在 allMessages 中找到该 assistant 消息的位置，向前找最近的未配对 user
      const asstIdx = conv.allMessages.indexOf(msg)
      if (asstIdx > 0) {
        for (let j = asstIdx - 1; j >= 0; j--) {
          if (conv.allMessages[j].role === 'user' && !pairedUserIndices.has(j)) {
            userMsg = conv.allMessages[j]
            pairedUserIndices.add(j)
            break
          }
        }
      }
    }
    const uploadedInputFiles = buildAttachmentsFromUserMsg(userMsg)
    const cardResults = buildResultsFromMessage(msg)
    const cardType = cardResults.length > 0 ? cardResults[0].type : 'image'
    const backendParams = {
      model: userMsg?.model || msg?.model || '',
      feature: userMsg?.feature || msg?.feature || '',
      ratio: userMsg?.ratio || msg?.ratio || '',
      quality: userMsg?.quality || msg?.quality || '',
      duration: userMsg?.duration || msg?.duration || 0,
      type: userMsg?.output_type || msg?.output_type || ''
    }
    const cachedParams = loadCardGenParams(id, msg.result_task_id)
    const resolvedModel = backendParams.model || cachedParams?.model || ''

    const card = {
      id: `task_${msg.result_task_id}`,
      title: (userMsg?.content || '').slice(0, 30) + ((userMsg?.content || '').length > 30 ? '...' : ''),
      prompt: userMsg?.content || '',
      type: backendParams.type || cachedParams?.type || cardType,
      model: resolvedModel,
      feature: backendParams.feature || cachedParams?.feature || '',
      ratio: backendParams.ratio || cachedParams?.ratio || '',
      quality: backendParams.quality || cachedParams?.quality || '',
      duration: backendParams.duration || cachedParams?.duration || 0,
      taskId: msg.result_task_id,
      results: cardResults,
      status: 'completed',
      loadingVideo: false,
      createdAt: msg.created_at || userMsg?.created_at || null,
      uploadedInputFiles: uploadedInputFiles
    }
    newCards.push(card)
    localCardByTaskId.set(card.taskId, card)

    // model 为空时异步从 billing 任务详情获取
    if (!card.model && msg.result_task_id) {
      getBillingTaskDetailApi(msg.result_task_id).then(taskDetail => {
        if (isUnmounted.value) return
        if (taskDetail?.model_name) {
          card.model = taskDetail.model_name
          saveCardGenParams(id, msg.result_task_id, {
            model: card.model,
            feature: card.feature,
            ratio: card.ratio,
            quality: card.quality,
            duration: card.duration,
            type: card.type || cardType
          })
        }
      }).catch(e => console.warn(`⚠️ 获取任务详情失败(task=${msg.result_task_id}):`, e?.message || e))
    }
  }

  if (newCards.length > 0) {
    conv.cards.unshift(...newCards)
  }
}

/**
 * 向上滚动时加载更多历史消息（每次 3 条，DESC → reverse → prepend）。
 * 使用 messages/stream 端点，通过 next_offset 续拉更早的消息。
 * 维护 conv.allMessages（ASC 顺序累积）和 conv.messagesNextOffset（下次加载偏移量）。
 * 加载完成后前插卡片到 conv.cards，并保持滚动位置不变。
 */
async function loadOlderMessages(id) {
  const conv = conversationHistory.value.find(c => c.id === id)
  if (!conv || !conv.messagesHasMore || conv.messagesLoading) return

  conv.messagesLoading = true

  // 记录滚动位置（加载后保持视觉位置不变）
  const container = canvasContainer.value
  const oldScrollHeight = container ? container.scrollHeight : 0
  const oldScrollTop = container ? container.scrollTop : 0

  try {
    // 流式端点：用 next_offset 续拉更早的消息（DESC 顺序）
    const offset = conv.messagesNextOffset || 0
    const msgRes = await streamMessagesApi(id, { limit: 3, offset })
    if (isUnmounted.value) return

    const msgData = unwrapResponse(msgRes.data)
    if (!msgData || !msgData.items) return

    // 用 API 返回的 total_available 校正 message_count
    if (msgData.total_available !== undefined && msgData.total_available !== conv.message_count) {
      conv.message_count = msgData.total_available
    }

    // 检测硬截断标记
    const msgCapped = msgData.capped === true ||
      msgRes.headers?.['x-message-stream-capped'] === 'true' ||
      msgRes.headers?.['x-message-stream-capped'] === true
    if (msgCapped) conv.messagesCapped = true

    // DESC → reverse → ASC → normalize
    const olderMessages = [...msgData.items].reverse().map(_normalizeStreamItem)

    console.log('📋 [流式端点] 加载更多历史消息:', {
      conversationId: id,
      offset,
      rawItems: msgData.items,
      normalized: olderMessages.map(m => ({
        message_id: m.message_id,
        role: m.role,
        content: m.content?.slice(0, 30),
        model: m.model,
        generation_task_id: m.generation_task_id,
        result_task_id: m.result_task_id,
        created_at: m.created_at
      }))
    })

    // 前插到 allMessages（ASC 顺序，旧消息在前）
    conv.allMessages = [...olderMessages, ...conv.allMessages]
    conv.messagesNextOffset = msgData.next_offset ?? (offset + msgData.items.length)
    conv.messagesHasMore = !!msgData.has_more

    // 从新批次消息重建卡片并前插
    _prependCardsFromMessages(olderMessages, conv, id)

    nextTick(() => {
      if (container && !isUnmounted.value) {
        const newScrollHeight = container.scrollHeight
        container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
      }
      if (window.lucide) lucide.createIcons()
    })
  } catch (e) {
    console.warn('加载更多消息失败:', e)
  } finally {
    if (!isUnmounted.value) conv.messagesLoading = false
  }
}

/**
 * 结果区域滚动事件：滚动到顶部时加载更多历史消息
 */
function onResultsScroll() {
  const el = canvasContainer.value
  if (!el) return
  if (el.scrollTop <= 50 && activeConversationId.value) {
    loadOlderMessages(activeConversationId.value)
  }
}

/**
 * 同步将一批恢复卡片应用到 conv.cards 上（供恢复轮询/finalize 期间使用）。
 * 内部会按 taskId 去重，避免与已有卡片重复。
 */
function _applyRecoveredCards(conv, newCards) {
  if (!conv) return
  if (!Array.isArray(conv.cards)) conv.cards = []
  const existingTaskIds = new Set(conv.cards.map(c => c.taskId).filter(Boolean))
  for (const c of newCards) {
    if (c && c.taskId && existingTaskIds.has(c.taskId)) continue
    conv.cards.push(c)
  }
}

/**
 * 根据 URL 扩展名判断媒体类型
 * @param {string} url - URL 地址
 * @returns {'image'|'video'} - 媒体类型
 */
function inferTypeFromUrl(url) {
  if (!url || typeof url !== 'string') return 'image'
  // 检查 URL 扩展名（忽略查询参数）
  const cleanUrl = url.split('?')[0].toLowerCase()
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.flv', '.wmv']
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico']
  // 优先检查视频扩展名
  if (videoExts.some(ext => cleanUrl.endsWith(ext))) return 'video'
  // 然后检查图片扩展名
  if (imageExts.some(ext => cleanUrl.endsWith(ext))) return 'image'
  // 默认返回 image（因为大多数生成结果是图片）
  return 'image'
}

/**
 * 从 assistant 消息构建 results 数组
 */
function buildResultsFromMessage(msg) {
  const results = []
  // 处理 result_video_url / result_url（流式端点字段）：根据 URL 扩展名判断实际类型
  const videoUrl = msg.result_video_url || msg.result_url
  if (videoUrl) {
    const actualType = inferTypeFromUrl(videoUrl)
    results.push({
      type: actualType,
      url: videoUrl,
      thumbnail: msg.result_thumbnail_url || '',
      id: msg.result_task_id || msg.message_id || 'res_0'
    })
  }
  // 支持图片结果（如果后端返回 result_image_url）
  if (msg.result_image_url) {
    const urls = Array.isArray(msg.result_image_url) ? msg.result_image_url : [msg.result_image_url]
    urls.forEach((u, idx) => {
      results.push({
        type: 'image',
        url: u,
        thumbnail: msg.result_thumbnail_url || u,
        id: `${msg.result_task_id || msg.message_id || 'res'}_${idx}`
      })
    })
  }
  return results
}

/**
 * 从 user 消息的 attachments 字段构建上传文件列表
 * attachments 结构: [{url, type, purpose, object_id?, file_id?}, ...]
 * 兼容流式端点的 uploaded_image_url 字段（单个 URL）。
 */
function buildAttachmentsFromUserMsg(userMsg) {
  if (!userMsg) return []
  // 流式端点：uploaded_image_url → 转为 attachments 结构
  if (userMsg.uploaded_image_url && !userMsg.attachments) {
    return [{
      url: userMsg.uploaded_image_url,
      type: 'image',
      purpose: 'reference',
      object_id: '',
      file_id: ''
    }]
  }
  if (!userMsg.attachments || !Array.isArray(userMsg.attachments)) return []
  return userMsg.attachments.map(att => ({
    url: att.url || '',
    type: att.type || 'image',
    purpose: att.purpose || 'reference',
    object_id: att.object_id || '',
    file_id: att.file_id || '',
    name: att.name || '',
    thumbnail: att.thumbnail || att.thumbnail_url || att.cover_url || ''
  }))
}

/**
 * 将 messages/stream 端点返回的 MessageStreamItem 归一化为卡片重建所需的格式。
 * 后端已在流式端点中补充了完整字段：content / generation_task_id / result_task_id /
 * created_at / duration / output_type / model_name（变体 ID）/ quality（实际值）。
 *
 * 字段映射（兼容后端字段命名）：
 *   result_url → result_video_url（如果后端用 result_url 而非 result_video_url）
 *   model_name → model（后端现返回变体 model_id 而非 display_name）
 *   uploaded_image_url → attachments[{url}]（如果后端未返回 attachments 数组）
 *   result_task_id：优先用后端返回值，缺失时 fallback 到 message_id（仅 assistant）
 *   content：优先用后端返回值，缺失时 fallback 到空字符串
 *   generation_task_id / created_at / duration / output_type：后端直返，直接透传
 */
function _normalizeStreamItem(item) {
  if (!item) return item
  const normalized = { ...item }
  // result_url → result_video_url（兼容后端两种字段命名）
  if (item.result_url && !normalized.result_video_url) {
    normalized.result_video_url = item.result_url
  }
  // model_name → model（后端现返回变体 model_id）
  if (item.model_name && !normalized.model) {
    normalized.model = item.model_name
  }
  // uploaded_image_url → attachments（仅当后端未返回 attachments 数组时转换）
  if (item.uploaded_image_url && !normalized.attachments) {
    normalized.attachments = [{ url: item.uploaded_image_url, type: 'image', purpose: 'reference' }]
  }
  // assistant 消息：result_task_id 优先用后端返回值，缺失时用 message_id 作 fallback
  if (item.role === 'assistant' && !normalized.result_task_id) {
    normalized.result_task_id = item.message_id
  }
  // content：优先用后端返回值，缺失时设为空字符串
  if (normalized.content === undefined) {
    normalized.content = ''
  }
  // quality：如果后端仍返回 "auto"（未修正的旧数据），视为无效值，置空让缓存兜底
  if (typeof normalized.quality === 'string' && normalized.quality.toLowerCase() === 'auto') {
    normalized.quality = ''
  }
  return normalized
}

// ========== 生命周期 ==========
// hasInteracted 变化时重新初始化 lucide 图标（v-if/v-else 切换导致 DOM 重建）
watch(hasInteracted, () => {
  nextTick(() => { if (window.lucide) lucide.createIcons() })
})

onMounted(async () => {
  // 重置卸载标志：组件重新挂载时恢复（路由切换回来后需要能继续轮询）
  isUnmounted.value = false
  // 从 API 加载对话列表
  await loadConversationsFromAPI()
  await initModels()
  userStore.fetchPoints()
  document.addEventListener('click', handleGlobalClick)
  // 页面重新获得焦点时刷新积分和价格估算（管理员可能改了价格）
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (window.lucide) lucide.createIcons()

  // 来自首页最近项目的跳转：自动选中指定对话
  const targetId = route.query.conversation_id
  if (targetId) {
    const exists = conversationHistory.value.some(c => String(c.id) === String(targetId))
    if (exists) {
      await selectConversation(String(targetId))
    }
    // 清掉 query 参数，避免刷新页面后再次自动选中（导致误触发详情加载）
    router.replace({ path: '/generate', query: {} })
  }
})

// 异步轮询组件卸载标志：卸载后停止轮询，避免对已销毁的 reactive 对象写值
const isUnmounted = ref(false)
let toastTimer = null

onUnmounted(() => {
  isUnmounted.value = true
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // 清理价格防抖与 toast 定时器，避免卸载后修改 state
  if (priceDebounceTimer) {
    clearTimeout(priceDebounceTimer)
    priceDebounceTimer = null
  }
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  // 关闭 Teleport modal，防止残留覆盖新页面
  showCloudModal.value = false
  showPreviewModal.value = false
  showAtMentionDropdown.value = false
})

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    userStore.fetchPoints()
    // 如果已选模型，重新估算价格（管理员可能改了定价）
    if (selectedModel.value) {
      fetchEstimatedPrice()
    }
  }
}

function handleGlobalClick(e) {
  if (!e.target.closest('.option-chip')) {
    closeOtherDropdowns('')
  }
  if (!e.target.closest('.upload-dropdown') && !e.target.closest('.upload-menu')) {
    isUploadDropdownOpen.value = false
  }
  if (!e.target.closest('.dual-upload-slot-wrap')) {
    dualUploadDropdown.value = null
  }
}
</script>

<style scoped>
/* ====== 即梦AI风格全局布局 ====== */
.generate-page-jimeng {
  width: 100%;
  height: 100%;
  display: flex;
  background: #f5f7fa;
  overflow: hidden;
}

/* ====== 左侧对话历史侧边栏 ====== */
.jimeng-left-sidebar {
  width: 260px;
  min-width: 200px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
  flex-shrink: 1;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.new-chat-btn {
  margin: 12px 16px;
  padding: 10px 16px;
  border: 1px dashed #d1d5db;
  background: #fafafa;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4b5563;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #f5f3ff;
}

.recent-section {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.recent-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 4px 6px;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  position: relative;
}

.conversation-item:hover {
  background: #f9fafb;
  border-color: #e5e7eb;
}

.conversation-item.active {
  background: #f3f0ff;
  border-color: #c4b5fd;
}

.conv-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.conv-thumb img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conv-thumb video {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conv-thumb-placeholder {
  color: #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conv-title {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-meta {
  font-size: 10px;
  color: #9ca3af;
}

/* 重命名输入框 */
.conv-title-input {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  border: 1.5px solid #6366f1;
  border-radius: 4px;
  padding: 0 4px;
  outline: none;
  width: 100%;
  background: white;
}

.conv-title-input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

/* 状态标签 */
.conv-status-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #9ca3af;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 操作按钮组 */
.conv-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.conversation-item:hover .conv-actions {
  opacity: 1;
}

.conv-rename-btn,
.conv-delete-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.conv-rename-btn:hover {
  background: #eff6ff;
  color: #2563eb;
}

.conv-delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* 归档状态 */
.conversation-item.archived {
  opacity: 0.65;
}

.conversation-item.archived .conv-title {
  color: #9ca3af;
}

.no-conversations {
  text-align: center;
  padding: 24px 0;
  font-size: 13px;
  color: #9ca3af;
}

/* 对话列表流式截断提示 */
.conv-capped-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 12px;
  color: #1e40af;
  cursor: help;
}

/* ====== 主内容区域 ====== */
.jimeng-main-area {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* ====== 欢迎页（未交互状态）===== */
.jimeng-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  overflow-y: auto;
  position: relative;
}

.page-asset-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4338ca;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.page-asset-btn:hover {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.jimeng-interaction .page-asset-btn {
  position: absolute;
  top: 12px;
  right: 12px;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 32px;
  letter-spacing: -0.5px;
}

/* ====== 输入卡片（通用）===== */
.input-card {
  width: 100%;
  max-width: 800px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid #e5e7eb;
  overflow: visible;
  transition: box-shadow 0.3s;
}

.input-card:focus-within {
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  border-color: #93c5fd;
}

.input-card-body {
  display: flex;
  align-items: flex-start;
  padding: 16px 16px 8px;
  gap: 12px;
}

.upload-zone {
  width: 48px;
  height: 48px;
  min-height: 48px;
  border: 2px dashed #d1d5db;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
  position: relative;
  background: #fafafa;
}

.upload-zone:hover {
  border-color: #3b82f6;
  background: #f5f3ff;
}

.upload-hint {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: #9ca3af;
  white-space: nowrap;
}

.prompt-editor-wrapper {
  flex: 1;
  min-height: 48px;
  position: relative;
}

.prompt-input {
  min-height: 48px;
  max-height: 200px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  word-break: break-word;
  overflow-y: auto;
  padding: 4px 0;
}

.prompt-input:empty::before {
  content: attr(placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.prompt-input::-webkit-scrollbar {
  width: 4px;
}

.prompt-input::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}

/* ========== @标签内联样式（蓝色芯片，与普通文字明显区分） ========== */
:deep(.at-tag-inline) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 8px;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  font-weight: 600;
  font-size: 13px;
  cursor: default;
  vertical-align: middle;
  transition: background 0.15s ease;
  user-select: none;
  flex-shrink: 0;
  line-height: 1.6;
}

:deep(.at-tag-inline:hover) {
  background: #2563eb;
}

/* 蓝色徽章文字 */
:deep(.at-tag-card-badge) {
  pointer-events: none;
}

/* @视频标签：紫色系，区别于@图片的蓝色 */
:deep(.at-tag-inline.at-tag-video) {
  background: #7c3aed;
}

:deep(.at-tag-inline.at-tag-video:hover) {
  background: #6d28d9;
}

/* 右侧关闭按钮（×用伪元素渲染，避免污染innerText） */
:deep(.at-tag-close) {
  border: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  line-height: 1;
  padding: 0;
  opacity: 0.6;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

:deep(.at-tag-close::before) {
  content: '\00D7';
}

:deep(.at-tag-close:hover) {
  opacity: 1;
  background: rgba(239, 68, 68, 0.85);
  transform: scale(1.15);
}

/* 激活状态（对应右侧引用素材高亮） */
:deep(.at-tag-inline-highlight) {
  animation: atPulse 1s ease-in-out;
}

@keyframes atPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

/* @视频标签高亮动画（紫色） */
.at-tag-inline-highlight.at-tag-video {
  animation: atPulseVideo 1s ease-in-out;
}

@keyframes atPulseVideo {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
}

/* @音频标签：绿色系，区别于@图片的蓝色和@视频的紫色 */
:deep(.at-tag-inline.at-tag-audio) {
  background: #10b981;
}

:deep(.at-tag-inline.at-tag-audio:hover) {
  background: #059669;
}

/* @音频标签高亮动画（绿色） */
.at-tag-inline-highlight.at-tag-audio {
  animation: atPulseAudio 1s ease-in-out;
}

@keyframes atPulseAudio {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
}

/* ========== 上传下拉菜单 ========== */
.upload-dropdown {
  position: relative;
  flex-shrink: 0;
}

.upload-dropdown.open .upload-zone {
  border-color: #3b82f6;
  background: #eff6ff;
}

.upload-dropdown.open .upload-zone i {
  color: #3b82f6;
}

.upload-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  background: white;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.04);
  padding: 6px;
  min-width: 190px;
  z-index: 9999;
}

.upload-menu-section {
  padding: 4px 0;
}

.upload-section-title {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.upload-menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 12px;
}

.upload-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.upload-option:hover {
  background: #f3f4f6;
  color: #111827;
}

/* 双上传框 */
.dual-upload-bar {
  display: flex;
  gap: 12px;
  padding: 10px 16px 0;
}

.dual-upload-slot {
  flex: 1;
  min-height: 80px;
  border: 2px dashed #e5e7eb;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  background: #fafbfc;
}

.dual-upload-slot:hover {
  border-color: #3b82f6;
  background: #f0f7ff;
}

.dual-upload-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 8px;
}

.dual-upload-badge {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 2;
}

.dual-upload-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  transition: background 0.15s;
}

.dual-upload-remove:hover {
  background: #ef4444;
}

.dual-upload-placeholder {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.dual-upload-slot-wrap {
  position: relative;
  flex: 1;
}

.dual-upload-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 100;
  min-width: 160px;
}

/* 媒体素材栏 */
.media-bar {
  padding: 8px 16px 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.media-section {
  flex: 1;
  min-width: 200px;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-count {
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
}

.media-items-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.media-item {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9fafb;
}

.media-item:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.audio-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #9ca3af;
  font-size: 9px;
}

.remove-file-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
}

.remove-file-btn i,
.remove-file-btn svg {
  display: block;
  width: 12px !important;
  height: 12px !important;
  color: inherit;
}

.media-item:hover .remove-file-btn {
  opacity: 1;
}

.file-type-badge {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
}

.preview-icon-btn {
  position: absolute;
  bottom: 2px;
  left: 34px;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  z-index: 10;
}

.preview-icon-btn:hover {
  background: rgba(59, 130, 246, 0.9);
}

.media-item:hover .preview-icon-btn {
  opacity: 1;
}

.preview-icon-btn svg {
  display: block;
  width: 14px !important;
  height: 14px !important;
  color: inherit;
}

.drag-hint-overlay {
  position: absolute;
  inset: 0;
  background: rgba(139, 92, 246, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 9px;
  opacity: 0;
  transition: opacity 0.2s;
  gap: 2px;
  pointer-events: none;
  z-index: 1;
}

.media-item:hover .drag-hint-overlay {
  opacity: 1;
}

.ref-item.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.ref-at-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #3b82f6;
  color: white;
  font-weight: 600;
}

/* @视频引用标签：紫色 */
.ref-item.type-video .ref-at-badge {
  background: #7c3aed;
}

.ref-item.type-video.active {
  border-color: #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
}

/* @音频引用标签：绿色 */
.ref-item.type-audio .ref-at-badge {
  background: #10b981;
}

.ref-item.type-audio.active {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.ref-audio-preview {
  font-size: 10px;
}

.remove-ref-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border: none;
  background: rgba(239, 68, 68, 0.9);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.ref-item:hover .remove-ref-btn {
  opacity: 1;
}

.media-bar-divider {
  width: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

/* 底部操作栏 */
.input-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 14px;
  border-top: 1px solid #f3f4f6;
  gap: 12px;
}

.footer-options {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.option-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 20px;
  font-size: 12px;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.option-chip:hover {
  border-color: #c4b5fd;
  background: #faf5ff;
  color: #2563eb;
}

.option-chip.open {
  border-color: #3b82f6;
  background: #f5f3ff;
  color: #2563eb;
}

.option-chip.sound-chip.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}

.option-chip.sound-chip.disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.option-chip.sound-chip .sound-label {
  font-size: 12px;
  font-weight: 500;
}

/* 图片生成高级参数样式 */
.option-chip.count-chip,
.option-chip.format-chip,
.option-chip.img-quality-chip,
.option-chip.background-chip,
.option-chip.watermark-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: pointer;
  font-size: 13px;
  color: #4b5563;
  transition: all 0.15s ease;
  user-select: none;
}

.option-chip.count-chip:hover,
.option-chip.format-chip:hover,
.option-chip.img-quality-chip:hover,
.option-chip.background-chip:hover,
.option-chip.watermark-chip:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
}

.option-chip.count-chip.open,
.option-chip.format-chip.open,
.option-chip.img-quality-chip.open,
.option-chip.background-chip.open {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}

.option-chip.watermark-chip.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.price-estimate-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #f59e0b;
  font-weight: 500;
  background: #fffbeb;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #fde68a;
  white-space: nowrap;
}

.price-estimate-mini.loading {
  color: #9ca3af;
  background: #f9fafb;
  border-color: #e5e7eb;
}

.price-estimate-mini.price-insufficient {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
  animation: pulse-insufficient 1.5s ease-in-out infinite;
}

@keyframes pulse-insufficient {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.char-count-mini {
  font-size: 11px;
  color: #9ca3af;
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 10px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.35);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 14px rgba(139, 92, 246, 0.45);
}

.send-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
  box-shadow: none;
}

/* 下拉菜单通用样式 */
.select-dropdown {
  position: fixed;
  z-index: 9999;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 6px;
  min-width: 180px;
  max-height: 280px;
  overflow-y: auto;
}

.select-option {
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}

.select-option:hover {
  background: #f3f4f6;
}

.select-option.active {
  background: #f5f3ff;
  color: #2563eb;
  font-weight: 500;
}

.model-option-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.model-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.default-badge {
  font-size: 9px;
  padding: 1px 5px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border-radius: 4px;
  font-weight: 500;
}


/* @提及下拉列表 */
.at-mention-dropdown {
  position: fixed;
  z-index: 10000;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  padding: 8px;
  min-width: 260px;
  max-height: 300px;
  overflow-y: auto;
}

.at-mention-header {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  padding: 4px 8px 8px;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 4px;
}

.at-mention-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.at-mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.at-mention-item:hover,
.at-mention-item.active {
  background: #f3f4f6;
}

.mention-thumb-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.mention-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.audio-thumb {
  width: 100%;
  height: 100%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.mention-type-icon {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  padding: 1px 3px;
  border-radius: 3px;
}

.mention-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mention-name {
  font-size: 13px;
  color: #1f2937;
  font-weight: 500;
}

.mention-type-label {
  font-size: 11px;
  color: #9ca3af;
}

.at-mention-empty {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  color: #9ca3af;
}

/* ====== 已交互状态：结果展示区域 ====== */
.jimeng-interaction {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 10px 10px 0 0;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  flex-shrink: 0;
  margin-bottom: -1px;
  gap: 8px;
}

.card-thumb-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.card-thumb-item {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid #e5e7eb;
  flex-shrink: 0;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-thumb-preview-btn {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.card-thumb-preview-btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.card-thumb-zoom-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(17, 24, 39, 0.52);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.card-thumb-preview-btn:hover .card-thumb-zoom-icon,
.card-thumb-preview-btn:focus-visible .card-thumb-zoom-icon {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .card-thumb-zoom-icon {
    transition: none;
  }
}

.card-thumb-video,
.card-thumb-file {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: #eef2ff;
}

.topbar-context {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: default;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.topbar-context.is-expanded {
  flex-wrap: wrap;
}

.context-thumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.context-thumb-item {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.context-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.context-thumb-video,
.context-thumb-file {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #6b7280;
}

.context-thumb-more {
  font-size: 11px;
  color: #6b7280;
  flex-shrink: 0;
}

.context-prompt {
  font-weight: 600;
  color: #1f2937;
  min-width: 0;
}

.context-prompt.is-truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.topbar-context.is-expanded .context-prompt {
  white-space: normal;
  max-width: none;
}

.context-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: #f3f4f6;
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.context-expand-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.context-title {
  font-weight: 600;
  color: #1f2937;
}

.context-sep {
  color: #d1d5db;
}

.context-feature {
  font-size: 11px;
  color: #6366f1;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.context-ratio {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

.context-duration {
  font-size: 11px;
  color: #2563eb;
  background: #dbeafe;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.context-time {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 400;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.topbar-action-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.results-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
  min-height: 0;
}

.results-area::-webkit-scrollbar {
  width: 5px;
}

.results-area::-webkit-scrollbar-track {
  background: transparent;
}

.results-area::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 10px;
}

/* 向上滚动加载更多 */
.messages-load-more-top,
.messages-load-more-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  color: #9ca3af;
  font-size: 12px;
}

.messages-load-more-top i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 达到最大对话次数提示 */
.max-rounds-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.max-rounds-notice i {
  flex-shrink: 0;
  color: #f59e0b;
}

.max-rounds-notice span {
  flex: 1;
}

.max-rounds-new-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.max-rounds-new-btn:hover {
  background: #1d4ed8;
}

/* 输入框禁用态 */
.prompt-input.is-disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
  pointer-events: none;
}

/* 结果卡片 */
.result-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.result-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f3f4f6;
}

.result-prompt-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
  flex: 1;
  margin-right: 16px;
}

.result-actions {
  display: flex;
  gap: 6px;
}

.result-action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.2s;
}

.result-action-btn:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.result-card-body {
  padding: 18px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  border: 1px solid #e5e7eb;
  border-top: none;
  border-radius: 0 0 10px 10px;
  padding: 16px;
  background: #ffffff;
}

.result-image-item {
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  transition: all 0.25s;
}

.result-image-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #c4b5fd;
}

.result-image-item img {
  width: 100%;
  display: block;
}

.video-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.video-wrapper video {
  width: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: white;
  border-radius: 12px;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-state i {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
}

/* 底部输入卡片（交互后） */
.input-card-bottom {
  flex-shrink: 0;
  margin: 0 auto 20px;
  max-width: 680px;
  width: 90%;
  position: relative;
  z-index: 10;
}

/* 结果卡片组 */
.result-card-group {
  margin-bottom: 24px;
}

.result-grid-item {
  position: relative;
}

.result-media-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
  border: 1px solid #e5e7eb;
  transition: all 0.25s;
  /* 固定16:9横屏比例 */
  aspect-ratio: 16 / 9;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-thumb-video {
  background: #111827;
}

.card-thumb-file {
  color: #6b7280;
}

.result-media-wrap:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #c4b5fd;
}

.result-img,
.result-video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain; /* 保持纵横比，竖屏内容两侧自动出现黑边 */
  background: #000;
}

.result-video {
  background: #000;
}

.video-loading-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 12px;
}

.spinner-small {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.result-hover-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s;
}

.result-media-wrap:hover .result-hover-actions {
  opacity: 1;
  transform: translateY(0);
}

.card-placeholder-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  background: #f9fafb;
  border-radius: 0 0 10px 10px;
  border: 1px solid #e5e7eb;
  border-top: none;
  color: #9ca3af;
  font-size: 14px;
}

.card-failed {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.card-failed .retry-btn {
  padding: 4px 14px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.card-failed .retry-btn:hover {
  background: #b91c1c;
}

.result-actions-row {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f3f4f6;
}

.result-action-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 20px;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
}

.result-action-chip:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #1f2937;
}

.result-feedback-group {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  background: #f3f4f6;
  border-radius: 20px;
  padding: 2px;
}

.result-feedback-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s;
}

.result-feedback-btn:hover {
  background: #e5e7eb;
  color: #4b5563;
}

.result-feedback-btn.active {
  color: #3b82f6;
  background: #dbeafe;
}

.results-empty {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.results-empty p {
  margin-top: 12px;
  font-size: 14px;
}

.generating-indicator-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 80px 20px;
  color: #6b7280;
}

.spinner-large {
  width: 44px;
  height: 44px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ====== 响应式适配 ====== */
@media (max-width: 1024px) {
  .jimeng-left-sidebar {
    width: 220px;
    min-width: 220px;
  }
  
  .result-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .jimeng-left-sidebar {
    display: none;
  }
  
  .welcome-title {
    font-size: 22px;
  }
  
  .input-card {
    border-radius: 12px;
  }
  
  .footer-options {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 4px;
  }
  
  .result-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    max-width: 100%;
    gap: 14px;
  }
}

/* 云资料库弹窗 */
.cloud-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.cloud-modal-content {
  background: #fff;
  border-radius: 16px;
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.cloud-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.cloud-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.cloud-modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 18px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.cloud-modal-close:hover {
  background: #e5e7eb;
  color: #111827;
}

.cloud-modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.cloud-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #9ca3af;
}

.cloud-empty p {
  margin: 0;
  font-size: 14px;
}

.cloud-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #9ca3af;
}

.cloud-loading p {
  margin: 0;
  font-size: 14px;
}

.cloud-assets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* 自动续拉加载提示（5 条/批，直到加载完全部） */
.cloud-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0 4px;
  color: #6b7280;
  font-size: 13px;
}

.cloud-load-more-end {
  color: #9ca3af;
  font-size: 12px;
}

.cloud-asset-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.cloud-asset-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.cloud-asset-thumb {
  width: 100%;
  aspect-ratio: 4/3;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cloud-asset-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cloud-asset-video-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cloud-asset-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cloud-asset-play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.cloud-asset-play-overlay svg {
  width: 22px;
  height: 22px;
  margin-left: 2px;
}

.cloud-asset-video-failed .cloud-asset-play-overlay {
  display: none;
}

.cloud-asset-placeholder {
  color: #9ca3af;
}

.cloud-asset-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cloud-asset-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cloud-asset-size {
  font-size: 11px;
  color: #9ca3af;
}

/* 媒体预览模态框 */
.preview-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.preview-modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.preview-modal-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.preview-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.preview-modal-close svg {
  display: block;
  width: 24px !important;
  height: 24px !important;
}

.preview-modal-body {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: calc(90vh - 60px);
}

.preview-image {
  max-width: 100%;
  max-height: calc(90vh - 60px);
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.preview-video {
  max-width: 100%;
  max-height: calc(90vh - 60px);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.preview-audio-panel {
  width: min(520px, calc(100vw - 40px));
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.preview-audio-icon {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2563eb;
  background: #eff6ff;
}

.preview-audio {
  width: 100%;
}

.preview-modal-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.preview-file-name {
  font-size: 13px;
  color: white;
  font-weight: 500;
  max-width: 400px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-file-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
</style>
