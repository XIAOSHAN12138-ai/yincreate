# 生成中任务跨页面恢复——后端接口需求

> 面向：后端开发、接口联调、测试  
> 涉及模块：生成任务、对话消息流、任务状态查询  
> 优先级：高

## 1. 目标

用户提交异步生成任务后，即使发生以下操作，也必须能够从后端恢复对应任务卡片并继续同步状态：

- 从生成页切换到其他页面后再返回。
- 刷新浏览器。
- 清空浏览器缓存后重新登录。
- 更换浏览器或设备登录。
- 浏览器休眠、断网后重新联网。

浏览器 `localStorage` 只能作为界面加速缓存，不得作为发现生成中任务的唯一数据源。

## 2. 当前问题

当前前端主要通过以下流式端点重建结果卡片：

```http
GET /api/v1/conversations/{conversation_id}/messages/stream
```

如果流式用户消息不返回 `generation_task_id` 和完整生成参数，前端只能从本机 `localStorage` 找到生成中任务。这会导致清缓存、换设备或本地缓存写入失败后无法恢复任务。

## 3. 对话消息流式端点要求

### 3.1 用户消息必须返回的字段

`role=user` 的 `MessageStreamItem` 必须包含：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `message_id` | string | 是 | 消息唯一 ID |
| `role` | string | 是 | 固定为 `user` |
| `content` | string | 是 | 本次生成提示词 |
| `generation_task_id` | string/null | 是 | 对应生成任务 ID；普通文本消息可为 `null` |
| `created_at` | datetime | 是 | 用户消息或任务创建时间 |
| `model_name` | string/null | 是 | 实际使用的模型 ID 或稳定模型标识 |
| `feature` | string/null | 是 | 特色功能/生成模式 |
| `ratio` | string/null | 是 | 生成比例 |
| `quality` | string/null | 是 | 分辨率或画质 |
| `duration` | number/null | 是 | 视频或音频时长参数 |
| `output_type` | string/null | 是 | `image`、`video`、`audio`、`digital_human` |
| `attachments` | array | 是 | 完整上传附件；无附件返回 `[]` |

附件详细结构见：

[CONVERSATION_STREAM_ATTACHMENTS_REQUIREMENT.md](./CONVERSATION_STREAM_ATTACHMENTS_REQUIREMENT.md)

### 3.2 Assistant 消息必须返回的字段

`role=assistant` 的已完成生成消息必须包含：

- `result_task_id`
- `created_at`
- `result_url`
- `result_thumbnail_url`
- `model_name`
- `feature`
- `ratio`
- `quality`
- `duration`
- `output_type`

`result_task_id` 必须与用户消息的 `generation_task_id` 相同，以便前端稳定配对，不能只依赖消息相邻顺序。

### 3.3 示例

```json
{
  "items": [
    {
      "message_id": "MSG-user-001",
      "role": "user",
      "content": "生成一段城市夜景视频",
      "generation_task_id": "TASK-001",
      "created_at": "2026-08-06T15:10:00+08:00",
      "model_name": "kling-3.0",
      "feature": "image_to_video",
      "ratio": "16:9",
      "quality": "1080P",
      "duration": 5,
      "output_type": "video",
      "attachments": []
    }
  ],
  "next_offset": 1,
  "has_more": false
}
```

## 4. 任务状态接口要求

现有接口：

```http
GET /api/v1/tasks/{task_id}/status
```

### 4.1 统一状态枚举

建议统一为：

| 类型 | 状态 |
|---|---|
| 非终态 | `queued`、`pending`、`processing` |
| 成功终态 | `completed` |
| 失败终态 | `failed`、`cancelled`、`timed_out`、`expired`、`aborted` |

状态一旦进入终态，不得回退到非终态。

### 4.2 响应要求

```json
{
  "task_id": "TASK-001",
  "status": "processing",
  "progress": 42,
  "created_at": "2026-08-06T15:10:00+08:00",
  "updated_at": "2026-08-06T15:11:20+08:00",
  "result": null,
  "error": null,
  "charge_info": null
}
```

要求：

- `progress` 范围为 `0-100`；无法计算时返回 `null`。
- `completed` 必须返回完整 `result`。
- 失败终态必须返回稳定错误码和用户可读错误信息。
- 返回状态必须来自数据库中的权威任务记录，不能依赖单个应用进程的内存状态。

## 5. HTTP 错误语义

必须区分“任务失败”和“状态服务暂不可用”：

| 情况 | 建议响应 |
|---|---|
| 任务仍在处理 | HTTP 200 + 非终态状态 |
| 任务业务失败 | HTTP 200 + `status=failed` + 错误信息 |
| 用户无权访问 | HTTP 403 |
| 确认不存在且从未创建 | HTTP 404 |
| 任务记录已按策略清理 | HTTP 410，并返回清理原因 |
| 状态服务或依赖暂不可用 | HTTP 5xx，不得伪装成任务失败 |

异步生成接口返回 `task_id` 后，状态记录必须立即可查，避免短时间内出现 404 的最终一致性窗口。

## 6. 任务记录保留周期

为了支持历史恢复：

- 生成任务记录建议至少保留 30 天。
- 对话仍有效时，任务与消息之间的关联不得提前删除。
- 清理任务状态前，应确保生成结果已经写入 assistant 消息。
- 已清理任务查询应返回明确的 HTTP 410，而不是与“从未存在”共用 404。

## 7. 推荐批量状态接口

为避免恢复多个任务时产生 N+1 请求，建议新增：

```http
POST /api/v1/tasks/status/batch
Content-Type: application/json
```

请求：

```json
{
  "task_ids": ["TASK-001", "TASK-002", "TASK-003"]
}
```

响应：

```json
{
  "items": [
    {
      "task_id": "TASK-001",
      "status": "processing",
      "progress": 42,
      "created_at": "2026-08-06T15:10:00+08:00",
      "result": null,
      "error": null
    },
    {
      "task_id": "TASK-002",
      "status": "completed",
      "progress": 100,
      "created_at": "2026-08-06T15:00:00+08:00",
      "result": {
        "video_url": "https://cdn.example.com/result.mp4"
      },
      "error": null
    }
  ]
}
```

接口必须按当前用户权限过滤，不允许查询其他用户的任务。

## 8. 数据一致性要求

生成请求成功返回前，应在同一事务或可恢复流程中完成：

1. 创建 `generation_tasks` 任务记录。
2. 创建或更新对应 user 对话消息。
3. 将 `generation_task_id` 写入 user 消息。
4. 保存完整生成参数与附件。
5. 返回 `task_id`。

生成完成后应保证：

1. 更新任务为终态。
2. 保存生成结果。
3. 创建 assistant 消息。
4. assistant 的 `result_task_id` 与任务 ID 一致。

若其中一步失败，需要可重试或由补偿任务修复，不能长期出现“任务完成但对话没有 assistant 消息”的状态。

## 9. 验收标准

### 9.1 页面切换和刷新

- 提交任务后立即切换页面，再返回时卡片能够恢复并继续更新进度。
- 提交任务后刷新浏览器，卡片能够恢复。
- 清空 `localStorage` 后重新登录，生成中卡片仍能恢复。
- 换浏览器或设备登录，生成中卡片仍能恢复。

### 9.2 网络异常

- 状态接口临时返回 5xx 时，任务数据库状态不被改为失败。
- 网络恢复后再次查询能够返回真实状态。
- 任务完成期间前端离线，重新联网后能够获取完成结果。

### 9.3 数据配对

- 连续提交多个任务时，每个 user/assistant 消息都能通过任务 ID 正确配对。
- 消息分页或流式分批不会造成提示词、附件和结果串卡。
- 已完成任务不会被重复恢复为生成中任务。

### 9.4 权限和性能

- 用户不能查询其他用户的任务状态或附件。
- 单任务状态查询满足现有性能目标。
- 批量接口查询 20 个任务时只产生一次前端请求，并避免逐项数据库 N+1 查询。

## 10. 前后端联调交付项

后端完成后请提供：

1. 包含生成中用户消息的真实 `/messages/stream` 响应。
2. `queued`、`processing`、`completed`、`failed` 四类任务样例。
3. 404、410、403、5xx 的错误响应样例。
4. 状态记录保留周期和清理策略。
5. 如实现批量接口，提供接口地址及最大 `task_ids` 数量。

