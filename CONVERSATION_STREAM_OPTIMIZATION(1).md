# 多会话列表流式首屏加载优化

> 适用版本:2026-07-28 起
> 涉及端点:`GET /api/v1/conversations/stream`(新增)
> 涉及 DTO:[app/api/conversation_dto.py](../app/api/conversation_dto.py) — `ConversationListItem` / `ConversationStreamResponse`

## 1. 背景

生成页"多页对话"加载遇到两个问题:

1. **响应体过大**:`GET /api/v1/conversations` 返回完整 `ConversationResponse`(~16 字段),即使前端首屏只关心 id / title / 最近消息时间。
2. **首屏等待时间长**:单次请求拿全部数据,即使分页也是 50 条起步;前端首屏只想先渲染 10~15 条。

本优化在不改变现有 `GET /conversations` 行为的前提下,**新增独立 `/stream` 端点**,与素材库 `GET /api/v1/media/stream` 设计保持一致。

## 2. 改动总览

| 层级 | 改动 |
|------|------|
| DTO | 新增 `ConversationListItem`(4 字段)、`ConversationStreamResponse`(9 字段) |
| DAO | 新增 `list_for_user_summary` / `list_all_summary` / `count_for_user` / `count_all`(精简列 SELECT) |
| Service | 新增 `_conv_row_to_list_item` / `list_conversations_summary` / `count_conversations` |
| API | 新增 `GET /api/v1/conversations/stream` 与 `_build_conv_stream_response` helper |
| 文档 | 本文档 |

## 3. 响应字段

### 3.1 列表项 `ConversationListItem`

```json
{
  "id": 123,
  "conversation_id": "CONV-7f3a91b2",
  "title": "电商主图生成",
  "last_message_at": "2026-07-28T15:42:11+08:00"
}
```

只保留 4 个字段(原 `ConversationResponse` 16 字段)。被剔除字段(`message_count` / `generation_count` / `total_quota_used` / `user_*` / `enterprise_id` / `project_id` / `status` / `created_at` / `updated_at`)仍可通过详情端点 `GET /api/v1/conversations/{conversation_id}` 获取。

### 3.2 流式响应 `ConversationStreamResponse`

```json
{
  "items": [ /* 本批返回的 ConversationListItem,最多 5 条 */ ],
  "offset": 0,
  "next_offset": 5,
  "batch_size": 5,
  "returned": 5,
  "requested_total": 10,
  "total_available": 138,
  "has_more": true,
  "capped": false
}
```

字段语义:

| 字段 | 含义 |
|------|------|
| `items` | 本批返回的会话,最多 5 条 |
| `offset` | 本次请求的 offset |
| `next_offset` | 下次续拉应使用的 offset,通常是 `offset + returned` |
| `batch_size` | 固定为 5 |
| `returned` | 本批实际返回条数(可能 < 5,例如末批) |
| `requested_total` | `limit=0` 时为 `null`(表示请求全部),否则等于 `limit` |
| `total_available` | DB 中符合过滤条件的真实总数 |
| `has_more` | 本次 stream 目标内是否还有下一批 |
| `capped` | 是否因 `CONV_STREAM_HARD_CAP=500` 被截断 |

## 4. 端点说明

### `GET /api/v1/conversations/stream`

| 参数 | 类型 | 默认 | 范围 | 说明 |
|------|------|------|------|------|
| `limit` | int | 10 | 0~500 | 本次 stream 目标条数;首屏推荐 10;0 表示请求全部(本轮最多 500) |
| `offset` | int | 0 | ≥ 0 | 续拉偏移 |

返回:`ConversationStreamResponse`。

响应头(可选):
- `X-Conversation-Stream-Capped: true` — 当 stream 目标被截断时携带(请求 limit>500,或 limit=0 且 DB 总数>500)。

**鉴权**:与 `GET /conversations` 一致。
- 非 admin:需是企业成员(`user_type ∈ {enterprise, employee}` 且 `enterprise_id` 非空),只能看自己的对话。
- admin:看所有对话(运营场景)。

**排序**:固定 `last_message_at DESC NULLS LAST, created_at DESC`(无最近消息时按创建时间)。

## 5. 典型流程

### 5.1 首屏 10 条(分 2 批)

```http
GET /api/v1/conversations/stream?limit=10&offset=0
```

```json
{
  "items": [/* 5 items */],
  "offset": 0,
  "next_offset": 5,
  "batch_size": 5,
  "returned": 5,
  "requested_total": 10,
  "total_available": 138,
  "has_more": true,
  "capped": false
}
```

`has_more=true` → 用 `next_offset=5` 续拉:

```http
GET /api/v1/conversations/stream?limit=10&offset=5
```

```json
{
  "items": [/* 5 items */],
  "offset": 5,
  "next_offset": 10,
  "batch_size": 5,
  "returned": 5,
  "requested_total": 10,
  "total_available": 138,
  "has_more": false,
  "capped": false
}
```

### 5.2 错误恢复 / 断点续拉

仅使用 `offset`,不依赖 cursor 或服务端状态。
- 中途某次请求失败 → 使用最后一次成功响应的 `next_offset` 重试即可。
- `offset` 超过 `total_available` 时返回空 `items`、`has_more=false`。

### 5.3 限流截断

```http
GET /api/v1/conversations/stream?limit=0&offset=0
```

若 DB 中有 800 条对话,本轮最多 stream 500 条:
- 第一次响应 `X-Conversation-Stream-Capped: true`、`requested_total=null`、`capped=true`。
- 前端发现 `capped=true` 时,应提示"还有更多,本轮已截断"或主动告知用户加载全部需另走路径(后续可加 cursor / 分页下钻)。

## 6. 与现有端点的关系

| 端点 | 用途 | 列表项字段数 | 是否流式 |
|------|------|--------------|----------|
| `GET /api/v1/conversations` | 完整分页(运营 / 后台) | 16 字段(`ConversationResponse`) | 否 |
| `GET /api/v1/conversations/stream` | 首屏流式加载(用户面向) | 4 字段(`ConversationListItem`) | 是(5/批) |
| `GET /api/v1/conversations/{id}` | 对话详情 | 16 字段 | — |
| `GET /api/v1/conversations/{id}/messages` | 消息列表 | (后续会单独优化) | — |

`/stream` 是**新增**,**不修改**现有 `/conversations` 行为,后端兼容老调用方。

## 7. 迁移建议

前端:
- 首屏加载路径全部改用 `GET /conversations/stream?limit=10&offset=0`。
- 错误恢复 / 断点续拉:记住最后一次成功的 `next_offset`。
- 看到响应头 `X-Conversation-Stream-Capped: true` → 给用户提示。
- 进入会话详情页(消息列表)仍用现有 `GET /conversations/{id}/messages`(此端点单页消息量大,后续单独优化)。

后端:
- 老调用方继续走 `GET /conversations` 不受影响。
- 后续若想给 `/conversations` 也用 4 字段精简项,可单独加 `?summary=true` 参数,不破坏现有响应 shape。

## 8. 回滚方案

`/stream` 是新增端点,回滚只需:

1. 删除 [app/api/conversations.py](../app/api/conversations.py) 中 `stream_conversations_endpoint` 与 `_build_conv_stream_response`。
2. 移除 [app/api/conversation_dto.py](../app/api/conversation_dto.py) 中 `ConversationListItem` / `ConversationStreamResponse`(可选,留作后续复用也无影响)。
3. 移除 service / DAO 中的 `*_summary` 与 `count_*` 函数(可选,仅影响流式端点)。

无需数据库迁移。

## 9. 验证步骤

1. 编译:
   ```bash
   python -m py_compile app/api/conversation_dto.py app/api/conversations.py \
                        app/services/conversation_service.py \
                        database/dao/conversation_dao.py
   ```
2. 启动服务后:
   - `GET /api/v1/conversations/stream?limit=10&offset=0` → 5 条、`next_offset=5`、`has_more=true`
   - `GET /api/v1/conversations/stream?limit=10&offset=5` → 5 条、`next_offset=10`、`has_more=false`
   - `GET /api/v1/conversations/stream?limit=0&offset=0` → 5 条、`requested_total=null`
   - `offset` 超过 `total_available` → 空数组、`has_more=false`
3. 鉴权:非 admin 调 `/stream` 看不到别人的对话;admin 看到全部。
4. 排序:同 `last_message_at` 的行,按 `created_at DESC` 稳定排序。
5. 老端点未受影响:`GET /api/v1/conversations?limit=10&offset=0` 仍返回完整 16 字段。

---

# 第二部分:消息列表流式首屏加载

> 适用版本:2026-07-28 起
> 涉及端点:`GET /api/v1/conversations/{conversation_id}/messages/stream`(新增)
> 涉及 DTO:[app/api/conversation_dto.py](../app/api/conversation_dto.py) — `MessageStreamItem` / `MessageStreamResponse`

## 10. 背景

生成页进入对话页时,前端只需要渲染最新 3 条气泡,后续用户上滑到顶部再分段拉更早的消息。现有 `GET /api/v1/conversations/{id}/messages` 单次默认 200 条 + 25+ 字段,首屏等待时间长。

前端要求的 7 字段刚好是气泡卡片最小集:

| # | 字段 | 来源 |
|---|------|------|
| 1 | id / message_id | `cm.id` / `cm.message_id` |
| 2 | 生成时使用模型 | `ai_models.display_name`(user→`user_model_display_name`,assistant→`asst_model_display_name`) |
| 3 | 特色功能 | `generation_params.parameters.feature`(`text_to_image` / `image_to_video` / ...) |
| 4 | 上传的图片(VOD URL) | `attachments[0].url`,已升级 https |
| 5 | 比例 | `generation_params.parameters.ratio` |
| 6 | 分辨率 | `generation_params.parameters.quality`(或 `resolution`) |
| 7 | 生成结果(VOD URL) | `cm.result_video_url` / `cm.result_thumbnail_url`,已升级 https |

## 11. 改动总览

| 层级 | 改动 |
|------|------|
| DTO | 新增 `MessageStreamItem`(10 字段)、`MessageStreamResponse`(9 字段) |
| DAO | 新增 `list_messages_stream`(精简列 SELECT,DESC 排序)、`count_messages` |
| Service | 新增 `_msg_row_to_stream_item` mapper、`list_messages_stream`、`count_messages` |
| API | 新增 `GET /api/v1/conversations/{conversation_id}/messages/stream`、`_build_msg_stream_response` helper、响应头 `X-Message-Stream-Capped` |

## 12. 响应字段

### 12.1 列表项 `MessageStreamItem`

```json
{
  "id": 42,
  "message_id": "MSG-aaaa1111",
  "role": "assistant",
  "uploaded_image_url": null,
  "model_name": "Kling 1.6",
  "feature": "image_to_video",
  "ratio": "16:9",
  "quality": "1080P",
  "result_url": "https://25100...vod2.myqcloud.com/xxx.mp4",
  "result_thumbnail_url": "https://25100...vod2.myqcloud.com/xxx.jpg"
}
```

被剔除字段(`content` / `generation_task_id` / `attachments` 完整结构 / `duration` / `output_type` / `created_at` / `updated_at` / `deleted_at`)仍可通过详情端点 `GET /conversations/{id}/messages` 获取。

字段归属规则:

- `role=user`:仅 `uploaded_image_url` 可能有值(取 `attachments[0].url`),其他 AI 回复侧字段为 null。
- `role=assistant`:仅 `result_url` / `result_thumbnail_url` 可能有值,`uploaded_image_url` 为 null。
- `role=system`:所有可选字段为 null。
- `model_name` / `feature` / `ratio` / `quality`:用户消息取 `user_task_*`,AI 回复取 `asst_task_*`(复用现有 `_msg_row_to_response` 的解析逻辑)。

### 12.2 流式响应 `MessageStreamResponse`

字段语义与会话流式响应完全一致,见 [§3.2](#32-流式响应-conversationstreamresponse)。

## 13. 端点说明

### `GET /api/v1/conversations/{conversation_id}/messages/stream`

| 参数 | 类型 | 默认 | 范围 | 说明 |
|------|------|------|------|------|
| `limit` | int | 3 | 0~500 | 本次 stream 目标条数;3/批固定;0 表示请求全部(本轮最多 500) |
| `offset` | int | 0 | ≥ 0 | 续拉偏移 |

返回:`MessageStreamResponse`。

响应头(可选):
- `X-Message-Stream-Capped: true` — 当 stream 目标被截断时携带(请求 `limit>500`,或 `limit=0` 且 DB 总数>500)。

**鉴权**:与 `GET /messages` 一致 — 非 admin 只能看自己 `user_id` 创建的对话,admin 看全部。

**排序**:固定 `created_at DESC, id DESC`(同时间多条消息稳定)。前端拿到响应后 `reverse(items)` 再渲染;上滑时用 `next_offset` 继续拉更早。

## 14. 典型流程

### 14.1 进入对话页 — 拉最新 3 条

```http
GET /api/v1/conversations/CONV-7f3a91b2/messages/stream?limit=3&offset=0
```

```json
{
  "items": [
    {
      "id": 42,
      "message_id": "MSG-aaaa1111",
      "role": "assistant",
      "uploaded_image_url": null,
      "model_name": "Kling 1.6",
      "feature": "image_to_video",
      "ratio": "16:9",
      "quality": "1080P",
      "result_url": "https://25100...vod2.myqcloud.com/xxx.mp4",
      "result_thumbnail_url": "https://25100...vod2.myqcloud.com/xxx.jpg"
    },
    {
      "id": 41,
      "message_id": "MSG-bbbb2222",
      "role": "user",
      "uploaded_image_url": "https://25100...vod2.myqcloud.com/ref.jpg",
      "model_name": "Kling 1.6",
      "feature": "image_to_video",
      "ratio": "16:9",
      "quality": "1080P",
      "result_url": null,
      "result_thumbnail_url": null
    },
    {
      "id": 40,
      "message_id": "MSG-cccc3333",
      "role": "assistant",
      "..."
    }
  ],
  "offset": 0,
  "next_offset": 3,
  "batch_size": 3,
  "returned": 3,
  "requested_total": 3,
  "total_available": 47,
  "has_more": true,
  "capped": false
}
```

前端 `reverse(items)` 后渲染,气泡顺序变为 `msg-40 → msg-41 → msg-42`(最旧到最新),符合对话 UI 习惯。

### 14.2 上滑加载更早的 3 条

```http
GET /api/v1/conversations/CONV-7f3a91b2/messages/stream?limit=3&offset=3
```

```json
{
  "items": [/* id 37 / 38 / 39,按 DESC 排列 */],
  "offset": 3,
  "next_offset": 6,
  "batch_size": 3,
  "returned": 3,
  "requested_total": 3,
  "total_available": 47,
  "has_more": true,
  "capped": false
}
```

前端 `reverse(items)` 后 prepend 到列表顶部,保留滚动位置。

### 14.3 末批 / 边界

```http
GET /api/v1/conversations/CONV-7f3a91b2/messages/stream?limit=3&offset=45
```

```json
{
  "items": [/* id 1 / 2,共 2 条 */],
  "offset": 45,
  "next_offset": 47,
  "batch_size": 3,
  "returned": 2,
  "requested_total": 3,
  "total_available": 47,
  "has_more": false,
  "capped": false
}
```

### 14.4 全部加载

```http
GET /api/v1/conversations/CONV-7f3a91b2/messages/stream?limit=0&offset=0
```

`limit=0` → `requested_total=null`、`capped` 按 DB 总数决定。

## 15. 与现有端点的关系

| 端点 | 用途 | 列表项字段数 | 是否流式 |
|------|------|--------------|----------|
| `GET /api/v1/conversations/{id}/messages` | 完整分页(运营 / 后台) | 25 字段(`MessageResponse`) | 否 |
| `GET /api/v1/conversations/{id}/messages/stream` | 首屏流式加载(用户面向) | 10 字段(`MessageStreamItem`) | 是(3/批) |

`/messages/stream` 是**新增**,**不修改**现有 `/messages` 行为,后端兼容老调用方。

## 16. 回滚方案

`/messages/stream` 是新增端点,回滚只需:

1. 删除 [app/api/conversations.py](../app/api/conversations.py) 中 `stream_messages_endpoint` 与 `_build_msg_stream_response`。
2. 移除 [app/api/conversation_dto.py](../app/api/conversation_dto.py) 中 `MessageStreamItem` / `MessageStreamResponse`(可选)。
3. 移除 service / DAO 中的 `list_messages_stream` 与 `count_messages`(可选,仅影响流式端点)。

无需数据库迁移。

## 17. 验证步骤

1. 编译:
   ```bash
   python -m py_compile app/api/conversation_dto.py app/api/conversations.py \
                        app/services/conversation_service.py \
                        database/dao/conversation_dao.py
   ```
2. 启动服务后(DESC 排序):
   - `GET /api/v1/conversations/{id}/messages/stream?limit=3&offset=0` → 最新 3 条、`next_offset=3`、`has_more=true`
   - `GET /api/v1/conversations/{id}/messages/stream?limit=3&offset=3` → 接下来 3 条
   - `offset` 超过 `total_available` → 空数组、`has_more=false`
   - `limit=0` → 3 条/批,`requested_total=null`
3. 字段验证:
   - user 消息:`uploaded_image_url` 取 `attachments[0].url`,已升级 https
   - assistant 消息:`result_url` 取 `result_video_url`,已升级 https
   - 两侧都填:`model_name` / `feature` / `ratio` / `quality`
4. 鉴权:非 admin 调 `/messages/stream` 看不到别人的对话;admin 看到全部。
5. 老端点未受影响:`GET /api/v1/conversations/{id}/messages?limit=200` 仍返回完整 25 字段。
