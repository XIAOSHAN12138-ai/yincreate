# 素材库列表接口优化与流式加载（2026-07-28 更新）

> 本文档记录 2026-07-28 对素材库列表接口的优化变更：
>
> 1. **轻量级列表响应**：列表端点的 items 从完整 `MediaResponse` 改为精简 `MediaListItem`，显著降低响应体大小与首屏等待时间。
> 2. **流式首屏加载 `/stream` 端点**：后端固定每批 5 条，前端通过 `offset` 续拉实现首屏快速渲染，支持断点续拉。
> 3. **DB 真实总数**：列表 `total` 字段改为 `COUNT(*)` 真实值，不再是 `len(items)`。
> 4. **`limit=0` 行为变化**：原本"取全部"现在被静默截断到 500（普通列表）或 500（流式），通过响应头告知前端。
>
> 主文档：[`docs/MEDIA_LIBRARY_API.md`](./MEDIA_LIBRARY_API.md)（本仓库历史已稳定的素材库接口定义）

---

## 1. 变更背景

### 1.1 原问题

- 4 个列表端点 `GET /api/v1/media`、`/by-source/{src}`、`/by-type/{type}`、`/recycle-bin` 每次返回**完整** `MediaResponse`（≈30 字段），包含 `generation_prompt`（可达 4 KB）、`generation_params`（JSONB）、`description`、全部音频字段、软删审计字段等。
- 单次加载多张图片时（如 100 张），响应体膨胀导致前端等待时间过长，**生产环境偶发超时**。
- `limit=0` 原意为"取全部"，在超管视角下可能一次拉上千行，触发数据库长查询。

### 1.2 目标

1. **瘦身列表 payload**：列表只保留前端卡片需要的字段（类型、命名、介绍、提示词、入库时间、模型展示名），详情端点保持完整。
2. **新增流式加载路径**：后端固定每批 5 条，前端通过 `offset` 续拉实现首屏快速渲染，支持断点续拉。
3. **向后兼容**：不破坏现有分页端点；`limit=0` 行为保留（仍支持全量语义），但通过响应头标识截断。

---

## 2. 列表响应瘦身（普通分页端点）

### 2.1 影响端点

| 方法 | 路径 | 原 response_model | 新 response_model |
| --- | --- | --- | --- |
| GET | `/api/v1/media` | `MediaListResponse` | `MediaListResponseV2` |
| GET | `/api/v1/media/by-source/{media_source}` | `MediaListResponse` | `MediaListResponseV2` |
| GET | `/api/v1/media/by-type/{media_type}` | `MediaListResponse` | `MediaListResponseV2` |
| GET | `/api/v1/media/recycle-bin` | `MediaListResponse` | `MediaListResponseV2` |

### 2.2 items 类型变化：`MediaResponse` → `MediaListItem`

#### 保留字段（卡片渲染所需）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | int | DB 主键 |
| `media_id` | string | 业务唯一键 |
| `media_type` | enum | `image` / `video` / `audio` |
| `media_source` | enum | `generated` / `uploaded` |
| `media_name` | string | 命名 |
| `description` | string\|null | 介绍 |
| `media_url` | string | 文件 URL |
| `thumbnail_url` | string\|null | 缩略图 URL |
| `file_size` | int\|null | 字节 |
| `duration` | int\|null | 视频/音频时长（秒） |
| `width` / `height` | int\|null | 像素 |
| `format` | string\|null | `jpg` / `png` / `mp4` 等 |
| `generation_prompt` | string\|null | 生成提示词 |
| `generation_model` | string\|null | 模型 ID |
| `model_id` | string\|null | 业务模型 ID（= `generation_model`） |
| `model_name` | string\|null | 业务名称 |
| `model_version` | string\|null | 版本号 |
| `model_display_name` | string\|null | 卡片标题 |
| `vendor_display_name` | string\|null | 供应商标题 |
| `category` | string\|null | 分类 |
| `tags` | string[] | 标签数组 |
| `creator_type` | enum | `enterprise` / `account` |
| `creator_id` | string | 创建者业务 ID |
| `account_id` | string\|null | 员工账号 |
| `view_count` | int | 浏览数 |
| `download_count` | int | 下载数 |
| `use_count` | int | 使用数 |
| `status` | enum | `normal` / `deleted` |
| `created_at` | string\|null | 入库时间 |

> 注：`model_*` 5 个字段全部保留（来自 `LEFT JOIN ai_models`），与之前"前端需要 5 个模型展示字段"的确认一致。

#### 剔除字段（详情端点 `GET /{media_id}` 仍提供）

| 字段 | 说明 |
| --- | --- |
| `enterprise_id`, `user_id`, `department_id` | 权限已在校验层处理，前端不必见 |
| `mime_type`, `generation_task_id`, `generation_params` | 详情再给 |
| `updated_at`, `deleted_at`, `deleted_by_type`, `deleted_by`, `delete_reason`, `permanent_delete_at` | 软删审计信息详情再给 |
| `created_by_type`, `created_by` | 创建者审计详情再给 |
| 音频专属字段：`sample_rate`, `channels`, `bitrate`, `artist`, `album`, `lyrics`, `voice_id`, `language`, `waveform_url` | 音频详情再给 |

### 2.3 响应示例

```http
GET /api/v1/media?limit=50&offset=0
```

```json
{
  "total": 138,
  "items": [
    {
      "id": 42,
      "media_id": "MEDIA-AE032259",
      "media_type": "image",
      "media_source": "generated",
      "media_name": "水墨山水画 #1",
      "description": "水墨风山水图",
      "media_url": "https://1500066181.vod-qcloud.com/.../img1.jpg",
      "thumbnail_url": "https://.../img1-thumb.jpg",
      "file_size": 524288,
      "duration": null,
      "width": 1920,
      "height": 1080,
      "format": "jpg",
      "generation_prompt": "水墨山水画",
      "generation_model": "doubao-seedance-2.0",
      "model_id": "doubao-seedance-2.0",
      "model_name": "Seedance",
      "model_version": "2.0",
      "model_display_name": "Seedance 2.0",
      "vendor_display_name": "火山引擎",
      "category": "山水",
      "tags": ["宣传图", "水墨"],
      "creator_type": "account",
      "creator_id": "user_001",
      "account_id": "user_001",
      "view_count": 12,
      "download_count": 3,
      "use_count": 1,
      "status": "normal",
      "created_at": "2026-07-28T10:00:00"
    }
  ]
}
```

### 2.4 关键行为变化

| 行为 | 原 | 新 |
| --- | --- | --- |
| `total` 字段语义 | `len(items)`（已取到条数） | `COUNT(*)` DB 真实总数 |
| `limit` 范围 | 1–200 | 1–500 |
| `limit=0` | 取全部（DAO 不加 `LIMIT`） | 取最多 500；响应头 `X-Media-Limit-Capped: true` |
| SELECT 列数 | 25 列 + JOIN 5 列 | 21 列 + JOIN 5 列 |

---

## 3. 流式首屏加载 `/stream` 端点

### 3.1 新增端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/media/stream` | 通用流式 |
| GET | `/api/v1/media/by-source/{media_source}/stream` | 按来源流式 |
| GET | `/api/v1/media/by-type/{media_type}/stream` | 按类型流式 |
| GET | `/api/v1/media/recycle-bin/stream` | 回收站流式 |

> 路由注册顺序：以上 4 个 `/stream` 端点**必须**在 `GET /api/v1/media/{media_id}` 之前，避免 `stream` 被当作 `media_id`。

### 3.2 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | int(0-500) | **10** | 本次 stream 目标条数；首屏推荐 10 或 15 |
| `offset` | int(≥0) | 0 | 续拉偏移（出错恢复时使用） |
| `media_type` | enum | — | `image` / `video` / `audio`（通用 / by-source 路径） |
| `media_source` | enum | — | `generated` / `uploaded`（通用 / by-type 路径） |
| `creator_type` | string | — | `enterprise` / `account` |
| `category` | string | — | 精确匹配 |
| `keyword` | string | — | 模糊匹配 `media_name` / `description` |

排序固定为 `created_at DESC, id DESC`（同时间入库稳定）。

### 3.3 语义说明

| 行为 | 说明 |
| --- | --- |
| **每批大小** | 固定 **5 条**（`STREAM_BATCH_SIZE=5`） |
| `limit=10` | 分 2 批返回，每批 5 条 |
| `limit=15` | 分 3 批返回，每批 5 条 |
| `limit=0` | 请求全部（本轮最多 500），按 5/批返回 |
| `offset=5` | 从第 6 条开始续拉 |
| 硬上限 | `STREAM_HARD_CAP = 500` |
| 截断标识 | `limit>500` 或 `limit=0` 且 DB>500 → `capped=true` + 响应头 `X-Media-Stream-Capped: true` |

### 3.4 响应结构 `MediaStreamResponse`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `items` | `MediaListItem[]` | 本批返回的素材，最多 5 条 |
| `offset` | int | 本次请求的 offset |
| `next_offset` | int | 下一次续拉的 offset（=`offset + returned`） |
| `batch_size` | int | 固定 5 |
| `returned` | int | 本批实际返回数（0–5） |
| `requested_total` | int\|null | 请求目标条数；`limit=0` 时为 `null` |
| `total_available` | int | DB 真实总数 |
| `has_more` | bool | 本次目标内是否还有下一批 |
| `capped` | bool | 是否被硬上限截断 |

### 3.5 响应示例

#### 第一批

```http
GET /api/v1/media/stream?limit=10&offset=0
```

```json
{
  "items": [
    { /* MediaListItem */ }
  ],
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

#### 第二批（续拉）

```http
GET /api/v1/media/stream?limit=10&offset=5
```

```json
{
  "items": [
    { /* MediaListItem */ }
  ],
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

#### `limit=0`（全部，超过硬上限）

```http
GET /api/v1/media/stream?limit=0&offset=0
```

```http
X-Media-Stream-Capped: true
```

```json
{
  "items": [ /* 5 条 */ ],
  "offset": 0,
  "next_offset": 5,
  "batch_size": 5,
  "returned": 5,
  "requested_total": null,
  "total_available": 800,
  "has_more": true,
  "capped": true
}
```

#### 越界（已拉完目标）

```http
GET /api/v1/media/stream?limit=10&offset=10
```

```json
{
  "items": [],
  "offset": 10,
  "next_offset": 10,
  "batch_size": 5,
  "returned": 0,
  "requested_total": 10,
  "total_available": 138,
  "has_more": false,
  "capped": false
}
```

### 3.6 断点续拉 / 错误恢复

- 不需要 cursor、不需要服务端会话状态。
- 客户端用最后一次成功的 `next_offset` 继续请求即可。
- 中途失败：重试相同 `(limit, offset)`，服务端是幂等的。

---

## 4. 端点对照表（迁移参考）

| 用途 | 旧端点 | 新端点（推荐） |
| --- | --- | --- |
| 普通分页 | `GET /api/v1/media?limit=N&offset=M` | **不变**（响应变精简） |
| 普通分页 | `GET /api/v1/media/by-source/..?..` | **不变**（响应变精简） |
| 普通分页 | `GET /api/v1/media/by-type/..?..` | **不变**（响应变精简） |
| 普通分页 | `GET /api/v1/media/recycle-bin?..` | **不变**（响应变精简） |
| 详情 | `GET /api/v1/media/{media_id}` | **不变**（仍返回完整 `MediaResponse`） |
| **流式首屏** | — | **`GET /api/v1/media/stream?limit=N&offset=M`** |
| **流式按来源** | — | **`GET /api/v1/media/by-source/{src}/stream?..`** |
| **流式按类型** | — | **`GET /api/v1/media/by-type/{type}/stream?..`** |
| **流式回收站** | — | **`GET /api/v1/media/recycle-bin/stream?..`** |

---

## 5. 前端迁移指南

### 5.1 普通列表（必须做）

- 列表 items 现在是 `MediaListItem` 而不是 `MediaResponse`。
- **删除字段引用**：前端若读取了 `generation_params` / `enterprise_id` / `deleted_at` / 音频字段 / `updated_at` / `created_by_*`，需要改为先拉列表再调详情端点。
- **`total` 字段语义变了**：现在是 DB 真实总数（之前是 `len(items)`），可正常用于分页 UI（如"第 X / Y 页"）。

### 5.2 首屏加载（建议做）

- 第一次渲染走 `/api/v1/media/stream?limit=10&offset=0`：
  1. 拿 5 条立即渲染首屏。
  2. 后台串行 / 并行发 `?limit=10&offset=5` 拉第二批。
  3. 中途失败用最后成功的 `next_offset` 重试。
- 与现有分页共存：用户切到第 2 页时仍可用 `?limit=N&offset=M` 普通列表。

### 5.3 React 示例（伪代码）

```tsx
async function loadFirstScreen() {
  const r1 = await fetch('/api/v1/media/stream?limit=10&offset=0');
  const page1: MediaStreamResponse = await r1.json();
  setItems([...page1.items]);
  if (!page1.has_more) return;

  // 继续拉取剩余
  let off = page1.next_offset;
  while (true) {
    const r = await fetch(`/api/v1/media/stream?limit=10&offset=${off}`);
    const p: MediaStreamResponse = await r.json();
    setItems((prev) => [...prev, ...p.items]);
    if (!p.has_more) break;
    off = p.next_offset;
  }
}
```

---

## 6. 向后兼容 / 回滚

### 6.1 兼容策略

- **响应 shape 变窄**：前端不再读取被剔除字段即可（多数前端只读保留字段，安全）。
- **新端点**：只新增 `/stream`，老端点不动。
- **`limit=0` 行为变化**：从"取全部"变为"最多 500 条 + 响应头标识"。前端若依赖"全部"语义，需自己处理 `X-Media-Limit-Capped: true`。

### 6.2 回滚方案

如需回滚：

1. [app/api/media.py](app/api/media.py)：四个列表端点改回 `response_model=MediaListResponse`，调用 `list_media(., summary_only=False)`。
2. [app/api/media_dto.py](app/api/media_dto.py)：保留 `MediaListItem` 与 `MediaListResponseV2`（不影响）。
3. [database/dao/media_dao.py](database/dao/media_dao.py)：保留新加的 `list_for_audience_summary` / `count_for_audience`（不影响）。
4. [app/services/media_service.py](app/services/media_service.py)：`list_media` 默认 `summary_only=False` 即可回滚老路径。

`/stream` 端点不受回滚影响，可保留作为新路径。

---

## 7. 关键文件

| 文件 | 改动 |
| --- | --- |
| [app/api/media_dto.py](../../app/api/media_dto.py) | 新增 `MediaListItem`、`MediaStreamResponse` |
| [app/api/media.py](../../app/api/media.py) | 4 个列表端点改精简响应；新增 4 个 `/stream` 端点；`STREAM_BATCH_SIZE=5`、`STREAM_HARD_CAP=500` |
| [app/services/media_service.py](../../app/services/media_service.py) | 新增 `_row_to_list_item`、`count_media`；`list_media` 支持 `summary_only` |
| [database/dao/media_dao.py](../../database/dao/media_dao.py) | 抽出 `_build_audience_where` 共享 WHERE 构造；新增 `list_for_audience_summary`、`count_for_audience`；排序加 `id DESC` tie-breaker |

---

## 8. 验证

### 8.1 列表瘦身验证

```bash
# items 不应包含 generation_params / mime_type / deleted_* 等字段
curl -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media?limit=5' \
  | jq '.items[0] | keys'
# 期望：只包含 §2.2 "保留字段" 中列出的 28 个 key
```

### 8.2 流式端点验证

```bash
# 第一批
curl -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media/stream?limit=10&offset=0' \
  | jq '.returned, .has_more, .next_offset'
# 期望：5, true, 5

# 第二批
curl -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media/stream?limit=10&offset=5' \
  | jq '.returned, .has_more'
# 期望：5, false
```

### 8.3 截断验证

```bash
# limit=0 且 DB > 500 时
curl -i -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media/stream?limit=0&offset=0' | head
# 期望：响应头 X-Media-Stream-Capped: true，body 中 capped=true
```

### 8.4 回归：详情不变

```bash
curl -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media/MEDIA-XXX' | jq '.generation_params, .deleted_at'
# 期望：都返回（非 null / 非缺失），证明详情端点未变
```

### 8.5 路由顺序验证

```bash
# /stream 必须路由到流式端点而不是被当作 media_id="stream"
curl -i -s -H "Authorization: Bearer $T" \
  'http://localhost:8000/api/v1/media/stream?limit=10'
# 期望：响应是 MediaStreamResponse，不是 404 NOT_FOUND
```

---

## 9. 相关文档

- 素材库主文档：[`docs/MEDIA_LIBRARY_API.md`](./MEDIA_LIBRARY_API.md)
- 上传 / 入库流程：[`docs/MEDIA_UPLOAD_GUIDE.md`](./MEDIA_UPLOAD_GUIDE.md)
- 通用模型 / 价格参考：[`docs/MODEL_DATA_SUMMARY.md`](./MODEL_DATA_SUMMARY.md)