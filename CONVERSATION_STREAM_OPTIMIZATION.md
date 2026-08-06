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
