# 前端 API 接口文档

本文档整理了当前平台使用的所有后端 API 接口，方便迁移到新平台时对接。

---

## 基础信息

| 项目 | 值 |
|------|-----|
| **Base URL** | `http://192.168.31.243:8003/api/v1` |
| **认证方式** | `Authorization: Bearer <token>`（可选，从 localStorage 读取） |
| **Content-Type** | `application/json` |
| **Token Switch Key** | `ErtveAQybj1XCVRsncebuiIYzTxUV0tganVf4bMijr5SKVzU` |

---

## 接口列表总览

| # | 方法 | 端点 | 用途 | 场景 |
|---|------|------|------|------|
| 1 | GET | `/models` | 获取模型列表 | 初始化/刷新模型 |
| 2 | POST | `/generate?sync=true` | 同步生成任务 | 图片/视频/数字人生成 |
| 3 | GET | `/generate/task/{taskId}` | 查询任务状态 | 异步轮询（已注释） |
| 4 | POST | `/tasks/{taskId}/cancel` | 取消任务 | 用户中止生成 |
| 5 | GET | TokenSwitch视频URL | 获取受保护视频 | vendor_b 视频播放 |

---

## 1. 获取模型列表

### 请求

```
GET /api/v1/models
Authorization: Bearer <token>（可选）
```

### 响应

```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "summary": {
            "total_image_models": 11,
            "total_video_models": 21,
            "total_voices": 9,
            "vendors": ["vendor_a", "vendor_b"]
        },
        "image_models": [
            {
                "id": "kling_3_0",
                "name": "Kling 3.0",
                "description": "模型描述",
                "vendor": "vendor_a",
                "vendor_name": "腾讯云 VOD",
                "is_new": false,
                "is_vip": false
            },
            {
                "id": "gpt-image-2",
                "name": "GPT Image 2",
                "description": "text_to_image",
                "vendor": "vendor_b",
                "vendor_name": "Token Switch",
                "is_new": false,
                "is_vip": false
            }
        ],
        "video_models": [
            {
                "id": "seedance_2_0_fast",
                "name": "Seedance 2.0-fast",
                "description": "模型描述",
                "vendor": "vendor_a",
                "vendor_name": "腾讯云 VOD",
                "is_new": false,
                "is_vip": false
            },
            {
                "id": "happyhorse-1.0-video-edit-720p",
                "name": "HappyHorse 1.0 Video Edit 720p (Image)",
                "description": "image_edit",
                "vendor": "vendor_b",
                "vendor_name": "Token Switch",
                "is_new": false,
                "is_vip": false
            }
        ],
        "voices": [
            {
                "id": "voice_001",
                "name": "默认音色",
                "description": "标准女声"
            }
        ]
    }
}
```

### 前端调用代码

```javascript
async function fetchModels() {
    const response = await fetch(`${API_CONFIG.BASE_URL}/models`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
    });
    const data = await response.json();
    if (data.code !== 200) throw new Error(data.message);
    globalModels = data.data || { image_models: [], video_models: [], voices: [] };
    return globalModels;
}
```

---

## 2. 同步生成任务（核心接口）

### 请求

```
POST /api/v1/generate?sync=true
Content-Type: application/json
Authorization: Bearer <token>（可选）
```

### ⭐ model 字段取值规则（重要！）

| vendor | model 字段取值 | 示例 |
|--------|---------------|------|
| **vendor_a** (腾讯云 VOD) | 用 **`name`** | `"Kling 3.0"` |
| **vendor_b** (Token Switch) | 用 **`id`** | `"gpt-image-2"` |

```typescript
const submitModel = selectedModel.vendor === 'vendor_a'
    ? selectedModel.name   // vendor_a → name
    : selectedModel.id;    // vendor_b → id
```

---

### 2.1 图片生成请求体

#### 文生图（无文件上传）

```json
{
    "output_type": "image",
    "model": "Kling 3.0",
    "vendor": "vendor_a",
    "feature": "text_to_image",
    "parameters": {
        "resolution": "1080P",
        "ratio": "1:1",
        "count": 1
    },
    "prompt": "一只可爱的猫咪在草地上奔跑",
    "input_files": []
}
```

#### 图生图（有文件上传，单张）

```json
{
    "output_type": "image",
    "model": "Kling 3.0",
    "vendor": "vendor_a",
    "feature": "image_reference",
    "parameters": {
        "resolution": "1080P",
        "ratio": "16:9",
        "count": 1
    },
    "prompt": "将图片风格转换为油画效果",
    "input_files": [
        {
            "type": "image",
            "url": "data:image/jpeg;base64,/9j/4AAQ...",
            "purpose": "reference",
            "object_id": "image_1"
        }
    ]
}
```

#### feature 可选值（图片）

| feature | 说明 | 是否需要 input_files |
|---------|------|---------------------|
| `text_to_image` | 文生图 | 否 |
| `image_reference` | 图生图/参考图 | 是 |
| `image_edit` | 图片编辑 | 是 |
| `image_inpainting` | 图片局部重绘 | 是 |
| `image_upscale` | 图片超分辨率 | 是 |
| `image_style_transfer` | 风格迁移 | 否/可选 |
| `image_remove_bg` | 抠图 | 是 |
| `image_extend` | 图片扩展 | 是 |

#### parameters 参数说明（图片）

| 参数 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| resolution | string | `480P`, `720P`, `1080P`, `2K`, `4K` | `1080P` | 分辨率 |
| ratio | string | `1:1`, `4:3`, `3:4`, `16:9`, `9:16` | `1:1` | 宽高比 |
| count | number | `1`~`4` | `1` | 生成数量 |

---

### 2.2 视频生成请求体

#### 文生视频（无文件上传）

```json
{
    "output_type": "video",
    "model": "Kling 3.0",
    "vendor": "vendor_a",
    "feature": "text_to_video",
    "parameters": {
        "resolution": "1080P",
        "duration": 5,
        "ratio": "16:9"
    },
    "prompt": "让画面动起来，一只猫在追蝴蝶",
    "input_files": []
}
```

#### 单图参考生视频

```json
{
    "output_type": "video",
    "model": "kling_3_0_omni",
    "vendor": "vendor_a",
    "feature": "global_reference",
    "parameters": {
        "resolution": "1080P",
        "duration": 8,
        "ratio": "16:9"
    },
    "prompt": "让 <<<image_1>>> 动起来",
    "input_files": [
        {
            "type": "image",
            "url": "data:image/jpeg;base64,/9j/4AAQ...",
            "purpose": "reference",
            "object_id": "image_1"
        }
    ]
}
```

#### 多图参考生视频

```json
{
    "output_type": "video",
    "model": "kling_3_0_omni",
    "vendor": "vendor_a",
    "feature": "multi_reference",
    "parameters": {
        "resolution": "1080P",
        "duration": 8,
        "ratio": "16:9"
    },
    "prompt": "让 <<<image_1>>> 和 <<<image_2>>> 一起跳舞",
    "input_files": [
        {
            "type": "image",
            "url": "data:image/jpeg;base64,/9j/4AAQ...",
            "purpose": "reference",
            "object_id": "image_1"
        },
        {
            "type": "image",
            "url": "data:image/jpeg;base64,iVBORw0KGgo...",
            "purpose": "reference",
            "object_id": "image_2"
        },
        {
            "type": "image",
            "url": "data:image/jpeg;base64,R0lGODlh...",
            "purpose": "reference",
            "object_id": "image_3"
        }
    ]
}
```

#### 视频上传生视频（首帧参考）

```json
{
    "output_type": "video",
    "model": "gv_3_1",
    "vendor": "vendor_a",
    "feature": "global_reference",
    "parameters": {
        "resolution": "1080P",
        "duration": 5,
        "ratio": "16:9"
    },
    "prompt": "让画面动起来",
    "input_files": [
        {
            "type": "video",
            "url": "data:video/mp4;base64,AAAAIGZ0eXB...（超长Base64）",
            "purpose": "reference",
            "object_id": "video_1"
        }
    ]
}
```

#### feature 可选值（视频）

| feature | 说明 | 是否需要 input_files |
|---------|------|---------------------|
| `text_to_video` | 文生视频 | 否 |
| `global_reference` | 全局参考（单图/单视频） | 是（1个） |
| `multi_reference` | 多图参考 | 是（≥2个） |
| `lip_sync` | 口型同步 | 是（音频+图片/视频） |
| `motion_control` | 运动控制 | 是 |
| `template_effect` | 模板特效 | 否/可选 |
| `style_replace` | 风格替换 | 是 |
| `object_repair` | 物品修复 | 是 |
| `object_replace` | 人物/物品替换 | 是 |

#### parameters 参数说明（视频）

| 参数 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| resolution | string | `480P`, `720P`, `1080P`, `2K`, `4K` | `1080P` | 分辨率 |
| duration | number | `2`~`120` | `5` | 时长(秒) |
| ratio | string | `16:9`, `9:16`, `1:1` | `16:9` | 宽高比 |
| face_id | number | `0` | `0` | 人脸ID（lip_sync用） |
| audio_start_time | number | `0`~ | `0` | 音频起始时间(s) |
| audio_volume | number | `0.0`~`2.0` | `1.0` | 音频音量 |
| original_audio_volume | number | `0.0`~`1.0` | `0.0` | 原始音频音量 |
| keep_original_sound | string | `yes`, `no` | `no` | 保留原声 |
| template | string | `morphlab` 等 | - | 模板名称 |

---

### 2.3 数字人生成请求体

```json
{
    "output_type": "digital_human",
    "model": "kling_2.6",
    "vendor": "vendor_a",
    "feature": "digital_human",
    "parameters": {
        "voice_id": "voice_001",
        "action_description": "挥手打招呼"
    },
    "prompt": "你好，欢迎来到我们的平台",
    "input_files": []
}
```

---

### 2.4 通用响应格式

#### 成功响应（图片）

```json
{
    "code": 200,
    "message": "生成成功",
    "data": {
        "task_id": "task_2026051519065640_2746448628704",
        "type": "image",
        "status": "completed",
        "progress": 100,
        "result": {
            "images": [
                {
                    "id": "img_001",
                    "url": "https://cdn.example.com/generated/image.png"
                }
            ]
        }
    }
}
```

#### 成功响应（视频 - vendor_a）

```json
{
    "code": 200,
    "message": "查询成功",
    "data": {
        "task_id": "task_xxx",
        "type": "video",
        "status": "completed",
        "progress": 100,
        "result": {
            "video": {
                "id": "video_001",
                "url": "https://vod.example.com/output/video.mp4",
                "thumbnail": "",
                "duration": null
            }
        }
    }
}
```

#### 成功响应（视频 - vendor_b / Gemini 图片返回 base64）

```json
{
    "code": 200,
    "message": "成功",
    "data": {
        "task_id": "task_2026051519065640_2746448628704",
        "type": "image",
        "status": "completed",
        "progress": 100,
        "result": {
            "images": [{
                "id": "img_001",
                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABWAAAAAMACAIATAAAA..."
            }]
        }
    }
}
```

#### 成功响应（视频 - vendor_b 受保护URL）

```json
{
    "code": 200,
    "message": "查询成功",
    "data": {
        "task_id": "task_xxx",
        "type": "video",
        "status": "completed",
        "progress": 100,
        "result": {
            "video_url": "https://neolink.com/api/v1/videos/{task_id}/content"
        }
    }
}
```

#### 错误响应

```json
{
    "code": 400,
    "message": "参数错误：model 不能为空",
    "data": null
}
```

或

```json
{
    "code": 500,
    "message": "后台任务执行失败",
    "data": null
}
```

---

## 3. 查询任务状态（异步轮询）

> 当前已注释掉轮询功能，使用同步模式。保留此接口文档以备后续启用。

### 请求

```
GET /api/v1/generate/task/{taskId}
Authorization: Bearer <token>（可选）
```

### 响应

```json
{
    "code": 200,
    "message": "查询成功",
    "data": {
        "task_id": "task_xxx",
        "status": "processing",     // processing | completed | failed
        "progress": 65,             // 0-100
        "result": null              // 完成时有值
    }
}
```

### 前端轮询代码（已注释）

```javascript
async function pollTaskStatus(taskId, maxAttempts = 30, signal = null) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/generate/task/${taskId}`, {
            method: 'GET', headers: {}, signal
        });
        const data = await response.json();
        if (data.data?.status === 'completed' || data.data?.status === 'failed') {
            return data.data;
        }
        await new Promise(r => setTimeout(r, 5000));  // 每5秒查一次
    }
    throw new Error('轮询超时');
}
```

---

## 4. 取消任务

### 请求

```
POST /api/v1/tasks/{taskId}/cancel
Content-Type: application/json
Authorization: Bearer <token>（可选）
```

### 响应

```json
{
    "code": 200,
    "message": "任务已取消",
    "data": null
}
```

---

## 5. Token Switch 受保护视频访问

> 仅用于 vendor_b (Token Switch) 的视频播放。生产环境应由后端代理。

### 访问方式

```
GET {result.video.url}  （即 https://neolink.com/api/v1/videos/{task_id}/content）
Authorization: Bearer ErtveAQybj1XCVRsncebuiIYzTxUV0tganVf4bMijr5SKVzU
```

### ⚠️ 重要限制

- **不能直接** `<video src="url">` 使用（浏览器无法带自定义 Header）
- 必须 **fetch → blob → ObjectURL** 再赋给 `<video>`

### 前端实现

```javascript
async function fetchProtectedVideo(videoUrl) {
    const response = await fetch(videoUrl, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${VENDOR_B_API_KEY}`
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);  // 返回 blob URL 给 <video>
}

// 使用
const blobUrl = await fetchProtectedVideo(videoUrl);
videoElement.src = blobUrl;  // ✅ 可以正常播放
```

---

## 6. Seedance 素材库资源引用（media_id）

> Seedance 2.0 系列模型不允许直接上传含人脸的参考图/视频。需先将人像素材上传到素材库，再通过 `media_id` 引用。后端自动注册到 Neolink 资源库，用 `Asset://tkres_xxx` 协议提交给 Seedance。
>
> **注意**：`"seedance快捷通道"` 分组的 API Key 不需要走资源库，直接传 http URL 即可。

### 6.1 适用模型

| 模型 | 可引用 image | 可引用 video | 可引用 audio |
|---|---|---|---|
| `doubao-seedance-2-0-260128` | ✅ | ✅ | ✅ |
| `doubao-seedance-2-0-fast-260128` | ✅ | ✅ | ✅ |

### 6.2 前端关键变化

1. 用户在素材库管理界面**勾选素材**（不再让用户粘贴 URL）
2. 请求体 `input_files[]` / `references[]` 元素新增 `media_id` 字段
3. `url` / `image_url` / `video_url` 字段可保留也可去掉，后端做兼容

**字段优先级**：
- `media_id` + `url` 都有 → 优先用 `media_id`，忽略 `url`
- 只有 `media_id` → 走素材库资源化路径
- 只有 `url` → 走旧路径（http URL 直接提交，适合非人脸）

### 6.3 请求示例

```jsonc
// Seedance 生成 - 引用素材库素材
{
  "output_type": "video",
  "model": "seedance_2.0",
  "vendor": "vendor_b",
  "feature": "multi_reference",
  "prompt": "让图片1中的人做视频1的蛋糕",
  "parameters": {
    "duration": 11,
    "ratio": "16:9",
    "generate_audio": true
  },
  "input_files": [
    {
      "type": "image",
      "media_id": "MEDIA-IMG-002",     // ← 素材库 media_id
      "purpose": "reference",
      "object_id": "image_1"
    },
    {
      "type": "video",
      "media_id": "MEDIA-VID-005",     // ← 视频素材同理
      "purpose": "reference",
      "object_id": "video_1"
    }
  ]
}
```

### 6.4 references[] / input_files[] 元素结构

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---|---|
| `media_id` | string | **推荐必填**（人脸场景） | 我方素材库中的 `media_id`，形如 `MEDIA-IMG-002` |
| `url` | string | 兼容旧字段 | 传了会被忽略；保留不影响后端 |
| `type` | string | ✅ 必填 | `image` / `video` / `audio` |
| `role` | string | 推荐 | `reference_image` / `reference_video` / `reference_audio` / `first_frame` / `last_frame`，默认按 `type` 推 |
| `purpose` | string | 否 | 固定值 `reference` |
| `object_id` | string | 否 | 用于 prompt 引用，如 `image_1` |

### 6.5 端到端流程

```
用户在前端:
  1) 打开素材库,选一张人像图 → 点击"用于 Seedance"
  2) 选模型 seedance_2.0,填 prompt,点"生成"
  3) 前端调用 POST /api/v1/generate?sync=true,input_files[] 含 media_id
       ↓
后端 vendor_b._generate_video_seedance:
  4) 遍历 input_files[] 中所有带 media_id 的元素
  5) 调用 SeedanceResourceService.ensure_seedance_resource(media_id)
     ├─ 查 media_library.seedance_resource_uuid (已注册?)
     ├─ 没有 → 调 Neolink POST /api/model-resources 注册
     ├─ 轮询 GET /api/model-resources/{uuid} 直到 status=1 (可用)
     ├─ 写回 media_library.seedance_resource_uuid
     └─ 返回 "Asset://tkres_xxx"
  6) 改写 references 元素为 {"image_url": {"url": "Asset://tkres_xxx"}}
       ↓
Neolink 上游:
  收到 Asset://tkres_xxx,识别为已授权素材,正常生成
```

### 6.6 性能 & 缓存

- **首次调用**（media_id 没注册过）：需要 1-30s 等 Neolink 同步人像资源
- **第二次以后**（同一 media_id）：直接命中 `seedance_resource_uuid` 字段，**毫秒级返回**
- 进程重启后也命中持久化字段，不会重新注册

### 6.7 边界 & 错误处理

| 场景 | 行为 | 前端处理建议 |
|---|---|---|
| media_id 不存在 | 该 ref 保留原样，Seedance 报缺图则错误透传 | 搜索错误码 `[SeedanceResource] media_id 不存在` |
| Neolink 同步超 30s / failed | 整次调用标记失败，前端拿到 5xx | 弹"资源同步超时，请稍后再试" |
| 不传 media_id 只传 url | 后端原样透传 URL | 适用于非人脸素材（风景、产品图） |
| 素材被软删 | seedance_resource_uuid 不清空，但查不到行 → 等价于没传 | 等价于不传，Seedance 报缺图 |

### 6.8 UI 集成建议

**素材库列表加"用于 Seedance"按钮**：

```vue
<el-button
  v-if="row.media_type === 'image' || row.media_type === 'video'"
  size="small"
  @click="$emit('select-for-seedance', row)"
>
  用于 Seedance
</el-button>
```

**生成页加"引用素材库"面板**：将用户选中的 `media_id[]` 渲染成 chip 列表，带删除按钮。

### 6.9 相关配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `SEEDANCE_RESOURCE_LIBRARY_ENABLED` | `true` | 是否启用素材库资源化路径。快捷通道场景设为 `false` |

---

## 特殊处理规则汇总

### 1. Base64 图片处理（Gemini 等 vendor_b 模型）

部分模型返回的图片 URL 是 base64 data URI 格式：
```
data:image/png;base64,iVBORw0KGgoAAAA...
```

前端需自动转换为 blob URL 以优化性能：

```javascript
function convertBase64ToBlobUrl(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(parts[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return URL.createObjectURL(new Blob([u8arr], { type: mime }));
}
```

### 2. 大文件上传动态超时

| 请求体大小 | 超时时间 |
|-----------|---------|
| < 1 MB | 120 秒 |
| 1 ~ 10 MB | 300 秒（5分钟） |
| > 10 MB | 600 秒（10分钟） |

### 3. 文件上传格式

所有上传文件统一转为 **Base64 Data URL**：

```javascript
// 本地文件读取
reader.readAsDataURL(file);  // 结果: "data:image/png;base64,..."

// input_files 结构（标准模式 - 传 URL）
{
    type: "image" | "video" | "audio",
    url: "data:...;base64,...",      // Base64 Data URL 或 blob URL
    purpose: "reference",             // 固定值
    object_id: "image_1" | "video_1"  // 用于 prompt 引用
}

// input_files 结构（素材库模式 - 传 media_id，适用于 Seedance 人脸场景）
{
    type: "image" | "video" | "audio",
    media_id: "MEDIA-IMG-002",        // ← 素材库 media_id，传了优先于 url
    purpose: "reference",
    object_id: "image_1"
}
```

> **Seedance 2.0 人脸素材**：含人脸的参考图/视频不能直接传 URL，必须先上传到素材库再通过 `media_id` 引用。详见 [§6 Seedance 素材库资源引用](#6-seedance-素材库资源引用media_id)。

### 4. 多文件自动 feature 切换

| 上传文件数 | 自动切换 feature | prompt 处理 |
|-----------|-----------------|-------------|
| 0 个 | 用户手动选择 refMode | 原样发送 |
| 1 个 | `global_reference` | 原样发送 |
| ≥ 2 个 | `multi_reference` | 追加 `<<<image_1>>> 和 <<<image_2>>>` |

---

## 厂商对照表

| vendor | 名称 | model 提交值 | 视频 URL 处理 | 图片返回格式 |
|--------|------|-------------|--------------|------------|
| **vendor_a** | 腾讯云 VOD | `name` | 直接使用 | 普通 URL |
| **vendor_b** | Token Switch | `id` | fetch + Bearer → blob | 可能是 Base64 |

---

## 接口调用流程图

```
┌─────────────┐
│  页面加载    │
└──────┬──────┘
       ▼
┌──────────────────────────┐
│ GET /models              │ ← 获取模型列表（含厂商信息）
│ → 缓存到 globalModels    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 用户操作：               │
│ 1. 选择场景（图/视频/数人）│
│ 2. 选择模型              │
│ 3. 输入 prompt           │
│ 4. 上传文件（可选）       │
└────────────┬─────────────┘
             ▼
┌──────────────────────────────────────────┐
│ 点击发送按钮                              │
│ → buildGenerateRequest() 构建请求体       │
│   • 按 vendor 选择 model 字段值          │
│   • 自动判断 feature                     │
│   • 构建 input_files 数组                │
└────────────┬─────────────────────────────┘
             ▼
┌──────────────────────────────────────────┐
│ POST /generate?sync=true                 │
│ → postJson() 发送请求（带动态超时）       │
└────────────┬─────────────────────────────┘
             ▼
┌──────────────────────────────────────────┐
│ 接收响应                                  │
│ → extractResultFromData() 提取结果        │
│ → renderTaskResult() 渲染结果             │
│   • 图片: 自动转换 base64 → blob         │
│   • 视频(vendor_b): fetch + Bearer → blob│
│   • 视频(vendor_a): 直接渲染             │
└──────────────────────────────────────────┘
```
