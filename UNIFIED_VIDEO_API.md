# 统一视频生成接口文档

## 概述

统一视频生成接口 (`POST /api/v1/generate/video`) 是一个强大的接口，通过不同参数组合实现所有视频生成功能。

### 设计理念

腾讯云 VOD AIGC API 本质上是一个统一的 `CreateAigcVideoTask` 接口，通过不同参数组合实现不同功能。我们的统一接口遵循这一设计，让前端可以：

1. **自由组合功能** - 图生视频 + 智能分镜、动作控制 + 多图参考等
2. **简化调用** - 一个接口完成所有视频生成需求
3. **易于扩展** - 新功能只需添加参数，无需新端点

## 接口信息

- **端点**: `POST /api/v1/generate/video`
- **请求格式**: JSON
- **响应格式**: JSON
- **认证**: 无（开发阶段）

## 基础参数

所有请求都需要这些基础参数：

```json
{
  "prompt": "提示词（multi_shot=true时无效）",
  "model": "模型ID",
  "ratio": "比例（16:9, 9:16, 1:1等）",
  "resolution": "分辨率（480P, 720P, 1080P, 2K, 4K）",
  "duration": 5,
  "audio_generation": false
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 否 | 提示词，描述视频内容（智能分镜时无效） |
| model | string | 是 | 模型ID，如 kling_3.0, gv_3.1 |
| ratio | string | 否 | 比例，默认 16:9 |
| resolution | string | 否 | 分辨率，默认 1080P |
| duration | integer | 否 | 时长（秒），默认 5，范围 1-15 |
| audio_generation | boolean | 否 | 是否生成音频，默认 false |

## 功能组合

### 1. 文生视频（最简单）

只需要基础参数：

```json
{
  "prompt": "城市夜景，霓虹灯闪烁，车流穿梭",
  "model": "kling_3.0",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 5
}
```

### 2. 图生视频

添加 `references` 参数（单张图片）：

```json
{
  "prompt": "让画面中的云朵缓缓飘动",
  "model": "gv_3.1",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 5,
  "references": [
    {
      "url": "https://example.com/landscape.jpg",
      "type": "image"
    }
  ]
}
```

**支持的图片格式**:
- URL: `https://example.com/image.jpg`
- Base64: `data:image/jpeg;base64,/9j/4AAQ...`

### 3. 首末帧生成视频

使用 `start_frame` 和 `end_frame` 参数：

```json
{
  "prompt": "平滑过渡",
  "model": "kling_2.1",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 5,
  "start_frame": "https://example.com/frame1.jpg",
  "end_frame": "https://example.com/frame2.jpg"
}
```

**支持的模型**: GV 3.1, Kling 2.1 (1080P), Vidu q2-pro/q2-turbo

### 4. 多图/多视频参考

使用 `references` 参数（多个文件）：

```json
{
  "prompt": "让 <<<image_1>>> 牵着 <<<image_2>>> 转圈圈",
  "model": "kling_3.0_omni",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 8,
  "references": [
    {
      "url": "https://example.com/person1.jpg",
      "type": "image",
      "object_id": "image_1"
    },
    {
      "url": "https://example.com/person2.jpg",
      "type": "image",
      "object_id": "image_2"
    }
  ]
}
```

**ReferenceFile 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `media_id` | string | 否（人脸场景推荐必填） | 我方素材库的 `media_id`（如 `MEDIA-IMG-002`）。传了优先走素材库资源化路径，适用于含人脸素材。详见 [§4.2 Seedance 素材库资源引用](#42-seedance-素材库资源引用media_id) |
| url | string | 否 | 文件URL或base64。`media_id` 和 `url` 都有 → 优先用 `media_id`；只有 `url` → 走旧路径（适合非人脸素材） |
| type | string | 是 | 文件类型：`image` / `video` / `audio`（Seedance 2.0 支持 audio 参考） |
| object_id | string | 否 | 主体ID，用于在Prompt中引用 |
| reference_type | string | 否 | 参考类型：asset/style/feature/base |
| voice_id | string | 否 | 音色ID（Vidu专用） |
| keep_original_sound | boolean | 否 | 是否保留原声 |
| **role** | string | 否 | **Seedance 2.0 多模态参考角色**：`reference_image` / `reference_video` / `reference_audio` / `first_frame` / `last_frame`。不传则按 `type` 自动推断 |

### 4.1 Seedance 2.0 多模态参考（推荐）

Seedance 2.0 / 2.0-fast 系列（豆包视频生成）支持多模态参考：**图片 + 视频 + 音频** 同时作为参考，每个参考可带 `role` 字段区分语义。

**端点**：`POST /api/v1/generate?sync=true` 或 `/api/v1/generate/video/multi-reference`

**支持的模型**：

- `seedance_2.0` — 5s / 10s，标准版
- `seedance_2.0_fast` — 5s / 10s / 11s，快版

**完整请求示例**（图片+视频+音频参考 + 首帧/末帧 + 音频生成）：

```bash
curl -X POST "http://localhost:8003/api/v1/generate?sync=true" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "vendor_b",
    "model_type": "video",
    "model_name": "seedance_2.0_fast",
    "prompt": "全程使用视频1的第一视角构图，全程使用音频1作为背景音乐。...",
    "parameters": {
      "ratio": "16:9",
      "duration": 11,
      "watermark": true,
      "generate_audio": true,
      "references": [
        {
          "url": "https://example.com/first_frame.jpg",
          "type": "image",
          "role": "first_frame"
        },
        {
          "url": "https://example.com/last_frame.jpg",
          "type": "image",
          "role": "last_frame"
        },
        {
          "url": "https://example.com/character.jpg",
          "type": "image",
          "role": "reference_image"
        },
        {
          "url": "https://example.com/style_video.mp4",
          "type": "video",
          "role": "reference_video"
        },
        {
          "url": "https://example.com/bgm.mp3",
          "type": "audio",
          "role": "reference_audio"
        }
      ]
    }
  }'
```

**References 字段对照**：

| `type` | 默认 `role` | 可选 `role` | 说明 |
|--------|------------|-------------|------|
| `image` | `reference_image` | `reference_image` / `first_frame` / `last_frame` | 首帧/末帧用独立 role 区分 |
| `video` | `reference_video` | `reference_video` | 运镜/动作参考 |
| `audio` | `reference_audio` | `reference_audio` | 背景音/音调参考（Seedance 2.0 起支持） |

**Parameters 字段对照**（Seedance 2.0 专属）：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `ratio` | string | `16:9` | 视频比例：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` / `21:9` |
| `duration` | int(5/10/11) | 5 | 时长（秒） |
| `watermark` | bool | — | 是否叠加火山方舟水印 |
| `generate_audio` | bool | true | 是否生成同步音频（Seedance 2.0 起默认 true） |
| `sound` | bool | — | 同 `generate_audio` 别名 |
| `audio_generation` | string | — | 同 `generate_audio`，但用 `"Enabled"` / `"Disabled"` |

**content 转换后端实际调用方**：

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    {"type": "text", "text": "全程使用视频1的第一视角构图..."},
    {"type": "image_url", "image_url": {"url": "https://..."}, "role": "first_frame"},
    {"type": "image_url", "image_url": {"url": "https://..."}, "role": "last_frame"},
    {"type": "image_url", "image_url": {"url": "https://..."}, "role": "reference_image"},
    {"type": "video_url", "video_url": {"url": "https://..."}, "role": "reference_video"},
    {"type": "audio_url", "audio_url": {"url": "https://..."}, "role": "reference_audio"}
  ],
  "parameters": {
    "ratio": "16:9",
    "duration": 11,
    "watermark": true,
    "generate_audio": true
  }
}
```

**向后兼容**：

- `references[].type` 仍支持 `image` / `video`，原有调用方无需改动
- `reference_image` / `reference_video` / `reference_audio` 顶层参数仍可单独传
- `start_frame` / `end_frame` 顶层参数仍可单独传，会自动映射为 `role=first_frame` / `last_frame`
- 显式 `role` 不在该 kind 允许集合中时，自动 fallback 到默认 role（不报错）

**Python SDK 等价调用**（参考）：

```python
from volcenginesdkarkruntime import Ark

client = Ark(base_url='https://ark.cn-beijing.volces.com/api/v3',
             api_key=os.environ.get("ARK_API_KEY"))

result = client.content_generation.tasks.create(
    model="doubao-seedance-2-0-260128",
    content=[
        {"type": "text", "text": "全程使用视频1的第一视角构图..."},
        {"type": "image_url", "image_url": {"url": "https://..."}, "role": "reference_image"},
        {"type": "video_url", "video_url": {"url": "https://..."}, "role": "reference_video"},
        {"type": "audio_url", "audio_url": {"url": "https://..."}, "role": "reference_audio"},
    ],
    generate_audio=True,
    ratio="16:9",
    duration=11,
    watermark=True,
)
```

### 4.2 Seedance 素材库资源引用（media_id）

Seedance 2.0 系列模型（`doubao-seedance-2-0-260128` / `doubao-seedance-2-0-fast-260128`，走 Token Switch / neolink）**不允许直接上传含人脸的参考图/视频**。为了合规使用人像素材，平台推出了**素材库授权**方案：

- 用户先把人像素材上传到我方素材库（等同一次普通上传）
- Seedance 调用时，引用素材库里的素材（用 `media_id`）
- 后端自动把素材注册到 Neolink 资源库，拿到 `tkres_xxx` 形式的资源 UUID
- 用 `Asset://tkres_xxx` 协议提交给 Seedance

> **注意**：`"seedance快捷通道"` 分组的 API Key **不需要**走资源库，直接传 http URL 即可。本文档针对的是非快捷通道（当前 `.env` 中 `VENDOR_B_API_KEY` 对应的通道）。

#### 请求示例（传 media_id）

```jsonc
// ✅ 新写法：用户从素材库选素材，前端传 media_id
{
  "model": "doubao-seedance-2-0-260128",
  "prompt": "让图片1中的人做视频1的蛋糕",
  "parameters": {
    "duration": 11,
    "ratio": "16:9",
    "references": [
      {
        "media_id": "MEDIA-IMG-002",     // ← 新字段：我方素材库的 media_id
        "type": "image",
        "role": "reference_image"
      },
      {
        "media_id": "MEDIA-VID-005",     // ← 视频素材同理
        "type": "video",
        "role": "reference_video"
      }
    ]
  }
}
```

#### references[] 元素结构

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---|---|
| `media_id` | string | **推荐必填**（人脸场景） | 我方素材库中的 `media_id`，形如 `MEDIA-IMG-002` |
| `url` | string | 兼容旧字段 | 如果传了，会被忽略；保留不影响后端 |
| `image_url` / `video_url` / `audio_url` | object | 兼容旧字段 | 同上 |
| `type` | string | ✅ 必填 | `image` / `video` / `audio` |
| `role` | string | 推荐 | `reference_image` / `reference_video` / `reference_audio` / `first_frame` / `last_frame`，默认按 `type` 推 |

**字段优先级**：
- `media_id` + `url` 都有 → 优先用 `media_id`，忽略 `url`
- 只有 `media_id` → 走素材库资源化路径
- 只有 `url` → 走旧路径（http URL 直接提交，适合非人脸）

#### 端到端流程

```
┌──────────────────────────────────────────────────────────────────────┐
│ 用户在前端:                                                           │
│   1) 打开素材库,选一张人像图 → 点击"用于 Seedance"                       │
│   2) 选模型 doubao-seedance-2-0-260128,填 prompt,点"生成"              │
│   3) 前端调用 POST /api/v1/generate/video,references[] 含 media_id      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ 后端 vendor_b._generate_video_seedance:                                │
│   4) 遍历 references[] 中所有带 media_id 的元素                        │
│   5) 调用 SeedanceResourceService.ensure_seedance_resource(media_id) │
│      ├─ 查 media_library.seedance_resource_uuid(已注册?)                │
│      ├─ 没有 → 调 Neolink POST /api/model-resources 注册              │
│      ├─ 轮询 GET /api/model-resources/{uuid} 直到 status=1(可用)     │
│      ├─ 写回 media_library.seedance_resource_uuid                      │
│      └─ 返回 "Asset://tkres_xxx"                                       │
│   6) 改写 references 元素:                                             │
│      {"media_id": "MEDIA-IMG-002", "type": "image", "role": "..."}    │
│      →  {"type": "image", "role": "...",                               │
│          "image_url": {"url": "Asset://tkres_xxx"}}                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│ Neolink 上游:                                                          │
│   收到 Asset://tkres_xxx,识别为已授权素材,正常生成                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 性能 & 缓存说明

- **首次调用**（media_id 还没注册过）：需要 1-30s 等 Neolink 同步人像资源
- **第二次以后**（同一 media_id）：直接命中 `media_library.seedance_resource_uuid` 字段，**毫秒级返回**
- 进程重启后第一次调用也会命中字段（已持久化），不会重新注册

也就是说：**只要 media_id 注册过一次，后续永远秒级**。

#### 边界 & 错误处理

**媒体 ID 不存在**：传的 `media_id` 在我方素材库查不到 → 该 ref 保留原样（`url` 还在就走 URL，没有就忽略），Seedance 上游如果因此报缺图，错误信息透传到前端。

**Neolink 资源同步失败**：Neolink 同步超 30s 或状态变 `failed` → 整次 Seedance 调用被标记为失败，前端拿到 5xx。

**用户绕过素材库直接传 URL**：`references[]` 元素没有 `media_id` 字段时，后端原样透传 `url` 给 Seedance，适用于非人脸素材（风景、产品图）以及"seedance 快捷通道"分组。

**删除素材的影响**：用户在素材库删除素材 → `status='deleted'`，`seedance_resource_uuid` 字段不会自动清空。已删除素材的 `media_id` 在 `ensure_seedance_resource` 里查不到行，走"媒体 ID 不存在"路径，原样跳过。

#### 相关配置

- 开关：`SEEDANCE_RESOURCE_LIBRARY_ENABLED`（默认 `true`，在 `.env` 配置）
  - `true`：走素材库资源化路径（非快捷通道场景）
  - `false`：跳过资源化，直接传 URL（快捷通道场景）
- 后端服务：`app/services/seedance_resource_service.py`
- 后端客户端：`app/vendors/seedance_resource_client.py`
- 集成点：`app/vendors/vendor_b.py`（`_generate_video_seedance`）
- 数据库字段：`database/sql/schema/35_media_library_seedance_uuid.sql`

### 5. 智能分镜

使用 `multi_shot`, `shot_type`, `multi_prompt` 参数：

```json
{
  "model": "kling_3.0",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 10,
  "multi_shot": true,
  "shot_type": "customize",
  "multi_prompt": [
    {
      "index": 1,
      "prompt": "公园长椅上，阳光透过树叶洒下",
      "duration": 5
    },
    {
      "index": 2,
      "prompt": "雨夜街道，汽车疾驰而过，车灯闪烁",
      "duration": 5
    }
  ]
}
```

**智能分镜参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| multi_shot | boolean | 是 | 是否多镜头 |
| shot_type | string | 是 | 分镜方式：customize/intelligence |
| multi_prompt | array | 是 | 分镜列表（1-6个） |

**ShotPrompt 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| index | integer | 是 | 分镜序号（1-6） |
| prompt | string | 是 | 分镜提示词（最多512字符） |
| duration | integer | 是 | 分镜时长（秒） |

**注意事项**:
- 所有分镜时长之和必须等于总时长
- 当 `multi_shot=true` 时，顶层 `prompt` 参数无效
- 最多支持 6 个分镜

### 6. 图生视频 + 智能分镜（组合功能）

```json
{
  "model": "kling_3.0",
  "ratio": "16:9",
  "resolution": "1080P",
  "duration": 10,
  "references": [
    {
      "url": "https://example.com/character.jpg",
      "type": "image",
      "object_id": "image"
    }
  ],
  "multi_shot": true,
  "shot_type": "customize",
  "multi_prompt": [
    {
      "index": 1,
      "prompt": "参考<<<image_1>>>，微笑着向我走来",
      "duration": 5
    },
    {
      "index": 2,
      "prompt": "参考<<<image_1>>>，转身离开",
      "duration": 5
    }
  ]
}
```

## 特殊场景

### 7. 对口型

使用 `scene_type="lip_sync"` 参数：

```json
{
  "prompt": "对口型",
  "model": "kling_2.6",
  "scene_type": "lip_sync",
  "lip_sync_video": "https://example.com/person.mp4",
  "lip_sync_audio": "https://example.com/speech.mp3",
  "face_id": 0,
  "audio_start_time": 0,
  "audio_end_time": 5000,
  "audio_insert_time": 0,
  "audio_volume": 1.0,
  "original_audio_volume": 0.0
}
```

**对口型参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scene_type | string | 是 | 固定为 "lip_sync" |
| lip_sync_video | string | 是 | 原始视频（URL或base64） |
| lip_sync_audio | string | 是 | 音频文件（URL或base64） |
| face_id | integer | 否 | 人脸ID，默认 0 |
| audio_start_time | integer | 否 | 音频开始时间（毫秒），默认 0 |
| audio_end_time | integer | 否 | 音频结束时间（毫秒） |
| audio_insert_time | integer | 否 | 音频插入时间（毫秒），默认 0 |
| audio_volume | float | 否 | 音频音量（0.0-2.0），默认 1.0 |
| original_audio_volume | float | 否 | 原始音频音量（0.0-2.0），默认 0.0 |

**推荐模型**: Kling 2.6

### 8. 动作控制

使用 `scene_type="motion_control"` 参数：

```json
{
  "prompt": "跳舞",
  "model": "kling_3.0",
  "ratio": "16:9",
  "resolution": "2K",
  "duration": 5,
  "scene_type": "motion_control",
  "references": [
    {
      "url": "https://example.com/person.jpg",
      "type": "image"
    },
    {
      "url": "https://example.com/dance.mp4",
      "type": "video"
    }
  ],
  "keep_original_sound": "no",
  "character_orientation": "image"
}
```

**动作控制参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scene_type | string | 是 | 固定为 "motion_control" |
| references | array | 是 | 参考文件（图片和/或视频） |
| keep_original_sound | string | 否 | 是否保留视频原声：yes/no |
| character_orientation | string | 否 | 人物朝向：image/video |

**推荐模型**: Kling 3.0

### 9. 特效模板

使用 `scene_type="template_effect"` 参数：

```json
{
  "prompt": "爆炸特效",
  "model": "vidu_q2_turbo",
  "ratio": "16:9",
  "resolution": "2K",
  "duration": 5,
  "scene_type": "template_effect",
  "references": [
    {
      "url": "https://example.com/object.jpg",
      "type": "image"
    }
  ],
  "template": "morphlab"
}
```

**特效模板参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scene_type | string | 是 | 固定为 "template_effect" |
| references | array | 是 | 参考图片（单张） |
| template | string | 是 | 特效模板名称，如 morphlab（爆炸） |

**推荐模型**: Vidu q2-turbo, q2-pro

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "生成任务已创建",
  "data": {
    "task_id": "task_20260511120000_123456",
    "status": "processing"
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

## 任务状态查询

使用返回的 `task_id` 查询任务状态：

```
GET /api/v1/tasks/{task_id}
```

响应示例：

```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "task_id": "task_20260511120000_123456",
    "type": "video_unified",
    "status": "completed",
    "progress": 100,
    "result": {
      "video_url": "https://example.com/result.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg"
    },
    "created_at": "2026-05-11T12:00:00Z",
    "completed_at": "2026-05-11T12:02:30Z"
  }
}
```

## 模型支持

### 推荐模型

| 功能 | 推荐模型 | 说明 |
|------|----------|------|
| 文生视频 | kling_3.0, gv_3.1 | 通用视频生成 |
| 图生视频 | gv_3.1, kling_3.0 | 图片转视频 |
| 首末帧 | kling_2.1, gv_3.1 | 首末帧过渡 |
| 多图参考 | kling_3.0_omni | 支持多主体 |
| 智能分镜 | kling_3.0 | 多镜头生成 |
| 对口型 | kling_2.6 | 人脸对口型 |
| 动作控制 | kling_3.0 | 动作迁移 |
| 特效模板 | vidu_q2_turbo | 特效生成 |

### 模型ID列表

```
# Kling 系列
- kling_1.6
- kling_2.0
- kling_2.1
- kling_2.6
- kling_3.0
- kling_3.0_omni

# GV 系列
- gv_3.1

# Vidu 系列
- vidu_q2_turbo
- vidu_q2_pro
- vidu_q3
- vidu_q3_pro

# 其他
- seedance_2.0              →  doubao-seedance-2-0-260128
- seedance_2.0_fast          →  doubao-seedance-2-0-260128 (fast mode)
- os_2.0
- hailuo_02
- hailuo_2.3
```

## 最佳实践

### 1. 参数验证

- 智能分镜时，确保所有分镜时长之和等于总时长
- 首末帧与 references 参数互斥，不能同时使用
- 场景类型（scene_type）与其他功能可能有冲突，请参考文档

### 2. 性能优化

- 使用 URL 而不是 base64 可以提高上传速度
- 合理设置分辨率和时长，避免不必要的资源消耗
- 批量任务时，使用异步模式并控制并发数

### 3. 错误处理

- 始终检查响应的 `code` 字段
- 任务失败时，查看 `message` 字段获取详细错误信息
- 实现重试机制，处理网络超时等临时错误

## 迁移指南

### 从专用端点迁移

如果你之前使用专用端点（如 `/api/v1/generate/video/text-to-video`），可以轻松迁移到统一接口：

**旧方式**:
```
POST /api/v1/generate/video/text-to-video
```

**新方式**:
```
POST /api/v1/generate/video
```

参数格式完全相同，只需更改端点URL。

### 专用端点保留

为了向后兼容，所有专用端点仍然保留，你可以继续使用它们。但我们建议新项目使用统一接口。

## 常见问题

### Q: 统一接口和专用端点有什么区别？

A: 统一接口支持功能组合（如图生视频+智能分镜），而专用端点只支持单一功能。统一接口更灵活，专用端点更简单。

### Q: 如何知道哪些功能可以组合？

A: 大部分功能都可以组合，除了：
- 首末帧与 references 互斥
- 场景类型（lip_sync, motion_control, template_effect）之间互斥

### Q: 智能分镜可以和图生视频组合吗？

A: 可以！这是统一接口的优势之一。参考示例 6。

### Q: 如何处理 base64 图片？

A: 直接在 `url` 字段传入 base64 字符串（以 `data:` 开头），后端会自动上传到腾讯云。

## 相关文档

- [前端 API 文档](./FRONTEND_API.md)
- [腾讯云 API 参数说明](./TENCENT_API_PARAMETERS.md)
- [模型数据汇总](./MODEL_DATA_SUMMARY.md)
- [图生视频指南](./IMAGE_TO_VIDEO_GUIDE.md)
- [智能分镜指南](./MULTI_SHOT_GUIDE.md)
- [对口型指南](./LIP_SYNC_GUIDE.md)
- [多图参考指南](./MULTI_REFERENCE_GUIDE.md)
