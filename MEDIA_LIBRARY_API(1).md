# 素材库 API 文档

> 企业 / 员工上传图片 / 视频到本企业素材库；支持回收站、统计上报、跨企业隔离。
> 数据表：[`media_library`](../../database/sql/schema/08_media_library.sql)。
> **范围**：本版本**仅素材库**。社区素材 (`community_materials`) 暂不实现，按你确认的"后续需要再补"。

---

## 1. 接口列表

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/media` | 企业 / 员工 | 上传素材入素材库（仅人工上传；生成入库由 `/api/v1/generate` 自动完成） |
| GET | `/api/v1/media` | 任意已登录 | 素材通用列表（带 `media_type` / `media_source` 等 query 过滤） |
| GET | `/api/v1/media/by-source/{media_source}` | 任意已登录 | **按来源分组列表**（`generated` / `uploaded`） |
| GET | `/api/v1/media/by-type/{media_type}` | 任意已登录 | **按类型分组列表**（`image` / `video` / `audio`） |
| GET | `/api/v1/media/recycle-bin` | 任意已登录 | 回收站列表（status='deleted'） |
| GET | `/api/v1/media/{media_id}` | 任意已登录 | 素材详情 |
| PATCH | `/api/v1/media/{media_id}` | 创建者 / **本企业管理员** / 系统管理员 | 修改 `name` / `description` / `category` / `tags` / `thumbnail_url` |
| DELETE | `/api/v1/media/{media_id}` | 创建者 / **本企业管理员** / 系统管理员 | 软删（→ 回收站） |
| POST | `/api/v1/media/{media_id}/restore` | 创建者 / **本企业管理员** / 系统管理员 | 从回收站恢复 |
| POST | `/api/v1/media/{media_id}/purge` | **本企业管理员** / 系统管理员 | 立即永久删除（硬删，员工不能硬删） |
| POST | `/api/v1/media/{media_id}/view` | 任意已登录 | 上报 view_count + 1 |
| POST | `/api/v1/media/{media_id}/download` | 任意已登录 | 上报 download_count + 1 |
| POST | `/api/v1/media/{media_id}/use` | 任意已登录 | 上报 use_count + 1 |

> **重要：关于 `{media_id}`**：这里必须传素材业务键，例如 `MEDIA-AE032259`，不要传响应里的数据库主键 `id`（例如 `6`）。`DELETE /api/v1/media/6` 会被后端按 `media_id='6'` 查询，通常返回 `404 NOT_FOUND`。

**素材上传前奏**（不入库，只拿 URL）：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/upload/base64` | 上传 base64（≤50MB），返回公网 URL |
| POST | `/api/v1/upload/file` | 上传文件（multipart/form-data），返回公网 URL |
| GET | `/api/v1/upload/info` | 查看支持的文件格式 / 最大尺寸 |

**生成自动入库**（生成接口返回值带 `media_ids`）：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/generate` 或 `/api/v1/generate?sync=true` | 生成图片 / 视频；默认自动入库（`save_to_library: true`） |

---

## 2. 鉴权与隔离

### 2.1 谁可以创建？

| 调用方 | 写入字段 | 备注 |
| --- | --- | --- |
| **企业账号** | `creator_type='enterprise'`, `creator_id=<enterprise_id>`, `enterprise_id=<self>` | token 中的 `enterprise_id` 决定 |
| **员工账号** | `creator_type='account'`, `creator_id=<account_id>`, `account_id=<self>`, `enterprise_id=<self>` | `account_id` 来自 token claims |
| **系统管理员** | ❌ **无权限**入素材库 | 业务上系统管理员只审 / 删 / 看 |

### 2.2 谁可以看？

- **企业 / 员工**：仅看本企业素材
- **系统管理员**：看全部（含已删除）
- 跨企业访问 → `403 FORBIDDEN`

### 2.3 谁可以改 / 删 / 恢复 / 永久删？

| 操作 | 系统管理员 | 企业管理员（本企业） | 员工创建者本人 | 员工非创建者 |
| --- | :---: | :---: | :---: | :---: |
| 修改（PATCH） | ✅ 全部 | ✅ 本企业 | ✅ 自己 | ❌ |
| 软删（DELETE） | ✅ 全部 | ✅ 本企业 | ✅ 自己 | ❌ |
| 恢复（restore） | ✅ 全部 | ✅ 本企业 | ✅ 自己 | ❌ |
| 永久删（purge） | ✅ 全部 | ✅ 本企业 | ❌ | ❌ |

> - **企业管理员**：`user_type=enterprise`，可对本企业素材做任何操作（包括员工上传的素材）。
> - **员工创建者本人**：`user_type=employee` 且 `creator_id` / `created_by` 匹配 token 中的 `sub`（或 `account_id`）。
> - **员工非创建者**：完全无法操作别人的素材。
> - 跨企业访问 → `403 FORBIDDEN`；找不到记录 → `404 NOT_FOUND`。
> - 已删除素材不可修改（需先 `/restore`），但**仍可继续 purge**（如果权限允许）。
> - 永久删（`/purge`）员工账号**不允许**，防止普通员工误操作把整个素材硬删。

---

## 3. 回收站生命周期

```
                       ┌────────────────────────────┐
                       │  normal (status='normal')  │
                       └────────────────────────────┘
                                │   ▲
              DELETE            │   │  POST /restore
   (创建者 / 本企业管理员 / 系统管理员)│   │  (创建者 / 本企业管理员 / 系统管理员)
                                ▼   │
                       ┌────────────────────────────┐
                       │ deleted (status='deleted') │
                       │  deleted_at + 7d           │
                       └────────────────────────────┘
                                │
                  (7 天后 cleanup_expired_media 自动清理)
                                ▼
                          DB 记录消失

   任意状态 (normal / deleted) ──POST /purge──> 立即物理删除
                (本企业管理员 / 系统管理员)
```

- `DELETE` → schema 触发器自动写 `deleted_at` + `permanent_delete_at = +7d`
- `/restore` → 触发器自动清空 `deleted_at` 等字段
- `/purge` → `DELETE FROM media_library WHERE media_id = ...`（任意状态都可，**仅本企业管理员 / 系统管理员**）
- 后端可定期调用 SQL 函数：`SELECT * FROM cleanup_expired_media();`

> **跨权限矩阵**：所有删除/恢复/purge 操作都需要满足：
> - `user_type == 'admin'`，或
> - `user_type == 'enterprise'` 且素材 `enterprise_id` 等于调用方 `enterprise_id`，或
> - `user_type == 'employee'` 且素材 `creator_id` / `created_by` 等于调用方 `sub`（purge 除外）

---

## 4. 创建素材 `POST /api/v1/media`

### 4.1 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `media_type` | enum | ✅ | `image` / `video` |
| `media_source` | enum | ❌ | 默认 `uploaded`；`generated` 用于后续生成入库 |
| `media_name` | string(1-255) | ✅ | 素材名称 |
| `media_url` | string(1-2000) | ✅ | 对象存储 URL（必须先调上传接口拿 URL） |
| `thumbnail_url` | string(0-2000) | ❌ | 缩略图 URL |
| `file_size` | int(≥0) | ❌ | 字节 |
| `duration` | int(≥0) | ❌ | 视频时长（秒） |
| `width` / `height` | int(>0) | ❌ | 像素 |
| `format` | string(0-20) | ❌ | `jpg` / `png` / `mp4` 等 |
| `mime_type` | string(0-100) | ❌ | `image/jpeg` 等 |
| `category` | string(0-50) | ❌ | 业务分类 |
| `tags` | array<string> | ❌ | 最多 50 个；每个 1-50 字符 |
| `description` | string(0-2000) | ❌ | 描述 |
| `department_id` | string(3) | ❌ | 仅员工账号生效；3 位大写字母/数字 |

#### 音频专属字段（仅 `media_type='audio'` 时使用，2026-07 新增）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `sample_rate` | int(>0) | ❌ | 采样率 Hz，如 44100 |
| `channels` | int(1-8) | ❌ | 声道数，1=单声道/2=立体声 |
| `bitrate` | int(>0) | ❌ | 比特率 bps，如 128000 |
| `artist` | string(0-255) | ❌ | 演唱者/作者 |
| `album` | string(0-255) | ❌ | 专辑名 |
| `lyrics` | string | ❌ | 歌词（LRC 或纯文本） |
| `voice_id` | string(0-100) | ❌ | 关联音色 ID（配音/数字人业务） |
| `language` | string(0-10) | ❌ | IETF BCP 47 语言代码，如 `zh-CN` |
| `waveform_url` | string(0-2000) | ❌ | 预渲染波形图 URL（PNG/SVG） |

`generation_*` 字段（`generation_task_id` / `generation_prompt` / `generation_model` / `generation_params`）不在请求体内——它们是**生成入库**的产物，由后续生成入库接口填入。

### 4.2 请求示例

```bash
curl -X POST http://localhost:8003/api/v1/media \
  -H "Authorization: Bearer <enterprise_or_employee_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "image",
    "media_source": "uploaded",
    "media_name": "产品图 v1",
    "media_url": "https://storage.example.com/demo-company/images/product-v1.jpg",
    "thumbnail_url": "https://storage.example.com/demo-company/thumbnails/product-v1-thumb.jpg",
    "file_size": 524288,
    "width": 1920,
    "height": 1080,
    "format": "jpg",
    "mime_type": "image/jpeg",
    "category": "产品素材",
    "tags": ["产品", "v1", "宣传"],
    "description": "2026 春季新版产品图"
  }'
```

### 4.3 成功响应（HTTP 201）

```json
{
  "id": 6,
  "media_id": "MEDIA-AE032259",
  "enterprise_id": "demo-company",
  "creator_type": "enterprise",
  "creator_id": "demo-company",
  "account_id": null,
  "user_id": null,
  "department_id": null,
  "media_type": "image",
  "media_source": "uploaded",
  "media_name": "产品图 v1",
  "media_url": "https://...",
  "thumbnail_url": "https://...",
  "file_size": 524288,
  "duration": null,
  "width": 1920,
  "height": 1080,
  "format": "jpg",
  "mime_type": "image/jpeg",
  "generation_task_id": null,
  "generation_prompt": null,
  "generation_model": null,
  "generation_params": null,
  "category": "产品素材",
  "tags": ["产品", "v1", "宣传"],
  "description": "2026 春季新版产品图",
  "view_count": 0,
  "download_count": 0,
  "use_count": 0,
  "status": "normal",
  "deleted_at": null,
  "deleted_by_type": null,
  "deleted_by": null,
  "delete_reason": null,
  "permanent_delete_at": null,
  "created_at": "2026-06-04T10:00:00",
  "updated_at": "2026-06-04T10:00:00",
  "created_by_type": "enterprise",
  "created_by": "demo-company"
}
```

### 4.4 错误响应

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 401 | `TOKEN_*` | 鉴权失败 |
| 403 | `FORBIDDEN` | 系统管理员无创建权限 |
| 409 | `MEDIA_ID_CONFLICT` | ID 冲突（极小概率，重试即可） |
| 422 | （Pydantic 422） | 字段缺失 / 格式错 / tag 空 / department_id 不符合 3 位大写 |

---

## 5. 列表 `GET /api/v1/media`

### 5.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `media_type` | enum | — | `image` / `video` |
| `media_source` | enum | — | `generated` / `uploaded` |
| `creator_type` | enum | — | `enterprise` / `account` |
| `category` | string | — | 精确匹配 |
| `keyword` | string | — | 模糊匹配 `media_name` / `description`（`ILIKE %kw%`） |
| `limit` | int(1-200) | 50 | 单页数量 |
| `offset` | int(≥0) | 0 | 偏移 |

排序：`created_at DESC`

### 5.2 响应

```json
{ "total": 23, "items": [ ... ] }
```

`total` 为当前页返回数（**非全量总数**）。

---

## 6. 详情 `GET /api/v1/media/{media_id}`

- 跨企业 → `403 FORBIDDEN`
- 已删除素材 → `404 NOT_FOUND`（普通调用）；要看已删除的需通过 `/recycle-bin` 或加查询参数

---

## 7. 修改 `PATCH /api/v1/media/{media_id}`

### 7.1 字段白名单

`media_name` / `description` / `category` / `tags` / `thumbnail_url`

> ❌ **不允许**改 `media_url` / `media_type` / `media_source` / `enterprise_id` / `creator_*` 等核心字段——这些需要新建一条记录或管理员特批。

### 7.2 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 403 | `FORBIDDEN` | 无权修改（既非系统管理员，也非创建者） |
| 404 | `NOT_FOUND` | 素材不存在 |
| 409 | `DELETED` | 已删除素材不可改（先 `/restore`） |

---

## 8. 软删 `DELETE /api/v1/media/{media_id}`

把素材移到回收站。schema 触发器自动写 `deleted_at` + `permanent_delete_at = NOW() + 7d`。

### 8.1 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `media_id` | string | ✅ | 素材业务键，例如 `MEDIA-AE032259` |

> ⚠️ 注意：这里不是响应里的数据库主键 `id`。如果前端调用 `DELETE /api/v1/media/6`，后端会按 `media_id='6'` 查询，通常返回 `404 NOT_FOUND`。

### 8.2 请求体（可选）

```json
{ "reason": "产品已下架" }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `reason` | string(≤255) | ❌ | 删除原因，写入 `media_library.delete_reason` |

如果不需要传 reason，**不要传请求体**或传 `{}` 都可以。

### 8.3 权限（按优先级，任一即可）

| 调用方 | 能否删除 |
| --- | :---: |
| 系统管理员（任意素材） | ✅ |
| 企业管理员（**本企业**素材） | ✅ |
| 员工创建者本人（自己 `creator_id` 匹配的素材） | ✅ |
| 其它企业的素材 / 其它员工的素材 | ❌ `403 FORBIDDEN` |
| 跨企业访问 | ❌ `403 FORBIDDEN` |
| 系统管理员直接调用本接口 | ✅ |

### 8.4 请求示例

```bash
# 用业务键（必须使用 media_id，不是 id）
curl -X DELETE "http://localhost:8003/api/v1/media/MEDIA-AE032259" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "产品已下架" }'

# 不带 reason
curl -X DELETE "http://localhost:8003/api/v1/media/MEDIA-AE032259" \
  -H "Authorization: Bearer <token>"
```

### 8.5 成功响应（HTTP 200）

返回**软删后**的素材完整信息（`status='deleted'`）：

```json
{
  "id": 6,
  "media_id": "MEDIA-AE032259",
  "enterprise_id": "demo-company",
  "creator_type": "account",
  "creator_id": "shuquzhi31010002",
  "account_id": "shuquzhi31010002",
  "user_id": null,
  "department_id": null,
  "media_type": "image",
  "media_source": "uploaded",
  "media_name": "产品图 v1",
  "media_url": "https://...",
  "thumbnail_url": "https://...",
  "file_size": 524288,
  "duration": null,
  "width": 1920,
  "height": 1080,
  "format": "jpg",
  "mime_type": "image/jpeg",
  "generation_task_id": null,
  "generation_prompt": null,
  "generation_model": null,
  "generation_params": null,
  "category": "产品素材",
  "tags": ["产品"],
  "description": "2026 春季新版产品图",
  "view_count": 12,
  "download_count": 3,
  "use_count": 1,
  "status": "deleted",
  "deleted_at": "2026-07-08T10:30:00",
  "deleted_by_type": "account",
  "deleted_by": "shuquzhi31010002",
  "delete_reason": "产品已下架",
  "permanent_delete_at": "2026-07-15T10:30:00",
  "created_at": "2026-07-01T10:00:00",
  "updated_at": "2026-07-08T10:30:00",
  "created_by_type": "account",
  "created_by": "shuquzhi31010002"
}
```

### 8.6 副作用

- schema 触发器自动写：
  - `status` ← `'deleted'`
  - `deleted_at` ← `NOW()`
  - `deleted_by_type` ← `'admin'` / `'enterprise'` / `'account'`（取决于调用方）
  - `deleted_by` ← 调用方 `sub` / `enterprise_id` / `account_id`
  - `delete_reason` ← 请求体的 `reason`（如未传则为 `NULL`）
  - `permanent_delete_at` ← `NOW() + 7 days`
- 7 天后由 `cleanup_expired_media()` SQL 函数自动清理（删 DB 记录，不删云存储）
- 软删后，`GET /api/v1/media/{media_id}` 普通列表接口不再返回该素材；仅在 `/recycle-bin` 列表中可见

### 8.7 错误响应

| HTTP | `code` | 触发条件 | 含义 |
| --- | --- | --- | --- |
| 401 | `TOKEN_MISSING` | 无 Bearer token | 缺少 Authorization |
| 401 | `TOKEN_INVALID` | JWT 过期 / 签名错 / 格式错 | token 无效 |
| 403 | `FORBIDDEN` | 跨企业 / 越权（既不是创建者也不是本企业管理员也不是系统管理员） | 无权操作 |
| 404 | `NOT_FOUND` | 路径参数既不匹配任何业务键也不匹配任何主键 ID | 素材不存在 |
| 409 | `ALREADY_DELETED` | 素材当前已是 `status='deleted'` | 已经处于软删状态，不能再软删 |

### 8.8 前端调用建议

```js
// 用后端返回的 media_id 业务键（必须使用 media_id，不是 id）
await axios.delete(`/api/v1/media/${item.media_id}`, {
  data: { reason: '产品已下架' },
  headers: { Authorization: `Bearer ${token}` },
})

// ❌ 错误示例：不要用 DB 主键 id
// await axios.delete(`/api/v1/media/${item.id}`)
```

如果前端使用了列表中拿到的 `item.id`（整数）调用删除，例如 `DELETE /api/v1/media/6`，后端会按 `media_id='6'` 查询，通常返回 `404 NOT_FOUND`。正确做法是使用 `item.media_id`。

---

## 9. 回收站 `GET /api/v1/media/recycle-bin`

列出当前用户**可见**的、状态为 `deleted` 的素材（即 7 天内软删的素材）。

### 9.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | int(0-200) | 50 | 单页数量；`0` 表示不限制（返回全部） |
| `offset` | int(≥0) | 0 | 偏移 |

> 其他过滤维度（`media_type` / `media_source` / `creator_type` / `keyword` 等）当前**不支持**，只能拿到所有已删素材。如需要筛选，请用通用列表 `GET /api/v1/media?media_source=uploaded&status=deleted` 的扩展（后续版本可能支持）。

### 9.2 可见性

| 调用方 | 看到的素材 |
| --- | --- |
| 系统管理员 | 所有企业的已删素材 |
| 企业账号 | 本企业的已删素材 |
| 员工账号 | 本企业的已删素材（不区分创建者） |

### 9.3 响应

```json
{ "total": 5, "items": [ /* MediaResponse 列表，status='deleted' */ ] }
```

每条 item 与 §8.5 软删响应一致，含 `deleted_at` / `permanent_delete_at` / `delete_reason` 字段。

### 9.4 示例

```bash
curl "http://localhost:8003/api/v1/media/recycle-bin?limit=20" \
  -H "Authorization: Bearer <token>"
```

### 9.5 错误响应

| HTTP | `code` | 触发条件 |
| --- | --- | --- |
| 401 | `TOKEN_*` | token 无效 |
| 422 | （Pydantic） | `limit` 超范围（>200 / <0）或 `offset` 为负 |

---

## 10. 恢复 `POST /api/v1/media/{media_id}/restore`

把已软删的素材恢复到 `status='normal'`。schema 触发器自动清空 `deleted_at` 等字段。

### 10.1 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `media_id` | string | ✅ | 素材业务键，例如 `MEDIA-AE032259` |

### 10.2 请求体

无。

### 10.3 权限（与软删一致）

| 调用方 | 能否恢复 |
| --- | :---: |
| 系统管理员（任意素材） | ✅ |
| 企业管理员（**本企业**素材） | ✅ |
| 员工创建者本人（自己 `creator_id` 匹配的素材） | ✅ |
| 其它企业的素材 / 其它员工的素材 | ❌ `403 FORBIDDEN` |
| 未软删的素材（`status='normal'`） | ❌ `409 NOT_DELETED` |

### 10.4 请求示例

```bash
curl -X POST "http://localhost:8003/api/v1/media/MEDIA-AE032259/restore" \
  -H "Authorization: Bearer <token>"
```

### 10.5 成功响应（HTTP 200）

返回恢复后的素材完整信息（`status='normal'`，`deleted_at` 等清空）：

```json
{
  "id": 6,
  "media_id": "MEDIA-AE032259",
  "media_name": "产品图 v1",
  "status": "normal",
  "deleted_at": null,
  "deleted_by_type": null,
  "deleted_by": null,
  "delete_reason": null,
  "permanent_delete_at": null,
  "updated_at": "2026-07-08T11:00:00"
  /* ... 其他字段不变 ... */
}
```

### 10.6 副作用

- schema 触发器自动清空：
  - `status` ← `'normal'`
  - `deleted_at` ← `NULL`
  - `deleted_by_type` ← `NULL`
  - `deleted_by` ← `NULL`
  - `delete_reason` ← `NULL`
  - `permanent_delete_at` ← `NULL`
  - `updated_at` ← `NOW()`
- 恢复后，素材重新出现在普通列表接口（`GET /api/v1/media`）中
- **不要**影响 `view_count` / `download_count` / `use_count` 等统计字段

### 10.7 错误响应

| HTTP | `code` | 触发条件 |
| --- | --- | --- |
| 401 | `TOKEN_*` | token 无效 |
| 403 | `FORBIDDEN` | 跨企业 / 越权 |
| 404 | `NOT_FOUND` | 素材不存在（既不匹配业务键也不匹配 ID） |
| 409 | `NOT_DELETED` | 素材当前不是 `deleted` 状态（说明未软删过或已 purge） |

### 10.8 典型流程

```
1. DELETE /api/v1/media/MEDIA-AE032259
   → status='deleted'

2. （后悔了或误删）

3. POST /api/v1/media/MEDIA-AE032259/restore
   → status='normal'，deleted_at 清空
```

---

## 11. 立即永久删除 `POST /api/v1/media/{media_id}/purge`

绕过 7 天回收站期，立即从 `media_library` 表中**物理删除**记录。

### 11.1 路径参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `media_id` | string | ✅ | 素材业务键，例如 `MEDIA-AE032259` |

### 11.2 请求体

无。

### 11.3 权限（比软删 / 恢复更严）

| 调用方 | 能否永久删除 |
| --- | :---: |
| 系统管理员（任意素材） | ✅ |
| 企业管理员（**本企业**素材） | ✅ |
| 员工创建者本人 | ❌ `403 FORBIDDEN`（防止普通员工误硬删） |
| 其它企业的素材 / 其它员工的素材 | ❌ `403 FORBIDDEN` |

> 设计原则：**软删 + 7 天回收站**已经提供了撤销窗口，硬删是少数需要强制清理的场景，因此只开放给系统管理员和本企业管理员。

### 11.4 请求示例

```bash
curl -X POST "http://localhost:8003/api/v1/media/MEDIA-AE032259/purge" \
  -H "Authorization: Bearer <admin_or_enterprise_admin_token>"
```

### 11.5 成功响应（HTTP 200）

```json
{ "media_id": "MEDIA-AE032259", "purged": true }
```

### 11.6 副作用

- `DELETE FROM media_library WHERE media_id = 'MEDIA-AE032259'` —— 物理删除记录
- 数据库记录消失后：
  - `GET /api/v1/media/{media_id}` → `404 NOT_FOUND`
  - `/recycle-bin` 列表中也不再可见
  - 统计上报接口（`view` / `download` / `use`）→ `404`
- **不**会删除云存储上的文件 URL（VOD / COS / S3 等）。当前版本只删 DB 记录，URL 仍然可访问；
  后续如果接入云存储回调或 Lifecycle 规则可以一并清理（**注意**：当前未实现，可能产生"孤儿文件"）

### 11.7 错误响应

| HTTP | `code` | 触发条件 |
| --- | --- | --- |
| 401 | `TOKEN_*` | token 无效 |
| 403 | `FORBIDDEN` | 员工账号调用 / 跨企业访问 / 无权限 |
| 404 | `NOT_FOUND` | 素材不存在 |
| 500 | `DB_ERROR` | 数据库执行失败（极小概率，并发或锁） |

### 11.8 不可恢复性警告

> ⚠️ **purge 不可撤销**。一旦记录从 DB 删除，引用这个 `media_id` 的地方全部 404。
>
> 推荐流程：**先用软删（DELETE）→ 7 天后再 purge**，让用户有恢复窗口。
> 只有在以下情况才直接 purge：
> - 上传了违规内容需立即清理
> - 测试 / 调试产生的脏数据
> - 用户明确要求"立即永久删除"

### 11.9 软删 vs 永久删 对照表

| 维度 | 软删（DELETE） | 永久删（/purge） |
| --- | --- | --- |
| 操作 | `status='deleted'` + 写删除元数据 | `DELETE FROM media_library` |
| 可恢复 | ✅ 7 天内 `/restore` | ❌ 不可恢复 |
| 权限 | 创建者 / 本企业管理员 / 系统管理员 | 本企业管理员 / 系统管理员 |
| 普通列表可见 | ❌（软删后不可见） | ❌（记录不存在） |
| 回收站可见 | ✅ | ❌ |
| 云存储文件 | 不动 | 不动（可能产生孤儿文件） |
| 性能 | 触发器一次 UPDATE | 直接 DELETE |
| 适用场景 | 用户取消 / 临时下架 / 误删兜底 | 违规清理 / 硬性数据清理 |

---

## 12. 统计上报

| 端点 | 累加 | 适用 |
| --- | --- | --- |
| `POST /media/{id}/view` | `view_count + 1` | 列表页打开时 |
| `POST /media/{id}/download` | `download_count + 1` | 实际下载文件后 |
| `POST /media/{id}/use` | `use_count + 1` | 用作生成 / 编辑的输入时 |

响应（三个端点同形）：

```json
{
  "media_id": "MEDIA-AE032259",
  "view_count": 12,
  "download_count": 3,
  "use_count": 1
}
```

仅对 `status='normal'` 的素材累加；已删除或不存在 → `404 NOT_FOUND`。

> 三个上报端点都**不**做去重 / 防刷。如果未来需要"同一用户 5 分钟内只算一次"，可加 `media_view_logs` 表（本版本不实现）。

---

## 13. 完整生命周期示例

### 13.1 普通路径（员工上传 → 软删 → 恢复 → 7天后自动清理）

```
1. 员工 A 上传图片
   POST /api/v1/media  {media_type:'image', media_name, media_url, ...}
   → media_id = "MEDIA-XXXXXXXX", status='normal'

2. 列表查询
   GET /api/v1/media?media_type=image
   → [该素材, ...]

3. 详情查看
   GET /api/v1/media/MEDIA-XXXXXXXX
   → { ... 完整字段 }

4. 触发浏览统计
   POST /api/v1/media/MEDIA-XXXXXXXX/view
   → view_count=1

5. 当作生成输入
   POST /api/v1/media/MEDIA-XXXXXXXX/use
   → use_count=1
   （然后用 media_url 作为 input_files[0].url 调 /api/v1/generate）

6. 7 天内软删（员工 A 本人 OR 企业管理员 OR 系统管理员 都可以）
   DELETE /api/v1/media/MEDIA-XXXXXXXX  {reason: '产品下架'}
   → status='deleted', deleted_at=NOW(), permanent_delete_at=NOW()+7d

7. 误删恢复（同样权限）
   POST /api/v1/media/MEDIA-XXXXXXXX/restore
   → status='normal'
```

### 13.2 永久清理路径（合规删除 / 误操作不可恢复场景）

```
1. （任何状态下的素材 — normal 或 deleted）
   POST /api/v1/media/MEDIA-XXXXXXXX/purge  (本企业管理员 / 系统管理员)
   → { media_id: 'MEDIA-XXXXXXXX', purged: true }
   → DB 记录立即消失;7 天等待窗口跳过
```

### 13.3 跨权限对比示例

假设 `media_id=MEDIA-XXX` 是企业 A 的员工 B 上传的：

| 调用方 | 是否能 DELETE | 是否能 restore | 是否能 purge |
| --- | :---: | :---: | :---: |
| 系统管理员 | ✅ | ✅ | ✅ |
| 企业 A 的企业管理员 token | ✅ | ✅ | ✅ |
| 员工 B（创建者）自己的 token | ✅ | ✅ | ❌ |
| 企业 A 的员工 C（非创建者）token | ❌ | ❌ | ❌ |
| 企业 X 的任何 token（跨企业） | ❌ | ❌ | ❌ |

---

## 14. 范围之外（未实现）

- **社区素材**（`community_materials` 表）：本版本不实现
- **审核流**：本版本素材入素材库不需要审核
- **去重 / 防刷统计**：上报接口无条件 +1
- **批量操作**：批量软删 / 批量恢复 / 批量改 category
- **跨企业共享素材**：业务上不开放
- **存储管理**：URL 引用层，不直接管理对象存储桶

如需扩展，请基于 [app/api/media.py](../../app/api/media.py) + [app/services/media_service.py](../../app/services/media_service.py) + [database/dao/media_dao.py](../../database/dao/media_dao.py) 继续迭代。

---

## 15. 生成自动入库（新）

> 用户最常见的诉求:AI 生成的图 / 视频,我希望能直接出现在"我的素材"里。
> 现在默认开启,生成接口返回值里多一个 `media_ids` 字段,前端可以直接渲染"已存入素材库"提示。

### 15.1 触发机制

在 `MediaGenerationRequest` 里加了两个字段（向前兼容）:

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `save_to_library` | bool | `true` | 是否自动入库。`false` 时只返回结果 URL,不创建素材记录 |
| `library_tags` | array<string> | `[]` | 入库时贴的标签,空表示不贴 |

### 15.2 入库字段映射

| `media_library` 字段 | 来源 |
| --- | --- |
| `media_type` | `request.model_type` (`image` / `video` / `audio`) |
| `media_source` | `'generated'`（**始终**） |
| `media_name` | prompt 前 32 字符 + ` #N`（多张时） |
| `media_url` | `result.url`（VOD 公网 URL） |
| `thumbnail_url` | `result.thumbnail` |
| `width` / `height` / `duration` / `file_size` | 从 `result.metadata` 推断 |
| `format` | URL 后缀（jpg/png/mp4...） |
| `generation_task_id` | 本次 task_id |
| `generation_prompt` | `request.prompt` |
| `model_id` | `request.model_name` |
| `generation_params` | `request.parameters`（JSONB） |
| `tags` | `request.library_tags` |
| `creator_type` / `creator_id` / `account_id` / `enterprise_id` | 调用方 token 信息 |

### 15.3 调用示例

```bash
curl -X POST "http://localhost:8000/api/v1/generate?sync=true" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "vendor_b",
    "model_type": "image",
    "model_name": "gpt-image-1.5",
    "prompt": "水墨山水画",
    "parameters": {
      "ratio": "16:9",
      "resolution": "1080P",
      "count": 2
    },
    "save_to_library": true,
    "library_tags": ["山水", "宣传图"]
  }'
```

### 15.4 响应

```json
{
  "id": "task_20260701024642_xxx",
  "status": "completed",
  "model_type": "image",
  "vendor": "vendor_b",
  "results": [
    {"url": "https://1500066181.vod-qcloud.com/.../img1.png", "metadata": {...}},
    {"url": "https://1500066181.vod-qcloud.com/.../img2.png", "metadata": {...}}
  ],
  "media_ids": [
    "MEDIA-AE031122",
    "MEDIA-AE031123"
  ],
  "created_at": "2026-07-01T...",
  "updated_at": "2026-07-01T..."
}
```

`media_ids[i]` 与 `results[i]` 一一对应。

### 15.5 不入库的场景

```json
{
  "save_to_library": false
}
```

或调用方没有登录态（后台批处理任务） — 自动跳过入库,返回 `media_ids: []`。

### 15.6 错误容忍

入库失败**不影响**主流程:打印警告日志,不影响 `results` / `usage` / `media_ids` 字段。前端拿到正常结果 + 部分 media_id 缺失,可以稍后重试或让用户手动补录。

---

前端上传 / 调用生成 → 素材入库的**两条独立路径**，必须清楚：

```
┌─────────────────────────────────────────────────────────────────┐
│  路径 A:用户主动上传(适合"上传一张产品图")                         │
└─────────────────────────────────────────────────────────────────┘
   1. POST /api/v1/upload/base64  (或 /upload/file)
      → {url, file_info}            // 仅拿到 URL,不入库
   2. POST /api/v1/media
      → {media_id, media_url, ...} // 手动创建素材记录,得到 media_id

┌─────────────────────────────────────────────────────────────────┐
│  路径 B:生成结果自动入库(适合"AI 生成后想存到我的素材")            │
└─────────────────────────────────────────────────────────────────┘
   POST /api/v1/generate  (或 ?sync=true)
   请求体: {... save_to_library: true  // 默认 true}
   → {results: [...], media_ids: ["MEDIA-XXX", ...]}  // 一个 result 对应一个 media_id
```

**前端 UI 建议**：
- 上传页用路径 A（手动控制入库时机）
- 生成结果页用路径 B 的返回值 `media_ids` 显示"已存入素材库"提示
- 素材库列表页同时展示两种来源（`by-source/generated` / `by-source/uploaded`）

---

## 16. 文件上传接口（不入库）

### 16.1 base64 上传 `POST /api/v1/upload/base64`

#### 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `data` | string | ✅ | base64 编码的媒体数据（`data:image/jpeg;base64,...` 或纯 base64） |
| `media_type` | enum | ✅ | `image` / `video` / `audio` |
| `upload_to_vod` | bool | ❌ | 默认 `true`；上传到 VOD 拿到公网 URL |

#### 响应

```json
{
  "url": "https://1500066181.vod-qcloud.com/a7521f11vodcd1500066181/xxx/abc.mp4",
  "file_info": {
    "is_valid": true,
    "size_mb": 2.45,
    "format": "mp4",
    "mime_type": "video/mp4",
    "width": 1920,
    "height": 1080,
    "duration": 30
  }
}
```

#### 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | （无 code,detail 是字符串） | 文件过大（>50MB）或格式不支持 |
| 500 | （无 code） | VOD 上传失败 / 网络错误 |

### 16.2 multipart 文件上传 `POST /api/v1/upload/file`

#### 请求（multipart/form-data）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | binary | ✅ | 文件本体 |
| `upload_to_vod` | bool | ❌ | 默认 `true` |

#### 响应

```json
{
  "url": "https://1500066181.vod-qcloud.com/.../xxx.mp4",
  "filename": "my-video.mp4",
  "size_mb": 12.34
}
```

### 16.3 上传配置 `GET /api/v1/upload/info`

返回支持的格式 + 大小限制,前端启动时拉一次缓存即可。

```json
{
  "max_file_size_mb": 50,
  "supported_formats": {
    "image": ["jpg", "jpeg", "png", "gif", "webp"],
    "video": ["mp4", "webm", "avi", "mov"],
    "audio": ["mp3", "wav", "ogg", "m4a"]
  },
  "upload_methods": [
    {"method": "base64", "endpoint": "/api/v1/upload/base64"},
    {"method": "file",   "endpoint": "/api/v1/upload/file"}
  ]
}
```

> ⚠️ **当前版本** `supported_formats.audio` 仅 4 种（mp3/wav/ogg/m4a）；后续 [migration 34](../../database/sql/schema/34_media_library_audio.sql) 会扩展到 6 种（+aac/flac）。

---

## 17. 按来源 / 类型分组查询（新）

> 业务常见查询:用户希望"只看我生成的图片"、"只看我上传的视频"等。
> 之前的通用 `GET /api/v1/media` 只支持 query 拼接,前端要自己组合过滤参数。
> 这里提供 2 个**语义化**的 endpoint,直接表达业务意图。

### 17.1 按来源查询 `GET /api/v1/media/by-source/{media_source}`

| 路径 | 含义 |
| --- | --- |
| `GET /api/v1/media/by-source/generated` | 所有 **AI 生成的**素材(图 + 视 + 音) |
| `GET /api/v1/media/by-source/uploaded`  | 所有 **用户上传的**素材 |

#### 路径参数

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `media_source` | `generated` / `uploaded` | 必填 |

#### Query 参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `media_type` | enum | — | 进一步过滤 `image` / `video` / `audio` |
| `creator_type` | enum | — | `enterprise` / `account` |
| `category` | string | — | 精确匹配 |
| `keyword` | string | — | 模糊匹配 name/description |
| `limit` | int | 50 | 单页数量 |
| `offset` | int | 0 | 偏移 |

#### 示例

```bash
# 所有 AI 生成的素材
curl /api/v1/media/by-source/generated

# AI 生成的图片
curl /api/v1/media/by-source/generated?media_type=image

# 用户上传的音频(注:音频目前只有 uploaded,因为没有 AI 音频模型)
curl /api/v1/media/by-source/uploaded?media_type=audio

# AI 生成的视频 + 按名字搜索"宣传"
curl "/api/v1/media/by-source/generated?media_type=video&keyword=宣传"
```

#### 响应

同通用列表（[§5](#5-列表-get-apiv1media)）。

### 17.2 按类型查询 `GET /api/v1/media/by-type/{media_type}`

| 路径 | 含义 |
| --- | --- |
| `GET /api/v1/media/by-type/image` | 所有 **图片**素材（生成 + 上传） |
| `GET /api/v1/media/by-type/video` | 所有 **视频**素材 |
| `GET /api/v1/media/by-type/audio` | 所有 **音频**素材 |

#### 路径参数

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `media_type` | `image` / `video` / `audio` | 必填 |

#### Query 参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `media_source` | enum | — | 进一步过滤 `generated` / `uploaded` |
| 其他 | – | – | 同 §17.1 |

#### 示例

```bash
# 所有图片
curl /api/v1/media/by-type/image

# 用户上传的视频
curl "/api/v1/media/by-type/video?media_source=uploaded"

# AI 生成的音频(可能为空,取决于是否有 AI 音频模型)
curl "/api/v1/media/by-type/audio?media_source=generated"
```

---

## 18. 通用列表查询 `GET /api/v1/media`

当上面 2 个分组 endpoint 不够灵活时（比如同时按多种条件组合过滤），用通用 endpoint。

### 18.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `media_type` | enum | — | `image` / `video` / `audio` |
| `media_source` | enum | — | `generated` / `uploaded` |
| `creator_type` | enum | — | `enterprise` / `account` |
| `category` | string | — | 精确匹配 |
| `keyword` | string | — | 模糊匹配 `media_name` / `description`（`ILIKE %kw%`） |
| `limit` | int(1-200) | 50 | 单页数量 |
| `offset` | int(≥0) | 0 | 偏移 |

排序：`created_at DESC`

> **前端推荐**：能用 `/by-source` 或 `/by-type` 就别用通用 endpoint,语义更清晰。

---
