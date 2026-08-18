# 对话消息流式端点附件字段升级需求

> 面向：后端开发、接口联调、测试  
> 涉及端点：`GET /api/v1/conversations/{conversation_id}/messages/stream`  
> 使用页面：生成页历史结果卡片  
> 优先级：高

## 1. 需求背景

生成结果卡片会展示用户在该次生成任务中上传的图片、视频和音频。前端已经支持以下交互：

- 图片：点击缩略图打开大图预览。
- 视频：显示封面或首帧，点击后打开视频播放器。
- 音频：显示音频图标，点击后打开音频播放器。

页面重新进入对话或刷新后，历史卡片通过以下流式端点恢复：

```http
GET /api/v1/conversations/{conversation_id}/messages/stream?limit=3&offset=0
```

当前精简响应中的 `uploaded_image_url` 只能表达 `attachments[0].url`，存在以下问题：

1. 只能恢复第一个附件，无法恢复多附件。
2. 字段名只能表达图片，无法判断实际是图片、视频还是音频。
3. 无法返回视频封面，历史卡片不能稳定显示视频缩略图。
4. 无法恢复附件名称、用途、对象 ID 等信息。

因此，需要在流式消息项中返回完整的 `attachments` 数组。

## 2. 总体要求

后端必须将生成请求中的全部 `input_files` 持久化到对应的用户消息，并在消息流式端点中完整返回。

数据链路应为：

```text
POST /api/v1/generate 的 input_files
    → conversation_messages.attachments（或等价的后端持久化结构）
    → GET /messages/stream 的 MessageStreamItem.attachments
    → 前端历史结果卡片
```

附件数据不得依赖浏览器 `localStorage`。用户更换浏览器、清理缓存或重新登录后，仍应能从后端恢复。

## 3. 流式响应字段要求

### 3.1 新增字段

在 `MessageStreamItem` 中新增：

```json
{
  "attachments": [
    {
      "url": "https://cdn.example.com/reference/video.mp4",
      "type": "video",
      "purpose": "reference",
      "object_id": "first_frame",
      "file_id": "FILE-xxxx",
      "name": "参考视频.mp4",
      "thumbnail_url": "https://cdn.example.com/reference/video-cover.jpg"
    }
  ]
}
```

### 3.2 附件字段定义

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `url` | string | 是 | 附件可访问地址，必须升级为 HTTPS |
| `type` | string | 是 | 枚举：`image`、`video`、`audio` |
| `purpose` | string | 否 | 附件用途，例如 `reference`、`first_frame`、`last_frame`、`audio` |
| `object_id` | string/null | 否 | 提示词引用或双上传槽位使用的对象 ID |
| `file_id` | string/null | 否 | 后端文件或素材库 ID |
| `name` | string/null | 否 | 原始文件名或展示名称 |
| `thumbnail_url` | string/null | 视频建议必填 | 视频封面地址；图片和音频可为 `null` |

### 3.3 字段归属

- `role=user`：返回该次生成请求关联的完整 `attachments`。
- `role=assistant`：`attachments` 返回空数组 `[]`；生成结果继续使用 `result_url` 和 `result_thumbnail_url`。
- `role=system`：`attachments` 返回空数组 `[]`。
- 用户消息没有上传附件时，返回空数组 `[]`，不要返回字符串或对象。

## 4. 视频封面要求

视频附件建议在上传或入库阶段生成封面，并将地址写入 `thumbnail_url`。

要求：

1. 封面应取视频首个有效画面，建议在 `0.1s` 附近截帧，避免黑帧。
2. 封面生成失败时允许 `thumbnail_url=null`，前端将直接加载视频并尝试显示首帧。
3. 封面 URL 与视频 URL 都必须能够被浏览器跨域访问。
4. URL 若为临时签名地址，过期时间必须满足历史会话展示需求；更推荐返回长期地址或在响应时刷新签名。

## 5. 数据库存储要求

生成接口接收到 `input_files` 后，必须在创建用户消息时完整保存附件数组，不能只保存第一项。

示例请求：

```json
{
  "prompt": "根据参考视频和音乐生成内容",
  "input_files": [
    {
      "url": "https://cdn.example.com/reference.mp4",
      "type": "video",
      "purpose": "reference",
      "object_id": "video_1"
    },
    {
      "url": "https://cdn.example.com/music.mp3",
      "type": "audio",
      "purpose": "audio",
      "object_id": "audio_1"
    }
  ]
}
```

重新读取对应用户消息时，两个附件都必须存在，且顺序与请求一致。

如果当前数据库已使用 JSON/JSONB 类型的 `attachments` 字段，可以直接扩展对象字段；如使用附件关联表，应保证按原始顺序稳定排序。

## 6. 推荐响应示例

```json
{
  "items": [
    {
      "id": 102,
      "message_id": "MSG-assistant-001",
      "role": "assistant",
      "content": "",
      "generation_task_id": null,
      "result_task_id": "TASK-001",
      "created_at": "2026-08-06T14:20:10+08:00",
      "model_name": "Kling 3.0",
      "feature": "video_to_video",
      "ratio": "16:9",
      "quality": "1080P",
      "duration": 5,
      "output_type": "video",
      "attachments": [],
      "result_url": "https://cdn.example.com/result.mp4",
      "result_thumbnail_url": "https://cdn.example.com/result-cover.jpg"
    },
    {
      "id": 101,
      "message_id": "MSG-user-001",
      "role": "user",
      "content": "根据参考视频和音乐生成内容",
      "generation_task_id": "TASK-001",
      "result_task_id": null,
      "created_at": "2026-08-06T14:20:00+08:00",
      "model_name": "Kling 3.0",
      "feature": "video_to_video",
      "ratio": "16:9",
      "quality": "1080P",
      "duration": 5,
      "output_type": "video",
      "attachments": [
        {
          "url": "https://cdn.example.com/reference.mp4",
          "type": "video",
          "purpose": "reference",
          "object_id": "video_1",
          "file_id": "FILE-video-001",
          "name": "参考视频.mp4",
          "thumbnail_url": "https://cdn.example.com/reference-cover.jpg"
        },
        {
          "url": "https://cdn.example.com/music.mp3",
          "type": "audio",
          "purpose": "audio",
          "object_id": "audio_1",
          "file_id": "FILE-audio-001",
          "name": "背景音乐.mp3",
          "thumbnail_url": null
        }
      ],
      "result_url": null,
      "result_thumbnail_url": null
    }
  ],
  "offset": 0,
  "next_offset": 2,
  "batch_size": 3,
  "returned": 2,
  "total_available": 2,
  "has_more": false,
  "capped": false
}
```

## 7. `uploaded_image_url` 兼容策略

建议在一个兼容周期内保留 `uploaded_image_url`，避免旧版前端受影响：

```text
uploaded_image_url = 第一个 type=image 的附件 URL；没有图片时为 null
```

注意：不要把视频或音频 URL 写入 `uploaded_image_url`。

新版前端读取优先级：

1. 优先读取 `attachments`。
2. `attachments` 字段不存在时，才使用 `uploaded_image_url` 构造单张图片附件。

待所有客户端升级后，可以另行评估是否废弃 `uploaded_image_url`。

## 8. 历史数据兼容

- 已有消息若保存了完整 `attachments`，流式 mapper 应直接返回。
- 已有消息只有单个图片 URL 时，可以转换为单元素 `attachments`。
- 无法判断旧附件类型时，不要根据 URL 强行标记为视频或音频；可按原数据语义标记为 `image`。
- 不要求为了本需求强制回填所有历史视频封面，但新产生的视频附件必须保存封面字段或明确返回 `null`。

## 9. 验收标准

### 9.1 单附件

- 上传一张图片，刷新页面后图片缩略图仍存在且可预览。
- 上传一个视频，刷新页面后视频附件类型仍为 `video`，可显示封面或首帧并播放。
- 上传一个音频，刷新页面后音频附件类型仍为 `audio`，可打开播放器播放。

### 9.2 多附件

- 同一次生成上传图片、视频、音频各一个，刷新后必须恢复全部三个附件。
- 返回顺序与提交 `input_files` 的顺序一致。
- 分页加载更早消息时，附件字段与首屏加载行为一致。

### 9.3 数据可靠性

- 清空浏览器缓存后重新登录，附件仍可恢复。
- 更换浏览器或设备后，附件仍可恢复。
- 非管理员不能通过流式端点读取其他用户的附件。
- 无附件消息返回 `attachments: []`。
- 所有附件 URL 均为 HTTPS 且可访问。

## 10. 前后端联调检查项

后端完成后，请提供以下内容用于联调：

1. 一条同时包含图片、视频、音频的真实流式响应。
2. 视频附件包含有效 `thumbnail_url` 的样例。
3. 无附件、单附件、多附件三种测试会话 ID。
4. `uploaded_image_url` 的保留或下线计划。
5. 数据库中附件字段的实际存储结构说明。

