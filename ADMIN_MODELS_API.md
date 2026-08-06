# AI 模型管理 API 文档（管理员后台）

> 面向 **系统管理员** 的 AI 模型 CRUD + 启停 + 定价管理。
> 所有端点都要求 `user_type=admin`。
>
> 数据表：[`19_ai_models.sql`](../../database/sql/schema/19_ai_models.sql)（含 5 张子表） +
> [`31_admin_models_changelog_fix.sql`](../../database/sql/schema/31_admin_models_changelog_fix.sql)（changelog 类型对齐）
>
> 实现位置：
> - 路由：[`app/api/admin/models.py`](../../app/api/admin/models.py)
> - DAO：[`database/dao/ai_model_dao.py`](../../database/dao/ai_model_dao.py)
> - Seeder（JSON 灌库）：[`database/dao/ai_model_seeder.py`](../../database/dao/ai_model_seeder.py)
>
> 与"只读模型目录 API"的区别（[`docs/FRONTEND_API_V3.md`](FRONTEND_API_V3.md)）：
>
> | | `/api/v1/models*` | `/api/v1/admin/models*` |
> | --- | --- | --- |
> | 谁可调 | 任意已登录用户 | 仅系统管理员 |
> | 主要用途 | 前端下拉框 / 选模型 | 后台 CRUD / 改价 |
> | 字段范围 | 公开字段 + 计算字段 | 全部字段（含配置 / 定价 / 启停）|

---

## 0. 权限

所有端点要求 JWT claims 含 `user_type == "admin"`。其他 user_type 一律返回 `403 FORBIDDEN`。

> 与 `POST /api/v1/generate` 一致：管理员账号虽然能**管理**模型，但**不能**发起生成（按 `require_non_admin` 约定）。要测试模型请用企业子账号。

---

## 1. 接口列表（12 个端点）

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/admin/models` | 模型列表（按 vendor / media_type / status / is_enabled 过滤；`?include_deleted=true` 回收站视图） |
| **`POST`** | **`/api/v1/admin/models`** | **新增模型** |
| `GET` | `/api/v1/admin/models/{model_id}` | 详情（含 `ai_model_configs` 字段；软删模型也可访问） |
| `PATCH` | `/api/v1/admin/models/{model_id}` | 局部更新（自动 diff + changelog） |
| `POST` | `/api/v1/admin/models/{model_id}/enable` | 启用 |
| `POST` | `/api/v1/admin/models/{model_id}/disable` | 停用 |
| `POST` | `/api/v1/admin/models/{model_id}/clone` | **复制/克隆模型**（迁移 model_id / 派生新模型） |
| `DELETE` | `/api/v1/admin/models/{model_id}` | **删除模型**（默认软删；`?force=true` 硬删） |
| `POST` | `/api/v1/admin/models/{model_id}/restore` | **恢复软删的模型** |
| `GET` | `/api/v1/admin/models/{model_id}/usage` | 用量统计（按小时聚合） |
| `GET` | `/api/v1/admin/models/{model_id}/changelog` | 变更历史 |
| `POST` | `/api/v1/admin/models/sync-from-json` | 从 `data/*.json` 重新灌入 |

---

## 2. 字段总表

### 2.1 必填字段（创建时）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `model_id` | string 1-100 | UNIQUE | 业务标识，例如 `kling_3_0` / `gemini-2.5-pro` |
| `model_name` | string 1-50 | - | 模型名（厂商内部名），例如 `Kling` / `Gemini` |
| `model_version` | string 1-20 | - | 版本号，例如 `3.0` / `2.5` |
| `display_name` | string 1-100 | - | 展示名，例如 `Kling 3.0` |
| `vendor` | enum | `vendor_a` / `vendor_b` | 厂商标识（与 `app/vendors/` 一致） |
| `media_type` | enum | `image` / `video` / `audio` | 模型类型 |

### 2.2 可选字段

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `vendor_display_name` | string 1-100 | NULL | 厂商展示名（"腾讯云 VOD"） |
| `supported_features` | list[string] | NULL | `["text_to_video", "image_to_video", ...]` |
| `supported_resolutions` | list[string] | NULL | `["720P", "1080P", "2K", "4K"]` |
| `supported_aspect_ratios` | list[string] | NULL | `["16:9", "9:16", "1:1"]` |
| `max_width` / `min_width` | int 256-4096 | max=4096, min=256 | 像素限制 |
| `max_height` / `min_height` | int 256-4096 | max=4096, min=256 | 像素限制 |
| `max_duration` | int 1-N | NULL | 视频最大时长（秒） |
| `max_fps` | int 1-60 | NULL | 最大帧率 |
| `price_per_request` | float ≥ 0 | NULL | 按次收费（图像 / 音频） |
| `price_per_second` | float ≥ 0 | NULL | 按秒收费（视频） |
| `price_multiplier` | float | 1.00 | 费用倍率（运营调价用） |
| `currency` | string | `CNY` | 货币单位 |
| `price_tiers` | dict | NULL | 按分辨率分级定价（见 2.3） |
| `status` | enum | `active` | `active` / `deprecated` / `unavailable` |
| `is_enabled` | bool | `true` | 总开关；`false` 时模型从前端下拉中消失 |
| `availability_region` | string | NULL | 例如 `ap-guangzhou` |
| `description` | text | NULL | 后台自由文本 |
| `tags` | list[string] | NULL | 例如 `["高清", "快速"]` |

### 2.3 `price_tiers` 格式（按分辨率分级定价）

```json
{
  "720p":  0.30,
  "1080p": 0.50,
  "2K":    1.20,
  "4K":    2.40
}
```

- 键 = 分辨率字符串（大小写不敏感）
- 值 = 单价（图像:元/张；视频:元/秒）
- 特殊键 `default` 作为兜底
- 至多 32 个键
- 与 `price_per_request` / `price_per_second` 是**互补**关系：
  - `price_tiers` 非空 → 优先查分辨率
  - `price_tiers` 为空 / null → 回退 `price_per_request`（图）或 `price_per_second`（视）

实际定价计算走 [`app/services/pricing_service.py`](../../app/services/pricing_service.py) 的 `compute_price()`。

---

## 3. 列表 `GET /api/v1/admin/models`

### 3.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `vendor` | enum | 不过滤 | `vendor_a` / `vendor_b` |
| `media_type` | enum | 不过滤 | `image` / `video` / `audio` |
| `status` | enum | 不过滤 | `active` / `deprecated` / `unavailable` |
| `is_enabled` | bool | 不过滤 | `true` / `false` |
| `limit` | int 1-1000 | 200 | 单页数量 |
| `offset` | int ≥ 0 | 0 | 偏移 |

### 3.2 响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "model_id": "kling_3_0",
        "model_name": "Kling",
        "model_version": "3.0",
        "display_name": "Kling 3.0",
        "vendor": "vendor_a",
        "vendor_display_name": "腾讯云 VOD",
        "media_type": "image",
        "supported_features": ["text_to_image", "image_to_image"],
        "supported_resolutions": ["1024x1024", "1920x1080"],
        "supported_aspect_ratios": ["1:1", "16:9", "9:16"],
        "max_width": 4096,
        "max_height": 4096,
        "price_per_request": 0.15,
        "price_per_second": null,
        "price_multiplier": 1.00,
        "currency": "CNY",
        "price_tiers": null,
        "status": "active",
        "is_enabled": true,
        "created_at": "2026-06-15T14:00:00",
        "updated_at": "2026-06-15T14:00:00"
      }
    ],
    "total": 45,
    "limit": 200,
    "offset": 0,
    "filters": { "vendor": null, "media_type": null, "status": null, "is_enabled": null }
  }
}
```

### 3.3 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `INVALID_PARAM` | `vendor` / `media_type` / `status` 取值非法 |
| 401 | `TOKEN_*` | 鉴权失败 |
| 403 | `FORBIDDEN` | 非 admin |

---

## 4. 新增 `POST /api/v1/admin/models`

### 4.1 请求

```http
POST /api/v1/admin/models
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### 4.2 最小请求体（5 个必填字段）

```bash
curl -X POST http://localhost:8003/api/v1/admin/models \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "kling_3_0",
    "model_name": "Kling",
    "model_version": "3.0",
    "display_name": "Kling 3.0",
    "vendor": "vendor_a",
    "media_type": "image"
  }'
```

### 4.3 完整请求体（带全部定价 + 配置）

```bash
curl -X POST http://localhost:8003/api/v1/admin/models \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "kling_3_0",
    "model_name": "Kling",
    "model_version": "3.0",
    "display_name": "Kling 3.0 Pro",
    "vendor": "vendor_a",
    "vendor_display_name": "腾讯云",
    "media_type": "video",
    "supported_features": ["text_to_video", "image_to_video"],
    "supported_resolutions": ["720P", "1080P", "2K", "4K"],
    "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
    "max_width": 1920,
    "max_height": 1080,
    "min_width": 256,
    "min_height": 256,
    "max_duration": 10,
    "max_fps": 30,
    "price_per_second": 0.50,
    "price_multiplier": 1.20,
    "currency": "CNY",
    "price_tiers": {
      "720p":  0.30,
      "1080p": 0.50,
      "2K":    1.20,
      "4K":    2.40
    },
    "status": "active",
    "is_enabled": true,
    "availability_region": "ap-guangzhou",
    "description": "高质量视频生成模型",
    "tags": ["高清", "VIP"]
  }'
```

### 4.4 成功响应（HTTP 201）

返回完整模型行（含 `ai_model_configs` LEFT JOIN 字段，如果有）：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "id": 123,
    "model_id": "kling_3_0",
    "model_name": "Kling",
    "model_version": "3.0",
    "display_name": "Kling 3.0 Pro",
    "vendor": "vendor_a",
    "vendor_display_name": "腾讯云",
    "media_type": "video",
    "supported_features": ["text_to_video", "image_to_video"],
    "price_tiers": {"720p": 0.30, "1080p": 0.50, "2K": 1.20, "4K": 2.40},
    "status": "active",
    "is_enabled": true,
    "created_at": "2026-06-18T15:00:00",
    "updated_at": "2026-06-18T15:00:00"
  }
}
```

### 4.5 副作用

1. **changelog 自动写入**：一条 `change_type="created"` 记录
2. **token_switch_helper 缓存失效**：让前端下拉立即看到新模型
3. **upsert 语义**：如果 `model_id` 已存在，会**覆盖**已有记录（与 `sync-from-json` 的 `force=false` 不同——这里**永远覆盖**）

### 4.6 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `INVALID_PARAM` | `vendor` / `media_type` / `status` 取值非法 |
| 400 | `INVALID_PRICE_TIERS` | `price_tiers` 格式错（>32 键 / 键非字符串 / 值 < 0） |
| 401 | `TOKEN_*` | 鉴权失败 |
| 403 | `FORBIDDEN` | 非 admin |
| 500 | `DB_ERROR` | DB 异常 |

---

## 5. 详情 `GET /api/v1/admin/models/{model_id}`

返回与 POST 一致（同一份 `data` 字段），并 `LEFT JOIN ai_model_configs` 合并配置字段：

```json
{
  "data": {
    "id": 123,
    "model_id": "kling_3_0",
    "default_width": 1024,
    "default_height": 1024,
    "default_duration": 5,
    "default_cfg_scale": 7.5,
    "supports_negative_prompt": true,
    "supports_seed": true,
    "api_params": { "extra_param": "..." }
    /* ...其他 ai_models 字段 */
  }
}
```

### 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 404 | `MODEL_NOT_FOUND` | 不存在 |
| 401 | `TOKEN_*` | 鉴权失败 |
| 403 | `FORBIDDEN` | 非 admin |

---

## 6. 局部更新 `PATCH /api/v1/admin/models/{model_id}`

### 6.1 语义

- 只更新**显式传入**的字段（基于 Pydantic `model_dump(exclude_none=True)`）
- 自动 diff：实际有变化的字段才写 changelog
- 改价 / 启停 / 状态变化都自动让缓存失效

### 6.2 典型场景

#### 6.2.1 改价

```bash
curl -X PATCH http://localhost:8003/api/v1/admin/models/kling_3_0 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "price_per_second": 0.60,
    "price_multiplier": 1.0,
    "price_tiers": { "720p": 0.35, "1080p": 0.60, "2K": 1.40, "4K": 2.80 }
  }'
```

#### 6.2.2 清空 price_tiers（回退 price_per_second）

```bash
curl -X PATCH .../kling_3_0 -d '{"price_tiers": {}}'
# 空 dict 表示清空
# null 也清空
```

> 注：当前 DTO 中 `price_tiers: Optional[Dict]` 不区分 `{}` 与 `null`——两者都走"清空"路径。如要"保持不变"，**不传**这个字段。

#### 6.2.3 调整 metadata

```bash
curl -X PATCH .../kling_3_0 -d '{
  "display_name": "Kling 3.0 (New)",
  "tags": ["高清", "快速", "稳定"],
  "description": "2026-06 更新"
}'
```

### 6.3 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `INVALID_PARAM` | `status` 取值非法 |
| 400 | `INVALID_PRICE_TIERS` | `price_tiers` 格式错 |
| 400 | `NO_CHANGES` | 请求体为空 |
| 404 | `MODEL_NOT_FOUND` | 不存在 |

---

## 7. 启用 / 停用

### 7.1 `POST /api/v1/admin/models/{model_id}/enable`

幂等：已是 `is_enabled=true` 不会重复写 changelog。

### 7.2 `POST /api/v1/admin/models/{model_id}/disable`

幂等。

### 7.3 副作用

- 写一条 changelog（`change_type="enabled"` / `"disabled"`，含 `{"is_enabled": {"old": false, "new": true}}`）
- token_switch_helper 缓存失效 → 前端下拉立即过滤

### 7.4 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 404 | `MODEL_NOT_FOUND` | 不存在 |
| 503 | `DB_UNAVAILABLE` | DB 不可用 |

---

## 8. 用量统计 `GET /api/v1/admin/models/{model_id}/usage`

### 8.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `days` | int 1-365 | 30 | 聚合最近 N 天的小时级统计 |

### 8.2 响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "kling_3_0",
    "days": 30,
    "aggregate": {
      "total_requests": 1245,
      "successful_requests": 1200,
      "failed_requests": 45,
      "total_processing_time": 18234,
      "avg_processing_time": 14.65,
      "total_cost": 612.50
    },
    "hourly": [
      {
        "stat_date": "2026-06-15",
        "stat_hour": 14,
        "total_requests": 28,
        "successful_requests": 27,
        "failed_requests": 1,
        "total_processing_time": 412,
        "total_cost": 13.50
      }
    ]
  }
}
```

数据来源：`ai_model_usage_stats` 表（按日 × 小时聚合），由 `pricing_service` + 实际任务结果回填。

---

## 9. 变更历史 `GET /api/v1/admin/models/{model_id}/changelog`

### 9.1 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | int 1-500 | 50 | 单页数量 |

### 9.2 响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "kling_3_0",
    "items": [
      {
        "id": 17,
        "model_id": "kling_3_0",
        "change_type": "created",
        "change_description": "created via admin API",
        "changed_fields": { "model_id": "kling_3_0", "media_type": "image", /* ...所有创建时的字段 */ },
        "operator_id": "72cae811-611c-4691-8677-001bf2ba106c",
        "operator_name": "系统管理员",
        "created_at": "2026-06-18T15:00:00"
      },
      {
        "id": 18,
        "model_id": "kling_3_0",
        "change_type": "updated",
        "change_description": "updated 2 field(s) via admin API",
        "changed_fields": {
          "price_per_second": { "old": 0.50, "new": 0.60 },
          "price_multiplier": { "old": 1.00, "new": 1.20 }
        },
        "operator_id": "72cae811-...",
        "operator_name": "系统管理员",
        "created_at": "2026-06-18T15:30:00"
      }
    ],
    "total": 2
  }
}
```

### 9.3 字段含义

| 字段 | 说明 |
| --- | --- |
| `change_type` | `created` / `updated` / `enabled` / `disabled` / `deprecated` |
| `changed_fields` | **created**：全字段快照；**updated**：仅 diff（`{field: {old, new}}`） |
| `operator_id` | UUID（`system_admins.id`），与 `operator_name` 冗余 |
| `operator_name` | 冗余存储，用于人类阅读；即使 admin 被删除也能追溯 |

> 💡 **历史类型 bug 修复**：[`31_admin_models_changelog_fix.sql`](../../database/sql/schema/31_admin_models_changelog_fix.sql) 把 `operator_id` 从 `BIGINT` 改为 `UUID`——修复前 changelog 写入会被静默吞掉。

---

## 10. 批量灌库 `POST /api/v1/admin/models/sync-from-json`

### 10.1 用途

从 `data/tencent_models.json` + `data/token_switch_models.json` 把所有模型 upsert 进 `ai_models` 表。

### 10.2 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `force` | bool | `false` | `false` 保留人工配置；`true` 覆盖（JSON 优先） |

### 10.3 响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "summary": {
      "tencent": { "inserted": 5, "updated": 2, "skipped": 26, "errors": 0 },
      "token_switch": { "inserted": 0, "updated": 0, "skipped": 12, "errors": 0 }
    },
    "force": false,
    "items": []
  }
}
```

### 10.4 何时使用

| 场景 | force | 行为 |
| --- | --- | --- |
| 初次部署或新增数据源 | `false` | 只插入新模型，已有的人工配置**不被覆盖** |
| JSON 更新（价格变了） | `true` | 强制用 JSON 覆盖 |
| 升级到新厂商 SDK | `true` | 同步所有字段 |

### 10.5 错误

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 500 | `SEED_FAILED` | seeder 异常（JSON 文件不存在、字段不匹配） |

---

## 10a. 复制模型 `POST /api/v1/admin/models/{model_id}/clone`

### 10a.1 用途

把源模型（主表 + `ai_model_configs`）完整克隆为一个新的 `model_id`。

典型场景：

| 场景 | 用法 |
| --- | --- |
| **修改 model_id** | Token Switch 实际期望 `gp-im-2` 而库内存的是 `gpt-image-2`：先克隆出 `gp-im-2`，前端切流量，再软删旧模型 |
| **派生新模型** | 同 vendor / 同能力，但不同价格档或不同 `display_name` |
| **A/B 试验** | 同一源模型派生两份，一份改价做对照 |

### 10a.2 请求体

```json
{
  "new_model_id": "gp-im-2",
  "model_name": "gpt-image-2",
  "model_version": "2.0",
  "display_name": "GPT Image 2 (新渠道 ID)",
  "price_per_request": 0.10,
  "is_enabled": false
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `new_model_id` | string 1-100 | ✅ | 克隆后的新 model_id，**全局唯一**，不能与源 model_id 相同 |
| `model_name` | string ≤ 50 | – | 覆盖源模型名；不传则用源值 |
| `model_version` | string ≤ 20 | – | 覆盖版本；不传则用源值 |
| `display_name` | string ≤ 100 | – | 覆盖展示名；不传则用源值 |
| `vendor_display_name` | string | – | 覆盖厂商展示名 |
| `price_per_request` | float ≥ 0 | – | 覆盖按次价格 |
| `price_per_second` | float ≥ 0 | – | 覆盖按秒价格 |
| `price_multiplier` | float | – | 覆盖费用倍率 |
| `currency` | string | – | 覆盖币种 |
| `price_tiers` | dict | – | 覆盖分辨率分级定价 |
| `availability_region` | string | – | 覆盖可用区域 |
| `description` | string | – | 覆盖描述 |
| `tags` | list[string] | – | 覆盖标签 |
| `is_enabled` | bool | – | **新模型默认 `false`**；即使显式传 `true`，也需要再 `POST /{new_id}/enable` 写 changelog |

### 10a.3 复制与不复制的字段

| 类别 | 行为 |
| --- | --- |
| ✅ 复制 | `model_name` / `model_version` / `display_name` / `vendor` / `media_type` / `vendor_display_name` / `supported_features` / `supported_resolutions` / `supported_aspect_ratios` / `max_width` / `max_height` / `min_width` / `min_height` / `max_duration` / `max_fps` / `price_per_request` / `price_per_second` / `price_multiplier` / `currency` / `price_tiers` / `availability_region` / `description` / `tags` |
| ✅ 复制（config 表） | `default_width` / `default_height` / `default_steps` / `default_cfg_scale` / `default_sampler` / `default_duration` / `default_fps` / `default_motion_strength` / `supports_negative_prompt` / `supports_seed` / `supports_batch` / `max_batch_size` / `api_params` |
| ❌ 清空 | `avg_processing_time` / `success_rate`（性能指标属于历史，新模型无数据） |
| ❌ 不复制 | `usage_stats` / `reviews` / `changelog`（历史数据不应跨模型转移） |
| ⚠️ 强制值 | `status` 默认 `'deprecated'`、`is_enabled` 默认 `false`、`deleted_at` 默认 NULL |

### 10a.4 响应

成功 `201 Created`，body 与详情接口一致（含新模型的 `model_id` / `model_name` / ...）：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "gp-im-2",
    "model_name": "gpt-image-2",
    "model_version": "2.0",
    "display_name": "GPT Image 2 (新渠道 ID)",
    "vendor": "vendor_b",
    "media_type": "image",
    "status": "deprecated",
    "is_enabled": false,
    "price_per_request": 0.10,
    "..."
  }
}
```

### 10a.5 Changelog

克隆会在两端各写一条记录，方便审计迁移路径：

| 写入端 | `change_type` | 描述 |
| --- | --- | --- |
| 源模型 | `cloned_to` | `cloned to 'gp-im-2' via admin API`，`changed_fields.target_model_id = "gp-im-2"` |
| 新模型 | `cloned_from` | `cloned from 'gpt-image-2' via admin API`，`changed_fields.source_model_id = "gpt-image-2"` |

### 10a.6 错误码

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `INVALID_PARAM` | `new_model_id` 与源 `model_id` 相同 |
| 404 | `MODEL_NOT_FOUND` | 源 `model_id` 不存在 |
| 409 | `MODEL_EXISTS` | `new_model_id` 在库中已存在 |
| 503 | `DB_UNAVAILABLE` | 数据库不可用 |

### 10a.7 典型用法：迁移 model_id

```bash
# 1) 克隆出新的渠道 ID
curl -X POST http://localhost:8000/api/v1/admin/models/gpt-image-2/clone \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_model_id": "gp-im-2",
    "display_name": "GPT Image 2 (新渠道 ID)"
  }'
# → 201 + changelog: source=cloned_to, new=cloned_from

# 2) 启用新模型(此时前端可选到 gp-im-2)
curl -X POST http://localhost:8000/api/v1/admin/models/gp-im-2/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3) 软删旧模型(可随时 restore 找回)
curl -X DELETE http://localhost:8000/api/v1/admin/models/gpt-image-2 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 10b. 删除模型 `DELETE /api/v1/admin/models/{model_id}`

### 10b.1 软删 vs 硬删

| 模式 | 触发方式 | 数据保留 | 何时使用 |
| --- | --- | --- | --- |
| **软删**（默认） | `DELETE /.../{model_id}` | 全部保留：`deleted_at` 写时间戳 + `is_enabled=false` + `status='deprecated'`；`usage_stats` / `reviews` / `changelog` / `config` 全部不动 | **90% 场景**，可随时 `restore` 恢复 |
| **硬删** | `DELETE /.../{model_id}?force=true` | 物理 `DELETE FROM ai_models`；CASCADE 清掉 config / usage / reviews / changelog | 确认该模型**永不再用**且没有任务在跑 |

### 10b.2 查询参数

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `force` | bool | `false` | `true` 走硬删；`false` 软删 |

### 10b.3 软删响应（默认）

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "gpt-image-2",
    "delete_mode": "soft",
    "deleted": true,
    "already_deleted": false
  }
}
```

幂等性：对**已软删**的模型再次 DELETE，会返回 `already_deleted: true` 并带原 `deleted_at` 时间，不会重复写 changelog。

### 10b.4 硬删响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "model_id": "gpt-image-2",
    "delete_mode": "hard",
    "deleted": true
  }
}
```

### 10b.5 FK 约束警告（硬删）

`ai_models.model_id` 在以下表上有外键：

| 表 | ON DELETE | 行为 |
| --- | --- | --- |
| `ai_model_configs` | CASCADE | 跟着删 |
| `ai_model_usage_stats` | CASCADE | 跟着删 |
| `ai_model_reviews` | CASCADE | 跟着删 |
| `ai_model_changelog` | CASCADE | 跟着删 |
| `media_library` | SET NULL | 该行 `model_id` 置 NULL |
| `quota_transactions` | SET NULL | 该行 `related_model_id` 置 NULL |
| `api_call_logs` | SET NULL | 同上 |
| `video_generation_tasks` | SET NULL | 该行 `model_id` 置 NULL |
| **`generation_tasks`** | **RESTRICT** | **只要还有任务在用，硬删就会失败** |

硬删失败时返回 `409 FOREIGN_KEY_BLOCKED`：

```json
{
  "code": "FOREIGN_KEY_BLOCKED",
  "message": "硬删除失败,被外键约束阻止 (可能存在 generation_tasks 引用,请先迁移/删除这些任务): <psycopg2 原始错误>"
}
```

### 10b.6 Changelog

| 模式 | `change_type` | `changed_fields` |
| --- | --- | --- |
| 软删 | `soft_deleted` | `is_enabled: {old, false}` / `status: {old, 'deprecated'}` |
| 硬删 | `hard_deleted` | `force: true` |
| 已软删再删 | – | 不写 changelog（幂等） |

### 10b.7 错误码

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 404 | `MODEL_NOT_FOUND` | `model_id` 不存在 |
| 409 | `FOREIGN_KEY_BLOCKED` | 硬删时被 `generation_tasks` 外键约束阻止 |
| 503 | `DB_UNAVAILABLE` | 数据库不可用 |

---

## 10c. 恢复软删模型 `POST /api/v1/admin/models/{model_id}/restore`

### 10c.1 用途

把软删的模型重新启用。等价于"反软删"——清空 `deleted_at`、`is_enabled=true`。

> 想把模型**永久**从数据库移除，请用 `DELETE /.../{model_id}?force=true`（见 §10b）。`restore` 不会清掉 usage / reviews / changelog，**只能**回滚"软删"。

### 10c.2 响应

成功 `200 OK`，body 与详情接口一致（含恢复后的模型完整数据）。

### 10c.3 Changelog

| `change_type` | `changed_fields` |
| --- | --- |
| `restored` | `deleted_at: {old: <上次软删时间>, new: null}` |

### 10c.4 错误码

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `NOT_DELETED` | 模型当前 `deleted_at IS NULL`，无需恢复 |
| 404 | `MODEL_NOT_FOUND` | `model_id` 不存在 |
| 503 | `DB_UNAVAILABLE` | 数据库不可用 |

### 10c.5 典型用法：误删找回

```bash
# 1) 误操作软删
curl -X DELETE .../api/v1/admin/models/kling_3_0
# → soft_deleted

# 2) 立刻恢复
curl -X POST .../api/v1/admin/models/kling_3_0/restore
# → restored, is_enabled=true

# 3) 看 changelog 确认
curl .../api/v1/admin/models/kling_3_0/changelog
# → soft_deleted (10:00) → restored (10:05)
```

### 10c.6 列表中的"回收站"视图

`GET /api/v1/admin/models?include_deleted=true` 会同时返回**所有**模型（含软删），软删的行 `deleted_at` 字段非空；前端可以用 `deleted_at` 字段区分活跃模型和回收站。

---

## 11. 状态机

```
                            enable
              ┌───────────────────────────┐
              │                           ▼
        ┌─────┴────┐  disable   ┌──────────────┐
        │  active  │ ◀───────  │   disabled   │
        └─────┬────┘            └──────────────┘
              │                           ▲
              │ deprecated                │ deprecated
              ▼                           │
        ┌──────────────┐                  │
        │  deprecated  │ ─────────────────┘
        └──────┬───────┘
               │ unavailable
               ▼
        ┌──────────────┐
        │ unavailable  │  (手动恢复 active 由 admin PATCH 改回)
        └──────────────┘
```

- `is_enabled` 与 `status` 是**正交**的：
  - `status="active" + is_enabled=true` → 正常展示
  - `status="active" + is_enabled=false` → 前端下拉过滤，但数据完整
  - `status="deprecated"` → 列表默认过滤
  - `status="unavailable"` → 服务层拒绝调用（待实现）

---

## 12. 与只读 API 的关系

| 端点 | 用户 | 鉴权 | 文档 |
| --- | --- | --- | --- |
| `/api/v1/models` | 任意 | 任意已登录 | [`FRONTEND_API_V3.md`](FRONTEND_API_V3.md) |
| `/api/v1/models/{model_id}` | 任意 | 任意已登录 | 同上 |
| `/api/v1/estimate-price` | 任意 | 任意已登录 | 同上 |
| `/api/v1/admin/models/*` | admin | admin only | **本文档** |

**使用建议**：前端只读用 `/api/v1/models`；运营后台（管理员）用 `/api/v1/admin/models/*`。

---

## 13. 完整生命周期示例

### 13.1 基础生命周期

```bash
# 1) 新增
curl -X POST .../api/v1/admin/models \
  -d '{"model_id": "kling_3_0", "model_name": "Kling", "model_version": "3.0",
       "display_name": "Kling 3.0", "vendor": "vendor_a", "media_type": "image"}'
# → 201 + changelog: created

# 2) 改价
curl -X PATCH .../api/v1/admin/models/kling_3_0 \
  -d '{"price_per_request": 0.20, "price_tiers": {"1024x1024": 0.20}}'
# → 200 + changelog: updated (diff)

# 3) 临时下架
curl -X POST .../api/v1/admin/models/kling_3_0/disable
# → 200 + changelog: disabled

# 4) 重新上架
curl -X POST .../api/v1/admin/models/kling_3_0/enable
# → 200 + changelog: enabled

# 5) 看用量
curl .../api/v1/admin/models/kling_3_0/usage?days=7

# 6) 看完整变更历史
curl .../api/v1/admin/models/kling_3_0/changelog
# → 4 条记录,按 created_at DESC

# 7) 下线
curl -X PATCH .../api/v1/admin/models/kling_3_0 \
  -d '{"status": "deprecated"}'
```

### 13.2 迁移 model_id（clone + delete）

```bash
# 场景: Token Switch 实际期望 gp-im-2, 库内是 gpt-image-2

# 1) 克隆出新 ID
curl -X POST .../api/v1/admin/models/gpt-image-2/clone \
  -d '{"new_model_id": "gp-im-2", "display_name": "GPT Image 2 (新渠道)"}'
# → 201; src changelog: cloned_to; new changelog: cloned_from

# 2) 启用新模型(让前端可选)
curl -X POST .../api/v1/admin/models/gp-im-2/enable

# 3) 软删旧模型(保留可恢复)
curl -X DELETE .../api/v1/admin/models/gpt-image-2
# → soft_deleted

# 4) 观察 1 周后,确认旧模型无流量,再硬删
curl .../api/v1/admin/models?include_deleted=true
curl -X DELETE ".../api/v1/admin/models/gpt-image-2?force=true"
# → 若 generation_tasks 仍有引用则报 409 FOREIGN_KEY_BLOCKED
```

### 13.3 误删恢复

```bash
# 误软删
curl -X DELETE .../api/v1/admin/models/kling_3_0

# 5 分钟后发现是误操作
curl -X POST .../api/v1/admin/models/kling_3_0/restore
# → restored, 业务无感知
```

---

## 14. 数据库触发器与约束

迁移脚本：[`31_admin_models_changelog_fix.sql`](../../database/sql/schema/31_admin_models_changelog_fix.sql)

- `ai_model_changelog.operator_id` 字段类型：`UUID`（与 `system_admins.id` 对齐；修复前是 `BIGINT` 导致写入失败）
- `ai_models` 表的 `updated_at` 由触发器自动维护（`update_updated_at_column`）
- 软删除：`ai_models.deleted_at` 非空视为已删除（[19_ai_models.sql:63](database/sql/schema/19_ai_models.sql#L63)）— 已通过 `DELETE /api/v1/admin/models/{model_id}`（默认软删）和 `POST .../restore` 暴露；详见 §11

---

## 15. 测试覆盖

冒烟测试覆盖（13 个用例）：
- 4 个鉴权边界（无 token / 假 token / 非 admin / 非法 vendor）
- 最小字段创建 + 全字段创建
- 列表过滤 / 详情
- 完整流程：create → patch → disable → enable（4 条 changelog，全部带有效 UUID）
- **clone** 流程：克隆 → 启用新 → 软删旧 → restore 旧（验证 changelog 双向记录、is_enabled 默认 false、配置行被复制）
- **delete** 软/硬删：软删幂等、硬删 FK 阻止 409、未软删的 restore 返回 400
- **list 回收站视图**：`?include_deleted=true` 能看到软删的行，`?include_deleted=false` 隐藏

---

## 16. 范围之外（未实现）

- 批量定价（按 vendor 一次性改 N 个模型）— 当前只能逐个 PATCH
- 模型评价 / 评分（`ai_model_reviews` 表已建但未暴露 API）— 阶段 2
- 实时调用（带 model_id → vendor 路由的 ping 测试）— 阶段 2
- 多语言 display_name — 当前只支持中文
- 灰度发布（按企业白名单分批开放）— 阶段 2

如需扩展，请基于 [`app/api/admin/models.py`](../../app/api/admin/models.py) + [`database/dao/ai_model_dao.py`](../../database/dao/ai_model_dao.py) 继续迭代。