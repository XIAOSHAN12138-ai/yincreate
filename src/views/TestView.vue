<template>
  <AppLayout>
    <div class="test-page">
      <div class="test-header">
        <h1 class="page-title">模型测试中心</h1>
        <p class="page-subtitle">一键批量测试所有AI模型的生成能力、速度和质量</p>
      </div>

      <div class="test-content">
        <!-- 左侧：控制面板 -->
        <div class="control-panel">
          <!-- 生成类型选择 -->
          <div class="panel-section">
            <h3>生成类型</h3>
            <div class="type-selector">
              <button
                v-for="type in generateTypes"
                :key="type.id"
                :class="['type-btn', { active: selectedType === type.id }]"
                @click="switchType(type.id)"
              >
                <i :data-lucide="type.icon"></i>
                {{ type.label }}
              </button>
            </div>
          </div>

          <!-- 批量测试控制 -->
          <div class="panel-section batch-control">
            <h3>🚀 一键批量测试</h3>

            <!-- 画面比例选择 -->
            <div class="param-group">
              <label>📐 画面比例</label>
              <div class="ratio-selector">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio"
                  :class="['ratio-btn', { active: selectedRatio === ratio }]"
                  @click="selectedRatio = ratio"
                  :disabled="isBatchTesting"
                >
                  {{ ratio }}
                </button>
              </div>
            </div>

            <!-- 分辨率多选 -->
            <div class="param-group">
              <label>选择分辨率（可多选）</label>
              <div class="resolution-grid">
                <label
                  v-for="res in resolutions"
                  :key="res"
                  :class="['resolution-checkbox', { selected: selectedResolutions.includes(res) }]"
                >
                  <input
                    type="checkbox"
                    :value="res"
                    v-model="selectedResolutions"
                    :disabled="isBatchTesting"
                  />
                  <span>{{ res }}</span>
                </label>
              </div>
            </div>

            <!-- 视频时长选择（仅视频生成时显示） -->
            <div class="param-group" v-if="selectedType === 'video'">
              <label>⏱️ 视频时长（秒）</label>
              <select
                v-model="selectedVideoDuration"
                class="param-select duration-select"
                :disabled="isBatchTesting"
              >
                <option
                  v-for="duration in videoDurations"
                  :key="duration"
                  :value="duration"
                >
                  {{ duration }}秒
                </option>
              </select>
            </div>

            <!-- 视频声音开关（仅视频生成时显示） -->
            <div class="param-group" v-if="selectedType === 'video'">
              <label>🔊 视频声音</label>
              <div class="sound-toggle-row">
                <button
                  type="button"
                  :class="['sound-toggle-btn', { active: videoSoundEnabled }]"
                  @click="videoSoundEnabled = !videoSoundEnabled"
                  :disabled="isBatchTesting"
                >
                  <i :data-lucide="videoSoundEnabled ? 'volume-2' : 'volume-x'"></i>
                  {{ videoSoundEnabled ? '生成声音' : '静音' }}
                </button>
                <span class="sound-hint">{{ videoSoundEnabled ? '将生成带音频的视频' : '仅生成画面，无音频' }}</span>
              </div>
            </div>

            <!-- 提示词 -->
            <div class="param-group">
              <label>统一提示词</label>
              <div class="prompt-editor-wrapper" ref="editorWrapperRef">
                <div
                  class="prompt-input"
                  contenteditable="true"
                  :placeholder="'输入测试提示词（所有模型使用相同提示词）... 输入 @ 可引用素材'"
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
                            :src="file.previewUrl || file.url"
                            class="mention-thumb"
                          />
                          <div v-else class="mention-thumb audio-thumb">
                            <i data-lucide="music" style="width: 16px; height: 16px;"></i>
                          </div>
                          <span :class="['mention-type-icon', file.type]">
                            {{ file.type === 'video' ? '▶' : '🖼' }}
                          </span>
                        </div>
                        <div class="mention-info">
                          <span class="mention-name">{{ file.name || (file.type === 'video' ? '视频' : '图片') }}</span>
                          <span class="mention-type-label">{{ getFileTypeLabel(file.type) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="atMentionCandidates.length === 0" class="at-mention-empty">
                      暂无可引用素材，请先上传图片或视频
                    </div>
                  </div>
                </Teleport>
              </div>

              <!-- 媒体素材栏：上传素材 + 引用素材 -->
              <div v-if="uploadedFiles.length > 0 || referencedFiles.length > 0" class="media-bar">
                <!-- 上传素材 -->
                <div v-if="uploadedFiles.length > 0" class="media-section">
                  <div class="section-label">
                    <i data-lucide="upload" style="width: 13px; height: 13px;"></i>
                    上传素材
                    <span class="section-count">{{ uploadedFiles.length }}</span>
                  </div>
                  <div class="media-items-row">
                    <div
                      v-for="(file, index) in uploadedFiles"
                      :key="'up-' + index"
                      class="media-item draggable-item"
                      :class="[`type-${file.type}`]"
                      @click.stop="clickToReference(file)"
                    >
                      <img
                        v-if="file.type === 'image'"
                        :src="file.previewUrl || file.url"
                        :alt="file.name"
                        class="preview-thumb"
                      />
                      <div v-else class="audio-preview">
                        <i data-lucide="music" style="width: 18px; height: 18px;"></i>
                        <span>{{ file.name }}</span>
                      </div>
                      <button class="remove-file-btn" @click="removeUploadedFile(index)" title="删除">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                      </button>
                      <div class="file-type-badge">{{ getFileTypeLabel(file.type) }}</div>
                      <div class="drag-hint-overlay">
                        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                        点击引用
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 分隔 -->
                <div
                  v-if="uploadedFiles.length > 0 && referencedFiles.length > 0"
                  class="media-bar-divider"
                ></div>

                <!-- 引用素材 -->
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
                        :src="refFile.previewUrl || refFile.url"
                        :alt="refFile.name"
                        class="preview-thumb"
                      />
                      <div v-else class="audio-preview">
                        <i data-lucide="music" style="width: 18px; height: 18px;"></i>
                        <span>{{ refFile.name }}</span>
                      </div>
                      <div class="ref-at-badge">@{{ refFile.atLabel }}</div>
                      <button class="remove-ref-btn" @click.stop="removeReferencedFile(refFile.atId)" title="取消引用">
                        <i data-lucide="x" style="width: 11px; height: 11px;"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="input-footer">
                <div class="footer-left">
                  <span class="char-count">{{ promptText.length }} / 2000</span>
                </div>
              </div>
            </div>

            <!-- 图片上传 -->
            <div class="param-group image-upload-section">
              <label>📷 上传测试图片（可选）</label>
              <p class="upload-hint">用于测试参考图、局部重绘、AI换脸等需要图片输入的功能</p>

              <div v-if="uploadedTestImages.length === 0" class="upload-area" @click="triggerImageUpload">
                <i data-lucide="upload-cloud"></i>
                <span>点击或拖拽上传图片</span>
                <small>支持 JPG、PNG、WebP 格式</small>
              </div>

              <div v-else class="uploaded-images-list">
                <div
                  v-for="(image, index) in uploadedTestImages"
                  :key="index"
                  class="uploaded-image-item"
                >
                  <img :src="image.previewUrl" alt="测试图片" />
                  <div class="image-info">
                    <span class="image-name">{{ image.name }}</span>
                    <span class="image-size">{{ image.sizeText }}</span>
                  </div>
                  <button
                    class="remove-image-btn"
                    @click="removeTestImage(index)"
                    title="移除图片"
                  >
                    <i data-lucide="x"></i>
                  </button>
                </div>

                <button
                  v-if="uploadedTestImages.length < 5"
                  class="add-more-btn"
                  @click="triggerImageUpload"
                >
                  <i data-lucide="plus"></i>
                  继续添加
                </button>
              </div>

              <div class="cloud-upload-btn-wrapper">
                <button class="cloud-upload-btn" @click="openCloudLibrary" :disabled="isBatchTesting">
                  <i data-lucide="cloud"></i>
                  从云资料库选择
                </button>
              </div>

              <input
                ref="testImageInputRef"
                type="file"
                accept="image/*"
                multiple
                style="display: none;"
                @change="handleTestImagesUpload"
              />
            </div>

            <!-- 测试模式 -->
            <div class="param-group">
              <label>测试模式</label>
              <select v-model="testMode" class="param-select" :disabled="isBatchTesting">
                <option value="all">全部模型 × 全部分辨率</option>
                <option value="models">全部模型 × 单一分辨率</option>
                <option value="resolutions">单一模型 × 全部分辨率</option>
              </select>
            </div>

            <!-- 进度显示 -->
            <div v-if="isBatchTesting || testResults.length > 0" class="progress-section">
              <div class="progress-header">
                <span class="progress-label">{{ progressText }}</span>
                <span class="progress-percent">{{ progressPercent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <div v-if="currentTestingModel" class="current-testing">
                <i data-lucide="loader-2" class="spin-icon"></i>
                <template v-if="isStopping">
                  正在接收数据: <strong>{{ currentTestingModel.display_name || currentTestingModel.name }}</strong>
                  ({{ currentResolution }}) - 等待完成后停止
                </template>
                <template v-else-if="isPaused">
                  暂停于: <strong>{{ currentTestingModel.display_name || currentTestingModel.name }}</strong>
                  ({{ currentResolution }}) - 当前任务完成后暂停
                </template>
                <template v-else>
                  正在测试: <strong>{{ currentTestingModel.display_name || currentTestingModel.name }}</strong>
                  ({{ currentResolution }})
                </template>
              </div>
            </div>

            <!-- 保存目录设置 -->
            <div class="save-directory-section">
              <label>📁 文件保存位置</label>
              <div class="directory-selector">
                <button
                  class="select-directory-btn"
                  @click="selectTestDirectory"
                  :disabled="isBatchTesting"
                >
                  <i data-lucide="folder-open"></i>
                  {{ testDirectoryHandle ? '更改目录' : '选择test文件夹' }}
                </button>
                <span v-if="testDirectoryHandle" class="directory-path">
                  <i data-lucide="check-circle"></i>
                  {{ testDirectoryHandle.name }}
                </span>
                <span v-else class="directory-hint">
                  <i data-lucide="info"></i>
                  未选择，文件将下载到浏览器默认目录
                </span>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="batch-buttons">
              <button
                v-if="!isBatchTesting"
                class="batch-btn start"
                @click="startBatchTest"
                :disabled="canStartBatch"
              >
                <i data-lucide="play-circle"></i>
                开始一键测试
              </button>
              <template v-else>
                <button class="batch-btn pause" @click="pauseBatchTest" :disabled="isStopping">
                  <i data-lucide="pause-circle"></i>
                  {{ isPaused ? '继续' : '暂停' }}
                </button>
                <button class="batch-btn stop" @click="stopBatchTest" :disabled="isStopping">
                  <i data-lucide="stop-circle"></i>
                  {{ isStopping ? '停止中...' : '停止' }}
                </button>
              </template>
            </div>

            <!-- 统计信息 -->
            <div v-if="testResults.length > 0" class="stats-summary">
              <div class="stat-item success">
                <i data-lucide="check-circle"></i>
                <span><strong>{{ successCount }}</strong> 成功</span>
              </div>
              <div class="stat-item failed">
                <i data-lucide="x-circle"></i>
                <span><strong>{{ failedCount }}</strong> 失败</span>
              </div>
              <div class="stat-item total-time">
                <i data-lucide="clock"></i>
                <span><strong>{{ totalDuration }}</strong> 总耗时</span>
              </div>
            </div>
          </div>

          <!-- 特色功能筛选 -->
          <div class="panel-section feature-filter-section">
            <div class="feature-filter-header">
              <h3>🎯 按特色功能筛选模型</h3>
              <button
                v-if="selectedFeature"
                class="clear-feature-btn"
                @click="clearFeatureFilter"
              >
                <i data-lucide="x"></i>
                清除筛选
              </button>
            </div>

            <p class="feature-hint">选择一个特色功能，查看哪些模型支持该功能</p>

            <div class="feature-selector-grid">
              <button
                v-for="feature in currentTypeFeatures"
                :key="feature.id"
                :class="['feature-select-btn', { active: selectedFeature === feature.id }]"
                @click="selectFeature(feature.id)"
                :disabled="isBatchTesting"
              >
                <span class="feature-icon">✨</span>
                <span class="feature-label">{{ feature.label }}</span>
              </button>
            </div>

            <div v-if="selectedFeature" class="feature-result-info">
              <div class="result-stats">
                <span class="stat-badge success">
                  <i data-lucide="check-circle"></i>
                  {{ modelsSupportingFeature.length }} 个模型支持
                </span>
                <span v-if="modelsNotSupportingFeature.length > 0" class="stat-badge warning">
                  <i data-lucide="x-circle"></i>
                  {{ modelsNotSupportingFeature.length }} 个不支持
                </span>
              </div>
            </div>
          </div>

          <!-- 模型多选列表 -->
          <div class="panel-section">
            <div class="model-list-header">
              <h3>选择测试模型 ({{ selectedModels.length }}/{{ filteredModels.length }})</h3>
              <div class="model-select-actions">
                <button
                  class="select-action-btn"
                  @click="selectAllModels"
                  :disabled="isBatchTesting"
                >
                  全选
                </button>
                <button
                  class="select-action-btn"
                  @click="clearModelSelection"
                  :disabled="isBatchTesting"
                >
                  清空
                </button>
              </div>
            </div>

            <div class="model-search-box">
              <i data-lucide="search"></i>
              <input
                type="text"
                v-model="modelSearchKeyword"
                placeholder="搜索模型..."
                :disabled="isBatchTesting"
              />
            </div>

            <div class="model-list-mini">
              <label
                v-for="(model, index) in filteredModelsBySearch"
                :key="model.id"
                :class="['model-item-mini', {
                  completed: isModelCompleted(model.id),
                  testing: currentTestingModel?.id === model.id,
                  failed: hasModelFailed(model.id),
                  selected: isModelSelected(model.id),
                  supports: selectedFeature && doesModelSupportFeature(model, selectedFeature),
                  'not-supports': selectedFeature && !doesModelSupportFeature(model, selectedFeature)
                }]"
                @mouseenter="onModelHover(model, true)"
                @mouseleave="onModelHover(model, false)"
              >
                <input
                  type="checkbox"
                  :value="model.id"
                  v-model="selectedModels"
                  :disabled="isBatchTesting"
                  class="model-checkbox"
                />
                <span class="model-index">{{ index + 1 }}</span>
                <div class="model-info-wrapper">
                  <span class="model-name-mini">{{ model.display_name || model.name }}</span>
                  <div class="model-tags-row">
                    <span v-if="model.is_default" class="model-tag-badge default">推荐</span>
                    <span v-if="model.vendor_name" class="model-tag-badge vendor">{{ model.vendor_name }}</span>
                    <span v-if="model.is_new" class="model-tag-badge new">新</span>
                    <span v-if="model.is_vip" class="model-tag-badge vip">VIP</span>
                    <span v-if="model.free_trial" class="model-tag-badge trial">限免</span>
                  </div>
                </div>
                <span class="vendor-tag-small">{{ model.vendor_name }}</span>
                <span
                  v-if="selectedFeature"
                  :class="['feature-support-badge', doesModelSupportFeature(model, selectedFeature) ? 'yes' : 'no']"
                >
                  <i :data-lucide="doesModelSupportFeature(model, selectedFeature) ? 'check' : 'x'"></i>
                </span>
                <i v-if="isModelCompleted(model.id)" data-lucide="check" class="status-icon success"></i>
                <i v-if="hasModelFailed(model.id)" data-lucide="alert-circle" class="status-icon failed"></i>
                <i v-if="currentTestingModel?.id === model.id" data-lucide="loader-2" class="status-icon testing spin-icon"></i>
              </label>
            </div>

            <p class="model-hint">提示：鼠标悬停可查看模型支持的特色功能</p>
          </div>
        </div>

        <!-- 右侧：结果展示区 -->
        <div class="result-panel">
          <!-- 模型详情与特色功能 -->
          <div class="info-card model-detail-card">
            <h3>🔧 模型详情与特色功能</h3>
            <div class="model-detail-content" v-if="currentTestingModel || hoveredModel || selectedModels.length > 0">
              <div class="detail-header">
                <span class="detail-model-name">{{ (currentTestingModel || hoveredModel || getFirstSelectedModel())?.name }}</span>
                <span class="vendor-badge">{{ (currentTestingModel || hoveredModel || getFirstSelectedModel())?.vendor_name }}</span>
              </div>

              <div class="detail-section">
                <h4><i data-lucide="sparkles"></i> 支持的特色功能</h4>
                <div class="features-grid">
                  <span
                    v-for="feature in getModelFeatures(currentTestingModel || hoveredModel || getFirstSelectedModel())"
                    :key="feature.id"
                    class="feature-tag"
                  >
                    {{ feature.label }}
                  </span>
                </div>
              </div>

              <div class="detail-info-row">
                <span><i data-lucide="hash"></i> ID: {{ (currentTestingModel || hoveredModel || getFirstSelectedModel())?.id }}</span>
              </div>
              <div class="detail-info-row" v-if="(currentTestingModel || hoveredModel || getFirstSelectedModel())?.description">
                <span><i data-lucide="file-text"></i> {{ (currentTestingModel || hoveredModel || getFirstSelectedModel())?.description }}</span>
              </div>
              <div class="detail-tags">
                <span v-if="(currentTestingModel || hoveredModel || getFirstSelectedModel())?.is_new" class="tag new">新</span>
                <span v-if="(currentTestingModel || hoveredModel || getFirstSelectedModel())?.is_vip" class="tag vip">VIP</span>
                <span v-if="(currentTestingModel || hoveredModel || getFirstSelectedModel())?.free_trial" class="tag trial">限免</span>
              </div>
            </div>
            <div class="empty-detail" v-else>
              <i data-lucide="mouse-pointer-click"></i>
              <p>请选择或悬停模型以查看详情和特色功能</p>
            </div>
          </div>

          <!-- 实时测试结果 -->
          <div class="info-card test-results">
            <h3>📊 实时测试结果 ({{ testResults.length }}条)</h3>

            <div v-if="testResults.length === 0" class="empty-state">
              <i data-lucide="flask-conical"></i>
              <p>点击左侧「开始一键测试」开始批量测试</p>
              <p class="hint">将自动遍历所有选定的模型和分辨率组合</p>
            </div>

            <div v-else class="results-list">
              <div
                v-for="(result, index) in testResults"
                :key="index"
                :class="['result-item', result.status, { expanded: expandedResults.includes(index) }]"
              >
                <div class="result-header" @click.stop="toggleResultExpand(index)">
                  <div class="result-title">
                    <span class="expand-icon">
                      <i :data-lucide="expandedResults.includes(index) ? 'chevron-down' : 'chevron-right'"></i>
                    </span>
                    <span class="result-number">#{{ index + 1 }}</span>
                    <span class="result-model">{{ result.modelName }}</span>
                    <span class="resolution-badge">{{ result.resolution }}</span>
                    <span v-if="result.videoDuration" class="duration-badge">⏱️ {{ result.videoDuration }}s</span>
                    <span v-if="result.actualVideoDuration" class="actual-duration-badge">📹 {{ result.actualVideoDuration }}s</span>
                  </div>
                  <span :class="['status', result.status]">
                    <i data-lucide="loader-2" v-if="result.status === 'testing'" class="spin-icon"></i>
                    <i v-else :data-lucide="result.status === 'success' ? 'check-circle' : 'x-circle'"></i>
                    {{ result.status === 'testing' ? '测试中...' : (result.status === 'success' ? '成功' : '失败') }}
                  </span>
                </div>

                <div v-show="expandedResults.includes(index)" class="result-body">
                  <div class="result-meta">
                    <div class="meta-item">
                      <i data-lucide="building-2"></i>
                      <span>{{ result.vendor }}</span>
                    </div>
                    <div class="meta-item timing-info">
                      <i data-lucide="timer"></i>
                      <div class="timing-details">
                        <strong class="client-time">{{ result.duration }}</strong>
                        <span v-if="result.serverDuration" class="server-time" :title="'后端计时: ' + result.serverDuration">
                          (后端: {{ result.serverDuration }})
                        </span>
                      </div>
                    </div>
                    <div class="meta-item" v-if="result.status === 'success'">
                      <i data-lucide="hard-drive"></i>
                      <span>{{ result.fileSize }}</span>
                    </div>
                    <div class="meta-item">
                      <i data-lucide="calendar"></i>
                      <span>{{ result.timestamp }}</span>
                    </div>
                    <div class="meta-item" v-if="result.taskId">
                      <i data-lucide="link"></i>
                      <code>{{ result.taskId.slice(0, 12) }}...</code>
                    </div>
                    <div class="meta-item" v-if="result.businessModelId" :title="result.businessModelId">
                      <i data-lucide="route"></i>
                      <code>{{ result.businessModelId }}</code>
                    </div>
                    <div class="meta-item" v-if="result.upstreamRoutes?.length" :title="result.upstreamRoutes.map(route => `P${route.priority_order} ${route.upstream_id}`).join('\n')">
                      <i data-lucide="git-branch"></i>
                      <span>上游路由 {{ result.upstreamRoutes.length }} 条</span>
                    </div>
                  </div>

                  <div v-if="result.error" class="error-message">
                    <i data-lucide="alert-triangle"></i>
                    {{ result.error }}
                  </div>

                  <div v-if="result.previewUrl" class="result-preview">
                    <img v-if="result.type === 'image'" :src="result.previewUrl" alt="生成结果" @error="(e) => { e.target.style.display = 'none'; console.error('图片加载失败:', result.modelName) }" />
                    <div v-else-if="result.type === 'video'" class="video-wrapper">
                      <video
                        :ref="(el) => { if (el) videoRefs[index] = el }"
                        :src="result.displayUrl || result.previewUrl"
                        controls
                        preload="metadata"
                        :muted="!videoSoundStates[index]"
                        @error="(e) => { console.error('视频加载失败:', result.modelName, e.target.error); e.target.parentElement.innerHTML = '<div style=\'padding:20px;color:#ef4444;text-align:center;\'><i data-lucide=\'alert-triangle\'></i><br>视频加载失败</div>' }"
                        @loadeddata="console.log('✅ 视频加载成功:', result.modelName)"
                        @click.stop
                      >
                        您的浏览器不支持视频播放
                      </video>
                      <button
                        class="sound-toggle-btn"
                        :class="{ muted: !videoSoundStates[index] }"
                        @click.stop="toggleVideoSound(index)"
                        title="切换声音"
                      >
                        <i :data-lucide="videoSoundStates[index] ? 'volume-2' : 'volume-x'" style="width: 16px; height: 16px;"></i>
                      </button>

                      <a
                        v-if="result.downloadUrl"
                        :href="result.downloadUrl"
                        download
                        class="video-download-btn"
                        title="下载视频"
                        @click.stop
                      >
                        <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                        <span>下载</span>
                      </a>
                    </div>
                  </div>

                  <div v-if="result.filePath" class="file-info">
                    <i data-lucide="folder"></i>
                    <code>{{ result.filePath }}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <button class="action-btn export" @click="exportReport" :disabled="testResults.length === 0">
              <i data-lucide="download"></i>
              导出完整报告
            </button>
            <button class="action-btn clear" @click="clearResults" :disabled="testResults.length === 0 || isBatchTesting">
              <i data-lucide="trash-2"></i>
              清空数据
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 云资料库选择弹窗 -->
    <Teleport to="body">
      <div v-if="showCloudLibrary" class="cloud-library-modal-overlay" @click.self="closeCloudLibrary">
        <div class="cloud-library-modal">
          <!-- 弹窗头部 -->
          <div class="cloud-modal-header">
            <h3 class="cloud-modal-title">
              <i data-lucide="cloud" style="width: 20px; height: 20px;"></i>
              云资料库
            </h3>
            <button class="cloud-modal-close" @click="closeCloudLibrary">
              <i data-lucide="x" style="width: 18px; height: 18px;"></i>
            </button>
          </div>

          <!-- 搜索栏 -->
          <div class="cloud-search-bar">
            <i data-lucide="search" style="width: 16px; height: 16px; color: #9ca3af;"></i>
            <input
              type="text"
              v-model="cloudSearchKeyword"
              placeholder="搜索云资料库中的文件..."
              class="cloud-search-input"
            />
          </div>

          <!-- 文件类型筛选 -->
          <div class="cloud-filter-tabs">
            <button
              v-for="tab in cloudFilterTabs"
              :key="tab.id"
              :class="['cloud-tab', { active: cloudActiveTab === tab.id }]"
              @click="cloudActiveTab = tab.id"
            >
              <i :data-lucide="tab.icon" style="width: 14px; height: 14px;"></i>
              {{ tab.label }}
            </button>
          </div>

          <!-- 文件列表 -->
          <div class="cloud-files-container">
            <div v-if="filteredCloudFiles.length === 0" class="cloud-empty-state">
              <i data-lucide="folder-open" style="width: 48px; height: 48px; color: #d1d5db;"></i>
              <p>暂无文件</p>
              <span class="cloud-empty-hint">请先在资产管理页面上传文件到云资料库</span>
            </div>
            <div v-else class="cloud-files-grid">
              <div
                v-for="(file, idx) in filteredCloudFiles"
                :key="'cloud-' + idx"
                :class="['cloud-file-item', `type-${file.type}`, { selected: isCloudFileSelected(file) }]"
                @click="toggleCloudFileSelection(file)"
              >
                <div class="cloud-file-thumb">
                  <img
                    v-if="file.type === 'image' && file.thumbnail"
                    :src="file.thumbnail"
                    :alt="file.name"
                  />
                  <video
                    v-else-if="file.type === 'video' && file.thumbnail"
                    :src="file.url || file.thumbnail"
                    muted
                    class="cloud-video-thumb"
                  />
                  <div v-else class="cloud-file-placeholder" :class="'placeholder-' + file.type">
                    <i
                      :data-lucide="file.type === 'audio' ? 'music' : (file.type === 'video' ? 'video' : 'file')"
                      style="width: 32px; height: 32px;"
                    ></i>
                  </div>
                  <div v-if="isCloudFileSelected(file)" class="cloud-selected-check">
                    <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                  </div>
                </div>
                <div class="cloud-file-info">
                  <p class="cloud-file-name">{{ file.name }}</p>
                  <span class="cloud-file-meta">{{ getFileTypeLabel(file.type) }} · {{ formatCloudFileSize(file.size) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="cloud-modal-footer">
            <div class="cloud-selection-info">
              已选择 {{ selectedCloudFiles.length }} 个文件
            </div>
            <div class="cloud-actions">
              <button class="cloud-btn-secondary" @click="closeCloudLibrary">取消</button>
              <button
                class="cloud-btn-primary"
                :disabled="selectedCloudFiles.length === 0"
                @click="confirmCloudSelection"
              >
                确认选择
                <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 全局 Toast 提示 -->
    <Teleport to="body">
      <Transition name="toast-fade">
        <div v-if="toastVisible" :class="['global-toast', 'toast-' + toastType]">
          <i
            :data-lucide="toastType === 'success' ? 'check-circle' : toastType === 'error' ? 'alert-circle' : toastType === 'warning' ? 'alert-triangle' : 'info'"
            style="width: 18px; height: 18px; flex-shrink: 0;"
          ></i>
          <span>{{ toastMessage }}</span>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import AppLayout from '../components/layout/AppLayout.vue'
import request, { safeMessage } from '../utils/request'
import { resolveModelRoute, resolveUpstreamRoutes } from '../utils/modelRouting'

const VENDOR_B_API_KEY = 'ErtveAQybj1XCVRsncebuiIYzTxUV0tganVf4bMijr5SKVzU'

const isUnmounted = ref(false)

const generateTypes = [
  { id: 'image', label: '图片生成', icon: 'image' },
  { id: 'video', label: '视频生成', icon: 'video' }
]

const resolutions = ['480p', '720p', '1080p', '2k', '4k']
const videoDurations = Array.from({ length: 30 }, (_, i) => i + 1)
const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '5:4', '4:5', '21:9']
const selectedRatio = ref('16:9')

const featureMap = {
  'image': [
    { id: 'text2img', label: '文生图', icon: 'type' },
    { id: 'reference', label: '参考图', icon: 'image-plus' },
    { id: 'style-transfer', label: '风格转换', icon: 'palette' },
    { id: 'inpaint', label: '局部重绘', icon: 'brush' },
    { id: 'outpaint', label: '扩图', icon: 'expand' },
    { id: 'erase', label: '消除笔', icon: 'eraser' },
    { id: 'face-swap', label: 'AI换脸', icon: 'user-check' },
    { id: 'outfit-change', label: 'AI换装', icon: 'shirt' }
  ],
  'video': [
    { id: 'all-reference', label: '全能参考', icon: 'layers' },
    { id: 'video-expand', label: '视频扩写', icon: 'maximize-2' },
    { id: 'first-last-frame', label: '首尾帧', icon: 'flip-horizontal' },
    { id: 'smart-multi-frame', label: '智能多帧', icon: 'grid-3x3' },
    { id: 'first-frame-gen', label: '首帧生成', icon: 'image' },
    { id: 'motion-imitate', label: '动作模仿', icon: 'move' },
    { id: 'lip-sync', label: '对口型', icon: 'mic' },
    { id: 'ai-outfit', label: 'AI换装', icon: 'shirt' },
    { id: 'scene-replace', label: '场景替换', icon: 'map' },
    { id: 'local-adjust', label: '局部调整', icon: 'crop' },
    { id: 'style-replace', label: '风格替换', icon: 'wand-2' },
    { id: 'effect-copy', label: '特效复刻', icon: 'sparkles' },
    { id: 'item-fix', label: '物品修复', icon: 'wrench' },
    { id: 'color-restore', label: '色彩还原', icon: 'droplet' },
    { id: 'smart-remove', label: '智能消除', icon: 'trash-2' }
  ]
}

const selectedType = ref('image')
const selectedResolutions = ref(['1080p'])
const selectedVideoDuration = ref(5)
const videoSoundEnabled = ref(false)
const testPrompt = ref('一只可爱的猫咪在花园里玩耍，阳光明媚，高质量，细节丰富')
const promptText = ref('一只可爱的猫咪在花园里玩耍，阳光明媚，高质量，细节丰富')
const uploadedFiles = ref([])
const referencedFiles = ref([])
const atTags = ref([])
const activeAtTagId = ref(null)
const promptEditorRef = ref(null)
const editorWrapperRef = ref(null)
let atImageCounter = 0
let atVideoCounter = 0

const showAtMentionDropdown = ref(false)
const atMentionCandidates = computed(() => {
  const alreadyReferencedIds = new Set(referencedFiles.value.map(r => r.sourceId))
  return uploadedFiles.value.filter(f => !alreadyReferencedIds.has(f.object_id))
})
const activeMentionIndex = ref(0)
const mentionDropdownStyle = ref({})
let mentionAnchorRange = null

const showCloudLibrary = ref(false)
const cloudSearchKeyword = ref('')
const cloudActiveTab = ref('all')
const selectedCloudFiles = ref([])

const cloudFilterTabs = [
  { id: 'all', label: '全部', icon: 'layout-grid' },
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'video', label: '视频', icon: 'video' },
  { id: 'audio', label: '音频', icon: 'music' }
]

const cloudLibraryFiles = ref([
  {
    id: 'cloud_1',
    name: '风景照片1.jpg',
    type: 'image',
    thumbnail: 'https://picsum.photos/200/150?random=1',
    url: '',
    size: 2048576,
    uploadTime: '2024-01-15'
  },
  {
    id: 'cloud_2',
    name: '人物肖像.png',
    type: 'image',
    thumbnail: 'https://picsum.photos/200/150?random=2',
    url: '',
    size: 1536000,
    uploadTime: '2024-01-14'
  },
  {
    id: 'cloud_3',
    name: '产品展示.mp4',
    type: 'video',
    thumbnail: 'https://picsum.photos/200/150?random=3',
    url: '',
    size: 52428800,
    uploadTime: '2024-01-13'
  },
  {
    id: 'cloud_4',
    name: '背景音乐.mp3',
    type: 'audio',
    thumbnail: null,
    url: '',
    size: 5242880,
    uploadTime: '2024-01-12'
  }
])

const filteredCloudFiles = computed(() => {
  let files = cloudLibraryFiles.value

  if (cloudActiveTab.value !== 'all') {
    files = files.filter(f => f.type === cloudActiveTab.value)
  }

  if (cloudSearchKeyword.value.trim()) {
    const keyword = cloudSearchKeyword.value.toLowerCase()
    files = files.filter(f =>
      f.name.toLowerCase().includes(keyword)
    )
  }

  return files
})

function openCloudLibrary() {
  showCloudLibrary.value = true
  selectedCloudFiles.value = []
  cloudSearchKeyword.value = ''
  cloudActiveTab.value = 'all'
  document.body.style.overflow = 'hidden'

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

function closeCloudLibrary() {
  showCloudLibrary.value = false
  selectedCloudFiles.value = []
  document.body.style.overflow = ''
}

function isCloudFileSelected(file) {
  return selectedCloudFiles.value.some(f => f.id === file.id)
}

function toggleCloudFileSelection(file) {
  const index = selectedCloudFiles.value.findIndex(f => f.id === file.id)

  if (index > -1) {
    selectedCloudFiles.value.splice(index, 1)
  } else {
    selectedCloudFiles.value.push(file)
  }
}

function formatCloudFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function confirmCloudSelection() {
  if (selectedCloudFiles.value.length === 0) return

  for (const file of selectedCloudFiles.value) {
    const objectId = `${file.type}_${uploadedFiles.value.length + 1}`

    let fileUrl = file.url

    if (!fileUrl && file.thumbnail && file.type === 'image') {
      try {
        const response = await fetch(file.thumbnail)
        const blob = await response.blob()
        fileUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result)
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        console.warn('无法加载云文件:', file.name, error)
        fileUrl = file.thumbnail
      }
    }

    uploadedFiles.value.push({
      type: file.type,
      url: fileUrl,
      purpose: 'reference',
      object_id: objectId,
      name: file.name,
      fromCloud: true,
      cloudId: file.id
    })

    console.log(`☁️ 已从云资料库选择: ${file.name} (${file.type}, ID: ${objectId})`)
  }

  const typeLabels = { image: '图片', video: '视频', audio: '音频' }
  showToast(`已从云资料库添加 ${selectedCloudFiles.value.length} 个文件`, 'success')

  closeCloudLibrary()

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })

  setTimeout(() => {
    console.log('📁 当前已上传文件（含云资料库）:', uploadedFiles.value.length, '个')
  }, 500)
}

const testMode = ref('all')
const videoRefs = ref({})
const videoSoundStates = ref({})

function toggleVideoSound(index) {
  const currentState = videoSoundStates.value[index] !== false
  videoSoundStates.value[index] = !currentState

  const videoEl = videoRefs.value[index]
  if (videoEl) {
    videoEl.muted = currentState
    console.log(`🔊 视频 #${index + 1} 声音: ${!currentState ? '开启' : '静音'}`)
  }

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

const isBatchTesting = ref(false)
const isPaused = ref(false)
const shouldStop = ref(false)
const isStopping = ref(false)
// 单次测试结果 ID 自增计数器，保证批量任务结果 ID 唯一
let runSingleTestIdCounter = 0

const currentTestingModel = ref(null)
const currentResolution = ref('')
const currentTaskIndex = ref(0)
const totalTasks = ref(0)
const hoveredModel = ref(null)
const selectedModels = ref([])
const modelSearchKeyword = ref('')
const selectedFeature = ref('')
const showOnlyImageRequired = ref(false)
const uploadedTestImages = ref([])
const testImageInputRef = ref(null)
const testDirectoryHandle = ref(null)
const isFileSystemAccessSupported = 'showDirectoryPicker' in window

const testResults = ref([])
const expandedResults = ref([])
const allModels = ref({
  image_models: [],
  video_models: []
})

const allFilteredModels = computed(() => {
  return selectedType.value === 'image'
    ? allModels.value.image_models
    : allModels.value.video_models
})

const filteredModelsBySearch = computed(() => {
  const keyword = modelSearchKeyword.value.trim().toLowerCase()
  if (!keyword) return allFilteredModels.value
  return allFilteredModels.value.filter(model =>
    model.name.toLowerCase().includes(keyword) ||
    (model.vendor_name && model.vendor_name.toLowerCase().includes(keyword))
  )
})

const filteredModels = computed(() => {
  if (selectedModels.value.length === 0) return []
  return allFilteredModels.value.filter(m => selectedModels.value.includes(m.id))
})

const currentTypeFeatures = computed(() => {
  return featureMap[selectedType.value] || []
})

const modelsSupportingFeature = computed(() => {
  if (!selectedFeature.value) return []
  return allFilteredModels.value.filter(m => doesModelSupportFeature(m, selectedFeature.value))
})

const modelsNotSupportingFeature = computed(() => {
  if (!selectedFeature.value) return []
  return allFilteredModels.value.filter(m => !doesModelSupportFeature(m, selectedFeature.value))
})

const canStartBatch = computed(() => {
  return isBatchTesting.value ||
    filteredModels.value.length === 0 ||
    selectedResolutions.value.length === 0 ||
    !testPrompt.value.trim()
})

const progressPercent = computed(() => {
  if (totalTasks.value === 0) return 0
  return Math.round((currentTaskIndex.value / totalTasks.value) * 100)
})

const progressText = computed(() => {
  if (!isBatchTesting.value && testResults.value.length === 0) return ''
  return `${currentTaskIndex.value} / ${totalTasks.value}`
})

const successCount = computed(() =>
  testResults.value.filter(r => r.status === 'success').length
)

const failedCount = computed(() =>
  testResults.value.filter(r => r.status === 'failed').length
)

const totalDuration = computed(() => {
  const totalMs = testResults.value.reduce((sum, r) => {
    const seconds = parseFloat(r.duration)
    return sum + (isNaN(seconds) ? 0 : seconds * 1000)
  }, 0)

  const totalSec = Math.round(totalMs / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec}s`
})

function getTypeLabel(type) {
  const map = { 'image': '图片生成', 'video': '视频生成' }
  return map[type] || type
}

function getModelFeatures(model) {
  if (!model) return []
  const type = selectedType.value
  const allFeatures = featureMap[type] || []
  // 若模型声明了 ui_features，则只返回该模型支持的功能
  if (model.ui_features && Array.isArray(model.ui_features) && model.ui_features.length > 0) {
    return allFeatures.filter(f => model.ui_features.includes(f.id))
  }
  return allFeatures
}

function onModelHover(model, isHovering) {
  hoveredModel.value = isHovering ? model : null
}

function isModelSelected(modelId) {
  return selectedModels.value.includes(modelId)
}

function selectAllModels() {
  selectedModels.value = allFilteredModels.value.map(m => m.id)
}

function clearModelSelection() {
  selectedModels.value = []
}

function getFileTypeLabel(type) {
  const labels = { image: '图片', video: '视频', audio: '音频' }
  return labels[type] || type
}

function onPromptInput(e) {
  const editor = e.target
  const text = editor.innerText || ''
  if (text.length <= 2000) {
    promptText.value = text
    testPrompt.value = text
  } else {
    editor.innerText = text.slice(0, 2000)
    promptText.value = text.slice(0, 2000)
    testPrompt.value = text.slice(0, 2000)
  }
  checkAtMention(e)
}

function onPromptKeydown(e) {
  if (showAtMentionDropdown.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeMentionIndex.value = Math.min(activeMentionIndex.value + 1, atMentionCandidates.value.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeMentionIndex.value = Math.max(activeMentionIndex.value - 1, 0)
    } else if (e.key === 'Escape') {
      closeMentionDropdown()
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const candidate = atMentionCandidates.value[activeMentionIndex.value]
      if (candidate) selectAtMention(candidate)
    }
    return
  }
  if (e.key === '@') {
    nextTick(() => checkAtMention(e))
  }
}

function checkAtMention(e) {
  const editor = promptEditorRef.value
  if (!editor) return

  const selection = window.getSelection()
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
    closeMentionDropdown()
    return
  }

  const range = selection.getRangeAt(0)
  const textBeforeCaret = getTextBeforeCursor(editor, range)

  const atMatch = textBeforeCaret.match(/@(\w*)$/)

  if (atMatch && atMentionCandidates.value.length > 0) {
    mentionAnchorRange = range.cloneRange()
    mentionAnchorRange.setStart(range.startContainer, range.startOffset - atMatch[0].length)

    const rect = range.getBoundingClientRect()
    const wrapperRect = editorWrapperRef.value?.getBoundingClientRect()

    showAtMentionDropdown.value = true
    activeMentionIndex.value = 0
    mentionDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${Math.max(rect.left, wrapperRect?.left || rect.left)}px`,
      minWidth: `${Math.min(320, wrapperRect?.width || 320)}px`,
      zIndex: 9999
    }

    nextTick(() => {
      if (window.lucide) lucide.createIcons()
    })
  } else {
    closeMentionDropdown()
  }
}

function getTextBeforeCursor(editor, range) {
  const container = range.startContainer
  const offset = range.startOffset

  if (container.nodeType === Node.TEXT_NODE) {
    let text = container.textContent.slice(0, offset)
    let node = container
    while ((node = node.previousSibling)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text = node.textContent + text
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        text = node.textContent + text
      }
    }
    let parent = container.parentNode
    while (parent && parent !== editor) {
      let prev = parent.previousSibling
      while (prev) {
        text = prev.textContent + text
        prev = prev.previousSibling
      }
      parent = parent.parentNode
    }
    return text
  }

  if (container === editor || editor.contains(container)) {
    let text = ''
    const children = Array.from(container.childNodes).slice(0, offset)
    for (const child of children) {
      text += child.textContent
    }
    let parent = container.parentNode
    while (parent && parent !== editor) {
      let prev = parent.previousSibling
      while (prev) {
        text = prev.textContent + text
        prev = prev.previousSibling
      }
      parent = parent.parentNode
    }
    return text
  }

  return ''
}

function closeMentionDropdown() {
  showAtMentionDropdown.value = false
  mentionAnchorRange = null
  activeMentionIndex.value = 0
}

function selectAtMention(file) {
  const editor = promptEditorRef.value
  if (!editor) { closeMentionDropdown(); return }

  if (mentionAnchorRange) {
    try {
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(mentionAnchorRange)
      mentionAnchorRange.deleteContents()
    } catch (_) {}
  }

  createReferenceFrom(file)
  closeMentionDropdown()

  nextTick(() => {
    editor.focus()
    if (window.lucide) lucide.createIcons()
  })
}

function createReferenceFrom(file) {
  const existingRef = referencedFiles.value.find(r => r.sourceId === file.object_id)
  if (existingRef) {
    showToast('该素材已被引用', 'info')
    return
  }

  const typeKey = file.type === 'video' ? '视频' : '图片'
  const counter = file.type === 'video' ? ++atVideoCounter : ++atImageCounter
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

  insertAtTagToPrompt(newAtTag)
  console.log(`📌 已引用素材: @${atLabel} (${file.type})`)
}

function clickToReference(file) {
  createReferenceFrom(file)
}

function insertAtTagToPrompt(tag) {
  const editor = promptEditorRef.value
  if (!editor) return

  const iconSvg = tag.type === 'video'
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'

  const innerHtml = `${iconSvg}<span class="at-tag-text">${tag.fullTag}</span><button class="at-tag-close" data-at-id="${tag.id}" title="移除引用"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`

  const selection = window.getSelection()

  if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.className = `at-tag-inline at-tag-${tag.type}`
    span.contentEditable = 'false'
    span.dataset.atId = tag.id
    span.innerHTML = innerHtml
    range.insertNode(span)
    range.setStartAfter(span)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } else {
    editor.innerHTML += `<span class="at-tag-inline at-tag-${tag.type}" contenteditable="false" data-at-id="${tag.id}">${innerHtml}</span>&nbsp;`
  }

  activeAtTagId.value = tag.id
  promptText.value = editor.innerText
  testPrompt.value = editor.innerText

  nextTick(() => bindInlineCloseButtons())
}

function bindInlineCloseButtons() {
  const editor = promptEditorRef.value
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

function focusAtTagById(atId) {
  const tag = atTags.value.find(t => t.id === atId)
  if (tag) focusAtTag(tag)
}

function focusAtTag(tag) {
  activeAtTagId.value = tag.id
  const editor = promptEditorRef.value
  if (!editor) return
  const el = editor.querySelector(`[data-at-id="${tag.id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.add('at-tag-highlight')
    setTimeout(() => el.classList.remove('at-tag-highlight'), 1500)
  }
}

function removeAtTag(atId) {
  const tagIdx = atTags.value.findIndex(t => t.id === atId)
  if (tagIdx !== -1) atTags.value.splice(tagIdx, 1)

  const refIdx = referencedFiles.value.findIndex(r => r.atId === atId)
  if (refIdx !== -1) referencedFiles.value.splice(refIdx, 1)

  const editor = promptEditorRef.value
  if (editor) {
    const el = editor.querySelector(`[data-at-id="${atId}"]`)
    if (el) el.remove()
    promptText.value = editor.innerText
    testPrompt.value = editor.innerText
  }

  if (activeAtTagId.value === atId) activeAtTagId.value = null

  recalcCounters()

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

function recalcCounters() {
  let maxVideo = 0
  let maxImage = 0
  for (const t of atTags.value) {
    if (t.type === 'video') {
      const n = parseInt(t.label.replace('视频', ''), 10) || 0
      if (n > maxVideo) maxVideo = n
    } else if (t.type === 'image') {
      const n = parseInt(t.label.replace('图片', ''), 10) || 0
      if (n > maxImage) maxImage = n
    }
  }
  atVideoCounter = maxVideo
  atImageCounter = maxImage
}

function removeReferencedFile(atId) {
  removeAtTag(atId)
}

function removeUploadedFile(index) {
  const removed = uploadedFiles.value.splice(index, 1)[0]

  if (removed && removed.object_id) {
    const relatedRefs = referencedFiles.value.filter(r => r.sourceId === removed.object_id)
    relatedRefs.forEach(ref => {
      removeAtTag(ref.atId)
    })
  }

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

function triggerImageUpload() {
  if (testImageInputRef.value) {
    testImageInputRef.value.click()
  }
}

async function handleTestImagesUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return

  const maxFiles = 5 - uploadedTestImages.value.length
  const filesToProcess = Array.from(files).slice(0, maxFiles)

  for (const file of filesToProcess) {
    if (!file.type.startsWith('image/')) {
      showToast(`文件 "${file.name}" 不是有效的图片格式`, 'warning')
      continue
    }

    try {
      const previewUrl = await convertFileToBase64(file)
      uploadedTestImages.value.push({
        name: file.name,
        size: file.size,
        sizeText: formatFileSize(file.size),
        type: file.type,
        base64Data: previewUrl,
        previewUrl: previewUrl
      })

      uploadedFiles.value.push({
        type: 'image',
        url: previewUrl,
        previewUrl: previewUrl,
        purpose: 'reference',
        object_id: `image_${uploadedFiles.value.length + 1}`,
        name: file.name
      })
    } catch (error) {
      console.error('处理图片失败:', error)
      showToast(`处理图片 "${file.name}" 失败`, 'error')
    }
  }

  event.target.value = ''

  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
}

function removeTestImage(index) {
  uploadedTestImages.value.splice(index, 1)
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function extractResultFromResponse(data) {
  if (typeof data === 'string') {
    throw new Error(data)
  }
  if (!data || data.code !== 200) {
    throw new Error(safeMessage(data?.message ?? data?.error ?? data?.detail ?? data, '生成失败'))
  }

  const resultData = data.data
  if (!resultData) {
    throw new Error('未获取到结果数据')
  }

  const taskInfo = {
    taskId: resultData.task_id,
    type: resultData.type,
    status: resultData.status,
    progress: resultData.progress
  }

  let results = []

  if (resultData.result) {
    if (resultData.result.images && Array.isArray(resultData.result.images)) {
      resultData.result.images.forEach(img => {
        results.push({
          type: 'image',
          url: img.url,
          id: img.id
        })
      })
    }

    if (resultData.result.video) {
      results.push({
        type: 'video',
        url: resultData.result.video.url,
        id: resultData.result.video.id,
        thumbnail: resultData.result.video.thumbnail
      })
    }

    if (resultData.result.video_url) {
      results.push({
        type: 'video',
        url: resultData.result.video_url,
        id: taskInfo.taskId
      })
    }
  }

  console.log(`📋 提取结果: ${results.length} 个文件 (${results.map(r => r.type).join(', ')})`)
  
  return { ...taskInfo, results }
}

async function fetchProtectedVideo(videoUrl) {
  try {
    const token = localStorage.getItem('token') || ''
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('❌ 获取受保护视频失败:', error)
    throw error
  }
}

async function selectTestDirectory() {
  try {
    if (!isFileSystemAccessSupported) {
      // File System Access API 仅在安全上下文（HTTPS 或 localhost）可用
      const isSecure = window.isSecureContext
      const reason = isSecure
        ? '当前浏览器不支持选择文件夹功能，请使用 Chrome/Edge 浏览器'
        : '选择文件夹功能需要 HTTPS 安全连接或 localhost 访问，当前为普通 HTTP 连接无法使用'
      showToast(reason + '，文件将通过浏览器默认方式下载', 'warning')
      console.warn('⚠️ showDirectoryPicker 不可用: isSecureContext =', isSecure)
      return
    }

    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads'
    })

    testDirectoryHandle.value = handle
    console.log('✅ 已选择保存目录:', handle.name)
    showToast(`✅ 已设置保存目录: ${handle.name}`, 'success')
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('❌ 选择目录失败:', error)
      showToast('选择目录失败: ' + error.message, 'error')
    }
  }
}

async function saveToFileWithFileSystemAccess(fileUrl, fileName, fileType) {
  try {
    if (!testDirectoryHandle.value || !isFileSystemAccessSupported) {
      console.log('📁 未指定保存目录，使用浏览器默认下载')
      await saveToFileFallback(fileUrl, fileName)
      return false
    }

    let blob

    if (fileUrl.startsWith('data:')) {
      const parts = fileUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
      const bstr = atob(parts[1])
      const u8arr = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
      blob = new Blob([u8arr], { type: mime })
    } else {
      console.log('🌐 正在下载文件:', fileUrl)
      try {
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        blob = await response.blob()
        console.log(`✅ 文件下载完成: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)
      } catch (fetchError) {
        console.error('❌ 文件下载失败:', fetchError)
        await saveToFileFallback(fileUrl, fileName)
        return false
      }
    }

    const fileHandle = await testDirectoryHandle.value.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()

    console.log(`💾 已保存到test文件夹: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`)
    return true
  } catch (error) {
    console.error('❌ 保存到test文件夹失败，尝试浏览器下载:', error)
    await saveToFileFallback(fileUrl, fileName)
    return false
  }
}

async function saveToFileFallback(fileUrl, fileName) {
  try {
    if (fileUrl.startsWith('data:')) {
      const parts = fileUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
      const bstr = atob(parts[1])
      const u8arr = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)

      const blob = new Blob([u8arr], { type: mime })

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } else {
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    console.log(`💾 已通过浏览器下载: ${fileName}`)
    return true
  } catch (error) {
    console.error('❌ 保存文件失败:', error)
    return false
  }
}

function getFirstSelectedModel() {
  if (selectedModels.value.length === 0) return null
  return allFilteredModels.value.find(m => m.id === selectedModels.value[0]) || null
}

function doesModelSupportFeature(model, featureId) {
  if (!model || !featureId) return false
  const type = selectedType.value
  const allFeatures = featureMap[type] || []
  // 先确认该 featureId 在当前类型的 featureMap 中存在
  if (!allFeatures.some(f => f.id === featureId)) return false
  // 若模型声明了 ui_features，按其过滤；否则视为全部支持
  if (model.ui_features && Array.isArray(model.ui_features) && model.ui_features.length > 0) {
    return model.ui_features.includes(featureId)
  }
  return true
}

function selectFeature(featureId) {
  selectedFeature.value = featureId === selectedFeature.value ? '' : featureId
}

function clearFeatureFilter() {
  selectedFeature.value = ''
}

function extractServerTiming(responseData) {
  if (!responseData || !responseData.data) return null

  const data = responseData.data

  if (data.elapsed_time_formatted) {
    return data.elapsed_time_formatted
  }

  if (data.elapsed_time !== undefined && data.elapsed_time !== null) {
    const value = parseFloat(data.elapsed_time)
    if (!isNaN(value)) {
      if (value > 60) {
        const minutes = Math.floor(value / 60)
        const seconds = Math.round(value % 60)
        return `${minutes}分${seconds}秒`
      }
      return value.toFixed(2) + 's'
    }
  }

  const timingFields = [
    'generation_time',
    'timing',
    'duration',
    'server_time',
    'processing_time',
    'total_time'
  ]

  for (const field of timingFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const value = parseFloat(data[field])
      if (!isNaN(value)) {
        if (value > 100) {
          return (value / 1000).toFixed(2) + 's'
        }
        return value.toFixed(2) + 's'
      }
    }
  }

  if (data.result) {
    const resultTimingFields = ['generation_time', 'timing', 'duration', 'elapsed', 'time']
    for (const field of resultTimingFields) {
      if (data.result[field] !== undefined && data.result[field] !== null) {
        const value = parseFloat(data.result[field])
        if (!isNaN(value)) {
          if (value > 100) {
            return (value / 1000).toFixed(2) + 's'
          }
          return value.toFixed(2) + 's'
        }
      }
    }
  }

  return null
}

// ========== 模型分辨率变体合并（与 GenerateView 对齐） ==========
const RESOLUTION_SUFFIX_RE = /[-_](480p|720p|1080p|2k|4k)$/i
const RES_KEY_TO_LABEL = { '480p': '480P', '720p': '720P', '1080p': '1080P', '2k': '2K', '4k': '4K' }
const RES_ORDER = ['480P', '720P', '1080P', '2K', '4K']

function normalizeResKey(r) {
  return String(r || '').toLowerCase()
}

function parseResolutionVariant(modelId, modelName) {
  const idStr = String(modelId || '')
  let match = idStr.match(RESOLUTION_SUFFIX_RE)
  if (match) {
    return { baseId: idStr.slice(0, -match[0].length), resolution: match[1].toLowerCase() }
  }
  const nameStr = String(modelName || '')
  match = nameStr.match(RESOLUTION_SUFFIX_RE)
  if (match) {
    return { baseId: idStr || nameStr.slice(0, -match[0].length), resolution: match[1].toLowerCase() }
  }
  return null
}

function extractSingleResolution(m) {
  if (Array.isArray(m.supported_resolutions) && m.supported_resolutions.length === 1) {
    return normalizeResKey(m.supported_resolutions[0])
  }
  if (Array.isArray(m.supported_quality) && m.supported_quality.length === 1) {
    return normalizeResKey(m.supported_quality[0])
  }
  return null
}

function mergeResolutionVariants(modelList) {
  const groupMap = new Map()
  const noSuffix = []

  for (const m of modelList) {
    const parsed = parseResolutionVariant(m.id, m.name)
    if (parsed && parsed.resolution) {
      const base = parsed.baseId
      if (!groupMap.has(base)) {
        const merged = { ...m }
        for (const field of ['name', 'display_name']) {
          if (merged[field]) {
            merged[field] = String(merged[field]).replace(RESOLUTION_SUFFIX_RE, '').trim()
          }
        }
        merged._resolutionVariants = {}
        merged._hasResolutionVariants = true
        merged._baseModelId = base
        merged.supported_resolutions = []
        groupMap.set(base, { merged, variants: new Map() })
      }
      const group = groupMap.get(base)
      group.variants.set(parsed.resolution, m)
      group.merged._resolutionVariants[parsed.resolution] = m.id
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

  for (const g of groupMap.values()) {
    if (g.merged._hasResolutionVariants && Array.isArray(g.merged.supported_resolutions)) {
      g.merged.supported_resolutions.sort((a, b) => RES_ORDER.indexOf(a) - RES_ORDER.indexOf(b))
    }
  }

  const idGroups = new Map()
  for (const m of noSuffix) {
    const key = String(m.id || m.name || '')
    if (!key) continue
    if (!idGroups.has(key)) idGroups.set(key, [])
    idGroups.get(key).push(m)
  }

  for (const [id, group] of idGroups) {
    if (group.length === 1) {
      groupMap.set('__plain__' + id, { merged: group[0], variants: new Map() })
      continue
    }
    const merged = { ...group[0] }
    const allResKeys = new Set()
    const variants = {}
    for (const m of group) {
      const resList = Array.isArray(m.supported_resolutions) && m.supported_resolutions.length > 0
        ? m.supported_resolutions
        : (m.supported_quality || [])
      resList.forEach(r => allResKeys.add(normalizeResKey(r)))
      const singleRes = extractSingleResolution(m)
      if (singleRes) variants[singleRes] = m.id
    }
    for (const r of allResKeys) {
      if (!variants[r]) variants[r] = id
    }
    if (Object.keys(variants).length > 0) {
      merged._resolutionVariants = variants
      merged._hasResolutionVariants = true
      merged._baseModelId = id
      merged.supported_resolutions = Array.from(allResKeys)
        .map(r => RES_KEY_TO_LABEL[r] || r.toUpperCase())
        .sort((a, b) => RES_ORDER.indexOf(a) - RES_ORDER.indexOf(b))
    }
    groupMap.set('__id__' + id, { merged, variants: new Map() })
  }

  return Array.from(groupMap.values()).map(g => g.merged)
}

function classifyModels(fetchedModels) {
  const result = { image: [], video: [] }
  if (!fetchedModels) return result

  const rawImage = (fetchedModels.image_models || [])
    .filter(m => {
      if (m.is_enabled === false) return false
      if (m.media_type === 'video') return false
      return true
    })
    .map(m => ({ ...m, inputType: 'text', categoryLabel: '文本输入' }))

  const rawVideo = (fetchedModels.video_models || [])
    .filter(m => m.is_enabled !== false)
    .map(m => ({ ...m, inputType: 'text', categoryLabel: '文本输入' }))

  result.image = mergeResolutionVariants(rawImage)
  result.video = mergeResolutionVariants(rawVideo)

  console.log('📊 模型分类完成:', {
    图片生成: result.image.length,
    视频生成: result.video.length
  })
  for (const m of [...result.image, ...result.video]) {
    if (m._hasResolutionVariants) {
      console.log(`  📐 合并模型 "${m.name}" 分辨率变体:`, m._resolutionVariants)
    }
  }
  return result
}

async function fetchModels() {
  try {
    const { data } = await request.get('/api/v1/models')
    if (data.code === 200) {
      const classified = classifyModels(data.data)
      allModels.value = {
        image_models: classified.image,
        video_models: classified.video
      }
      console.log('✅ 模型列表加载成功:', {
        图片模型: classified.image.length,
        视频模型: classified.video.length
      })
    }
  } catch (error) {
    console.error('❌ 获取模型失败:', error)
    showToast('获取模型列表失败', 'error')
  }
}

function switchType(typeId) {
  if (isBatchTesting.value) {
    showToast('测试进行中，请先停止当前测试', 'warning')
    return
  }
  selectedType.value = typeId
  selectedModels.value = []
  modelSearchKeyword.value = ''
  selectedFeature.value = ''
  showOnlyImageRequired.value = false
  uploadedTestImages.value = []
  selectedVideoDuration.value = 5
}

function getModelPrice(model, resolution) {
  const vendor = model.vendor
  const isVideo = selectedType.value === 'video'

  if (isVideo) {
    const videoPrices = {
      '720p': { cost: vendor === 'vendor_a' ? '¥2.0' : '$0.08', time: '30-60s' },
      '1080p': { cost: vendor === 'vendor_a' ? '¥4.0' : '$0.16', time: '60-120s' },
      '2k': { cost: vendor === 'vendor_a' ? '¥8.0' : '$0.32', time: '120-180s' },
      '4k': { cost: vendor === 'vendor_a' ? '¥16.0' : '$0.64', time: '240-360s' }
    }
    return videoPrices[resolution] || videoPrices['1080p']
  }

  const imagePrices = {
    'vendor_a': {
      '720p': { cost: '¥0.5', time: '5-10s' },
      '1080p': { cost: '¥1.0', time: '10-20s' },
      '2k': { cost: '¥2.0', time: '20-30s' },
      '4k': { cost: '¥4.0', time: '40-60s' }
    },
    'vendor_b': {
      '720p': { cost: '$0.02', time: '8-15s' },
      '1080p': { cost: '$0.04', time: '15-25s' },
      '2k': { cost: '$0.08', time: '25-40s' },
      '4k': { cost: '$0.16', time: '50-70s' }
    }
  }

  return imagePrices[vendor]?.[resolution] || imagePrices['vendor_a']['1080p']
}

function isModelCompleted(modelId) {
  return testResults.value.some(r =>
    r.modelId === modelId && r.status === 'success'
  )
}

function hasModelFailed(modelId) {
  return testResults.value.some(r =>
    r.modelId === modelId && r.status === 'failed' &&
    !testResults.value.some(rr => rr.modelId === modelId && rr.status === 'success')
  )
}

async function startBatchTest() {
  if (canStartBatch.value) return

  const models = filteredModels.value
  const resList = selectedResolutions.value

  let taskQueue = []

  if (testMode.value === 'all') {
    for (const model of models) {
      for (const res of resList) {
        taskQueue.push({ model, resolution: res })
      }
    }
  } else if (testMode.value === 'models') {
    for (const model of models) {
      taskQueue.push({ model, resolution: resList[0] })
    }
  } else if (testMode.value === 'resolutions') {
    if (models.length > 0) {
      for (const res of resList) {
        taskQueue.push({ model: models[0], resolution: res })
      }
    }
  }

  if (taskQueue.length === 0) {
    showToast('没有可执行的任务', 'warning')
    return
  }

  isBatchTesting.value = true
  isPaused.value = false
  shouldStop.value = false
  isStopping.value = false
  currentTaskIndex.value = 0
  totalTasks.value = taskQueue.length
  testResults.value = []

  try {
    for (let i = 0; i < taskQueue.length; i++) {
      if (shouldStop.value || isUnmounted.value) break

      while (isPaused.value && !shouldStop.value && !isUnmounted.value) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      if (shouldStop.value || isUnmounted.value) break

      const task = taskQueue[i]
      currentTaskIndex.value = i + 1
      currentTestingModel.value = task.model
      currentResolution.value = task.resolution

      nextTick(() => {
        if (!isUnmounted.value && window.lucide) lucide.createIcons()
      })

      await runSingleTest(task.model, task.resolution)

      if (!isUnmounted.value) {
        nextTick(() => {
          if (!isUnmounted.value && window.lucide) lucide.createIcons()
        })
      }
    }

    if (!shouldStop.value && !isUnmounted.value) {
      showToast(`🎉 批量测试完成！共完成 ${testResults.value.length} 个任务`, 'success')
    } else if (isUnmounted.value) {
      console.log('🧹 组件已卸载，批量测试已终止')
    } else {
      showToast(`⏹️ 测试已停止，已完成 ${testResults.value.length}/${totalTasks.value}`, 'info')
    }
  } finally {
    if (!isUnmounted.value) {
      isBatchTesting.value = false
      isStopping.value = false
      currentTestingModel.value = null
      currentResolution.value = ''

      nextTick(() => {
        if (!isUnmounted.value && window.lucide) lucide.createIcons()
      })
    }
  }
}

function getModelIdentity(model) {
  return [model?.business_model_id, model?.id, model?.model_id, model?.name, model?.display_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replaceAll('_', '-')
}

async function runSingleTest(model, resolution) {
  if (isUnmounted.value) {
    console.log('⚠️ 组件已卸载，跳过测试')
    return
  }

  const startTime = Date.now()
  // 用自增计数器 + 时间戳保证 resultId 唯一，避免批量任务在同一毫秒创建导致 ID 重复覆盖
  const resultId = `test_${runSingleTestIdCounter++}_${model.id}_${resolution}_${startTime}`
  const createTestingResult = () => ({
    id: resultId,
    modelName: model.display_name || model.name,
    modelId: model.id,
    vendor: model.vendor_name,
    type: selectedType.value,
    resolution: resolution,
    videoDuration: selectedType.value === 'video' ? selectedVideoDuration.value : null,
    duration: '测试中...',
    serverDuration: null,
    taskId: null,
    status: 'testing',
    fileSize: '-',
    filePath: '',
    previewUrl: null,
    displayUrl: null,
    timestamp: new Date().toLocaleString(),
    prompt: testPrompt.value
  })

  const findResultIndex = () => testResults.value.findIndex(r => r.id === resultId)

  const updateResultToFailed = (errorMsg, durationStr) => {
    if (isUnmounted.value) return
    try {
      const idx = findResultIndex()
      if (idx > -1) {
        const newResults = [...testResults.value]
        newResults[idx] = {
          ...newResults[idx],
          duration: durationStr,
          status: 'failed',
          error: errorMsg
        }
        testResults.value = newResults
      } else {
        testResults.value = [...testResults.value, {
          ...createTestingResult(),
          duration: durationStr,
          status: 'failed',
          error: errorMsg
        }]
      }
      nextTick(() => {
        if (!isUnmounted.value && window.lucide) lucide.createIcons()
      })
    } catch (updateError) {
      console.error('更新失败状态出错:', updateError.message)
    }
  }

  if (!isUnmounted.value) {
    testResults.value = [...testResults.value, createTestingResult()]

    nextTick(() => {
      if (isUnmounted.value) return
      if (window.lucide) lucide.createIcons()
      const idx = findResultIndex()
      if (idx > -1 && !expandedResults.value.includes(idx)) {
        expandedResults.value = [...expandedResults.value, idx]
      }
    })
  }

  try {
    if (isUnmounted.value) throw new Error('组件已卸载')

    // === 1. 构造输入文件列表（优先 @引用，其次上传素材）===
    const hasAtReferences = referencedFiles.value.length > 0
    let allInputFiles
    if (hasAtReferences) {
      allInputFiles = referencedFiles.value.map(ref => ({
        type: ref.type,
        url: ref.url,
        purpose: 'reference',
        object_id: ref.object_id || String(ref.sourceId || '')
      }))
    } else {
      // 兼容旧逻辑：把 uploadedTestImages 也纳入 uploadedFiles
      allInputFiles = [...uploadedFiles.value]
    }

    const isI2VModel = (model.id || model.name || '').toLowerCase().includes('i2v') ||
                       (model.name || '').toLowerCase().includes('image.to.video')

    if (!model.variants && isI2VModel && allInputFiles.length === 0) {
      console.warn(`⚠️ ${model.name} 是 I2V 模型，需要上传参考图片才能测试`)
      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      updateResultToFailed('I2V 模型需要上传参考图片，请先上传测试图片', duration)
      return
    }

    // === 2. 解析 feature（与 GenerateView 对齐）===
    const uiFeature = selectedFeature.value || ''
    let feature = selectedFeature.value || ''
    if (!feature) {
      if (selectedType.value === 'image') {
        feature = allInputFiles.length > 0 ? 'image_reference' : 'text_to_image'
      } else {
        feature = allInputFiles.length === 0 ? 'text_to_video' : (allInputFiles.length === 1 ? 'global_reference' : 'multi_reference')
      }
    }
    if (selectedType.value === 'video' && allInputFiles.length >= 2 && !selectedFeature.value) {
      feature = 'multi_reference'
    }

    const resolutionLabel = RES_KEY_TO_LABEL[resolution.toLowerCase()] || resolution.toUpperCase()
    const modelRoute = resolveModelRoute(model, {
      feature,
      resolution: resolutionLabel,
      inputFiles: allInputFiles
    })
    feature = modelRoute.feature || feature
    let apiModelId = modelRoute.businessModelId
    const suffixPattern = /__(img|vid|aud)$/
    if (suffixPattern.test(apiModelId)) apiModelId = apiModelId.replace(suffixPattern, '')

    const requiresInput = typeof modelRoute.variant?.requires_input === 'boolean'
      ? modelRoute.variant.requires_input
      : model.requires_input === true
    if (requiresInput && allInputFiles.length === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      updateResultToFailed('当前模型需要上传输入素材', duration)
      return
    }

    const resultIndex = findResultIndex()
    if (resultIndex > -1) {
      const newResults = [...testResults.value]
      newResults[resultIndex] = {
        ...newResults[resultIndex],
        businessModelId: apiModelId,
        upstreamRoutes: resolveUpstreamRoutes(model, {
          businessModelId: apiModelId,
          resolution: resolutionLabel
        })
      }
      testResults.value = newResults
    }

    // === 3. 处理 prompt 中的 @ 标签替换为 <<<object_id>>> ===
    let finalPrompt = String(testPrompt.value || '').trim()
    if (referencedFiles.value.length > 0 && finalPrompt.includes('@')) {
      const tagToObjectId = {}
      for (const ref of referencedFiles.value) {
        const tag = String(ref.atTag || '')
        const oid = String(ref.object_id || '')
        if (tag && oid) tagToObjectId[tag] = `<<<${oid}>>>`
      }
      finalPrompt = finalPrompt.replace(/@\S+/g, (match) => tagToObjectId[match] || match)
    }

    // === 4. 构造 requestBody ===
    const requestBody = {
      output_type: String(selectedType.value || 'image'),
      model: apiModelId,
      vendor: String(model.vendor || 'vendor_a'),
      feature: String(feature || 'text_to_video'),
      parameters: {},
      prompt: finalPrompt,
      input_files: allInputFiles.map((f) => ({
        type: String(f.type || 'image'),
        url: String(f.url || ''),
        purpose: String(f.purpose || 'reference'),
        object_id: String(f.object_id || `file_${f.type}_${Math.random().toString(36).slice(2, 6)}`)
      }))
    }

    if (selectedType.value === 'image') {
      requestBody.parameters = {
        resolution: resolutionLabel,
        ratio: selectedRatio.value,
        count: 1
      }
      const modelIdLower = getModelIdentity(model)
      // GPT 图像模型专属参数
      if (modelIdLower.includes('gpt-image') || modelIdLower.includes('chatgpt-image') || modelIdLower.includes('dall-e')) {
        requestBody.parameters.quality = 'auto'
        requestBody.parameters.output_format = 'png'
        requestBody.parameters.background = 'auto'
        if (allInputFiles.length > 0) {
          requestBody.parameters.references = allInputFiles.map(f => ({ type: f.type || 'image', url: f.url }))
        }
      }
      // 千问/万象模型参数
      if (modelIdLower.includes('qwen') || modelIdLower.includes('wan')) {
        requestBody.parameters.watermark = false
        const resMatch = resolutionLabel.match(/(\d+)[pP]/i)
        if (resMatch) {
          const baseHeight = parseInt(resMatch[1])
          const ratioParts = String(selectedRatio.value).split(':')
          if (ratioParts.length === 2) {
            const wRatio = parseInt(ratioParts[0])
            const hRatio = parseInt(ratioParts[1])
            const width = Math.round(baseHeight * wRatio / hRatio)
            requestBody.parameters.size = `${width}*${baseHeight}`
          }
        }
      }
    } else if (selectedType.value === 'video') {
      requestBody.parameters = {
        resolution: resolutionLabel,
        duration: selectedVideoDuration.value,
        ratio: selectedRatio.value,
        sound: videoSoundEnabled.value,
        audio_generation: videoSoundEnabled.value
      }

      const modelIdLower = apiModelId.toLowerCase()
      const isSeedance = modelIdLower.includes('seedance')
      if (isSeedance) {
        requestBody.parameters.generate_audio = videoSoundEnabled.value
        requestBody.parameters.watermark = false
      }

      const featureVal = uiFeature
      // 对口型
      if (featureVal === 'lip-sync') {
        requestBody.parameters.scene_type = 'lip_sync'
        const videoFile = allInputFiles.find(f => f.type === 'video')
        const audioFile = allInputFiles.find(f => f.type === 'audio')
        if (videoFile) requestBody.parameters.lip_sync_video = videoFile.url
        if (audioFile) requestBody.parameters.lip_sync_audio = audioFile.url
      }
      // 动作模仿
      else if (featureVal === 'motion-imitate') {
        requestBody.parameters.scene_type = 'motion_control'
        requestBody.parameters.character_orientation = 'image'
        requestBody.parameters.keep_original_sound = 'no'
      }
      // 特效复刻
      else if (featureVal === 'effect-copy') {
        requestBody.parameters.scene_type = 'template_effect'
      }
      // 智能多帧
      else if (featureVal === 'smart-multi-frame') {
        requestBody.parameters.multi_shot = true
        requestBody.parameters.shot_type = 'customize'
      }

      // references 带 role（非首尾帧场景）
      if (allInputFiles.length > 0 && featureVal !== 'first-last-frame') {
        requestBody.parameters.references = allInputFiles.map(f => {
          const ref = { url: f.url, type: f.type || 'image' }
          if (f.object_id) ref.object_id = f.object_id
          if (f.purpose === 'first_frame') ref.role = 'first_frame'
          else if (f.purpose === 'last_frame') ref.role = 'last_frame'
          else if (f.type === 'image') ref.role = 'reference_image'
          else if (f.type === 'video') ref.role = 'reference_video'
          else if (f.type === 'audio') ref.role = 'reference_audio'
          return ref
        })
      }
    }

    // === 6. vendor_b 的 input.media 字段（带 role）===
    if (model.vendor === 'vendor_b' && allInputFiles.length > 0) {
      requestBody.input = {
        media: allInputFiles.map((file, index) => {
          const media = {
            type: String(file.type || 'image'),
            url: String(file.url || ''),
            purpose: String(file.purpose || 'reference'),
            object_id: String(file.object_id || `media_${index + 1}`)
          }
          if (file.purpose === 'first_frame') media.role = 'first_frame'
          else if (file.purpose === 'last_frame') media.role = 'last_frame'
          else if (file.type === 'image') media.role = 'reference_image'
          else if (file.type === 'video') media.role = 'reference_video'
          else if (file.type === 'audio') media.role = 'reference_audio'
          return media
        })
      }
      console.log('📎 为 vendor_b 模型添加 input.media 字段:', requestBody.input.media.length, '个文件')
    }

    let response
    let data

    try {
      response = await request.post('/api/v1/generate?sync=true', requestBody, { timeout: 1200000 })
      data = response.data
    } catch (fetchErr) {
      if (isUnmounted.value) return
      if (fetchErr.code === 'ECONNABORTED' || fetchErr.code === 'ETIMEDOUT' || fetchErr.code === 'ERR_CANCELED') {
        throw new Error('请求超时（5分钟）')
      }
      throw fetchErr
    }

    if (!data || data.code !== 200 || !data.data) {
      const errMsg = safeMessage(data?.message ?? data?.error ?? data?.detail ?? data, '生成失败')
      throw new Error(errMsg)
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2) + 's'

    let extractedData
    try {
      extractedData = extractResultFromResponse(data)
    } catch (extractErr) {
      throw new Error(`提取结果失败: ${safeMessage(extractErr?.message, '未知错误')}`)
    }

    if (!extractedData.results || extractedData.results.length === 0) {
      throw new Error('未返回有效的生成结果')
    }

    for (const resultData of extractedData.results) {
      if (isUnmounted.value) return
      if (!resultData.url) {
        continue
      }

      let displayUrl = resultData.url
      let previewUrl = resultData.url

      if (resultData.type === 'video' && resultData.url.includes('neolink.com')) {
        try {
          displayUrl = await Promise.race([
            fetchProtectedVideo(resultData.url),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('视频超时')), 15000)
            )
          ])
          previewUrl = displayUrl
        } catch (videoErr) {
        }
      } else if (resultData.url.startsWith('data:')) {
        previewUrl = convertBase64ToBlobUrl(resultData.url)
      }

      const fileName = `${model.name}_${resolution}.${resultData.type === 'image' ? 'png' : 'mp4'}`
      const filePath = `test/${fileName}`

      try {
        await Promise.race([
          saveToFileWithFileSystemAccess(resultData.url, fileName, resultData.type),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('保存超时')), 30000)
          )
        ])
      } catch (saveErr) {
      }

      const serverDuration = extractServerTiming(data)
      const actualVideoDuration = data.data?.result?.video?.duration || null

      if (isUnmounted.value) return

      const successResult = {
        ...createTestingResult(),
        type: resultData.type || selectedType.value,
        actualVideoDuration: actualVideoDuration,
        duration: duration,
        serverDuration: serverDuration,
        taskId: extractedData.taskId || data.data.task_id || null,
        status: 'success',
        fileSize: estimateFileSize(resultData.url),
        filePath: filePath,
        previewUrl: previewUrl,
        displayUrl: displayUrl,
        downloadUrl: resultData.url
      }

      const idx = findResultIndex()
      if (idx > -1) {
        const newResults = [...testResults.value]
        newResults[idx] = successResult
        testResults.value = newResults
      }
      nextTick(() => {
        if (!isUnmounted.value && window.lucide) lucide.createIcons()
      })
    }
  } catch (error) {
    if (!isUnmounted.value) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      updateResultToFailed(error.message, duration)
    }
  }
}

function pauseBatchTest() {
  if (!isBatchTesting.value || isStopping.value) return

  isPaused.value = !isPaused.value
  showToast(isPaused.value ? '⏸️ 测试已暂停，当前任务完成后不会启动新任务' : '▶️ 继续测试...', 'info')
}

function stopBatchTest() {
  if (!isBatchTesting.value) return

  shouldStop.value = true
  isStopping.value = true
  isPaused.value = false
  showToast('⏹️ 正在停止测试，等待当前任务完成...', 'info')
}

function convertBase64ToBlobUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(parts[1])
  const u8arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
  return URL.createObjectURL(new Blob([u8arr], { type: mime }))
}

function estimateFileSize(dataUrl) {
  if (!dataUrl) return '未知'
  const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024)
  if (sizeKB < 1024) return `${sizeKB} KB`
  return `${(sizeKB / 1024).toFixed(2)} MB`
}

function exportReport() {
  if (testResults.value.length === 0) return

  const now = new Date()
  let report = `# 📊 AI模型批量测试报告\n\n`
  report += `**生成时间**: ${now.toLocaleString()}\n`
  report += `**测试类型**: ${getTypeLabel(selectedType.value)}\n`
  report += `**测试提示词**: "${testPrompt.value}"\n\n`

  report += `---\n\n## 📈 测试概览\n\n`
  report += `| 指标 | 数值 |\n|------|------|\n`
  report += `- **总测试次数**: ${testResults.value.length}\n`
  report += `- **成功次数**: ${successCount.value}\n`
  report += `- **失败次数**: ${failedCount.value}\n`
  report += `- **成功率**: ${testResults.value.length > 0 ? ((successCount.value / testResults.value.length) * 100).toFixed(1) : 0}%\n`
  report += `- **总耗时**: ${totalDuration.value}\n\n`

  report += `---\n\n## 💰 成本估算\n\n`
  let totalCostA = 0
  let totalCostB = 0
  testResults.value.forEach(r => {
    const model = filteredModels.value.find(m => m.id === r.modelId)
    if (model) {
      const priceInfo = getModelPrice(model, r.resolution)
      const costStr = priceInfo.cost.replace(/[¥$]/g, '')
      const cost = parseFloat(costStr) || 0
      if (priceInfo.cost.startsWith('¥')) {
        totalCostA += cost
      } else {
        totalCostB += cost
      }
    }
  })

  report += `- **预估总成本 (腾讯云)**: ¥${totalCostA.toFixed(2)}\n`
  report += `- **预估总成本 (Token Switch)**: $${totalCostB.toFixed(2)}\n\n`

  report += `---\n\n## 📋 详细结果\n\n`

  const groupedByModel = {}
  testResults.value.forEach((result, index) => {
    if (!groupedByModel[result.modelName]) {
      groupedByModel[result.modelName] = []
    }
    groupedByModel[result.modelName].push({ ...result, index: index + 1 })
  })

  Object.entries(groupedByModel).forEach(([modelName, results]) => {
    const model = filteredModels.value.find(m => m.name === modelName)
    const features = model ? getModelFeatures(model) : []

    report += `### 🔹 ${modelName}\n\n`

    if (features.length > 0) {
      report += `**支持的特色功能**: ${features.map(f => f.label).join('、')}\n\n`
    }

    const hasVideoDuration = results.some(r => r.videoDuration || r.actualVideoDuration)
    if (hasVideoDuration) {
      report += `| # | 分辨率 | 视频时长 | 实际时长 | 状态 | 客户端耗时 | 后端耗时 | 文件大小 | URL | 任务ID | 时间 |\n|---|--------|----------|----------|------|-----------|---------|----------|------|--------|------|\n`
    } else {
      report += `| # | 分辨率 | 状态 | 客户端耗时 | 后端耗时 | 文件大小 | URL | 任务ID | 时间 |\n|---|--------|------|-----------|---------|----------|------|--------|------|\n`
    }

    results.forEach(result => {
      report += `| ${result.index} | ${result.resolution} | `
      if (hasVideoDuration) {
        report += result.videoDuration ? `${result.videoDuration}s` : '-'
        report += ` | `
        report += result.actualVideoDuration ? `${result.actualVideoDuration}s` : '-'
        report += ` | `
      }
      report += result.status === 'success' ? '✅ 成功' : '❌ 失败'
      report += ` | ${result.duration} | `
      report += result.serverDuration || '-'
      report += ` | `
      report += result.status === 'success' ? result.fileSize : '-'
      report += ` | `
      report += (result.downloadUrl || '-')
      report += ` | `
      report += result.taskId ? result.taskId.slice(0, 12) + '...' : '-'
      report += ` | ${result.timestamp} |\n`
    })

    report += `\n`
  })

  report += `---\n\n## ⚠️ 错误详情\n\n`
  const failures = testResults.value.filter(r => r.status === 'failed')
  if (failures.length === 0) {
    report += `所有测试均通过，无错误记录 ✨\n\n`
  } else {
    failures.forEach((result, idx) => {
      report += `${idx + 1}. **${result.modelName}** (${result.resolution}): ${result.error}\n\n`
    })
  }

  report += `---\n\n*报告由模型测试中心自动生成*\n`

  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `AI模型测试报告_${now.toISOString().slice(0, 10)}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  showToast('📄 完整测试报告已导出', 'success')
}

function toggleResultExpand(index) {
  if (isUnmounted.value) return
  if (index < 0 || index >= testResults.value.length) return

  if (expandedResults.value.includes(index)) {
    expandedResults.value = expandedResults.value.filter(i => i !== index)
  } else {
    expandedResults.value = [...expandedResults.value, index]
  }

  nextTick(() => {
    if (!isUnmounted.value && window.lucide) lucide.createIcons()
  })
}

function clearResults() {
  if (isUnmounted.value) return
  if (confirm('确定要清空所有测试数据吗？此操作不可撤销。')) {
    testResults.value = []
    expandedResults.value = []
    currentTaskIndex.value = 0
    totalTasks.value = 0
    showToast('🗑️ 测试数据已清空', 'info')
  }
}

// ========== Toast 提示 ==========
const toastVisible = ref(false)
const toastMessage = ref('')
const toastType = ref('info')
let toastTimer = null

function showToast(msg, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${msg}`)
  toastMessage.value = msg
  toastType.value = type
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 3000)
}

onMounted(async () => {
  if (window.lucide) lucide.createIcons()
  await fetchModels()
  nextTick(() => {
    if (window.lucide) lucide.createIcons()
  })
})

onUnmounted(() => {
  isUnmounted.value = true
  shouldStop.value = true
  isStopping.value = true
  isBatchTesting.value = false
  console.log('🧹 TestView 组件已卸载，清理所有异步操作')
})
</script>

<style scoped>
.test-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px;
}

.test-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: #6b7280;
}

.test-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  height: calc(100vh - 160px);
}

.test-content > div:nth-child(2) {
  overflow-y: auto;
  max-height: calc(100vh - 160px);
  padding-right: 8px;
}

.test-content > div:nth-child(2)::-webkit-scrollbar {
  width: 6px;
}

.test-content > div:nth-child(2)::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}

.test-content > div:nth-child(2)::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.test-content > div:nth-child(2)::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.control-panel {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 160px);
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.type-selector {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.type-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  background: #eff6ff;
}

.type-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.type-btn i {
  width: 16px;
  height: 16px;
}

.batch-control {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 2px solid #bae6fd;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.batch-control h3 {
  color: #0369a1;
  font-size: 16px;
  margin-bottom: 16px;
}

.param-group {
  margin-bottom: 16px;
}

.param-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

/* 画面比例选择器 */
.ratio-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ratio-btn {
  padding: 8px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6b7280;
}

.ratio-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.ratio-btn.active {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

.ratio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resolution-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.resolution-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.resolution-checkbox:hover:not(:disabled) {
  border-color: #3b82f6;
}

.resolution-checkbox.selected {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 600;
}

.resolution-checkbox input {
  display: none;
}

/* 视频时长选择 */
.duration-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.duration-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  font-size: 13px;
}

.duration-option:hover:not(:disabled) {
  border-color: #8b5cf6;
  background: #faf5ff;
}

.duration-option.selected {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
  color: #7c3aed;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15);
}

.duration-option input {
  display: none;
}

/* 视频声音开关 */
.sound-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sound-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6b7280;
}

.sound-toggle-btn:hover:not(:disabled) {
  border-color: #8b5cf6;
  background: #faf5ff;
}

.sound-toggle-btn.active {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
}

.sound-toggle-btn i {
  width: 16px;
  height: 16px;
}

.sound-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sound-hint {
  font-size: 11px;
  color: #9ca3af;
}

.param-select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  background: white;
}

.prompt-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.prompt-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* 图片上传区域 */
.image-upload-section {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #93c5fd;
  border-radius: 10px;
  padding: 16px;
}

.upload-hint {
  font-size: 11px;
  color: #3b82f6;
  margin-bottom: 12px;
  opacity: 0.8;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  background: white;
  border: 2px dashed #93c5fd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.upload-area i {
  width: 32px;
  height: 32px;
  color: #3b82f6;
}

.upload-area span {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.upload-area small {
  font-size: 11px;
  color: #9ca3af;
}

.uploaded-images-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.uploaded-image-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  position: relative;
}

.uploaded-image-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.image-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-name {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-size {
  font-size: 11px;
  color: #6b7280;
}

.remove-image-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fecaca;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  color: #dc2626;
  transition: all 0.2s;
  flex-shrink: 0;
}

.remove-image-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.remove-image-btn i {
  width: 14px;
  height: 14px;
}

.add-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px dashed #93c5fd;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #3b82f6;
  font-size: 12px;
  transition: all 0.2s;
}

.add-more-btn:hover {
  background: #eff6ff;
  border-color: #3b82f6;
}

.add-more-btn i {
  width: 14px;
  height: 14px;
}

.progress-section {
  margin: 20px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.current-testing {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #0369a1;
  background: #f0f9ff;
  padding: 8px 12px;
  border-radius: 6px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 保存目录设置 */
.save-directory-section {
  margin-top: 16px;
  padding: 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

.save-directory-section label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 8px;
}

.directory-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.select-directory-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.select-directory-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.select-directory-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.select-directory-btn i {
  width: 16px;
  height: 16px;
}

.directory-path {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #166534;
  font-weight: 500;
  padding: 6px 10px;
  background: #dcfce7;
  border-radius: 6px;
}

.directory-path i {
  width: 14px;
  height: 14px;
}

.directory-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #92400e;
  opacity: 0.8;
}

.directory-hint i {
  width: 12px;
  height: 12px;
}

.batch-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.batch-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.batch-btn.start {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.batch-btn.start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.batch-btn.pause {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.batch-btn.stop {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.batch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.batch-btn i {
  width: 20px;
  height: 20px;
}

.stats-summary {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  background: white;
  border-radius: 8px;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.stat-item.success { color: #059669; }
.stat-item.failed { color: #dc2626; }
.stat-item.total-time { color: #2563eb; }

.stat-item strong {
  font-size: 18px;
  color: inherit;
}

.stat-item i {
  width: 16px;
  height: 16px;
}

/* 模型列表头部 */
.model-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

/* 特色功能筛选区域 */
.feature-filter-section {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.feature-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.feature-filter-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #166534;
  margin-bottom: 0;
}

.clear-feature-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #fca5a5;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  color: #dc2626;
  transition: all 0.2s;
}

.clear-feature-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

.clear-feature-btn i {
  width: 12px;
  height: 12px;
}

.feature-hint {
  font-size: 12px;
  color: #166534;
  margin-bottom: 12px;
  opacity: 0.8;
}

.feature-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.feature-select-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border: 1px solid #bbf7d0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.feature-select-btn:hover:not(:disabled) {
  border-color: #22c55e;
  background: #f0fdf4;
  transform: translateY(-1px);
}

.feature-select-btn.active {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.feature-select-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feature-icon {
  font-size: 18px;
}

.feature-label {
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  line-height: 1.3;
}

.feature-result-info {
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-top: 8px;
}

.result-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.stat-badge.success {
  background: #dcfce7;
  color: #166534;
}

.stat-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.stat-badge i {
  width: 14px;
  height: 14px;
}

.model-list-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0;
}

.model-select-actions {
  display: flex;
  gap: 6px;
}

.select-action-btn {
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.select-action-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #3b82f6;
  color: #3b82f6;
}

.select-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 搜索框 */
.model-search-box {
  position: relative;
  margin-bottom: 10px;
}

.model-search-box i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #9ca3af;
}

.model-search-box input {
  width: 100%;
  padding: 8px 10px 8px 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  transition: all 0.2s;
}

.model-search-box input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.model-hint {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.model-list-mini {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.model-item-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.2s;
  background: white;
  cursor: pointer;
}

.model-item-mini.selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.model-item-mini.supports {
  background: #f0fdf4;
  border-color: #86efac;
}

.model-item-mini.not-supports {
  opacity: 0.5;
  background: #fef2f2;
  border-color: #fecaca;
}

.model-item-mini:hover:not(.completed):not(.testing) {
  border-color: #93c5fd;
  background: #f0f9ff;
}

.model-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
}

.feature-support-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

.feature-support-badge.yes {
  background: #dcfce7;
  color: #166534;
}

.feature-support-badge.no {
  background: #fef2f2;
  color: #dc2626;
}

.feature-support-badge i {
  width: 12px;
  height: 12px;
}

.model-item-mini.completed {
  background: #f0fdf4;
  border-color: #86efac;
}

.model-item-mini.testing {
  background: #eff6ff;
  border-color: #93c5fd;
  animation: pulse 1.5s ease-in-out infinite;
}

.model-item-mini.failed {
  background: #fef2f2;
  border-color: #fca5a5;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.model-index {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.model-name-mini {
  flex: 1;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-info-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.model-tags-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.model-tag-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.3px;
}

.model-tag-badge.default {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.model-tag-badge.vendor {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  color: #166534;
}

.model-tag-badge.new {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.model-tag-badge.vip {
  background: linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%);
  color: #6b21a8;
}

.model-tag-badge.trial {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #be185d;
}

.vendor-tag-small {
  font-size: 10px;
  padding: 2px 6px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
  white-space: nowrap;
}

.status-icon {
  width: 14px;
  height: 14px;
}

.status-icon.success { color: #059669; }
.status-icon.failed { color: #dc2626; }
.status-icon.testing { color: #2563eb; }

.result-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: calc(100vh - 160px);
}

.info-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 20px;
}

.info-card h3 {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f3f4f6;
}

.price-overview {
  overflow-x: auto;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.comparison-table th,
.comparison-table td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.comparison-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  position: sticky;
  top: 0;
}

.model-cell strong {
  color: #111827;
  font-size: 12px;
}

.vendor-badge {
  font-size: 10px;
  padding: 3px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}

.price-cell {
  text-align: center;
}

.price-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.price-info .cost {
  font-weight: 600;
  color: #059669;
  font-size: 12px;
}

.price-info .time {
  font-size: 10px;
  color: #9ca3af;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #9ca3af;
}

.empty-state i {
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-state p {
  margin: 8px 0;
  font-size: 14px;
}

.empty-state .hint {
  font-size: 12px;
  color: #d1d5db;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.result-item:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.result-item.expanded {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.result-item.success {
  border-color: #86efac;
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
}

.result-item.success:hover {
  border-color: #22c55e;
}

.result-item.success.expanded {
  border-color: #16a34a;
}

.result-item.failed {
  border-color: #fca5a5;
  background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
}

.result-item.failed:hover {
  border-color: #ef4444;
}

.result-item.failed.expanded {
  border-color: #dc2626;
}

.result-item.testing {
  border-color: #fbbf24;
  background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
  animation: pulse 2s infinite;
}

.result-item.testing:hover {
  border-color: #f59e0b;
}

.result-item.testing.expanded {
  border-color: #d97706;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid #f3f4f6;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.expand-icon i {
  width: 16px;
  height: 16px;
}

.result-number {
  font-size: 12px;
  font-weight: 700;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

.result-model {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.resolution-badge {
  font-size: 11px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 4px;
  font-weight: 600;
}

.duration-badge {
  font-size: 11px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: white;
  border-radius: 4px;
  font-weight: 600;
}

.actual-duration-badge {
  font-size: 11px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  border-radius: 4px;
  font-weight: 600;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
}

.status.success {
  background: #d1fae5;
  color: #065f46;
}

.status.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status.testing {
  background: #fef3c7;
  color: #92400e;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status i {
  width: 14px;
  height: 14px;
}

.result-body {
  padding: 16px;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

.meta-item i {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}

.meta-item strong {
  color: #111827;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 12px;
  margin-bottom: 12px;
}

.error-message i {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.result-preview {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.result-preview img,
.result-preview video {
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  display: block;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
}

.file-info i {
  width: 14px;
  height: 14px;
}

.file-info code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #374151;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.action-btn.export {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-btn.clear {
  background: #f3f4f6;
  color: #6b7280;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn i {
  width: 18px;
  height: 18px;
}

/* 模型详情卡片 */
.model-detail-card {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-color: #fbbf24;
}

.model-detail-card h3 {
  color: #92400e;
}

.model-detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  text-align: center;
  color: #92400e;
}

.empty-detail i {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-detail p {
  font-size: 13px;
  opacity: 0.7;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #fcd34d;
}

.detail-model-name {
  font-size: 18px;
  font-weight: 700;
  color: #78350f;
}

.detail-section {
  margin-top: 8px;
}

.detail-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-section h4 i {
  width: 16px;
  height: 16px;
}

.features-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feature-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #fcd34d;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: #78350f;
  transition: all 0.2s;
}

.feature-tag:hover {
  background: #fffbeb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

.detail-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #92400e;
  padding: 6px 0;
}

.detail-info-row i {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.detail-tags {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}

.tag.new {
  background: #dcfce7;
  color: #166534;
}

.tag.vip {
  background: #dbeafe;
  color: #1e40af;
}

.tag.trial {
  background: #fce7f3;
  color: #9d174d;
}

/* 计时器信息样式 */
.timing-info .timing-details {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.client-time {
  color: #111827;
}

.server-time {
  font-size: 11px;
  color: #059669;
  font-weight: 500;
  cursor: help;
  border-bottom: 1px dashed #059669;
}

/* ========== @提及 & 媒体素材栏样式 ========== */

.prompt-editor-wrapper {
  position: relative;
}

.prompt-input[contenteditable="true"] {
  width: 100%;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 13.5px;
  line-height: 1.6;
  outline: none;
  font-family: inherit;
  color: #111827;
  background: white;
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  transition: border-color 0.2s ease;
}

.prompt-input[contenteditable="true"]:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.prompt-input[contenteditable="true"]:empty::before {
  content: attr(placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.char-count {
  font-size: 11px;
  color: #9ca3af;
}

/* ====== @提及下拉列表 ====== */
.at-mention-dropdown {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  animation: mentionFadeIn 0.15s ease-out;
  z-index: 9999;
}

@keyframes mentionFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.at-mention-header {
  padding: 10px 14px 6px;
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.at-mention-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px 8px;
}

.at-mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.at-mention-item:hover,
.at-mention-item.active {
  background: #f0f4ff;
}
.at-mention-item.active {
  box-shadow: inset 0 0 0 2px #6366f1;
}

.mention-thumb-wrap {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.mention-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mention-thumb.audio-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #6366f1;
}

.mention-type-icon {
  position: absolute;
  bottom: 1px;
  right: 1px;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0,0,0,0.65);
  color: white;
}
.mention-type-icon.video { background: rgba(190, 24, 93, 0.85); }
.mention-type-icon.image { background: rgba(29, 78, 216, 0.85); }

.mention-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mention-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mention-type-label {
  font-size: 11px;
  color: #9ca3af;
}

.at-mention-empty {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* ====== 媒体素材栏（单行流式布局）===== */
.media-bar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
  min-height: 96px;
}

.media-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  background: #e5e7eb;
  color: #6b7280;
}

.media-items-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.media-bar-divider {
  width: 1px;
  min-height: 80px;
  align-self: stretch;
  background: #e5e7eb;
  border-radius: 1px;
  margin: 22px 0 0 0;
  flex-shrink: 0;
}

.ref-section .section-count {
  background: #dbeafe;
  color: #2563eb;
}

.media-item {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.media-item .preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.draggable-item {
  cursor: pointer;
}
.draggable-item:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
  transform: translateY(-2px);
}

.drag-hint-overlay {
  position: absolute;
  inset: 0;
  background: rgba(99, 102, 241, 0.88);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: white;
  font-size: 9px;
  font-weight: 600;
  z-index: 5;
}
.draggable-item:hover .drag-hint-overlay { display: flex; }

.ref-item {
  border-color: #c7d2fe;
  cursor: pointer;
}
.ref-item.active {
  border-color: #6366f1;
  border-style: solid;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.ref-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.ref-at-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3px 0;
  background: linear-gradient(to top, rgba(99, 102, 241, 0.92), rgba(99, 102, 241, 0.7));
  color: white;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.3px;
}

.remove-ref-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
  z-index: 10;
}
.ref-item:hover .remove-ref-btn { opacity: 1; }
.remove-ref-btn:hover { background: #dc2626; transform: scale(1.1); }

.audio-preview {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #6366f1;
  font-size: 9px;
  padding: 4px;
  text-align: center;
  word-break: break-all;
}

.remove-file-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s ease;
  z-index: 10;
}
.uploaded-file-item:hover .remove-file-btn,
.draggable-item:hover .remove-file-btn { opacity: 1; }
.remove-file-btn:hover { background: rgba(37, 99, 235, 1); transform: scale(1.1); }

.file-type-badge {
  position: absolute;
  bottom: 3px;
  left: 3px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 9px;
  font-weight: 600;
  border-radius: 4px;
}

/* ====== 输入框内 @标签徽章样式（全局，因由JS动态创建） ====== */
.at-tag-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px 3px 7px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  margin: 0 2px;
  vertical-align: middle;
  cursor: default;
  transition: all 0.18s ease;
  user-select: none;
  white-space: nowrap;
  line-height: 1.2;
}
.at-tag-inline:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.at-tag-inline.at-tag-video {
  background: linear-gradient(135deg, #fce7f3, #fbcfe8);
  color: #be185d;
  border: 1.5px solid #f9a8d4;
}
.at-tag-inline.at-tag-image {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
  border: 1.5px solid #93c5fd;
}
.at-tag-text { letter-spacing: 0.2px; }
.at-tag-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-left: 1px;
  margin-right: -2px;
  border-radius: 50%;
  border: none;
  background: transparent;
  opacity: 0.45;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.at-tag-close:hover { opacity: 1; background: rgba(0,0,0,0.12); }
.at-tag-inline.at-tag-video .at-tag-close:hover { background: rgba(190, 24, 93, 0.15); }
.at-tag-inline.at-tag-image .at-tag-close:hover { background: rgba(29, 78, 216, 0.15); }
.at-tag-inline.at-tag-highlight { animation: atPulse 1s ease-in-out; }
@keyframes atPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
}

/* 云资料库选择弹窗样式 */
.cloud-upload-btn-wrapper {
  margin-top: 10px;
}

.cloud-upload-btn {
  width: 100%;
  padding: 10px;
  border: 2px dashed #3b82f6;
  border-radius: 8px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.cloud-upload-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.cloud-upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cloud-library-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  animation: cloudModalFadeIn 0.2s ease-out;
}

@keyframes cloudModalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.cloud-library-modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: cloudModalSlideUp 0.3s ease-out;
}

@keyframes cloudModalSlideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.cloud-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.cloud-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.cloud-modal-close {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.cloud-modal-close:hover {
  background: #e5e7eb;
  color: #374151;
}

.cloud-search-bar {
  margin: 16px 24px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.cloud-search-bar:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: white;
}

.cloud-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #374151;
}

.cloud-search-input::placeholder {
  color: #9ca3af;
}

.cloud-filter-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.cloud-tab {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.cloud-tab:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.cloud-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.cloud-files-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.cloud-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.cloud-empty-state p {
  margin: 16px 0 8px;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
}

.cloud-empty-hint {
  font-size: 13px;
  color: #9ca3af;
}

.cloud-files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.cloud-file-item {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
}

.cloud-file-item:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.cloud-file-item.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.cloud-file-thumb {
  width: 100%;
  height: 120px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.cloud-file-thumb img,
.cloud-video-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cloud-file-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #d1d5db;
}

.placeholder-audio {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.placeholder-video {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.cloud-selected-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  animation: checkPop 0.2s ease-out;
}

@keyframes checkPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.cloud-file-info {
  padding: 10px 12px;
}

.cloud-file-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-file-meta {
  font-size: 11px;
  color: #9ca3af;
}

.cloud-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 16px 16px;
}

.cloud-selection-info {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.cloud-actions {
  display: flex;
  gap: 10px;
}

.cloud-btn-secondary,
.cloud-btn-primary {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cloud-btn-secondary {
  background: white;
  border: 1.5px solid #d1d5db;
  color: #6b7280;
}

.cloud-btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #374151;
}

.cloud-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

.cloud-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.45);
}

.cloud-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 视频声音开关样式 */
.video-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.video-wrapper video {
  max-width: 100%;
  border-radius: 8px;
}

.sound-toggle-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.sound-toggle-btn:hover {
  background: rgba(59, 130, 246, 0.85);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.sound-toggle-btn.muted {
  background: rgba(239, 68, 68, 0.75);
}

.video-download-btn {
  position: absolute;
  bottom: 12px;
  right: 56px;
  height: 30px;
  padding: 0 10px;
  border-radius: 15px;
  border: none;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  z-index: 10;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.video-download-btn:hover {
  background: rgba(34, 197, 94, 0.85);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
}

/* ========== 全局 Toast 提示 ========== */
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
  z-index: 100000;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.15);
  background: white;
  color: #111827;
  max-width: 90vw;
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
</style>
