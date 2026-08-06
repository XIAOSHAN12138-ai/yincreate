# 管理员模型配置页面 - 实现计划

## Context

当前模型的声音模式、特色功能、分辨率、时长等配置全部硬编码在 `GenerateView.vue` 中，每次调整都需要改前端代码重新部署。需要让管理员通过 UI 配置这些参数，用户前端动态读取生效。

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/api/adminModels.js` | 新增常量：SOUND_MODE_OPTIONS、FEATURE_UI_OPTIONS、RESOLUTION_OPTIONS；mock 数据增加 sound_mode/ui_features 字段 |
| `src/stores/modelConfig.js` | **新建** Pinia Store：加载/缓存/降级模型配置 |
| `src/views/AdminView.vue` | 模型列表增加声音模式/最大时长列；编辑弹窗增加声音模式下拉、分辨率多选、特色功能多选 |
| `src/views/GenerateView.vue` | soundToggleMode/availableQualities/currentFeatures/videoDurationOptions 改为从模型配置动态读取；initModels 增加缓存 |

## 实施步骤

### 步骤1: `src/api/adminModels.js` - 数据层扩展

1. mockModels 每条视频模型新增 `sound_mode` 字段（kling系列=`free`, happyhorse=`forced-sound`, 其他=`disabled-silent`）
2. 导出常量：
   - `SOUND_MODE_OPTIONS` - 声音模式选项（free/forced-sound/disabled-silent/hidden）
   - `SOUND_MODE_LABELS` + `getSoundModeLabel()` - 中文标签映射
   - `FEATURE_UI_OPTIONS` - 前端用户功能选项（按 media_type 分组，与 featureMap 对齐）
   - `RESOLUTION_OPTIONS` - 分辨率选项（480p/720P/1080P/2K/4K）

### 步骤2: `src/stores/modelConfig.js` - 新建模型配置 Store

- `fetchModelConfig()` - 从 GET /api/v1/models 加载，写入 localStorage 缓存（30分钟TTL）
- `ensureLoaded()` - 只请求一次
- `getModelConfigById(modelId)` - 按ID查询配置
- `clearCache()` - 清除缓存
- API 不可用时降级读取 localStorage 缓存

### 步骤3: `src/views/AdminView.vue` - 管理页面增强

1. **列表表格**增加列：声音模式（彩色标签）、最大时长
2. **编辑弹窗**增加控件：
   - 声音模式下拉框（select，仅视频模型有效）
   - 分辨率多选（checkbox 组，替代原文本输入）
   - 前端用户功能多选（checkbox 组，按 media_type 过滤）
3. **JS 逻辑**：
   - defaultModelForm() 增加 sound_mode、ui_features 字段
   - openModelModal() 填充新字段
   - buildModelPayload() 提交新字段
   - filteredUiFeatureOptions computed 按 media_type 过滤功能选项

### 步骤4: `src/views/GenerateView.vue` - 动态读取配置

1. **soundToggleMode** - 优先读取 `model.sound_mode`，降级保留原字符串匹配
2. **availableQualities** - 优先读取 `model.supported_resolutions` 过滤，降级用 _resolutionVariants
3. **currentFeatures** - 优先读取 `model.ui_features` 过滤，降级返回全量 featureMap
4. **videoDurationOptions** - 改为 computed，从 `model.max_duration` 动态生成上限；watch selectedModel 自动修正超出时长
5. **initModels()** - 先读 localStorage 缓存秒开，再异步刷新 API 数据
6. **classifyModels()** - 过滤 `is_enabled === false` 的模型
7. **getDefaultVideoModels()** - 每个默认模型增加 sound_mode/ui_features/supported_resolutions/max_duration 字段

## 验证方式

1. 开启 Mock 模式（VITE_MOCK=true），访问 /admin 模型管理 Tab
2. 编辑一个视频模型，修改声音模式/最大时长/分辨率/特色功能，保存
3. 切换到 /generate 页面，选择该模型，验证：
   - 声音按钮状态与管理员配置一致
   - 分辨率选项只显示已勾选的
   - 特色功能列表只显示已勾选的
   - 时长滑块最大值受 max_duration 限制
4. 在管理员中停用某模型，验证生成页面不再显示该模型
5. 关闭后端，刷新页面，验证 localStorage 缓存降级生效
