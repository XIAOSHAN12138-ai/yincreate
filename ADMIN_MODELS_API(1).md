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

> ## 📌 PR-4.10（2026-08-14）：`resolution_variants` 分辨率变体映射
>
> 新增可选字段 `resolution_variants: dict[str, list[str]]`，用于给**同一分辨率**配置多个候选上游私有 ID（vendor 路由时按顺序回退）。
>
> - **存储位置**：持久化到现有 `ai_models.api_params` JSONB 的 `resolution_variants` 键下，**未改 DB schema**
> - **接口形态**：在 `CreateModelRequest` / `UpdateModelRequest` / `CloneModelRequest` 顶层独立接收，同时在 `GET` 响应顶层独立返回
> - **数据语义**：`null` = 不更新 / 不设置；`{}` = 清空；非空 dict = 设置该映射
> - **典型用途**：单分辨率多上游 fallback，例如 `{"720P": ["happyhorse-1.0-i2v-720p", "alt-720p-fallback"]}`
>
> 详见 §2.5 与 §4-§6 示例。

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
| `model_id` | string 1-100 | UNIQUE | 业务标识, 例如 `kling_3_0` / `happyhorse_1_0` |
| `business_model_id` | string 1-64 | UNIQUE NOT NULL | **PR-4.6 必填, 前端输入** — 稳定业务 ID = `model_name + version`, 例如 `happyhorse_1_0` / `doubao_seedance_2_0_260128`。前端永远见, 永不变 |
| **`upstream_id_by_resolution`** | **Dict[str, str]** | **NOT NULL DEFAULT `{}`** | **🆕 PR-4.6 必填** — **上游私有 ID 路由表** (分辨率/尺寸键 → 上游 ID 值)。多分辨率 happyhorse: `{"720P": "happyhorse-1.0-i2v-720p", "1080P": "happyhorse-1.0-i2v-1080p"}`;单上游 gpt-image-2: `{"all": "gpt-image-2"}`。一行 = 一个模型, 上游 ID 全在这张路由表里 |
| `model_name` | string 1-50 | - | 模型短名 (不含版本), 例如 `HappyHorse` / `Gemini` |
| `model_version` | string 1-20 | - | 版本号, 例如 `1.0` / `2.5` / `260128` |
| `display_name` | string 1-100 | - | 模型级展示名 (不含分辨率), 例如 `HappyHorse 1.0` |
| `vendor` | enum | `vendor_a` / `vendor_b` | 厂商标识 (与 `app/vendors/` 一致) |
| `media_type` | enum | `image` / `video` / `audio` | 模型类型 |
| **`price_tiers`** | **Dict[str, float]** | **NOT NULL DEFAULT `{}`** | **🆕 PR-4.6 必填** — 按清晰度/分辨率定价 JSONB。键=分辨率字符串 (图: `'1024x1024'`; 视频: `'720P'`/`'1080P'`), 值=单价 (图: 元/张; 视频: 元/秒)。特殊键 `'default'` 作兜底。`price_per_request`/`price_per_second` 单值字段已删除 |

### 2.2 可选字段

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `vendor_display_name` | string 1-100 | NULL | 厂商展示名（"腾讯云 VOD"） |
| **`upstream_model_id`** | **string 1-100 NULL** | **NULL** | **🆕 PR-4.6 降为可空** — 上游私有 ID 兜底 (单上游场景, 多分辨率场景请走 `upstream_id_by_resolution`) |
| **`endpoint`** | **string 1-100** | **NULL** | **🆕 PR-4.6** — 上游路由模板 (同模型不同分辨率共用), 例如 `openai_videos:/v1/videos` / `gemini:/v1beta/models/{model}:generateContent` |
| **`endpoint_2`** | **string 1-100** | **NULL** | **🆕 PR-4.6** — 备用路由 (chat completions 兜底等), 例如 `openai-images-generations:/v1/images/generations` |
| `generation_type` | string 1-50 | `text_to_image` | `text_to_image` / `image_to_image` / `image_edit` / `text_to_video` / `image_to_video` / `video_edit` / `reference_to_video` / `text_to_audio` / `image_to_audio` / `audio_to_video` ... |
| `supported_features` | list[string] | NULL | `["text_to_video", "image_to_video", ...]` |
| `supported_resolutions` | list[string] | NULL | **模型级**支持的分辨率, 前端下拉用, 例如 `["720P", "1080P"]` |
| `supported_aspect_ratios` | list[string] | NULL | `["16:9", "9:16", "1:1"]` |
| `supported_durations` | list[int] | NULL | 视频时长(秒), 如 `[5, 10]`。视频模型必填 |
| `supported_sizes` | list[string] | NULL | OpenAI style 尺寸, 如 `["1024x1024", "1024x1536"]` |
| `max_width` / `min_width` | int 256-4096 | max=4096, min=256 | 像素限制 |
| `max_height` / `min_height` | int 256-4096 | max=4096, min=256 | 像素限制 |
| `max_duration` | int 1-N | NULL | 视频最大时长（秒） |
| `max_fps` | int 1-60 | NULL | 最大帧率 |
| `max_reference_images` | int ≥ 0 | NULL | 最大参考图片数 (Seedance 等多参考模型) |
| `max_reference_videos` | int ≥ 0 | NULL | 最大参考视频数 |
| `max_reference_audios` | int ≥ 0 | NULL | 最大参考音频数 |
| `requires_input` | bool | NULL | 是否需要输入素材 (image_edit / video_edit 等需要, text_to_* 不需要)。null = 由 generation_type 自动推算 |
| `input_materials` | dict[str, int] | NULL | 素材配额, 如 `{"image": 3, "video": 1, "audio": 0}`; 0 表示不支持 |
| ~~`price_per_request`~~ | ~~float ≥ 0~~ | ~~NULL~~ | **🆕 PR-4.6 已删除** — 价格只走 `price_tiers`, 不再有"按次"单值字段 |
| ~~`price_per_second`~~ | ~~float ≥ 0~~ | ~~NULL~~ | **🆕 PR-4.6 已删除** — 价格只走 `price_tiers`, 不再有"按秒"单值字段 |
| `price_multiplier` | float | 1.00 | 费用倍率 (运营调价用) |
| `currency` | string | `CNY` | 货币单位 |
| `status` | enum | `active` | `active` / `deprecated` / `unavailable` |
| `is_enabled` | bool | `true` | 总开关；`false` 时模型从前端下拉中消失 |
| `availability_region` | string | NULL | 例如 `ap-guangzhou` |
| `supports_audio` | bool | `false` | 是否支持音频生成 (有声/无声切换)。仅 video 模型有意义 |
| `description` | text | NULL | 后台自由文本 |
| `tags` | list[string] | NULL | 例如 `["高清", "快速"]` |

### 2.3 `price_tiers` 格式（PR-4.11 二维：分辨率 × 音频模式）

> 🆕 PR-4.11 把 `price_tiers` 从一维 dict 升级为二维 dict，支持**分辨率 × 音频模式**双维度定价。
>
> **video 媒体类型强制二维**（每个分辨率档必须显式列 `silent` 与 `with_audio`）；**image / audio 媒体类型仍允许一维**（size → price，向后兼容）。

#### 2.3.1 Video 模型（二维，必填 silent + with_audio）

```json
{
  "720P":  { "silent": 0.30, "with_audio": 0.45 },
  "1080P": { "silent": 0.50, "with_audio": 0.75 },
  "2K":    { "silent": 1.20, "with_audio": 1.50 },
  "4K":    { "silent": 2.40, "with_audio": 3.00 },
  "default": { "silent": 0.30, "with_audio": 0.45 }
}
```

| 维度 | 键类型 | 说明 |
| --- | --- | --- |
| 一级键（分辨率） | `string` | 视频分辨率字符串，如 `'720P'` / `'1080P'` / `'2K'` / `'4K'` |
| 二级键（音频模式） | `silent` / `with_audio` | 仅两态，不允许 `with_music` 等其他命名 |
| 一级键 `default` | `dict` (二维) | 兜底档，建议覆盖所有 `supported_resolutions` |

**校验规则**（缺一即 400 `INVALID_PRICE_TIERS`）：
- 每个 resolution 必须同时含 `silent` 与 `with_audio` 两个键
- 不允许任何额外键（`with_music`、`silent_video` 等历史命名都不接受）
- 值必须为非负数字
- 至多 32 个一级键

**查找优先级**（`compute_price` 二维走查）：
1. `tiers[resolution][audio_mode]` ← 精确命中
2. `tiers[resolution]['silent']` ← resolution 命中但 mode 缺（**唯一**隐式回退）
3. `tiers['default'][audio_mode]` ← resolution 兜底
4. `tiers['default']['silent']` ← 双兜底

#### 2.3.2 Image / Audio 模型（一维，向后兼容）

```json
{
  "1024x1024": 0.10,
  "2048x2048": 0.20,
  "default": 0.10
}
```

- 键 = 输出尺寸字符串（OpenAI style `'1024x1024'` / `'2048x2048'`）
- 值 = 单价（元/张）
- 不涉及音频维度，仍是一维结构

#### 2.3.3 价格计算

最终单价 = `price_tiers[res][mode] * price_multiplier`
- image: `cost = unit_price * price_multiplier`（按次）
- video: `cost = unit_price * duration_seconds * price_multiplier`（按时长）
- audio: `cost = unit_price * price_multiplier`（按次）

实际定价计算走 [`app/services/pricing_service.py`](../../app/services/pricing_service.py) 的 `compute_price()`。

#### 2.3.4 数据迁移

- 49 SQL（`49_ai_models_price_tiers_2d.sql`）把存量 video 模型的扁平 dict 转二维：`with_audio = silent × 1.5` 起步，运营可手动 PATCH 微调
- 49 SQL 已幂等，可重复运行
- 旧扁平结构在 `_resolve_tier_price_2d` 里有逃生口（一维 number → silent 兜底），49 SQL 没跑时不会全挂，但 audio 不区分

### 2.4 `supports_audio` 音频能力声明

仅 `media_type=video` 的模型需要设置该字段。

| 值 | 含义 | 前端行为 | 后端行为 |
| --- | --- | --- | --- |
| `true` | 模型支持生成有声/无声视频 | 显示"声音"开关 | `audio_generation=true` 透传到上游 |
| `false` | 模型只生成无声视频 | 隐藏"声音"开关 / 强制 false | `audio_generation=true` 直接返回 **400 INVALID_PARAM** |

**示例：给 doubao-seedance-2-0-fast 开启音频支持**

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/models/doubao-seedance-2-0-fast \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"supports_audio": true}'
```

**后端音频校验**（`app/services/frontend_service.py:_validate_audio_capability`）：

```python
# 用户开启 audio 但模型不支持 → 拒绝
if audio_generation=true and model.supports_audio=false:
    raise ValueError("模型 'kling_1.6' 不支持音频生成...")
    # 上层捕获后转成 HTTP 400 INVALID_PARAM
```

**前端集成**：

```js
// /api/v1/models 返回的每个模型条目都带 supports_audio 字段
const supportsAudio = model.supports_audio === true
if (supportsAudio) {
  // 显示"声音"开关
} else {
  // 隐藏开关,或者展示并禁用
}
```

**`POST /api/v1/admin/models/sync-from-json` 自动回填**：

执行 `sync-from-json` 时，`ai_model_seeder` 会从 token_switch JSON 的 `supported_features` 数组里检查是否含 `"with_audio"`，自动设置 `supports_audio`。对于 seedance 这类已在 JSON 里标记的模型，无需手动 PATCH。

**回填 SQL**（一次性，给已存在的 ai_models 行补 supports_audio）：

```sql
UPDATE ai_models
   SET supports_audio = TRUE
 WHERE supported_features IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(supported_features) AS elem
        WHERE elem = 'with_audio'
   );
```

完整 migration 见 [`database/sql/schema/33_ai_models_supports_audio.sql`](../../database/sql/schema/33_ai_models_supports_audio.sql)。

### 2.5 `resolution_variants` 分辨率变体映射（PR-4.10）

> **新增**：单分辨率多上游私有 ID 候选列表。`dict[str, list[str]]`，
> 键 = 分辨率/尺寸字符串（图：`'1024x1024'`；视频：`'720P'`/`'1080P'`），
> 值 = 该分辨率下的上游私有 ID 候选列表（**vendor 路由时按列表顺序回退**）。

**为什么需要**：单分辨率模型有时候会有多个上游私有 ID 等价实现（例如主供应商 ID + 备用 fallback ID），调度层需要按顺序尝试。`upstream_id_by_resolution` 只能存 1:1 映射，而 `resolution_variants` 是 1:N 的扩展。

**字段位置**：

- 请求体顶层独立字段：`CreateModelRequest.resolution_variants` / `UpdateModelRequest.resolution_variants` / `CloneModelRequest.resolution_variants`
- 响应体顶层独立字段：`_row_to_response_dict` 会把 `api_params.resolution_variants` 提到顶层，前端读取方便
- 存储位置：`ai_models.api_params` JSONB 的 `resolution_variants` 子键（**无新 DB 列**）

**字段语义（统一）**：

| 请求值 | 含义 | 副作用 |
| --- | --- | --- |
| `null`（字段未提供或显式 null） | 不动现有值 | 无 |
| `{}` | 清空（删除 api_params.resolution_variants 键） | 该模型不再有变体映射 |
| `{"720P": ["a", "b"]}` | 设置该映射 | api_params.resolution_variants = `{...}` |

**校验规则**（DAO 内部静默丢弃非法项，不报错）：

- 键必须为非空字符串
- 值必须为 list；list 元素全部转 str；None 元素丢弃
- 非 dict / 非 list 的整体值 → 当作空处理

**示例：给 happyhorse_1_0 设置 720P 双候选**

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/models/happyhorse_1_0 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution_variants": {
      "720P": ["happyhorse-1.0-i2v-720p", "happyhorse-alt-720p"],
      "1080P": ["happyhorse-1.0-i2v-1080p"]
    }
  }'
```

**示例：清空**

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/models/happyhorse_1_0 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution_variants": {}}'
```

**响应示例**（GET 详情 / PATCH 后返回）：

```json
{
  "model_id": "happyhorse_1_0",
  "api_params": {
    "endpoint": "openai_videos:/v1/videos",
    "resolution_variants": {
      "720P": ["happyhorse-1.0-i2v-720p", "happyhorse-alt-720p"],
      "1080P": ["happyhorse-1.0-i2v-1080p"]
    }
  },
  "resolution_variants": {
    "720P": ["happyhorse-1.0-i2v-720p", "happyhorse-alt-720p"],
    "1080P": ["happyhorse-1.0-i2v-1080p"]
  },
  ...
}
```

> `resolution_variants` 同时在 `api_params` 子键和顶层出现，便于不同调用方读取。

**Clone 行为**（`POST /api/v1/admin/models/{model_id}/clone`）：

- 源模型 `api_params.resolution_variants` 自动复制到新模型
- `CloneModelRequest.resolution_variants` 可覆盖；不传 = 用源值；`{}` = 清空；`{...}` = 设置

**Changelog diff**（PR-4.10）：当 PATCH 改 `resolution_variants`，会在 `ai_model_changelog.changed_fields` 里写一条 `{"resolution_variants": {"old": {...}, "new": {...}}}`，方便审计与回滚。

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

### 4.2 最小请求体（PR-4.6 必填字段, 多分辨率 happyhorse 例子）

> PR-4.6 后, **`business_model_id` + `upstream_id_by_resolution` + `price_tiers`** 是核心三必填。
> - `business_model_id` = `model_name + version`, **前端输入** (e.g. `happyhorse_1_0`)
> - `upstream_id_by_resolution` 是路由表, key=分辨率, value=上游私有 ID
> - `price_tiers` 是定价表, key=分辨率, value=单价

```bash
curl -X POST http://localhost:8003/api/v1/admin/models \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "happyhorse_1_0",
    "business_model_id": "happyhorse_1_0",
    "model_name": "HappyHorse",
    "model_version": "1.0",
    "display_name": "HappyHorse 1.0",
    "vendor": "vendor_b",
    "media_type": "video",
    "upstream_id_by_resolution": {
      "720P":  "happyhorse-1.0-i2v-720p",
      "1080P": "happyhorse-1.0-i2v-1080p"
    },
    "price_tiers": {
      "720P":  0.30,
      "1080P": 0.50,
      "default": 0.30
    }
  }'
```

> 单上游场景例子 (gpt-image-2):
> ```json
> {
>   "model_id": "gpt_image_2",
>   "business_model_id": "gpt_image_2",
>   "model_name": "gpt-image-2",
>   "model_version": "2.0",
>   "display_name": "GPT Image 2",
>   "vendor": "vendor_b",
>   "media_type": "image",
>   "upstream_id_by_resolution": {
>     "all": "gpt-image-2"
>   },
>   "price_tiers": {
>     "1024x1024": 0.20,
>     "512x512":   0.10,
>     "default":   0.20
>   }
> }
> ```

### 4.3 完整请求体 (PR-4.6 happyhorse 1.0 多分辨率例子)

```bash
curl -X POST http://localhost:8003/api/v1/admin/models \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "happyhorse_1_0",
    "business_model_id": "happyhorse_1_0",
    "model_name": "HappyHorse",
    "model_version": "1.0",
    "display_name": "HappyHorse 1.0",
    "vendor": "vendor_b",
    "vendor_display_name": "Token Switch",
    "media_type": "video",
    "generation_type": "image_to_video",
    "endpoint": "openai_videos:/v1/videos",
    "endpoint_2": null,
    "supported_features": ["image_to_video", "text_to_video"],
    "supported_resolutions": ["720P", "1080P"],
    "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
    "supported_durations": [5, 10],
    "max_duration": 10,
    "max_fps": 30,
    "upstream_id_by_resolution": {
      "720P":  "happyhorse-1.0-i2v-720p",
      "1080P": "happyhorse-1.0-i2v-1080p"
    },
    "price_tiers": {
      "720P":  0.30,
      "1080P": 0.50,
      "default": 0.30
    },
    "price_multiplier": 1.20,
    "currency": "CNY",
    "max_reference_images": 1,
    "requires_input": true,
    "input_materials": {"image": 1, "video": 0, "audio": 0},
    "supports_audio": false,
    "status": "active",
    "is_enabled": true,
    "description": "HappyHorse 1.0 多分辨率视频生成 (720P/1080P)",
    "tags": ["多分辨率", "VIP"]
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

### 6.2 可更新字段

| 字段 | 可 PATCH | 备注 |
| --- | --- | --- |
| `business_model_id` | ⚠️ 仅走专用函数 | 标识列, 改完会破坏所有 FK 引用; 走专用迁移路径 (见 §6.2.4) |
| `upstream_model_id` | ✅ | PR-4.5/4.6 加; 降级为可选兜底列 |
| **`upstream_id_by_resolution`** | **✅** | **🆕 PR-4.6** — 整张路由表 PATCH; 传 `{}` 或 `null` 表示不动现有表 |
| **`endpoint`** | **✅** | **🆕 PR-4.6** — 上游路由模板 PATCH |
| **`endpoint_2`** | **✅** | **🆕 PR-4.6** — 备用路由 PATCH; 显式传空字符串 `""` 清空 |
| `generation_type` | ✅ | PR-4.5 加 |
| `supported_durations` | ✅ | PR-4.5 加 |
| `supported_sizes` | ✅ | PR-4.5 加 |
| `max_reference_images` / `videos` / `audios` | ✅ | PR-4.5 加 |
| `requires_input` | ✅ | PR-4.5 加 |
| `input_materials` | ✅ | PR-4.5 加 (JSONB) |
| `model_name` / `model_version` / `display_name` | ✅ | 普通字段 |
| 定价字段 | ✅ | `price_multiplier` / `currency` / `price_tiers` |
| ~~`price_per_request`~~ | ~~❌ 已删除~~ | **🆕 PR-4.6** — 不再可改 |
| ~~`price_per_second`~~ | ~~❌ 已删除~~ | **🆕 PR-4.6** — 不再可改 |
| 启停字段 | ✅ | `status` / `is_enabled` / `availability_region` |
| 能力字段 | ✅ | `supported_features` / `supported_resolutions` / `supported_aspect_ratios` |
| 限制字段 | ✅ | `max_width` / `max_height` / `min_width` / `min_height` / `max_duration` / `max_fps` |
| 描述字段 | ✅ | `description` / `tags` / `vendor_display_name` |
| `vendor` / `media_type` / `model_id` | ❌ | 标识列, 不可改; 想改请用 §10a clone |

### 6.3 典型场景

#### 6.3.1 改价

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

#### 6.3.2 清空 price_tiers

```bash
curl -X PATCH .../kling_3_0 -d '{"price_tiers": {}}'
# 空 dict 表示清空 (模型将无法定价, 仅用于临时下架)
# null 也清空
```

> 注：当前 DTO 中 `price_tiers: Optional[Dict]` 不区分 `{}` 与 `null`——两者都走"清空"路径。如要"保持不变"，**不传**这个字段。
>
> PR-4.6 后清空不再回退到 `price_per_request` / `price_per_second` (已删除), 而是真的没定价。

#### 6.3.3 调整 metadata

```bash
curl -X PATCH .../kling_3_0 -d '{
  "display_name": "Kling 3.0 (New)",
  "tags": ["高清", "快速", "稳定"],
  "description": "2026-06 更新"
}'
```

#### 6.3.4 PR-4.6 新字段更新示例

```bash
# 🆕 改上游 ID 路由表 (整张替换, 加新分辨率)
curl -X PATCH .../happyhorse_1_0 -d '{
  "upstream_id_by_resolution": {
    "720P":  "happyhorse-1.0-i2v-720p",
    "1080P": "happyhorse-1.0-i2v-1080p",
    "4K":    "happyhorse-1.0-i2v-4k"
  }
}'

# 🆕 改上游路由模板 (上游 API 路径变了)
curl -X PATCH .../happyhorse_1_0 -d '{
  "endpoint": "openai_videos:/v2/videos",
  "endpoint_2": "openai-images-generations:/v1/images/generations"
}'

# 🆕 改价格分段 (调整 1080P 单价)
curl -X PATCH .../happyhorse_1_0 -d '{
  "price_tiers": {
    "720P":  0.30,
    "1080P": 0.55,
    "default": 0.30
  },
  "price_multiplier": 1.10
}'

# 🆕 单上游模型 (gpt-image-2) 改兜底上游 ID
curl -X PATCH .../gpt_image_2 -d '{
  "upstream_id_by_resolution": {
    "all": "gpt-image-2.1"
  }
}'

# 旧 PR-4.5 字段 (仍可用)
# 调整 video 时长支持范围 + 启用多参考
curl -X PATCH .../doubao_seedance_2_0_260128 -d '{
  "supported_durations": [5, 10, 15],
  "max_reference_images": 5,
  "max_reference_videos": 2,
  "requires_input": true,
  "input_materials": {"image": 5, "video": 2, "audio": 0}
}'

# 调整 image 模型支持的尺寸
curl -X PATCH .../gpt_image_2 -d '{
  "supported_sizes": ["1024x1024", "1024x1536", "1536x1024", "auto"]
}'

# 切换 generation_type (image_to_image → image_edit)
curl -X PATCH .../kling_image_2 -d '{
  "generation_type": "image_edit"
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