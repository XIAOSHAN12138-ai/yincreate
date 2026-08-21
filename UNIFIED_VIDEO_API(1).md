# 统一视频生成接口文档

> ## 📌 PR-4.9（2026-08-12）：模型 ID 三层语义
>
> 请求 `model` 字段继续填业务 ID（如 `gpt_image_2_tokenswitch`），后端自动解析成上游 ID 调 token switch。响应中（账单流水、任务详情、素材库）的 `model` 相关字段返回的是 **`display_name`**（展示名）。
>
> 详见 [BILLING_API.md](BILLING_API.md) 和 [MEDIA_LIBRARY_API.md](MEDIA_LIBRARY_API.md) 顶部的 PR-4.9 说明。

> ## 📌 PR-SmartRoute-Family（2026-08-20）：HappyHorse 家族聚合
>
> `GET /api/v1/models` 已支持把同名 display_name 的 HappyHorse 多功能行聚合成 1 条 entry，并暴露 `variants` map。
>
> 前端发请求时 `model` 必须填 **`business_model_id`**（从 `variants[feature].business_model_ids_by_resolution[resolution]` 取），而不是 `display_name`。详见 [`MODELS_CATALOG_SMART_ROUTE.md`](MODELS_CATALOG_SMART_ROUTE.md)。

> ## 📌 PR-A（2026-08-20）：`/api/v1/models` 字段补齐
>
> 现在每个 entry 额外带 `upstream_routes` / `variant_routes` / `description` / `input_materials` / `max_reference_images/videos/audios` / `requires_input`。
> **多素材上限 + 是否需要输入**这些种子信息前端可直接读 entry 决定 UI（不再需要写死白名单）。
> 详见 [`MODELS_CATALOG_SMART_ROUTE.md` §2.1](MODELS_CATALOG_SMART_ROUTE.md) 的字段表。

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
| url | string | 是 | 文件URL或base64 |
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
