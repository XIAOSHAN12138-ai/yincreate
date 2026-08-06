# 多轮对话 API 文档（前端对接）

> 多轮对话系统：用户在一个"对话"里发消息、模型回复，消息和生成结果都按时间顺序串成一条历史记录。
> 数据表：[`16_video_conversations.sql`](../../database/sql/schema/16_video_conversations.sql) /
> [`17_conversation_messages.sql`](../../database/sql/schema/17_conversation_messages.sql) +
> [`30_conversation_patches.sql`](../../database/sql/schema/30_conversation_patches.sql) 触发器补全
>
> 实现位置：
> - 路由：[`app/api/conversations.py`](../../app/api/conversations.py)
> - 业务层：[`app/services/conversation_service.py`](../../app/services/conversation_service.py)
> - DTO：[`app/api/conversation_dto.py`](../../app/api/conversation_dto.py)
> - DAO：[`database/dao/conversation_dao.py`](../../database/dao/conversation_dao.py)
> - 测试：[`tests/test_conversations_api.py`](../../tests/test_conversations_api.py)

---

## 0. 用户类型与能力矩阵

`user_type` 来自 JWT token claims，可能值：

| `user_type` | 含义 | 可执行的对话操作 |
| --- | --- | --- |
| `admin` | 系统管理员 | 只读全部（运营场景） |
| `enterprise` | 企业账号 | 创建 / 修改 / 归档 / 写消息（自己的） |
| `employee` | 企业员工 | 同上（同企业内） |

阶段 1 简化规则（设计文档 [`video_conversations.md`](../../database/sql/schema/video_conversations.md)）：
- 创建：必须 `user_type ∈ {enterprise, employee}` 且 `enterprise_id` 非空
- 读：自己 `user_id` 创建的全部可见；admin 看全部
- 写：仅 `user_id` 匹配；admin **不**允许创建或修改（与 `/api/v1/generate` 行为一致）

阶段 2 启用 `project_members` 后会引入细粒度权限位（`can_create_conversation` / `can_invite_member` 等），不影响现有 API 形态。

---

## 1. 接口列表（6 个端点）

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/conversations` | enterprise/employee | 创建对话 |
| GET | `/api/v1/conversations` | 任意已登录 | 列出我可见的对话 |
| GET | `/api/v1/conversations/{id}` | 任意已登录 | 对话详情（按受众过滤） |
| PATCH | `/api/v1/conversations/{id}` | 拥有者 | 修改（重命名 / 归档） |
| GET | `/api/v1/conversations/{id}/messages` | 任意已登录 | 消息列表（按时间正序） |
| POST | `/api/v1/conversations/{id}/messages` | 拥有者 | 追加一条文本消息 |

---

## 2. 与 `/api/v1/generate` 的集成

`POST /api/v1/generate` 新增**可选**字段 `conversation_id`（在 [FrontendUnifiedRequest](../../app/models_frontend.py) 中）：

- **不传 `conversation_id`**：与旧逻辑完全一致，生成结果不会进任何对话。
- **传 `conversation_id`**：自动
  1. 在该对话下写一条 `user` 消息（携带 `prompt` + `generation_task_id`）
  2. 生成成功后再写一条 `assistant` 消息（携带 `result_task_id` + 视频 url）
  3. `generation_tasks` 表的 `conversation_id` / `user_message_id` 同步落库
  4. 触发器自动维护 `video_conversations.message_count` / `last_message_at` / `generation_count` / `total_quota_used`

**重要**：即使用户用同步模式（`?sync=true`），user 消息也会在调用 vendor **之前**先写入（与异步模式行为一致）。vendor 失败不会回滚 user 消息——前端可以基于"已有 user 消息"做"重试/续传"。

### 2.1 示例：在对话里发起一次生成

```bash
# 1) 先创建对话
curl -X POST http://localhost:8003/api/v1/conversations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "短视频项目 #1"}'
# → { "conversation_id": "CONV-7cca9b04", ... }

# 2) 在该对话里生成视频
curl -X POST "http://localhost:8003/api/v1/generate?sync=true" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "output_type": "video",
    "model": "Kling 3.0",
    "prompt": "生成一个5秒的城市夜景",
    "parameters": {"resolution": "1080P", "duration": 5, "ratio": "16:9"},
    "vendor": "vendor_a",
    "conversation_id": "CONV-7cca9b04"
  }'

# 3) 列消息（含 user + assistant 两条）
curl http://localhost:8003/api/v1/conversations/CONV-7cca9b04/messages \
  -H "Authorization: Bearer <token>"
```

---

## 3. 创建对话 `POST /api/v1/conversations`

### 3.1 请求

```http
POST /api/v1/conversations
Authorization: Bearer <token>
Content-Type: application/json
```

### 3.2 Body（全部可选）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string 1-200 | ❌ | 对话标题，前端可在创建时直接给第一个默认标题（"未命名对话"） |
| `project_id` | string | ❌ | **阶段 1 忽略**，永远存 NULL；阶段 2 启用项目时再必填 |

### 3.3 成功响应（HTTP 201）

```json
{
  "id": 7,
  "conversation_id": "CONV-7cca9b04",
  "project_id": null,
  "user_type": "enterprise",
  "user_id": "demo-company",
  "user_name": "示例科技",
  "enterprise_id": "demo-company",
  "title": "短视频项目 #1",
  "message_count": 0,
  "generation_count": 0,
  "total_quota_used": 0.0,
  "status": "active",
  "last_message_at": null,
  "created_at": "2026-06-18T13:11:50",
  "updated_at": "2026-06-18T13:11:50"
}
```

### 3.4 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` | 鉴权失败 |
| 403 | `FORBIDDEN` | user_type=admin 或 user_type=employee 且 token 缺 enterprise_id |
| 409 | `CONVERSATION_ID_CONFLICT` | 极小概率（8 hex 冲突），重试一次 |

---

## 4. 列表 `GET /api/v1/conversations`

### 4.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | int 1-200 | 50 | 单页数量 |
| `offset` | int ≥ 0 | 0 | 偏移 |

### 4.2 排序

`last_message_at DESC NULLS LAST` → `created_at DESC`

### 4.3 响应

```json
{
  "total": 12,
  "items": [ /* ConversationResponse × N */ ]
}
```

> `total` 为当前页返回数（与 announcement 一致，本接口不另发 COUNT 查询）。

---

## 5. 详情 `GET /api/v1/conversations/{id}`

```json
{
  "id": 7,
  "conversation_id": "CONV-7cca9b04",
  "title": "短视频项目 #1",
  "message_count": 8,
  "generation_count": 3,
  "total_quota_used": 12.50,
  "status": "active",
  "last_message_at": "2026-06-18T13:30:00",
  "created_at": "2026-06-18T13:11:50",
  "updated_at": "2026-06-18T13:30:00"
  /* ... */
}
```

### 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 404 | `NOT_FOUND` | 对话不存在 |
| 403 | `FORBIDDEN` | 别人的对话；admin 不会被拒 |

---

## 6. 修改 `PATCH /api/v1/conversations/{id}`

### 6.1 权限

- `user_id == token.sub`（自己创建的）可改
- `user_type=admin` **不**允许修改（与创建一致）
- `user_type=admin` 只读 → 永远不能 PATCH

### 6.2 Body

```json
{ "title": "新标题" }
```
或
```json
{ "status": "archived" }
```
或同时改：
```json
{ "title": "归档", "status": "archived" }
```

> `title` / `status` 至少传一个；`status` 只能 `active` 或 `archived`；传空 body 会 422。

### 6.3 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 403 | `FORBIDDEN` | 别人的对话 / admin 尝试改 |
| 404 | `NOT_FOUND` | 不存在 |
| 422 | — | 空 body 或 status 取值非法 |

---

## 7. 消息 `POST /api/v1/conversations/{id}/messages`

### 7.1 Body

```json
{ "content": "你是一个视频生成助手", "role": "system" }
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `content` | ✅ | 1-65535 字符 |
| `role` | ❌ | `user` (默认) / `assistant` / `system` |

> 实际**通常不需要调此端点**——`/api/v1/generate` 会自动写 user/assistant 消息。
> 此端点用途：纯文本追加（"提示词补充" / "系统 prompt"）。

### 7.2 成功响应（HTTP 201）

```json
{
  "id": 14,
  "message_id": "MSG-8910f175",
  "conversation_id": "CONV-7cca9b04",
  "role": "system",
  "content": "你是一个视频生成助手",
  "generation_task_id": null,
  "result_task_id": null,
  "result_video_url": null,
  "result_thumbnail_url": null,
  "created_at": "2026-06-18T13:30:00",
  "updated_at": "2026-06-18T13:30:00",
  "deleted_at": null
}
```

**字段含义**：

- `generation_task_id`：仅 user 消息可能有 → 关联到 `generation_tasks.task_id`（**该消息触发的任务**）
- `result_task_id`：仅 assistant 消息可能有 → 关联到 `generation_tasks.task_id`（**该消息引用的生成结果**）
- `result_video_url` / `result_thumbnail_url`：assistant 消息冗余存储，前端不用再次 JOIN `generation_tasks`

---

## 8. 消息列表 `GET /api/v1/conversations/{id}/messages`

### 8.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | int 1-500 | 200 | 单页数量 |
| `offset` | int ≥ 0 | 0 | 偏移 |

### 8.2 排序

`created_at ASC, id ASC`（时间正序；对话界面从下往上读）

### 8.3 软删过滤

默认 `deleted_at IS NULL`；被软删的消息不会返回（用户撤回场景）。

### 8.4 响应

```json
{
  "total": 8,
  "items": [
    {
      "message_id": "MSG-8910f175",
      "role": "system",
      "content": "你是一个视频生成助手",
      "created_at": "2026-06-18T13:11:55"
    },
    {
      "message_id": "MSG-ad28d117",
      "role": "user",
      "content": "生成一个5秒的城市夜景",
      "generation_task_id": "task_xxx",
      "created_at": "2026-06-18T13:12:00"
    },
    {
      "message_id": "MSG-bf72ce42",
      "role": "assistant",
      "content": "已为你生成视频",
      "result_task_id": "task_xxx",
      "result_video_url": "https://cdn.example.com/result.mp4",
      "result_thumbnail_url": "https://cdn.example.com/result.jpg",
      "created_at": "2026-06-18T13:12:35"
    }
  ]
}
```

---

## 9. 状态机

对话本身只有 2 态：`active` ↔ `archived`，**不可逆**地软删（保留历史）。

| 当前 status | 可改为 | 不可改为 |
| --- | --- | --- |
| `active` | `archived` | — |
| `archived` | (无) | `active` |

阶段 2 可能增加 `deleted` 态（与 `media_library` 类似，参见 [docs/MEDIA_LIBRARY_API.md](MEDIA_LIBRARY_API.md)）。

消息本身没有状态字段，但有 `deleted_at`（软删时间戳）。前端通常不需要软删接口——目前未暴露；如需可加 `DELETE /api/v1/conversations/{id}/messages/{msg_id}`。

---

## 10. 数据库触发器（前端无需关心，但要知道）

迁移脚本 [`30_conversation_patches.sql`](../../database/sql/schema/30_conversation_patches.sql) 安装了：

| 触发器 | 作用 |
| --- | --- |
| `update_projects_updated_at` | `projects.updated_at` 自动维护 |
| `update_video_conversations_updated_at` | 同上 |
| `update_conversation_messages_updated_at` | 同上 |
| `trg_update_conversation_last_message_at` | 新消息插入时，自动更新 `video_conversations.last_message_at = NOW()` |
| `trg_update_conversation_message_count` | 新消息插入时，`message_count += 1` |

→ **应用层永远不要自己写这两个字段**，直接 INSERT 消息即可，DB 触发器会维护。

---

## 11. 完整生命周期示例

```bash
# 1) 创建对话
POST /api/v1/conversations { "title": "短视频项目" }
→ CONV-xxxx

# 2) (可选) 写系统消息
POST /api/v1/conversations/CONV-xxxx/messages { "role": "system", "content": "你是一个短视频助手" }
→ MSG-1

# 3) 在该对话里生成(异步或同步都行)
POST /api/v1/generate { "model": "Kling 3.0", "prompt": "夕阳下的城市", "conversation_id": "CONV-xxxx" }
→ 自动写 user + assistant 两条消息 + generation_tasks.conversation_id

# 4) 拉历史
GET /api/v1/conversations/CONV-xxxx/messages
→ [system, user, assistant, user, assistant, ...]

# 5) 重命名
PATCH /api/v1/conversations/CONV-xxxx { "title": "已完成的成片" }

# 6) 归档
PATCH /api/v1/conversations/CONV-xxxx { "status": "archived" }
```

---

## 12. 测试覆盖

[`tests/test_conversations_api.py`](../../tests/test_conversations_api.py) 包含 27 个用例，全部通过：

| 测试类 | 用例数 | 覆盖点 |
| --- | --- | --- |
| `TestAuthRequired` | 3 | 无 token / 假 token / admin 越权 |
| `TestCreateConversation` | 4 | 带标题 / 空 body / employee / 缺 enterprise_id |
| `TestListConversations` | 3 | 自己的 / admin 全部 / 分页 |
| `TestGetConversation` | 4 | 自己的 / 404 / 别人 403 / admin 可看 |
| `TestUpdateConversation` | 4 | 改名 / 归档 / 越权 / 空 body |
| `TestPostMessage` | 3 | user / system 默认 / 计数自增 |
| `TestListMessages` | 3 | 时间正序 / 404 / 越权 |
| `TestGenerateWithConversation` | 2 | user 消息在 vendor 之前写入 / 无 conv_id 向后兼容 |
| `TestTriggers` | 1 | last_message_at 自动更新 |

运行：

```bash
pytest tests/test_conversations_api.py -v
```

---

## 13. 范围之外（未实现）

- 项目协作（`/projects`、`/project_members`）— 阶段 2
- 消息软删 / 撤回 API
- 消息搜索 / 标签
- 对话导出（Markdown / PDF）
- 多模态消息（图/音/视频消息）
- 流式回复（SSE）

如需扩展，请基于 [`app/services/conversation_service.py`](../../app/services/conversation_service.py) + [`database/dao/conversation_dao.py`](../../database/dao/conversation_dao.py) 继续迭代。